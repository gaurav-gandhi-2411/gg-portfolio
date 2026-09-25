// Dispatch-only Lighthouse runner for .github/workflows/lighthouse.yml.
//
// A separate file rather than new flags on scripts/lighthouse.mjs: that
// script's contract is one BASE_URL with same-origin routes measured one
// route at a time, and a committed reports/*.summary.json artifact — right
// for its own local baseline job, wrong shape for several unrelated origins
// measured round-robin into a $GITHUB_STEP_SUMMARY table. What IS reused
// (not duplicated, rule 58b) is lighthouse.mjs's exports: the Chrome
// launch/kill lifecycle and profile-dir cleanup (runOnce), Chrome-binary
// resolution (resolveChromePath), the stale-tmpdir sweep, and the
// fail-closed run error (StateError) — the hard-won part of that file.
//
// Fails closed (rule 98a): a runtimeError (checked inside runOnce) or a run
// that fails twice aborts the ENTIRE dispatch, never a partial table for
// whichever URLs happened to work. Malformed inputs are a hard exit 1.

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PERF_GATE = 90;
const A11Y_GATE = 95;
const BP_GATE = 95;
const SEO_GATE = 95;
const CLS_GATE = 0.05;

/** Splits a comma/whitespace-separated URL list and validates each entry is an absolute http(s) URL. */
function parseUrls(raw) {
  const parts = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new Error("no URLs provided — pass one or more absolute http(s) URLs, comma- or whitespace-separated");
  }
  for (const p of parts) {
    let parsed;
    try {
      parsed = new URL(p);
    } catch {
      throw new Error(`"${p}" is not a valid absolute URL`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`"${p}" must use http or https`);
    }
  }
  return parts;
}

/** Filesystem-safe label for a URL, used only for raw-JSON filenames and log lines. */
function slugFor(url) {
  const u = new URL(url);
  const path = u.pathname.replace(/^\/+|\/+$/g, "").replace(/\//g, "-") || "root";
  return `${u.hostname}-${path}`.replace(/[^a-zA-Z0-9-]/g, "-");
}

/** Sorted-values median: the middle value for odd n, the mean of the two middle values for even n. */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function fmtScore(v) {
  return v == null ? "n/a" : String(v);
}
function fmtMs(v) {
  return v == null ? "n/a" : String(Math.round(v));
}
function fmtCls(v) {
  return v == null ? "n/a" : v.toFixed(3);
}
/** Column order/formatters shared by the per-run rows and the median/min/max rows. */
const COLUMNS = [
  { label: "Perf", get: (r) => r.categories.performance, fmt: fmtScore },
  { label: "A11y", get: (r) => r.categories.accessibility, fmt: fmtScore },
  { label: "BP", get: (r) => r.categories["best-practices"], fmt: fmtScore },
  { label: "SEO", get: (r) => r.categories.seo, fmt: fmtScore },
  { label: "CLS", get: (r) => r.audits.cls, fmt: fmtCls },
  { label: "LCP (ms)", get: (r) => r.audits["lcp-ms"], fmt: fmtMs },
  { label: "TBT (ms)", get: (r) => r.audits["tbt-ms"], fmt: fmtMs },
  { label: "FCP (ms)", get: (r) => r.audits["fcp-ms"], fmt: fmtMs },
];

/** Best-effort: does the response carry an x-robots-tag header (e.g. Vercel preview deploys' noindex)? */
async function checkRobotsTag(url) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    const value = res.headers.get("x-robots-tag");
    return { checked: true, present: value != null, value };
  } catch (err) {
    return { checked: false, error: err.message };
  }
}

/** SEO audits that failed (score < 1) on a run's lhr — raw, never re-scored or adjusted. */
function seoFailingAudits(lhr) {
  const seoCategory = lhr.categories?.seo;
  if (!seoCategory) return [];
  const failing = [];
  for (const ref of seoCategory.auditRefs) {
    const audit = lhr.audits[ref.id];
    if (audit && audit.score !== null && audit.score < 1) failing.push({ id: audit.id, title: audit.title });
  }
  return failing;
}

/** Renders up to `limit` rows of a Lighthouse table/opportunity `details` object as short strings. */
function tableRows(details, limit) {
  if (!details) return [];
  const headings = (details.headings ?? []).filter((h) => h.key);
  const items = details.items ?? [];
  return items.slice(0, limit).map((item) => headings.map((h) => `${h.label || h.key}=${fmtCellValue(item[h.key], h.valueType)}`).join(", "));
}

function fmtCellValue(v, valueType) {
  if (v == null) return "n/a";
  if (typeof v === "object") {
    if (v.snippet) return v.snippet;
    if (v.selector) return v.selector;
    if (v.url) return v.url;
    return JSON.stringify(v).slice(0, 80);
  }
  if (valueType === "bytes") return `${Math.round(v / 1024)}KB`;
  if (valueType === "ms" || valueType === "timespanMs") return `${Math.round(v)}ms`;
  return String(v);
}

/** A Lighthouse "list" detail (e.g. lcp-breakdown-insight) wraps a table and/or a node — pull both out. */
function listParts(details) {
  if (!details || details.type !== "list") return { table: null, node: null };
  const table = (details.items ?? []).find((i) => i?.type === "table") ?? null;
  const node = (details.items ?? []).find((i) => i?.type === "node") ?? null;
  return { table, node };
}

/** `rows`, or a one-element placeholder when the audit produced nothing to show. */
function withFallback(rows) {
  return rows.length ? rows : ["none"];
}

/**
 * Pulls the 8 diagnostics this workflow reports for a sub-90-median-performance URL, straight off
 * one run's raw lhr. Audit ids below were verified against the pinned lighthouse@13.5.0 install
 * (node_modules/lighthouse/core/audits/**), not guessed. Every lookup is optional-chained and
 * falls back to an explicit "not available" rather than throwing, since a future Lighthouse bump
 * could rename/replace any of these (lcp-breakdown-insight already declares
 * `replacesAudits: ['largest-contentful-paint-element']`).
 */
function performanceDiagnostics(lhr) {
  const audits = lhr.audits ?? {};
  const { table: lcpTable, node: lcpNode } = listParts(audits["lcp-breakdown-insight"]?.details);
  const unusedJs = audits["unused-javascript"]?.details;

  return {
    lcpElement: lcpNode ? lcpNode.snippet || lcpNode.selector || lcpNode.nodeLabel || "(unnamed node)" : "not available in this Lighthouse version",
    lcpPhaseBreakdown: lcpTable ? tableRows(lcpTable, 10) : ["not available in this Lighthouse version"],
    renderBlocking: withFallback(tableRows(audits["render-blocking-insight"]?.details, 5)),
    unusedJavascriptBytes: unusedJs?.overallSavingsBytes ?? null,
    unusedJavascriptRows: withFallback(tableRows(unusedJs, 5)),
    bootupTimeTop5: withFallback(tableRows(audits["bootup-time"]?.details, 5)),
    mainThreadWorkBreakdown: tableRows(audits["mainthread-work-breakdown"]?.details, 10),
    fontDisplay: withFallback(tableRows(audits["font-display-insight"]?.details, 5)),
    imageOpportunities: withFallback(tableRows(audits["image-delivery-insight"]?.details, 5)),
  };
}

/** Runs `runs` Lighthouse passes per URL, round-robin (run 1 for every URL, then run 2, ...). */
async function measureRoundRobin(urls, runs, chromePath, extraSettings, runOnce, StateError) {
  const resultsByUrl = new Map(urls.map((u) => [u, []]));
  for (let i = 1; i <= runs; i++) {
    for (const url of urls) {
      const label = `${slugFor(url)}-run${i}`;
      let lastErr;
      let success = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const r = await runOnce(url, chromePath, label, extraSettings);
          console.log(`  [${url}] run ${i}/${runs}: performance=${r.categories.performance} tbt=${Math.round(r.audits["tbt-ms"])}ms`);
          success = r;
          break;
        } catch (err) {
          lastErr = err;
          console.log(`  [${url}] run ${i}/${runs}: FAILED attempt ${attempt} (${err.message})`);
        }
      }
      if (!success) {
        throw new StateError(
          "RUN_FAILED",
          `${url} run ${i}/${runs} failed twice (${lastErr.message}) — aborting the whole dispatch rather than reporting a partial result`
        );
      }
      resultsByUrl.get(url).push(success);
    }
  }
  return resultsByUrl;
}

/** Aggregates one URL's per-run results into the table rows, gates, robots-tag note and diagnostics. */
function buildUrlReport(url, results, robots, closestRun) {
  const rows = results.map((r) => COLUMNS.map((c) => c.get(r)));
  const medianValues = COLUMNS.map((c, i) => median(rows.map((row) => row[i])));
  const minValues = COLUMNS.map((_, i) => Math.min(...rows.map((row) => row[i])));
  const maxValues = COLUMNS.map((_, i) => Math.max(...rows.map((row) => row[i])));

  const [perfMedian, a11yMedian, bpMedian, seoMedian, clsMedian] = medianValues;
  // The single run whose raw lhr backs every "from the median run" diagnostic below — the run
  // whose own performance score sits closest to the computed median (real run, not an interpolated
  // value with no lhr of its own to point at).
  const representative = closestRun(results, (r) => r.categories.performance, perfMedian);

  const gates = [
    { label: `Performance >=${PERF_GATE}`, pass: perfMedian >= PERF_GATE, text: fmtScore(perfMedian) },
    { label: `Accessibility >=${A11Y_GATE}`, pass: a11yMedian >= A11Y_GATE, text: fmtScore(a11yMedian) },
    { label: `Best Practices >=${BP_GATE}`, pass: bpMedian >= BP_GATE, text: fmtScore(bpMedian) },
    { label: `SEO >=${SEO_GATE}`, pass: seoMedian >= SEO_GATE, text: fmtScore(seoMedian) },
    { label: `CLS <=${CLS_GATE}`, pass: clsMedian <= CLS_GATE, text: fmtCls(clsMedian) },
  ];

  return {
    url,
    lighthouseVersion: results[0].lighthouseVersion,
    chromeVersion: results[0].chromeVersion,
    rows,
    medianValues,
    minValues,
    maxValues,
    gates,
    robots,
    seoMedian,
    failingSeoAudits: seoMedian < 100 ? seoFailingAudits(representative.lhr) : [],
    perfMedian,
    diagnostics: perfMedian < PERF_GATE ? performanceDiagnostics(representative.lhr) : null,
  };
}

function renderMarkdown(reportsByUrl, formFactor, runs) {
  const lines = [`# Lighthouse dispatch report`, "", `Form factor: **${formFactor}** — runs per URL: **${runs}** — throttling: simulate (Lighthouse default)`, ""];
  for (const [url, r] of reportsByUrl) {
    lines.push(`## ${url}`, "", `Lighthouse ${r.lighthouseVersion} — Chrome ${r.chromeVersion}`, "");
    lines.push(`| Run | ${COLUMNS.map((c) => c.label).join(" | ")} |`);
    lines.push(`|---|${COLUMNS.map(() => "---").join("|")}|`);
    r.rows.forEach((row, idx) => {
      lines.push(`| ${idx + 1} | ${row.map((v, i) => COLUMNS[i].fmt(v)).join(" | ")} |`);
    });
    lines.push(`| **Median** | ${r.medianValues.map((v, i) => COLUMNS[i].fmt(v)).join(" | ")} |`);
    lines.push(`| Min | ${r.minValues.map((v, i) => COLUMNS[i].fmt(v)).join(" | ")} |`);
    lines.push(`| Max | ${r.maxValues.map((v, i) => COLUMNS[i].fmt(v)).join(" | ")} |`, "");
    lines.push(`**Gates (median):** ${r.gates.map((g) => `${g.label}: ${g.pass ? "PASS" : "FAIL"} (${g.text})`).join(" · ")}`, "");
    if (r.robots.checked) {
      lines.push(
        r.robots.present
          ? `**x-robots-tag:** \`${r.robots.value}\` present on the response — raw SEO score below is not adjusted for this.`
          : `**x-robots-tag:** not present on the response.`
      );
    } else {
      lines.push(`**x-robots-tag:** could not be checked (${r.robots.error}).`);
    }
    lines.push("");
    if (r.seoMedian < 100) {
      lines.push(`**SEO raw score (median): ${r.seoMedian}/100** — failing audits:`);
      for (const a of r.failingSeoAudits) lines.push(`- \`${a.id}\` — ${a.title}`);
      lines.push("");
    }
    if (r.diagnostics) {
      const d = r.diagnostics;
      lines.push(`**Performance diagnostics** (median Perf ${r.perfMedian} < ${PERF_GATE} gate, from the median run):`);
      lines.push(`- LCP element: ${d.lcpElement}`);
      lines.push(`- LCP phase breakdown: ${d.lcpPhaseBreakdown.join("; ")}`);
      lines.push(`- Render-blocking resources: ${d.renderBlocking.join("; ")}`);
      lines.push(
        `- Unused JavaScript: ${d.unusedJavascriptBytes != null ? `${Math.round(d.unusedJavascriptBytes / 1024)}KB wasted` : "n/a"} — ${d.unusedJavascriptRows.join("; ")}`
      );
      lines.push(`- Bootup time (top 5 scripts): ${d.bootupTimeTop5.join("; ")}`);
      lines.push(`- Main-thread work breakdown: ${d.mainThreadWorkBreakdown.join("; ")}`);
      lines.push(`- Font-display: ${d.fontDisplay.join("; ")}`);
      lines.push(`- Image delivery opportunities: ${d.imageOpportunities.join("; ")}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

async function main() {
  const rawUrls = process.env.LH_URLS ?? "";
  const runsInput = process.env.LH_RUNS ?? "5";
  const formFactor = (process.env.LH_FORM_FACTOR ?? "mobile").trim().toLowerCase();
  const outputDir = process.env.LH_OUTPUT_DIR ?? join(process.cwd(), "lighthouse-ci-output");

  let urls;
  try {
    urls = parseUrls(rawUrls);
  } catch (err) {
    console.error(`FAIL — INVALID_URLS: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const runs = Number.parseInt(runsInput, 10);
  if (!Number.isInteger(runs) || runs < 1 || String(runs) !== runsInput.trim()) {
    console.error(`FAIL — INVALID_RUNS: expected a positive integer, got "${runsInput}"`);
    process.exitCode = 1;
    return;
  }

  if (formFactor !== "mobile" && formFactor !== "desktop") {
    console.error(`FAIL — INVALID_FORM_FACTOR: expected "mobile" or "desktop", got "${formFactor}"`);
    process.exitCode = 1;
    return;
  }

  // lighthouse.mjs reads OUTPUT_DIR_OVERRIDE at module-load time to set its raw-output directory
  // (the one runOnce() actually writes each run's JSON into) — must be set before the dynamic
  // import below, and the directory must already exist since that module never creates it itself
  // for a caller-supplied override (see its own RAW_OUTPUT_DIR_IS_OURS comment).
  mkdirSync(outputDir, { recursive: true });
  process.env.OUTPUT_DIR_OVERRIDE = outputDir;

  const { StateError, resolveChromePath, runOnce, sweepStaleProfiles, closestRun } = await import(
    new URL("./lighthouse.mjs", import.meta.url).href
  );

  console.log(`scripts/lighthouse-ci.mjs: ${urls.length} URL(s), runs=${runs}, form_factor=${formFactor}`);
  sweepStaleProfiles();

  let chromePath;
  try {
    chromePath = resolveChromePath();
  } catch (err) {
    console.error(`FAIL — ${err.state ?? "CHROME_UNAVAILABLE"}: ${err.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Chrome: ${chromePath}`);

  // Desktop settings come straight from Lighthouse's own shipped preset (the same one
  // `lighthouse --preset=desktop` uses) rather than hand-typed formFactor/screenEmulation
  // values, so this never invents numbers Lighthouse doesn't already vouch for.
  const extraSettings = formFactor === "desktop" ? (await import("lighthouse/core/config/desktop-config.js")).default.settings : {};

  let resultsByUrl;
  try {
    resultsByUrl = await measureRoundRobin(urls, runs, chromePath, extraSettings, runOnce, StateError);
  } catch (err) {
    console.error(`\nFAIL — ${err.state ?? "ERROR"}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const reportsByUrl = new Map();
  for (const url of urls) {
    const robots = await checkRobotsTag(url);
    reportsByUrl.set(url, buildUrlReport(url, resultsByUrl.get(url), robots, closestRun));
  }

  const markdown = renderMarkdown(reportsByUrl, formFactor, runs);
  console.log(`\n${markdown}`);

  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    appendFileSync(summaryFile, `${markdown}\n`);
  } else {
    console.warn("WARN — GITHUB_STEP_SUMMARY not set; markdown printed to stdout only.");
  }

  const summaryJsonPath = join(outputDir, "summary.json");
  writeFileSync(summaryJsonPath, `${JSON.stringify(Object.fromEntries(reportsByUrl), null, 2)}\n`);
  console.log(`\nOK — wrote ${summaryJsonPath} and ${urls.length * runs} raw Lighthouse JSON report(s) to ${outputDir}`);
}

await main();
