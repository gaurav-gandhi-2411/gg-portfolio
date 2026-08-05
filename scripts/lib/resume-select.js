// Pure selection/scoring logic — no I/O, no rendering. See spec-resume-variants.md
// "Selection algorithm" for the rules this implements.
//
// Amendment 3 (2026-08-05): the single linear weight vector from amendment 2
// produced two rank-position inversions against the intended sequence
// (demo_quality drives click-through for the first two entries only; below
// rank 2, substance dominates — one linear vector can't express that).
// Replaced with a two-stage positional model: stage 1 fills ranks 1..cutoff
// using demo-dominant weights, stage 2 ranks everything else using
// substance-dominant weights. Both stages still run only over the
// surface-gated eligible pool (repo_only projects are excluded before either
// stage, unchanged from amendment 1). jd_keywords/boost_tags still don't
// drive project ordering — only research-entry scoring and the
// keyword-coverage report.

const DEFAULT_STAGE1_WEIGHTS = { demo_quality: 0.45, role_relevance: 0.25, technical_depth: 0.2, metric_strength: 0.1 };
const DEFAULT_STAGE2_WEIGHTS = { demo_quality: 0.1, role_relevance: 0.35, technical_depth: 0.35, metric_strength: 0.2 };
const DEFAULT_STAGE1_CUTOFF = 2;

function resolveWeights(variant) {
  return {
    stage1: { ...DEFAULT_STAGE1_WEIGHTS, ...(variant.stage1_weights || {}) },
    stage2: { ...DEFAULT_STAGE2_WEIGHTS, ...(variant.stage2_weights || {}) },
    stage1Cutoff: variant.stage1_cutoff ?? DEFAULT_STAGE1_CUTOFF,
  };
}

function weightedScore(entry, weights) {
  return (
    entry.demo_quality * weights.demo_quality +
    entry.role_relevance * weights.role_relevance +
    entry.technical_depth * weights.technical_depth +
    entry.metric_strength * weights.metric_strength
  );
}

// Scores that are mathematically equal (e.g. two 2.55s built from different
// 1-5 inputs) can differ in their last IEEE-754 bit — a bare `!==` treats
// those as a real score difference and skips the tie-break entirely, making
// the final order depend on floating-point rounding noise instead of the
// spec'd rule. 1e-9 is far below any daylight two distinct real scores could
// have (weights have 2 decimal digits, entries are integers 1-5) and far
// above float rounding error, so it only collapses genuine ties.
const SCORE_EPSILON = 1e-9;

// Deterministic tie-break, applied whenever two entries score identically
// within a stage: demo_quality desc, then metric_strength desc, then project
// id asc. No random or insertion-order fallback (amendment 3, item 1).
function compareScored(a, b) {
  if (Math.abs(b.score - a.score) > SCORE_EPSILON) return b.score - a.score;
  if (b.entry.demo_quality !== a.entry.demo_quality) return b.entry.demo_quality - a.entry.demo_quality;
  if (b.entry.metric_strength !== a.entry.metric_strength) return b.entry.metric_strength - a.entry.metric_strength;
  return a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0;
}

// Two-stage positional ranking over the surface-gated eligible pool.
// Stage 1 fills ranks 1..stage1Cutoff with demo-dominant weights; stage 2
// ranks everything left over with substance-dominant weights. Returns both
// stage tables (for the required stdout audit trail) plus the combined
// best-first list consumed by the rest of the pipeline.
function twoStageRank(eligibleProjects, weights) {
  const stage1Scored = eligibleProjects
    .map((entry) => ({ entry, score: weightedScore(entry, weights.stage1) }))
    .sort(compareScored);

  const stage1Winners = stage1Scored.slice(0, weights.stage1Cutoff);
  const winnerIds = new Set(stage1Winners.map((c) => c.entry.id));

  const stage2Scored = eligibleProjects
    .filter((entry) => !winnerIds.has(entry.id))
    .map((entry) => ({ entry, score: weightedScore(entry, weights.stage2) }))
    .sort(compareScored);

  return {
    stage1Scored, // every eligible project's stage-1 score, best-first (audit table)
    stage1Winners, // the stage1Cutoff winners that fill ranks 1..cutoff
    stage2Scored, // remaining projects' stage-2 score, best-first (audit table + fills ranks cutoff+1..)
    combined: [...stage1Winners, ...stage2Scored], // final best-first order
  };
}

// Unchanged from before amendment 2 — still used for research entries only.
function tagOverlapScore(entry, boostTags, jdKeywords) {
  const tagOverlap = entry.tags.filter((t) => boostTags.includes(t)).length;
  const text = entry.text_runs.map((r) => r.text).join(" ").toLowerCase();
  const kwHits = jdKeywords.filter((kw) => text.includes(kw.toLowerCase())).length;
  return tagOverlap * 2 + kwHits;
}

// Returns the full candidate pool, gated and scored, plus the always-included
// sections. Does NOT apply the page-count cut — that's the build script's job,
// since it requires an actual render to measure against.
function selectForVariant(resumeData, certifications, variant) {
  const dropped = new Set(variant.drop_ids || []);
  const entries = resumeData.entries.filter((e) => !dropped.has(e.id));
  const weights = resolveWeights(variant);

  const header = entries.filter((e) => e.section === "header");
  const summary = entries.find((e) => e.section === "summary") || null;
  const experience = entries.filter((e) => e.section === "experience");
  const skills = entries.filter((e) => e.section === "skills");
  const education = entries.filter((e) => e.section === "education");

  const candidateProjects = entries.filter((e) => e.section === "project");
  const candidateResearch = entries.filter((e) => e.section === "research");

  // Hard surface gate (amendment 1, item 2): repo_only can never be a full
  // entry — excluded from both stages, not just scored low.
  const eligibleProjects = candidateProjects.filter((e) => e.surface !== "repo_only");
  const forcedCollapse = candidateProjects.filter((e) => e.surface === "repo_only");

  const ranked = twoStageRank(eligibleProjects, weights);

  const scoredResearch = candidateResearch
    .map((entry, i) => ({ entry, score: tagOverlapScore(entry, variant.boost_tags, variant.jd_keywords), origIndex: i }))
    .sort((a, b) => b.score - a.score || a.origIndex - b.origIndex);

  return {
    header,
    summary,
    experience,
    skills,
    education,
    certifications: certifications.certifications,
    weights,
    stage1Scored: ranked.stage1Scored, // audit table: every eligible project's stage-1 score
    stage2Scored: ranked.stage2Scored, // audit table: remaining projects' stage-2 score
    scoredProjects: ranked.combined, // final best-first order (stage1 winners, then stage2)
    scoredResearch, // research entries, best-first
    forcedCollapse, // repo_only projects — always in the "More on GitHub" line
  };
}

// amendment 2, item 5: the collapsed line caps at 200 chars total and may
// carry a metric for at most one project (the single highest-weighted-score
// collapsed entry, if any). Returns { line, tooLong } — the caller (build
// script) is responsible for turning tooLong into a hard build failure; this
// function does not throw, so it stays pure/testable.
//
// Collapsed entries (repo_only force-collapses + anything dropped by the
// page-fit loop) are, by construction, never stage-1 material — scored here
// with stage-2 (substance-dominant) weights for a single consistent ordering.
function buildCollapsedLine(collapsedProjectEntries, weights) {
  if (collapsedProjectEntries.length === 0) return { line: null, tooLong: false };

  const stage2Weights = weights.stage2 || weights;
  const withScores = collapsedProjectEntries
    .map((e, i) => ({ e, score: weightedScore(e, stage2Weights), origIndex: i }))
    .sort((a, b) => (Math.abs(b.score - a.score) > SCORE_EPSILON ? b.score - a.score : a.origIndex - b.origIndex));
  const metricCarrierId = withScores[0].e.id;

  const parts = withScores.map(({ e }) => {
    const name = e.text_runs[0].text.split(" — ")[0];
    return e.id === metricCarrierId && e.headline_metric ? `${name} (${e.headline_metric})` : name;
  });

  const line = `More on GitHub: ${parts.join(", ")}.`;
  return { line, tooLong: line.length > 200 };
}

module.exports = {
  DEFAULT_STAGE1_WEIGHTS,
  DEFAULT_STAGE2_WEIGHTS,
  DEFAULT_STAGE1_CUTOFF,
  resolveWeights,
  weightedScore,
  compareScored,
  twoStageRank,
  tagOverlapScore,
  selectForVariant,
  buildCollapsedLine,
};
