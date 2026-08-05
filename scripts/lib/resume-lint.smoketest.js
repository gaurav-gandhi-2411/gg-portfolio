// Minimal assertion smoke test for resume-lint.js's hard gates — run directly
// with `node scripts/lib/resume-lint.smoketest.js`. No framework: this repo
// has no unit-test runner (Playwright covers e2e only), and a full jest/vitest
// setup isn't warranted for one new module. Proves each gate actually fires,
// not just that it stays quiet on clean data (rule 80/81 in spirit).

const assert = require("assert");
const lint = require("./resume-lint");

function makeEntry(overrides) {
  return {
    id: "test:entry",
    section: "project",
    text_runs: [{ text: "placeholder", bold: false }],
    verified_source: "some/file.md:1",
    surface: "live_demo",
    research_status: null,
    ...overrides,
  };
}

// --- summary lint ---
assert.deepStrictEqual(lint.lintSummary(null), [], "null summary should pass");
assert.deepStrictEqual(
  lint.lintSummary(makeEntry({ text_runs: [{ text: "I ship features.", bold: false }] })),
  [],
  "clean summary should pass",
);
assert.strictEqual(
  lint.lintSummary(makeEntry({ text_runs: [{ text: "Outside work I run 9 live products.", bold: false }] }))
    .length > 0,
  true,
  "bare count + 'products' must be caught",
);
assert.strictEqual(
  lint.lintSummary(makeEntry({ text_runs: [{ text: "My award-winning work speaks for itself.", bold: false }] }))
    .length > 0,
  true,
  "banned superlative must be caught",
);

// --- surface gate ---
assert.deepStrictEqual(lint.lintSurfaceGate([makeEntry({ surface: "live_demo" })]), [], "live_demo should pass the gate");
assert.strictEqual(
  lint.lintSurfaceGate([makeEntry({ id: "proj:x", surface: "repo_only" })]).length,
  1,
  "repo_only rendered as a full entry must be caught",
);

// --- unverified gate ---
const unverifiedEntry = makeEntry({ id: "proj:y", verified_source: "UNVERIFIED" });
assert.strictEqual(lint.lintUnverified([unverifiedEntry], false).length, 1, "UNVERIFIED must be caught by default");
assert.deepStrictEqual(lint.lintUnverified([unverifiedEntry], true), [], "--allow-unverified must suppress it");
assert.deepStrictEqual(lint.lintUnverified([makeEntry()], false), [], "a verified entry must pass");

// --- certification lint ---
assert.deepStrictEqual(
  lint.lintCertifications([{ name: "A", status: "held", expected: null }]),
  [],
  "held cert with no expected date should pass",
);
assert.deepStrictEqual(
  lint.lintCertifications([{ name: "B", status: "in_progress", expected: "2026-12" }]),
  [],
  "in_progress cert WITH an expected date should pass",
);
assert.strictEqual(
  lint.lintCertifications([{ name: "C", status: "in_progress", expected: null }]).length,
  1,
  "in_progress cert with NO expected date must be caught",
);

// --- research status gate: never upgrade ---
assert.deepStrictEqual(
  lint.lintResearchStatus([
    makeEntry({ section: "research", research_status: "in_preparation", text_runs: [{ text: "first-author preprint, arXiv pending", bold: false }] }),
  ]),
  [],
  "honest in_preparation phrasing should pass",
);
assert.strictEqual(
  lint.lintResearchStatus([
    makeEntry({ section: "research", research_status: "in_preparation", text_runs: [{ text: "Published in a top venue.", bold: false }] }),
  ]).length,
  1,
  "claiming 'published' while status is in_preparation must be caught",
);
assert.strictEqual(
  lint.lintResearchStatus([makeEntry({ section: "research", research_status: null })]).length,
  1,
  "missing research_status must be caught",
);

// --- "More on GitHub" line gate (amendment 2, item 5) ---
assert.deepStrictEqual(lint.lintMoreOnGithubLine(null), [], "no line at all should pass");
assert.deepStrictEqual(
  lint.lintMoreOnGithubLine("More on GitHub: ShelfSense (WRMSSE 0.5693 vs. 0.8956 naive), Reclaim."),
  [],
  "a short line with exactly one metric should pass",
);
assert.strictEqual(
  lint.lintMoreOnGithubLine("More on GitHub: " + "X".repeat(190) + ".").length,
  1,
  "a line over 200 chars must be caught",
);
assert.strictEqual(
  lint.lintMoreOnGithubLine("More on GitHub: ShelfSense (WRMSSE 0.5693), Reclaim (~48GB → 3.92GB).").length,
  1,
  "a line with two metrics (two projects parenthesized) must be caught",
);

// --- headline_metric no-parens gate (root cause of the More-on-GitHub bug) ---
assert.deepStrictEqual(
  lint.lintHeadlineMetricNoParens([makeEntry({ headline_metric: "WRMSSE 0.5693 vs. 0.8956 naive" })]),
  [],
  "a paren-free headline_metric should pass",
);
assert.strictEqual(
  lint.lintHeadlineMetricNoParens([makeEntry({ headline_metric: "−13.3 to −28.9pp (3 model families)" })]).length,
  1,
  "a headline_metric with an embedded paren must be caught",
);

// --- certification "kind" gate (amendment 2, item 4) ---
assert.deepStrictEqual(
  lint.lintCertificationKind([{ name: "NLP Specialization", kind: "course" }]),
  [],
  "a course-kind cert should pass regardless of certificate language",
);
assert.deepStrictEqual(
  lint.lintCertificationKind([{ name: "Built a resume variant generator", kind: "self_paced", description: "Selection scoring, docx rendering, and 6 CI hard gates for JD-tailored resume builds." }]),
  [],
  "a self_paced entry with a description and no certificate language should pass",
);
assert.strictEqual(
  lint.lintCertificationKind([{ name: "Self-taught project", kind: "self_paced", description: null }]).length,
  1,
  "a self_paced entry with no description must be caught",
);
assert.strictEqual(
  lint.lintCertificationKind([{ name: "Independent Deep Learning Course", kind: "self_paced", description: "did some stuff" }]).length,
  1,
  "a self_paced entry using certificate language ('Course') in its name must be caught",
);

// --- artifact_url gate (amendment 4, 2026-08-05) ---
assert.deepStrictEqual(lint.lintArtifactUrl([makeEntry({ surface: "repo_only", artifact_url: null })]), [], "repo_only entries are exempt, even with no artifact_url");
assert.deepStrictEqual(
  lint.lintArtifactUrl([makeEntry({ surface: "live_demo", artifact_url: "https://example.com" })]),
  [],
  "a non-repo_only entry with a well-formed https artifact_url should pass",
);
assert.strictEqual(
  lint.lintArtifactUrl([makeEntry({ id: "proj:x", surface: "pypi", artifact_url: null })]).length,
  1,
  "a non-repo_only entry with no artifact_url must be caught",
);
assert.strictEqual(
  lint.lintArtifactUrl([makeEntry({ id: "proj:y", surface: "hf_model", artifact_url: "not-a-url" })]).length,
  1,
  "a non-repo_only entry with a malformed (non-http) artifact_url must be caught",
);

// --- raw test count gate (amendment 6, 2026-08-05) ---
assert.deepStrictEqual(
  lint.lintNoRawTestCounts([makeEntry({ text_runs: [{ text: "≥87.65% test coverage", bold: false }] })]),
  [],
  "a coverage percentage (no raw count) should pass",
);
assert.strictEqual(
  lint.lintNoRawTestCounts([makeEntry({ id: "proj:x", text_runs: [{ text: "601/601 tests passing", bold: false }] })]).length,
  1,
  "an N/N raw test count must be caught",
);
assert.strictEqual(
  lint.lintNoRawTestCounts([makeEntry({ id: "proj:y", text_runs: [{ text: "597 tests, coverage strong", bold: false }] })]).length,
  1,
  "a bare 'N tests' raw count must be caught",
);
assert.strictEqual(
  lint.lintNoRawTestCounts([makeEntry({ id: "proj:z", headline_metric: "143/143 backend tests passing", text_runs: [{ text: "clean", bold: false }] })]).length,
  1,
  "a raw test count in headline_metric must be caught even if the bullet text itself is clean",
);
assert.deepStrictEqual(
  lint.lintNoRawTestCounts([makeEntry({ text_runs: [{ text: "GPA 8.45/10.0 · Chennai, India", bold: false }] })]),
  [],
  "an unrelated N/N pattern with no nearby 'test' word (e.g. a GPA) must not false-positive",
);

console.log("resume-lint.smoketest.js: all assertions passed");
