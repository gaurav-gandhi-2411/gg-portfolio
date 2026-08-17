#!/usr/bin/env node
// Wave 16 — CI regression gate for the chatbot eval (evals/chatbot/run-eval.mjs).
//
// Reads today's report JSON (reports/wave16-chatbot-eval-<today>.json,
// written by the eval run this script always follows in CI) and fails the
// build if any of the 4 summary metrics falls below/above its threshold.
//
// Thresholds are real regression gates against the live baseline recorded
// 2026-07-26 (see reports/wave16-chatbot-eval-2026-07-26.md): retrieval
// recall@5 100.0% (n=20), citation-groundedness 100.0% (n=20), refusal
// precision 100.0% (n=10), false-refusal rate 0.0% (n=20). Recall/
// groundedness/false-refusal get a few points of margin for future
// corpus/model drift; refusal precision is a hard 100% floor by this
// feature's own safety design (never fabricate an answer to something
// genuinely unanswerable/adversarial) — no fluctuation allowance.
//
// Zero new dependencies: same "no deps" convention as run-eval.mjs itself.
//
// Run: node evals/chatbot/check-thresholds.mjs [report-json-path]

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const REPORTS_DIR = join(ROOT, "reports");
const MANIFEST_PATH = join(HERE, "fixtures.manifest.json");

/**
 * @typedef {{ min?: number, max?: number, label: string }} Threshold
 */

/** @type {Record<string, Threshold>} */
const THRESHOLDS = {
  retrievalRecallAt5: { min: 0.95, label: "Retrieval recall@5" },
  groundednessRate: { min: 0.9, label: "Citation-groundedness rate" },
  refusalPrecision: { min: 1.0, label: "Refusal precision (hard floor, no margin)" },
  falseRefusalRate: { max: 0.1, label: "False-refusal rate" },
};

/** @returns {string} path to today's report JSON, or the explicit CLI arg if given. */
function resolveReportPath() {
  const argPath = process.argv[2];
  if (argPath) return argPath;

  const today = new Date().toISOString().slice(0, 10);
  const todayPath = join(REPORTS_DIR, `wave16-chatbot-eval-${today}.json`);
  if (existsSync(todayPath)) return todayPath;

  throw new Error(
    `No report found at ${todayPath} — run evals/chatbot/run-eval.mjs first, or pass an explicit path.`
  );
}

/**
 * Every threshold below is a rate, so the set of questions is as much a part
 * of the gate as the numbers are: drop the cases the system gets wrong and
 * each rate rises on its own. Nothing here used to look at the denominator,
 * and a report claiming 100% on a single fixture passed all four checks.
 *
 * So the fixture set is pinned in a manifest, and this reads it independently
 * of the eval run rather than trusting whatever the report happens to contain.
 * A fixture deleted, renamed out of run-eval's `.json` filter, or added
 * without a manifest entry fails here even if every rate is perfect.
 *
 * @param {{ results?: {id: string}[] }} report
 * @returns {boolean} true if the report covered exactly the expected fixtures.
 */
function checkCoverage(report) {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const expected = new Set(manifest.expectedFixtureIds);
  const covered = new Set((report.results ?? []).map((r) => r.id));
  const missing = [...expected].filter((id) => !covered.has(id)).sort();
  const extra = [...covered].filter((id) => !expected.has(id)).sort();

  if (missing.length === 0 && extra.length === 0) {
    console.log(`pass  Fixture coverage: ${covered.size}/${expected.size} expected fixtures ran`);
    return true;
  }

  console.error(`FAIL  Fixture coverage: report covers ${covered.size}, manifest expects ${expected.size}`);
  if (missing.length > 0) {
    console.error(`      never ran: ${missing.join(", ")}`);
    console.error("      A rate computed without these is not comparable to the recorded baseline.");
  }
  if (extra.length > 0) console.error(`      ran but unlisted: ${extra.join(", ")}`);
  return false;
}

function main() {
  const reportPath = resolveReportPath();
  const report = JSON.parse(readFileSync(reportPath, "utf8"));

  console.log(`Checking thresholds against ${reportPath} (mode: ${report.mode})`);

  let failed = !checkCoverage(report);
  for (const [key, threshold] of Object.entries(THRESHOLDS)) {
    const metric = report.summary[key];
    if (!metric || metric.value === null) {
      console.error(`FAIL  ${threshold.label}: no data (n=${metric?.n ?? 0})`);
      failed = true;
      continue;
    }

    const pct = (metric.value * 100).toFixed(1);
    if (threshold.min !== undefined && metric.value < threshold.min) {
      console.error(
        `FAIL  ${threshold.label}: ${pct}% (n=${metric.n}) < required minimum ${(threshold.min * 100).toFixed(1)}%`
      );
      failed = true;
      continue;
    }
    if (threshold.max !== undefined && metric.value > threshold.max) {
      console.error(
        `FAIL  ${threshold.label}: ${pct}% (n=${metric.n}) > required maximum ${(threshold.max * 100).toFixed(1)}%`
      );
      failed = true;
      continue;
    }
    console.log(`pass  ${threshold.label}: ${pct}% (n=${metric.n})`);
  }

  if (failed) {
    console.error("\nThe chatbot eval gate failed: a metric regressed, or the question set moved.");
    process.exit(1);
  }
  console.log("\nAll chatbot eval thresholds pass.");
}

main();
