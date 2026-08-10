// Assertion smoke test for resume-select.mjs — run directly with
// `node scripts/lib/resume-select.smoketest.mjs`. No framework, same posture
// as resume-lint.smoketest.mjs (this repo has no unit-test runner).
//
// Two things this proves:
// 1. Unit coverage of the two-stage model + its tie-break/epsilon behavior
//    against synthetic fixtures (amendment 3, item 1).
// 2. A REGRESSION test (amendment 3, item 4) against the real, current
//    content/resume-data.json: asserts the exact full project sequence the
//    two-stage model currently produces for the default weights. If a future
//    score edit reorders the resume's project surfacing, this fails
//    immediately instead of silently drifting.

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWeights, twoStageRank, compareScored, buildCollapsedLine, selectForVariant } from "./resume-select.mjs";
import { lintArtifactUrl } from "./resume-lint.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function proj(overrides) {
  return {
    id: "proj:x",
    section: "project",
    surface: "live_demo",
    demo_quality: 3,
    role_relevance: 3,
    technical_depth: 3,
    metric_strength: 3,
    text_runs: [{ text: "Placeholder — a project.", bold: true }],
    headline_metric: null,
    ...overrides,
  };
}

const noOverrideVariant = { boost_tags: [], jd_keywords: [], drop_ids: [] };

// --- resolveWeights: defaults + per-field variant override ---
{
  const w = resolveWeights(noOverrideVariant);
  assert.deepStrictEqual(w.stage1, { demo_quality: 0.45, role_relevance: 0.25, technical_depth: 0.2, metric_strength: 0.1 });
  assert.deepStrictEqual(w.stage2, { demo_quality: 0.1, role_relevance: 0.35, technical_depth: 0.35, metric_strength: 0.2 });
  assert.strictEqual(w.stage1Cutoff, 2);
}
{
  const w = resolveWeights({ stage1_weights: { demo_quality: 0.5 }, stage2_cutoff: 3, stage1_cutoff: 3 });
  assert.strictEqual(w.stage1.demo_quality, 0.5, "stage1_weights should override only the given field");
  assert.strictEqual(w.stage1.role_relevance, 0.25, "unspecified stage1 fields fall back to default");
  assert.strictEqual(w.stage1Cutoff, 3, "stage1_cutoff should override the default of 2");
}

// --- twoStageRank: stage 1 fills exactly `cutoff` ranks by stage-1 weights, stage 2 ranks the rest ---
{
  const weights = resolveWeights(noOverrideVariant);
  const candidates = [
    proj({ id: "proj:a", demo_quality: 5, role_relevance: 3, technical_depth: 3, metric_strength: 3 }), // stage1 score 3.90 — wins rank 1
    proj({ id: "proj:c", demo_quality: 4, role_relevance: 3, technical_depth: 3, metric_strength: 3 }), // stage1 score 3.45 — wins rank 2
    proj({ id: "proj:b", demo_quality: 1, role_relevance: 5, technical_depth: 5, metric_strength: 5 }), // stage1 score 3.20 (misses cutoff) but stage2 score 4.60 (dominant substance)
    proj({ id: "proj:d", demo_quality: 1, role_relevance: 1, technical_depth: 1, metric_strength: 1 }), // weak everywhere
  ];
  const ranked = twoStageRank(candidates, weights);
  assert.strictEqual(ranked.stage1Winners.length, 2, "cutoff=2 should select exactly 2 stage-1 winners");
  assert.deepStrictEqual(ranked.stage1Winners.map((c) => c.entry.id), ["proj:a", "proj:c"],
    "stage 1 should fill ranks 1-2 by demo-dominant weights, not overall substance");
  assert.deepStrictEqual(ranked.combined.map((c) => c.entry.id), ["proj:a", "proj:c", "proj:b", "proj:d"],
    "proj:b missed the demo-dominant stage-1 cutoff but its substance should still beat proj:d once both compete under stage-2's substance-dominant weights");
}

// --- compareScored: tie-break order is demo_quality desc, then metric_strength desc, then id asc ---
// Fabricated {entry, score} rows (bypassing weightedScore) isolate the
// tie-break logic from the constraint that 1-5 integer inputs rarely produce
// exact ties under these particular weights.
{
  const rows = [
    { entry: proj({ id: "proj:z1", demo_quality: 2, metric_strength: 1 }), score: 2.2 },
    { entry: proj({ id: "proj:z2", demo_quality: 2, metric_strength: 3 }), score: 2.2 },
  ];
  assert.deepStrictEqual(rows.sort(compareScored).map((r) => r.entry.id), ["proj:z2", "proj:z1"], "equal score + equal demo_quality ties break on metric_strength desc");
}
{
  const rows = [
    { entry: proj({ id: "proj:b", demo_quality: 2, metric_strength: 2 }), score: 2.2 },
    { entry: proj({ id: "proj:a", demo_quality: 2, metric_strength: 2 }), score: 2.2 },
  ];
  assert.deepStrictEqual(rows.sort(compareScored).map((r) => r.entry.id), ["proj:a", "proj:b"], "fully-tied entries break on project id asc");
}

// --- floating-point tie-break regression: two 2.55s that differ in their last IEEE-754 bit must still tie ---
{
  const weights = resolveWeights(noOverrideVariant);
  const higherDemo = proj({ id: "proj:higher-demo", demo_quality: 4, role_relevance: 3, technical_depth: 2, metric_strength: 2 }); // stage2 score 2.5499999999999998
  const lowerDemo = proj({ id: "proj:lower-demo", demo_quality: 2, role_relevance: 2, technical_depth: 3, metric_strength: 3 }); // stage2 score 2.5500000000000003
  const winner1 = proj({ id: "proj:winner1", demo_quality: 5, role_relevance: 5, technical_depth: 5, metric_strength: 5 });
  const winner2 = proj({ id: "proj:winner2", demo_quality: 5, role_relevance: 4, technical_depth: 5, metric_strength: 5 });
  const ranked = twoStageRank([winner1, winner2, higherDemo, lowerDemo], weights);
  assert.deepStrictEqual(
    ranked.stage2Scored.map((c) => c.entry.id),
    ["proj:higher-demo", "proj:lower-demo"],
    "mathematically-tied scores that differ only in float rounding must resolve via demo_quality desc, not raw score comparison",
  );
}

// --- buildCollapsedLine accepts the new {stage1,stage2,stage1Cutoff} weights shape ---
{
  const weights = resolveWeights(noOverrideVariant);
  const collapsed = [
    proj({ id: "proj:hi", role_relevance: 5, technical_depth: 5, metric_strength: 5, headline_metric: "90% accuracy" }),
    proj({ id: "proj:lo", role_relevance: 1, technical_depth: 1, metric_strength: 1 }),
  ];
  const { line } = buildCollapsedLine(collapsed, weights);
  assert.ok(line.includes("(90% accuracy)"), "the higher stage-2-scored collapsed entry should carry the metric");
}

// --- REGRESSION: exact full project sequence for the real, current resume-data.json ---
{
  const ROOT = path.resolve(__dirname, "..", "..");
  const resumeData = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "resume-data.json"), "utf-8"));
  const certifications = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "certifications.json"), "utf-8"));
  // A variant with no drop_ids and default weights exercises the full pool.
  const baselineVariant = { boost_tags: [], jd_keywords: [], drop_ids: [] };
  const base = selectForVariant(resumeData, certifications, baselineVariant);

  // Amendment 4 (2026-08-05): AgentGauge's surface corrected repo_only -> pypi
  // (it was already published to PyPI as agentgauge-harness; products.ts's
  // pypi field was just never added) — it now enters the ranked pool and
  // wins stage 2 outright (4.70, the highest stage-2 score of any project).
  //
  // 2026-08-10 content-correctness sweep: expense-tracker's surface corrected
  // live_demo -> repo_only (the opposite direction from AgentGauge's fix
  // above). Its artifact_url 404s (DEPLOYMENT_NOT_FOUND) — content/products.ts
  // already dropped this same liveUrl in wave 19 (2026-07-31) for the
  // identical reason, but resume-data.json's entry never picked up that fix.
  // It now joins ShelfSense in the repo_only forced-collapse set below
  // instead of the ranked sequence.
  const EXPECTED_SEQUENCE = [
    "proj:triageiq",
    "proj:style-maitri",
    "proj:agentgauge",
    "proj:mmfr",
    "proj:warmer",
    "proj:aetherart",
    "proj:gold-rate-tracker",
    "proj:dealhunter",
    "proj:reviewiq",
    "proj:tracegauge",
    "proj:reclaim",
  ];
  assert.deepStrictEqual(
    base.scoredProjects.map((c) => c.entry.id),
    EXPECTED_SEQUENCE,
    "the two-stage model's full project sequence for the current resume-data.json scores has changed — " +
      "if this is an intentional score edit, update EXPECTED_SEQUENCE after confirming the new order by hand; " +
      "if not, a score or weight change silently reordered the resume",
  );
  assert.deepStrictEqual(
    base.forcedCollapse.map((e) => e.id).sort(),
    ["proj:expense-tracker", "proj:shelfsense"],
    "the repo_only forced-collapse set has changed — this is gated on surface, not score, so it should only " +
      "move if a project's liveUrl/pypi status changed in content/products.ts",
  );

  // Amendment 4: every non-repo_only project must carry a verified artifact_url.
  const projectEntries = resumeData.entries.filter((e) => e.section === "project");
  assert.deepStrictEqual(
    lintArtifactUrl(projectEntries),
    [],
    "every current project with a non-repo_only surface must have a real artifact_url — see spec-resume-variants.md",
  );
}

console.log("resume-select.smoketest.mjs: all assertions passed");
