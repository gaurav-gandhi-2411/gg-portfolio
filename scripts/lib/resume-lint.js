// Hard-gate checks (amendment items 2, 4, 5, 6 + original spec item 5).
// Every function returns a string[] of violations — empty array means pass.
// scripts/build_resume.js treats any non-empty combined list as a build failure.

const BANNED_SUPERLATIVES = ["award-winning", "world-class"];
const BANNED_EXACT_PHRASES = ["13 products", "11 live", "authored two preprints"];
// A number (digit or spelled-out) followed by a count noun, allowing up to two
// words in between ("9 live AI products", "nine live products", "13 products")
// — even if the exact phrase isn't on the explicit banned-phrase list above.
const NUMBER_WORD =
  "(?:\\d+\\+?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)";
const COUNT_PATTERN = new RegExp(
  `\\b${NUMBER_WORD}\\s+(?:\\w+\\s+){0,2}(products?|projects?|papers?|preprints?|publications?)\\b`,
  "i",
);

function lintSummary(summaryEntry) {
  if (!summaryEntry) return [];
  const text = summaryEntry.text_runs.map((r) => r.text).join(" ");
  const lower = text.toLowerCase();
  const violations = [];
  for (const phrase of BANNED_EXACT_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) violations.push(`summary contains banned phrase: "${phrase}"`);
  }
  for (const s of BANNED_SUPERLATIVES) {
    if (lower.includes(s)) violations.push(`summary contains banned superlative: "${s}"`);
  }
  const m = text.match(COUNT_PATTERN);
  if (m) violations.push(`summary contains a project/product/publication count: "${m[0]}"`);
  return violations;
}

function lintSurfaceGate(renderedFullProjectEntries) {
  return renderedFullProjectEntries
    .filter((e) => e.surface === "repo_only")
    .map((e) => `project "${e.id}" rendered as a full entry despite surface == "repo_only"`);
}

function lintUnverified(renderedEntries, allowUnverified) {
  if (allowUnverified) return [];
  return renderedEntries
    .filter((e) => e.verified_source === "UNVERIFIED")
    .map((e) => `bullet "${e.id}" has verified_source == "UNVERIFIED" and --allow-unverified was not passed`);
}

function lintCertifications(certs) {
  return certs
    .filter((c) => c.status !== "held" && !c.expected)
    .map((c) => `certification "${c.name}" has status="${c.status}" but no "expected" date is set`);
}

// research_status must be rendered verbatim, never upgraded. The layout module
// only ever renders the enum value itself (never free text), so this checks the
// one place free text could smuggle in a stronger claim than the status allows.
const RESEARCH_STATUS_FORBIDDEN_WORDS = {
  in_preparation: ["published", "under review", "accepted"],
  under_submission: ["published", "accepted"],
  published: [],
};

function lintResearchStatus(researchEntries) {
  const violations = [];
  for (const e of researchEntries) {
    const status = e.research_status;
    if (!status) {
      violations.push(`research entry "${e.id}" has no research_status set`);
      continue;
    }
    const forbidden = RESEARCH_STATUS_FORBIDDEN_WORDS[status] || [];
    const text = e.text_runs.map((r) => r.text).join(" ").toLowerCase();
    for (const word of forbidden) {
      if (text.includes(word)) {
        violations.push(`research entry "${e.id}" (status=${status}) bullet text claims "${word}"`);
      }
    }
  }
  return violations;
}

// amendment 2, item 5: the "More on GitHub" line caps at 200 chars and may
// name a metric (a "(...)" parenthetical) for at most one project. Checked
// independently of resume-select.js's buildCollapsedLine() construction logic
// per rule 85a — a control shouldn't just trust its own builder never to drift.
// Root-cause check: buildCollapsedLine() wraps a project's headline_metric in
// its own "(...)" — if the metric string itself embeds a paren (e.g. "−13.3
// to −28.9pp (3 model families)"), the "one metric = one open-paren"
// assumption in lintMoreOnGithubLine breaks even though exactly one project
// was chosen to carry a metric. Catch it at the content level, not just as a
// downstream character-count symptom (rule 85a: check the surface directly).
function lintHeadlineMetricNoParens(projectEntries) {
  return projectEntries
    .filter((e) => e.headline_metric && e.headline_metric.includes("("))
    .map((e) => `project "${e.id}"'s headline_metric contains a paren, breaks the collapsed-line single-metric invariant: "${e.headline_metric}"`);
}

function lintMoreOnGithubLine(line) {
  if (!line) return [];
  const violations = [];
  if (line.length > 200) {
    violations.push(`"More on GitHub" line is ${line.length} chars, exceeds the 200-char cap: "${line}"`);
  }
  const metricCount = (line.match(/\(/g) || []).length;
  if (metricCount > 1) {
    violations.push(`"More on GitHub" line carries ${metricCount} metrics, only 1 is allowed: "${line}"`);
  }
  return violations;
}

// amendment 2, item 4: self_paced certifications must never use certificate
// language ("Specialization", "Certification", "Certificate", "Course") and
// must carry a description of what was built instead.
const CERTIFICATE_LANGUAGE = /\b(specialization|certification|certificate|course)\b/i;

function lintCertificationKind(certs) {
  const violations = [];
  for (const c of certs) {
    if (c.kind === "self_paced") {
      if (!c.description) {
        violations.push(`self_paced entry "${c.name}" has no description set`);
      }
      if (CERTIFICATE_LANGUAGE.test(c.name)) {
        violations.push(`self_paced entry "${c.name}" uses certificate language in its name`);
      }
    }
  }
  return violations;
}

// Amendment 4 (2026-08-05): AgentGauge sat as surface="repo_only" for a
// published PyPI package (agentgauge-harness) because content/products.ts's
// pypi field was never added post-publication — the surface classification
// wasn't backed by a checkable link. Every project that claims a live
// surface (anything other than repo_only) must carry a real, well-formed
// artifact_url so that claim traces to something, not just a hand-set enum
// value. repo_only entries are exempt (surface itself says there's nothing
// to link).
function lintArtifactUrl(projectEntries) {
  const violations = [];
  for (const e of projectEntries) {
    if (e.surface === "repo_only") continue;
    if (!e.artifact_url || !/^https?:\/\//.test(e.artifact_url)) {
      violations.push(`project "${e.id}" has surface="${e.surface}" but no valid artifact_url set (got: ${JSON.stringify(e.artifact_url ?? null)})`);
    }
  }
  return violations;
}

// Amendment 6 (2026-08-05): raw test counts (e.g. "601/601 tests passing",
// "597 tests") drift between builds — a resume is a printed/PDF snapshot, not
// a live page, so a number like this is stale the moment the suite grows by
// one test. Coverage/ratio percentages (e.g. "≥87.65% test coverage") don't
// have this problem and are allowed. Requires the word "test(s)" near the
// number so it doesn't false-positive on unrelated N/N patterns (a GPA like
// "8.45/10.0" has no nearby "test").
const RAW_TEST_COUNT_PATTERN = /\b\d[\d,]*\s*\/\s*\d[\d,]*\s+(?:\w+\s+){0,3}tests?\b|\b\d[\d,]*\+?\s+tests?\b/i;

function lintNoRawTestCounts(entries) {
  const violations = [];
  for (const e of entries) {
    const text = e.text_runs.map((r) => r.text).join(" ");
    const m = text.match(RAW_TEST_COUNT_PATTERN);
    if (m) violations.push(`entry "${e.id}" contains a raw test count ("${m[0]}") — these drift between builds; use a coverage percentage or a stable ratio instead`);
    if (e.headline_metric && RAW_TEST_COUNT_PATTERN.test(e.headline_metric)) {
      violations.push(`entry "${e.id}"'s headline_metric ("${e.headline_metric}") contains a raw test count`);
    }
  }
  return violations;
}

module.exports = {
  lintSummary,
  lintSurfaceGate,
  lintUnverified,
  lintCertifications,
  lintResearchStatus,
  lintMoreOnGithubLine,
  lintHeadlineMetricNoParens,
  lintCertificationKind,
  lintArtifactUrl,
  lintNoRawTestCounts,
};
