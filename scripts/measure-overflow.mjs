// Horizontal-overflow measurement report (fix/horizontal-overflow-375-768).
//
// WHAT THIS IS: a reporting tool, not a gate. e2e/no-horizontal-overflow.spec.ts
// is the CI-blocking pass/fail check (documentElement/body.scrollWidth <=
// innerWidth, plus the window.scrollTo(10000, 0) real-scroll confirmation) —
// this script exists alongside it to produce the actual numbers (scrollWidth
// vs. clientWidth per route per width) as a committable artifact, so a PR can
// show a before/after table rather than just a pass/fail line. Follows this
// repo's existing scripts/lighthouse.mjs and scripts/search/measure-cold-start
// .mjs convention: a standalone Playwright-driven Node script under scripts/,
// run manually, writing to reports/.
//
// WHY clientWidth rather than window.innerWidth here (the e2e spec's own
// signal): clientWidth excludes the scrollbar-occupied width where a browser
// reserves one, which is what actually bounds visible layout — innerWidth is
// the right check for "did the viewport itself move" (the spec's
// window.scrollTo probe), clientWidth is the right one for "does content fit
// the box a route's own layout has to work with." Reported together with
// scrollWidth so a reader can see both.
//
// Run: node scripts/measure-overflow.mjs
//   BASE_URL            single target, default http://localhost:3000
//   TARGETS_JSON         multiple targets in one report, e.g.:
//                         '[{"label":"before (production)","baseUrl":"https://gaurav-gandhi.vercel.app"},
//                           {"label":"after (fix/horizontal-overflow-375-768)","baseUrl":"http://localhost:3100"}]'
//   REPORTS_DIR_OVERRIDE  default reports/overflow

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORTS_DIR = process.env.REPORTS_DIR_OVERRIDE ?? join(ROOT, "reports", "overflow");
const WIDTHS = [375, 768, 1440];
const HEIGHT = 900;
// Same rationale as e2e/no-horizontal-overflow.spec.ts's document.fonts.ready
// wait: a component that re-measures its own geometry once web fonts finish
// swapping in hasn't necessarily run yet at page-load. The extra 500ms is
// this script's own margin on top of that for any post-fonts layout settle
// (e.g. a ResizeObserver-driven re-clamp) — the e2e spec doesn't need it
// because Playwright's auto-waiting on later assertions covers it there;
// this script takes a single measurement, so it waits explicitly instead.
const SETTLE_MS = 500;

const DEFAULT_TARGETS = [{ label: "local", baseUrl: process.env.BASE_URL ?? "http://localhost:3000" }];
const TARGETS = process.env.TARGETS_JSON ? JSON.parse(process.env.TARGETS_JSON) : DEFAULT_TARGETS;

/** Fetches a target's own built /sitemap.xml and returns each entry's path (never a hardcoded route list). */
async function fetchSitemapRoutes(baseUrl) {
  const url = new URL("/sitemap.xml", baseUrl).href;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`sitemap.xml fetch failed for ${url}: HTTP ${res.status}`);
  }
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (locs.length === 0) {
    throw new Error(`sitemap.xml at ${url} contained zero <loc> entries`);
  }
  return [...new Set(locs.map((loc) => new URL(loc).pathname || "/"))];
}

async function measureRoute(browser, baseUrl, route, width) {
  const context = await browser.newContext({ viewport: { width, height: HEIGHT } });
  const page = await context.newPage();
  try {
    await page.goto(new URL(route, baseUrl).href, { waitUntil: "load", timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(SETTLE_MS);
    const measured = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    return {
      route,
      width,
      scrollWidth: measured.scrollWidth,
      clientWidth: measured.clientWidth,
      pass: measured.scrollWidth <= measured.clientWidth,
    };
  } catch (err) {
    return { route, width, scrollWidth: null, clientWidth: null, pass: null, error: err.message };
  } finally {
    await context.close();
  }
}

async function measureTarget(target) {
  const routes = await fetchSitemapRoutes(target.baseUrl);
  console.log(`  ${routes.length} route(s) from ${target.baseUrl}/sitemap.xml`);
  const browser = await chromium.launch();
  const rows = [];
  try {
    for (const route of routes) {
      for (const width of WIDTHS) {
        const row = await measureRoute(browser, target.baseUrl, route, width);
        rows.push(row);
        if (row.error) {
          console.log(`    ${route} @ ${width}px: ERROR (${row.error})`);
        } else if (!row.pass) {
          console.log(`    ${route} @ ${width}px: FAIL (scrollWidth ${row.scrollWidth} > clientWidth ${row.clientWidth})`);
        }
      }
    }
  } finally {
    await browser.close();
  }
  return { label: target.label, baseUrl: target.baseUrl, rows };
}

function buildMarkdown(results, today) {
  let md = `# Horizontal overflow measurement — ${today}\n\n`;
  md +=
    "Measured `document.documentElement.scrollWidth` vs. `clientWidth` at 375px/768px/1440px " +
    `(height 900), after \`document.fonts.ready\` + a ${SETTLE_MS}ms settle, for every route in each ` +
    "target's own built `/sitemap.xml`. `pass` is `scrollWidth <= clientWidth`; the CI-blocking check " +
    "for this repo's own branch is e2e/no-horizontal-overflow.spec.ts, which additionally confirms real " +
    "scrollability via `window.scrollTo(10000, 0)` — this table is the underlying numbers, not a " +
    "replacement gate.\n\n";
  for (const result of results) {
    md += `## ${result.label}\n\n(\`${result.baseUrl}\`)\n\n`;
    md += "| Route | Width | scrollWidth | clientWidth | Pass |\n";
    md += "|---|---|---|---|---|\n";
    for (const row of result.rows) {
      if (row.error) {
        md += `| ${row.route} | ${row.width} | ERROR | ERROR | ERROR: ${row.error} |\n`;
      } else {
        md += `| ${row.route} | ${row.width} | ${row.scrollWidth} | ${row.clientWidth} | ${row.pass ? "PASS" : "FAIL"} |\n`;
      }
    }
    const failing = result.rows.filter((r) => r.pass === false);
    const errored = result.rows.filter((r) => r.error);
    md += `\n${failing.length} of ${result.rows.length} route×width combination(s) overflowing`;
    md += errored.length > 0 ? `, ${errored.length} errored.\n\n` : ".\n\n";
    if (failing.length > 0) {
      md += `Overflowing: ${failing.map((r) => `${r.route}@${r.width}`).join(", ")}\n\n`;
    }
  }
  return md;
}

async function main() {
  console.log(`scripts/measure-overflow.mjs: ${TARGETS.length} target(s)`);
  const results = [];
  for (const target of TARGETS) {
    console.log(`\n--- ${target.label} (${target.baseUrl}) ---`);
    results.push(await measureTarget(target));
  }

  const today = new Date().toISOString().slice(0, 10);
  const md = buildMarkdown(results, today);
  mkdirSync(REPORTS_DIR, { recursive: true });
  const outPath = join(REPORTS_DIR, `overflow-${today}.md`);
  writeFileSync(outPath, md);
  console.log(`\nOK — wrote ${outPath}`);

  console.log("\nSummary:");
  for (const result of results) {
    const failing = result.rows.filter((r) => r.pass === false);
    const errored = result.rows.filter((r) => r.error);
    console.log(
      `  ${result.label}: ${result.rows.length} measured, ${failing.length} failing, ${errored.length} errored`
    );
  }
}

await main();
