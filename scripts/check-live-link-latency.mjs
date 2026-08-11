#!/usr/bin/env node
// Live-link latency gate — checks time-to-first-byte, not just status code.
//
// WHY THIS EXISTS: .lychee.toml's own comment says it best — "Cloud Run demos
// (e.g. AetherArt) cold-start after idle... generous timeout/retries above
// absorb that instead of flagging it as broken every run." That's exactly
// the gap: a link check that retries past a cold start treats a 20-90s stall
// as a pass, because it only ever asks "did it eventually return 200" — the
// thing a real visitor feels (how long they stared at a spinner) was never
// measured. Found 2026-08-11 auditing Style Maitri's backend (asa-stylist-api),
// whose cold start turned out to be 60s+ — undetected by link-check.yml for
// as long as the card had a raw Cloud Run/Vercel-frontend link, because it
// only ever checked the status code.
//
// This script measures wall-clock time to first byte for every liveUrl in
// content/products.ts, PLUS every link annotation actually embedded in the
// deployed public/resume.pdf, and fails if any exceeds its budget. The fix
// for a genuinely slow backend is content/warmup.ts's bridge page (a static
// page that always responds fast, and explicitly asks the visitor to wait
// rather than silently stalling) — so this gate gets to use ONE tight
// budget for every link instead of a patchwork of per-service exceptions.
//
// 2026-08-11 addendum: public/resume.pdf's links went stale TWICE with no
// gate ever catching it (once for a pre-ADR-0036 TriageIQ metric — see
// check-resume-pdf-consistency.mjs's own header — and again when three
// Live links kept pointing at raw Cloud Run/Vercel-frontend URLs after
// products.ts had already moved to the /warmup/* bridge). Both scripts
// existed by then; neither one read the PDF's actual link ANNOTATIONS
// (the clickable /URI targets embedded in its link objects) — only its
// text. A number can match resume-data.json while a link still points at
// last month's URL, because the two are stored completely separately
// inside the PDF's object graph. This is a distinct, narrower surface than
// check-resume-pdf-consistency.mjs's number check, so it's checked here
// alongside every other live link's latency, not folded into that script.
//
// Run: node scripts/check-live-link-latency.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_PATH = path.join(ROOT, "content", "products.ts");
const RESUME_PDF_PATH = path.join(ROOT, "public", "resume.pdf");

// Generous enough that normal network jitter never flags a false positive,
// tight enough that a silent multi-second stall (the actual failure class
// this exists to catch) still fails loudly. /warmup/* pages and every
// remaining direct liveUrl (Vercel frontends already kept warm, HF Spaces,
// GitHub Pages, PyPI) all comfortably clear this in normal operation.
const BUDGET_MS = 5000;
const FETCH_TIMEOUT_MS = 15000;

// Mirrors .lychee.toml's `accept` list: LinkedIn returns 999 to any
// non-browser client as its standard anti-scraping response, not a real
// break — treated as ok here for the same reason link-check.yml does.
const ACCEPTED_STATUSES = new Set([200, 201, 202, 203, 204, 206, 301, 302, 303, 307, 308, 999]);

async function measure(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      // Cache-busting: a CDN-cached fast response would hide a slow origin,
      // which is exactly the case (a cold backend) this gate exists to catch.
      headers: { "Cache-Control": "no-cache" },
    });
    const ttfbMs = performance.now() - start;
    return { url, ok: ACCEPTED_STATUSES.has(res.status), status: res.status, ttfbMs };
  } catch (err) {
    const ttfbMs = performance.now() - start;
    return {
      url,
      ok: false,
      status: err.name === "AbortError" ? "timeout" : err.message,
      ttfbMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Extracts every clickable link TARGET from a PDF's link annotations — the
// actual /URI values a click resolves to, not the page's visible text. A
// naive text scrape would miss exactly the failure mode this exists to
// catch (a visible label that's fine while its href silently rotted).
function extractPdfLinkUrls(pdfPath) {
  const bytes = readFileSync(pdfPath);
  const matches = [...bytes.toString("latin1").matchAll(/\/URI\s*\(([^)]*)\)/g)];
  const urls = matches.map((m) => m[1]);
  return [...new Set(urls)];
}

function sourceLabel(sources) {
  return sources.map((s) => `[${s}]`).join("");
}

const productsSrc = readFileSync(PRODUCTS_PATH, "utf8");
const productsUrls = [...productsSrc.matchAll(/liveUrl:\s*"([^"]+)"/g)].map((m) => m[1]);
const pdfUrls = extractPdfLinkUrls(RESUME_PDF_PATH).filter((u) => !u.startsWith("mailto:"));

if (productsUrls.length === 0) {
  console.error("check-live-link-latency: no liveUrl entries found in content/products.ts — parser broken?");
  process.exit(1);
}
if (pdfUrls.length === 0) {
  console.error("check-live-link-latency: no link annotations found in public/resume.pdf — parser broken?");
  process.exit(1);
}

// One check per unique URL, tagged with every surface that references it —
// a URL both products.ts and the PDF link to is checked once, not twice.
const bySource = new Map();
for (const u of productsUrls) bySource.set(u, [...(bySource.get(u) ?? []), "products.ts"]);
for (const u of pdfUrls) bySource.set(u, [...(bySource.get(u) ?? []), "resume.pdf"]);
const entries = [...bySource.entries()].map(([url, sources]) => ({ url, sources }));

console.log(
  `check-live-link-latency: checking ${entries.length} unique link(s) ` +
    `(${productsUrls.length} from products.ts, ${pdfUrls.length} from resume.pdf), budget ${BUDGET_MS}ms\n`
);

const results = await Promise.all(entries.map(async (e) => ({ ...(await measure(e.url)), sources: e.sources })));

const overBudget = [];
for (const r of results) {
  const ms = Math.round(r.ttfbMs);
  const verdict = !r.ok ? "FAIL (status)" : ms > BUDGET_MS ? "FAIL (slow)" : "ok";
  console.log(
    `  [${verdict.padEnd(13)}] ${ms.toString().padStart(6)}ms  status=${r.status}  ${sourceLabel(r.sources)}  ${r.url}`
  );
  if (!r.ok || ms > BUDGET_MS) overBudget.push({ ...r, ms });
}

if (overBudget.length > 0) {
  console.error(
    `\nFAIL — ${overBudget.length} link(s) failed on status or exceeded the ${BUDGET_MS}ms budget:\n`
  );
  for (const r of overBudget) {
    console.error(`  - ${r.url} (${r.ms}ms, status=${r.status}) ${sourceLabel(r.sources)}`);
  }
  console.error(
    "\nIf this is a genuinely slow backend (a Cloud Run service that scales to zero), " +
      "point the link at a /warmup/<service> bridge page instead of the raw URL — " +
      "see content/warmup.ts. Don't raise BUDGET_MS to make a slow link pass.\n" +
      "If a [resume.pdf] link is stale, that's a source-file problem, not a code one — " +
      "public/resume.pdf is a hand-built export from a private, gitignored .docx master " +
      "(see check-resume-pdf-consistency.mjs's header); it needs a manual re-export."
  );
  process.exit(1);
}

console.log(`\nOK — all ${entries.length} unique link(s) responded within ${BUDGET_MS}ms.`);
