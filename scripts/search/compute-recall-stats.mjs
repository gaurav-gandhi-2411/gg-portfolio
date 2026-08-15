// BL-9 round 5 (task A1) — proper statistics on
// reports/BL-9-round5-recall-eval.json: a per-query win/loss table for
// every pair of tiers, a Wilson 95% CI for each tier's Recall@1/@3, and
// McNemar's exact test on the discordant pairs between MiniLM and
// potion-base-8M (the two tiers round 4 treated as meaningfully different
// on a 2/28 gap without ever testing whether 2/28 is distinguishable from
// noise at this sample size).
//
// Run: node scripts/search/compute-recall-stats.mjs
// (run evals/project-search/run-recall-eval.mjs first to regenerate the
// input report)

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPORT_PATH = join(ROOT, "reports", "BL-9-round5-recall-eval.json");
const STATS_PATH = join(ROOT, "reports", "BL-9-round5-recall-stats.json");

/** n choose k, exact (small n here, no overflow risk). */
function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return Math.round(result);
}

/** P(X = k) for X ~ Binomial(n, 0.5). */
function binomPmfHalf(n, k) {
  return choose(n, k) / 2 ** n;
}

/**
 * McNemar's EXACT test (binomial form, appropriate for small discordant
 * counts rather than the chi-square/continuity-corrected approximation)
 * on a 2x2 table's off-diagonal counts b, c.
 * @param {number} b - tier A right, tier B wrong
 * @param {number} c - tier A wrong, tier B right
 * @returns {{ b: number, c: number, n: number, pValue: number }}
 */
function mcNemarExact(b, c) {
  const n = b + c;
  if (n === 0) return { b, c, n, pValue: 1 };
  const k = Math.min(b, c);
  let pLower = 0;
  for (let i = 0; i <= k; i++) pLower += binomPmfHalf(n, i);
  const pValue = Math.min(1, 2 * pLower);
  return { b, c, n, pValue };
}

/**
 * Wilson score 95% confidence interval for a binomial proportion.
 * @param {number} successes
 * @param {number} n
 * @returns {{ point: number, low: number, high: number }}
 */
function wilsonCI95(successes, n) {
  const z = 1.96;
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
  return {
    point: p,
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
  };
}

/** @param {{low: number, high: number}} a @param {{low: number, high: number}} b */
function ciOverlap(a, b) {
  return a.low <= b.high && b.low <= a.high;
}

function main() {
  const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
  const tiers = ["minilm", "potionBase8m", "staticMatrix", "keywordOnly"].filter(
    (t) => report[t]?.perQuery
  );

  const n = report.nCases;
  const byId = {};
  for (const t of tiers) {
    byId[t] = new Map(report[t].perQuery.map((q) => [q.id, q]));
  }

  // --- per-query win/loss table (all tiers, all n queries) ---
  const allIds = report[tiers[0]].perQuery.map((q) => q.id);
  const winLossTable = allIds.map((id) => {
    const row = { id };
    for (const t of tiers) {
      const q = byId[t].get(id);
      row[t] = { hit1: q.hit1, hit3: q.hit3 };
    }
    return row;
  });

  // --- Wilson CI per tier, recall@1 and recall@3 ---
  const wilson = {};
  for (const t of tiers) {
    const hits1 = report[t].perQuery.filter((q) => q.hit1).length;
    const hits3 = report[t].perQuery.filter((q) => q.hit3).length;
    wilson[t] = {
      recallAt1: { hits: hits1, n, ...wilsonCI95(hits1, n) },
      recallAt3: { hits: hits3, n, ...wilsonCI95(hits3, n) },
    };
  }

  // --- McNemar's exact test: MiniLM vs potion-base-8M, both @1 and @3 ---
  let mcnemar = null;
  if (tiers.includes("minilm") && tiers.includes("potionBase8m")) {
    const rows = allIds.map((id) => ({
      minilm: byId.minilm.get(id),
      potion: byId.potionBase8m.get(id),
    }));
    const b1 = rows.filter((r) => r.minilm.hit1 && !r.potion.hit1).length;
    const c1 = rows.filter((r) => !r.minilm.hit1 && r.potion.hit1).length;
    const b3 = rows.filter((r) => r.minilm.hit3 && !r.potion.hit3).length;
    const c3 = rows.filter((r) => !r.minilm.hit3 && r.potion.hit3).length;
    mcnemar = {
      recallAt1: { ...mcNemarExact(b1, c1), bMeans: "minilm right, potion wrong", cMeans: "minilm wrong, potion right" },
      recallAt3: { ...mcNemarExact(b3, c3), bMeans: "minilm right, potion wrong", cMeans: "minilm wrong, potion right" },
    };
  }

  const overlapConclusions = {};
  if (tiers.includes("minilm") && tiers.includes("potionBase8m")) {
    overlapConclusions.minilmVsPotion = {
      recallAt1Overlap: ciOverlap(wilson.minilm.recallAt1, wilson.potionBase8m.recallAt1),
      recallAt3Overlap: ciOverlap(wilson.minilm.recallAt3, wilson.potionBase8m.recallAt3),
    };
  }

  const stats = { generatedAt: new Date().toISOString(), nCases: n, wilson, mcnemar, overlapConclusions, winLossTable };
  writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2) + "\n");

  console.log("=== Wilson 95% CIs ===");
  for (const t of tiers) {
    const r1 = wilson[t].recallAt1;
    const r3 = wilson[t].recallAt3;
    console.log(
      `${t.padEnd(14)} recall@1=${(r1.point * 100).toFixed(1)}% [${(r1.low * 100).toFixed(1)}, ${(r1.high * 100).toFixed(1)}]  ` +
        `recall@3=${(r3.point * 100).toFixed(1)}% [${(r3.low * 100).toFixed(1)}, ${(r3.high * 100).toFixed(1)}]`
    );
  }

  if (mcnemar) {
    console.log("\n=== McNemar's exact test: MiniLM vs potion-base-8M ===");
    console.log(
      `recall@1: b=${mcnemar.recallAt1.b} c=${mcnemar.recallAt1.c} n=${mcnemar.recallAt1.n} p=${mcnemar.recallAt1.pValue.toFixed(4)}`
    );
    console.log(
      `recall@3: b=${mcnemar.recallAt3.b} c=${mcnemar.recallAt3.c} n=${mcnemar.recallAt3.n} p=${mcnemar.recallAt3.pValue.toFixed(4)}`
    );
  }

  console.log("\n=== CI overlap (MiniLM vs potion-base-8M) ===");
  console.log(JSON.stringify(overlapConclusions, null, 2));

  console.log(`\nFull stats (incl. win/loss table for all ${n} queries): ${STATS_PATH}`);
}

main();
