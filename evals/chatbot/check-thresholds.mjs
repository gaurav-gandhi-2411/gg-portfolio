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

function main() {
  const reportPath = resolveReportPath();
  const report = JSON.parse(readFileSync(reportPath, "utf8"));

  console.log(`Checking thresholds against ${reportPath} (mode: ${report.mode})`);

  let failed = false;
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
    console.error("\nOne or more chatbot eval metrics regressed below threshold.");
    process.exit(1);
  }
  console.log("\nAll chatbot eval thresholds pass.");
}

main();
