// Pinned, reproducible mobile Lighthouse runner (run locally:
// node scripts/lighthouse.mjs [route...]).
//
// WHY THIS EXISTS (root-cause context, not narrative for its own sake): two
// WebGL prototypes (homepage hero point cloud, /work/warmer embedding
// viewer) were built, measured, discarded, and never committed, on the
// strength of Lighthouse numbers nobody can now reproduce. Every historical
// figure in this repo's git history came from an unpinned `npx lighthouse`
// invocation — a different Lighthouse version, a different Chrome version,
// on a machine whose state has since changed, with no committed run
// artifact to check the claim against. Two recorded figures for the exact
// same measurement already disagree (commit dc27535's message: Perf
// 80.8 -> 76.7; components/warmer/embedding-viewer-static.tsx:46-48: ~82 ->
// 61-69) and there is no way to adjudicate which one was honest — see
// reports/lighthouse-*-summary.json's docblock-honesty note and the commit
// that introduced this script for the full writeup. This script exists so
// every FUTURE perf claim has a pinned tool version, a pinned Chrome
// binary, a committed artifact, and n>=6 runs with reported variance —
// never a single unpinned number again.
//
// WHAT IT MEASURES: mobile Lighthouse (Lighthouse's own default config is
// already mobile form-factor + "simulate" throttling — not overridden here)
// against a real `npm run start` production server. Four categories
// (performance, accessibility, best-practices, seo) plus five performance
// audits (FCP, LCP, TBT, CLS, Speed Index) captured per run, aggregated to
// mean + sample stddev (n-1) across the run set.
//
// LIMITS (stated, not hidden):
//   - This machine's own Lighthouse noise floor is a ~10-point band on the
//     performance category score run-to-run (why n>=6, not n=1) — a
//     shared CI runner would likely be noisier still, which is exactly why
//     this never became a CI-blocking gate (see .github/workflows/ci.yml's
//     own comment on the bundle-size gate for the deterministic-vs-noisy
//     split this repo draws).
//   - Simulated throttling (Lighthouse's default), not real network/CPU
//     conditions — a relative regression signal on THIS machine, not a
//     promise of the field-observed number on a visitor's real device.
//   - Chrome version drifts with this machine's system Chrome install
//     unless CHROME_PATH_OVERRIDE pins an exact binary — the aggregate
//     records the exact Chrome version used per run so a future
//     comparison can see whether the tool, not the page, moved.
//
// FAILS CLOSED, not open (rule 98a) — every one of these aborts the run for
// that route with a distinct, named state and writes NO artifact, rather
// than silently producing a partial or misleading aggregate:
//   - CHROME_UNAVAILABLE: no Chrome binary found at CHROME_PATH_OVERRIDE or
//     any platform default candidate.
//   - SERVER_UNAVAILABLE: nothing answering at BASE_URL_OVERRIDE.
//   - DEV_SERVER_DETECTED: the server IS answering, but
//     /_next/static/development/_buildManifest.js resolves (200) — that
//     path only exists under `next dev`, never a production build. A dev
//     server's numbers are not comparable to a production baseline and
//     must never silently stand in for one.
//   - RUN_FAILED: an individual Lighthouse run threw (page didn't load,
//     Chrome crashed mid-run, etc.) and its one retry also failed. The
//     failed run is NOT dropped from n with the remaining runs quietly
//     averaged — the whole route's measurement aborts. A crashed run must
//     not silently shrink n.
//
// Zero non-dev dependencies beyond the two devDependencies this script
// exists to justify (lighthouse, chrome-launcher) — both pinned exact
// versions in package.json, not a caret range, so `npm ci` reproduces the
// same tool build this script's own header claims to measure with.

import { launch as launchChrome } from "chrome-launcher";
import lighthouse from "lighthouse";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { hostname, platform, release, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORTS_DIR = process.env.REPORTS_DIR_OVERRIDE ?? join(ROOT, "reports");
const BASE_URL = process.env.BASE_URL_OVERRIDE ?? "http://localhost:3000";
const RUNS = Number(process.env.RUNS_OVERRIDE ?? 6);
// Windows-repo wart avoided on purpose (rule from this script's own kickoff
// instruction): os.tmpdir() resolves to the real per-user temp dir on
// whatever OS this runs on, never a hardcoded POSIX /tmp default.
const RAW_OUTPUT_DIR =
  process.env.OUTPUT_DIR_OVERRIDE ?? mkdtempSync(join(tmpdir(), "gg-portfolio-lighthouse-"));
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];
const AUDITS = {
  "first-contentful-paint": "fcp-ms",
  "largest-contentful-paint": "lcp-ms",
  "total-blocking-time": "tbt-ms",
  "cumulative-layout-shift": "cls",
  "speed-index": "si-ms",
};
const DEFAULT_ROUTES = ["/", "/work/warmer"];

// Chrome-launcher's own auto-detection does not see a Playwright-managed
// browser (installed under a cache dir it never searches, e.g.
// %LOCALAPPDATA%\ms-playwright on Windows) — so this resolves a real system
// Chrome install explicitly rather than trusting ambient auto-detect, and
// fails closed (throws) rather than falling through to chrome-launcher's
// own (possibly-wrong-for-this-machine) search.
const CHROME_CANDIDATES = {
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
  darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
  linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium-browser", "/usr/bin/chromium"],
};

function resolveChromePath() {
  const override = process.env.CHROME_PATH_OVERRIDE;
  if (override) {
    // Checked here too, not just for the platform-default candidates below:
    // a bad override isn't caught by existsSync anywhere else, and
    // chrome-launcher's spawn() failure for a nonexistent binary surfaces
    // as an async, uncatchable 'error' event that crashes the whole
    // process instead of a clean rejection — validating the path up front
    // is the only way to fail closed on a typo'd override instead of an
    // unhandled exception.
    if (!existsSync(override)) {
      throw new StateError("CHROME_UNAVAILABLE", `CHROME_PATH_OVERRIDE="${override}" does not exist`);
    }
    return override;
  }
  const candidates = CHROME_CANDIDATES[platform()] ?? [];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new StateError(
      "CHROME_UNAVAILABLE",
      `no Chrome binary found for platform "${platform()}" at any of [${candidates.join(", ")}] ` +
        "and CHROME_PATH_OVERRIDE is not set — install Chrome or set CHROME_PATH_OVERRIDE to an exact binary path"
    );
  }
  return found;
}

class StateError extends Error {
  constructor(state, detail) {
    super(detail);
    this.state = state;
  }
}

async function assertProductionServer(baseUrl) {
  let res;
  try {
    res = await fetch(baseUrl, { redirect: "follow" });
  } catch (err) {
    throw new StateError(
      "SERVER_UNAVAILABLE",
      `nothing answering at ${baseUrl} (${err.message}) — run "npm run start" first, then re-run this script`
    );
  }
  if (!res.ok) {
    throw new StateError("SERVER_UNAVAILABLE", `${baseUrl} responded ${res.status} — is "npm run start" actually serving this route?`);
  }
  // Dev-only asset path: `next dev` serves an unhashed build manifest at
  // this fixed path; a production build's manifest lives under a
  // content-hashed build ID instead, so this 404s under `npm run start`.
  const devMarkerUrl = new URL("/_next/static/development/_buildManifest.js", baseUrl).href;
  const devRes = await fetch(devMarkerUrl).catch(() => null);
  if (devRes?.ok) {
    throw new StateError(
      "DEV_SERVER_DETECTED",
      `${devMarkerUrl} resolved 200 — that path only exists under "next dev". This script measures ` +
        'against a production build only; run "npm run start" (not "next dev") and re-run.'
    );
  }
}

function gitBranch() {
  if (process.env.BRANCH_OVERRIDE) return process.env.BRANCH_OVERRIDE;
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown-branch";
  }
}

function routeSlug(route) {
  if (route === "/") return "home";
  return route.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\//g, "-");
}

// Branch names routinely contain "/" (feat/x, fix/y) — embedding one
// straight into a filename creates an implicit, uncreated subdirectory
// instead of a flat file (mkdirSync above only creates REPORTS_DIR itself).
function branchSlug(branch) {
  return branch.replace(/[\\/]/g, "-");
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Sample stddev (n-1) — the conventional choice for a small (n=6) observed
// run set being used to estimate variance, not a full population.
function stddev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function extractChromeVersion(lhr) {
  const match = /Chrome\/([\d.]+)/.exec(lhr.environment?.hostUserAgent ?? lhr.userAgent ?? "");
  return match ? match[1] : "unknown";
}

async function runOnce(url, chromePath, runIndex) {
  // chrome-launcher's own kill() deletes ITS OWN auto-created temp profile
  // dir TWICE — once synchronously inside kill() itself, and again later
  // from a `chromeProcess.on('close', ...)` listener it registers
  // internally, which fires asynchronously once Windows actually reports
  // the process closed. Both calls race the OS's file-lock release
  // (rmSync's own maxRetries budget isn't enough on this machine), and the
  // SECOND (event-driven) call happens completely outside this function's
  // control flow — no try/catch here can ever catch it, because it isn't
  // triggered by anything this function calls directly. It surfaced as a
  // process-crashing uncaught exception during the very first real n=6
  // baseline run (run 2 of 6 succeeded, then the async cleanup from run 2
  // crashed the whole process before run 3 could start).
  //
  // The actual fix: chrome-launcher's destroyTmp() no-ops entirely (both
  // call sites) whenever the CALLER supplied its own `userDataDir` — it
  // only ever auto-deletes a directory IT created via its own
  // makeTmpDir(). Supplying an explicit, self-owned profile dir here makes
  // both of chrome-launcher's internal cleanup attempts inert, and this
  // function does its own best-effort removal instead, on a path this
  // function actually controls.
  const profileDir = mkdtempSync(join(tmpdir(), "gg-lh-profile-"));
  const chrome = await launchChrome({
    chromePath,
    userDataDir: profileDir,
    chromeFlags: ["--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
  });
  let result;
  try {
    result = await lighthouse(url, { port: chrome.port, onlyCategories: CATEGORIES, output: "json" });
  } finally {
    await chrome.kill();
    // Best-effort: a leftover profile dir under os.tmpdir() is cosmetic
    // (the OS reclaims it eventually) and must never invalidate an
    // otherwise-successful run — only a genuine measurement failure
    // (thrown out of the `lighthouse()` call above) counts toward
    // RUN_FAILED.
    try {
      rmSync(profileDir, { recursive: true, force: true, maxRetries: 5 });
    } catch (cleanupErr) {
      console.warn(`  (run ${runIndex}: temp profile cleanup failed, ignoring — ${cleanupErr.message})`);
    }
  }
  if (!result?.lhr) throw new Error("lighthouse() returned no lhr");
  const { lhr } = result;
  const categories = Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]));
  const audits = Object.fromEntries(
    Object.entries(AUDITS).map(([auditId, key]) => [key, lhr.audits[auditId]?.numericValue ?? null])
  );
  const rawPath = join(RAW_OUTPUT_DIR, `run-${runIndex}.json`);
  writeFileSync(rawPath, JSON.stringify(lhr, null, 2));
  return { run: runIndex, categories, audits, lighthouseVersion: lhr.lighthouseVersion, chromeVersion: extractChromeVersion(lhr), rawPath, lhr };
}

async function measureRoute(route, chromePath) {
  const url = new URL(route, BASE_URL).href;
  const slug = routeSlug(route);
  console.log(`\n--- ${route} (${url}) — ${RUNS} runs ---`);

  const results = [];
  for (let i = 1; i <= RUNS; i++) {
    let attempt = 0;
    let lastErr;
    while (attempt < 2) {
      attempt++;
      try {
        const r = await runOnce(url, chromePath, i);
        console.log(`  run ${i}/${RUNS}: performance=${r.categories.performance} tbt=${Math.round(r.audits["tbt-ms"])}ms`);
        results.push(r);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        console.log(`  run ${i}/${RUNS}: FAILED attempt ${attempt} (${err.message})`);
      }
    }
    if (lastErr) {
      throw new StateError(
        "RUN_FAILED",
        `run ${i}/${RUNS} for ${route} failed twice (${lastErr.message}) — aborting this route's measurement ` +
          "entirely rather than reporting an aggregate over fewer than the intended n"
      );
    }
  }

  const aggregate = {};
  for (const c of CATEGORIES) {
    const values = results.map((r) => r.categories[c]);
    aggregate[c] = { mean: round2(mean(values)), stddev: round2(stddev(values)), values };
  }
  for (const key of Object.values(AUDITS)) {
    const values = results.map((r) => r.audits[key]);
    aggregate[key] = { mean: round2(mean(values)), stddev: round2(stddev(values)), values };
  }

  // Representative run for the committed full report: the run whose
  // performance score sits closest to the aggregate's own mean — ties
  // broken by earliest run index.
  const perfMean = aggregate.performance.mean;
  const median = results.reduce((best, r) =>
    Math.abs(r.categories.performance - perfMean) < Math.abs(best.categories.performance - perfMean) ? r : best
  );

  const today = new Date().toISOString().slice(0, 10);
  const branch = gitBranch();
  const base = `lighthouse-${branchSlug(branch)}-${slug}-${today}`;
  mkdirSync(REPORTS_DIR, { recursive: true });

  const summaryPath = join(REPORTS_DIR, `${base}.summary.json`);
  const summary = {
    route,
    url,
    branch,
    date: today,
    n: RUNS,
    lighthouseVersion: results[0].lighthouseVersion,
    chromeVersion: results[0].chromeVersion,
    host: `${hostname()} (${platform()} ${release()})`,
    medianRunIndex: median.run,
    aggregate,
  };
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + "\n");

  const reportPath = join(REPORTS_DIR, `${base}.report.json`);
  writeFileSync(reportPath, JSON.stringify(median.lhr, null, 2) + "\n");

  console.log(`  OK — wrote ${summaryPath}`);
  console.log(`  OK — wrote ${reportPath} (median run ${median.run}/${RUNS} by performance score)`);
  return { route, summary, summaryPath, reportPath };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Driver logic lives in main(), returning rather than calling
// process.exit(1) on every failure path — this script does an awaited
// fetch() (assertProductionServer) before some of those failure points,
// and a hard process.exit() immediately after an in-flight undici socket
// hasn't finished tearing down trips a libuv/Windows-specific crash
// (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`) that produces
// an unpredictable process exit code instead of the intended 1 — caught
// live testing the SERVER_UNAVAILABLE/DEV_SERVER_DETECTED failure paths.
// Setting process.exitCode and letting the module finish naturally drains
// the event loop cleanly and always yields the intended code.
async function main() {
  const routes = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_ROUTES;

  console.log(`scripts/lighthouse.mjs: ${routes.length} route(s), n=${RUNS}, base=${BASE_URL}`);

  let chromePath;
  try {
    chromePath = resolveChromePath();
  } catch (err) {
    console.error(`\nFAIL — ${err.state}: ${err.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Chrome: ${chromePath}`);

  try {
    await assertProductionServer(BASE_URL);
  } catch (err) {
    console.error(`\nFAIL — ${err.state}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const outcomes = [];
  const failures = [];
  for (const route of routes) {
    try {
      outcomes.push(await measureRoute(route, chromePath));
    } catch (err) {
      console.error(`\n  FAIL — ${err.state ?? "ERROR"}: ${err.message}`);
      failures.push({ route, state: err.state ?? "ERROR", detail: err.message });
    }
  }

  console.log(`\nSummary: ${outcomes.length}/${routes.length} route(s) measured, ${failures.length} failed.`);
  for (const o of outcomes) {
    const perf = o.summary.aggregate.performance;
    console.log(`  ${o.route}: performance ${perf.mean} +/- ${perf.stddev} (n=${o.summary.n})`);
  }

  if (failures.length > 0) {
    console.error(`\nFAIL — ${failures.length} route(s) did not produce a committable artifact:`);
    for (const f of failures) console.error(`  - ${f.route}: [${f.state}] ${f.detail}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nOK — ${outcomes.length} route(s) measured and written to ${REPORTS_DIR}.`);
}

await main();
