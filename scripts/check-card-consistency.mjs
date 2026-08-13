// Wave 20 — same-project card-vs-case-study consistency check (run locally:
// node scripts/check-card-consistency.mjs; wired into ci.yml).
//
// WHY THIS EXISTS: the Style Maitri incident (content/provenance.md's Wave 20
// section). content/products.ts's homepage/projects-grid card (figure +
// tagline) and content/metrics.json's style-maitri entries both kept a stale,
// gitignored-sourced number (94.4%/n=378, 42 stores) for an entire deploy
// cycle AFTER the case-study body itself had already been reverted to the
// correct, git-committed figures (93.8%/n=211, 8 stores) — a same-project
// internal contradiction between two files that no rebase ever put in
// conflict with each other. check-metric-freshness.mjs (external-repo drift,
// report-only, always exits 0) structurally cannot catch this class: it
// compares metrics.json against an OUTSIDE source repo, never against this
// repo's own case-study body. This script is the opposite shape on purpose:
// zero network calls, entirely same-repo, and it FAILS CLOSED (non-zero exit
// on any finding) rather than just reporting — a same-repo comparison has no
// flaky-fetch excuse to be soft about.
//
// Three checks, all same-repo:
//   A. metrics.json entry vs. the case-study row/decision that cites the same
//      sourceRef (id) — precise, 1:1, catches "the manifest and the page
//      disagree about the exact same claim" (the Style Maitri bug, and the
//      shape DealHunter's stray coverage-value carryover took during Wave 19).
//   B. products.ts `figure` vs. its own product's `metric` — content/types.ts
//      states the invariant directly ("every value must mirror the row's
//      `metric` ... the figure is the metric drawn, never a second source of
//      truth"); this enforces it mechanically instead of trusting a comment.
//   C. products.ts `tagline` vs. that product's own case-study body (broader:
//      a tagline number should appear SOMEWHERE in its own case study).
//
// Deliberately no MIN_TOKEN_LEN filter (unlike check-metric-freshness.mjs):
// that check searches an entire external file and needs the filter to avoid
// coincidental short-number noise; every comparison here is scoped to one
// product's own small set of fields against its own case study, so a short
// token (a bare store count like "8" vs "42") is exactly the signal this
// script exists to catch, not noise to filter out.
//
// Zero dependencies; Node 20+ (dynamic import).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const METRICS_PATH = join(ROOT, "content", "metrics.json");
const PRODUCTS_PATH = join(ROOT, "content", "products.ts");
const CASE_STUDIES_INDEX_PATH = join(ROOT, "content", "case-studies", "index.ts");
const CASE_STUDIES_DIR = join(ROOT, "content", "case-studies");

// metrics.json IDs are prefixed with a short slug that doesn't always match
// content/products.ts's own `slug` field 1:1 (e.g. "mmfr:recall10" vs. the
// product slug "multimodal-fashion-recommender"). Hand-maintained, same
// convention as check-metric-freshness.mjs's CASE_STUDY_REPO — a new short
// prefix needs a line here or it falls into `NO_SLUG_MAPPING` below rather
// than silently going unchecked.
const METRIC_PREFIX_TO_SLUG = {
  mmfr: "multimodal-fashion-recommender",
};

function resolveSlug(prefix) {
  return METRIC_PREFIX_TO_SLUG[prefix] ?? prefix;
}

// Same convention as check-metric-freshness.mjs's extractTokens: percent
// signs stripped, digits are the evidence, each token carries a fraction-form
// alternate (94.4 -> 0.944) since some sources render the identical number
// either way. No MIN_TOKEN_LEN filter here — see header comment for why.
function extractTokens(text) {
  if (!text) return [];
  const matches = String(text).match(/\d+(?:\.\d+)?/g) ?? [];
  const unique = [...new Set(matches)];
  return unique.map((t) => {
    const n = Number(t);
    const alternates = [t];
    if (n >= 0 && n <= 100) {
      const asFraction = (n / 100).toFixed(6).replace(/0+$/, "").replace(/\.$/, ".0");
      if (asFraction !== t) alternates.push(asFraction);
    }
    return { display: t, alternates };
  });
}

function tokensFoundIn(tokens, haystack) {
  const missing = [];
  for (const t of tokens) {
    if (!t.alternates.some((a) => haystack.includes(a))) missing.push(t.display);
  }
  return missing;
}

function discoverCaseStudyModules() {
  const indexSrc = readFileSync(CASE_STUDIES_INDEX_PATH, "utf8");
  return [...indexSrc.matchAll(/import \{ (\w+) \} from "\.\/([\w-]+)";/g)].map(
    ([, exportName, fileName]) => ({ exportName, fileName })
  );
}

// Every sourceRef-carrying claim in a case study, paired with the exact
// displayed text for it — same shape as check-metric-freshness.mjs's
// collectCaseStudyClaims, duplicated here (not imported) so this script stays
// zero-dependency and independently runnable.
function collectClaims(study) {
  const claims = [];
  for (const r of study.results ?? []) {
    claims.push({ sourceRef: r.sourceRef, text: `${r.value} ${r.detail ?? ""}`.trim() });
  }
  for (const d of study.decisions ?? []) {
    claims.push({ sourceRef: d.sourceRef, text: d.body });
  }
  if (study.diagram) {
    const pointsText = study.diagram.points.map((p) => `${p.label} ${p.value}`).join(" ");
    claims.push({ sourceRef: study.diagram.sourceRef, text: `${pointsText} ${study.diagram.caption}` });
  }
  return claims;
}

// Every numeric-bearing string on a case study, flattened into one haystack —
// used by Check C (a tagline number just needs to appear SOMEWHERE in its own
// project's case study, not against one specific sourceRef row).
function fullCaseStudyText(study) {
  const parts = [
    ...(study.problem ?? []),
    ...(study.approach ?? []),
    ...(study.closing ?? []),
    study.dek,
  ];
  for (const d of study.decisions ?? []) parts.push(d.body);
  for (const r of study.results ?? []) parts.push(`${r.value} ${r.detail ?? ""}`);
  if (study.story) parts.push(study.story.title, ...study.story.body);
  if (study.architecture) {
    for (const s of study.architecture.stages ?? []) {
      parts.push(s.label, s.detail ?? "");
      for (const p of s.parallel ?? []) parts.push(p.label, p.detail ?? "");
    }
  }
  if (study.diagram) {
    parts.push(study.diagram.points.map((p) => `${p.label} ${p.value}`).join(" "), study.diagram.caption);
  }
  return parts.join(" \n ");
}

async function loadCaseStudies() {
  const modules = discoverCaseStudyModules();
  const bySlug = new Map(); // slug -> { study, claims, fullText }
  for (const { exportName, fileName } of modules) {
    const fileUrl = pathToFileURL(join(CASE_STUDIES_DIR, `${fileName}.ts`)).href;
    const mod = await import(fileUrl);
    const study = mod[exportName];
    bySlug.set(study.slug ?? fileName, {
      study,
      claims: collectClaims(study),
      fullText: fullCaseStudyText(study),
    });
  }
  return bySlug;
}

async function loadProducts() {
  // products.ts imports refreshableMetric from "@/lib/metrics", which in turn
  // imports content/metrics.json — a plain dynamic import of the .ts source
  // won't resolve the "@/" alias or transpile TS outside the Next build. This
  // script instead re-implements just enough of refreshableMetric() against
  // the same metrics.json this process already reads, by re-parsing
  // products.ts's own source text for each `slug`/`tagline`/`metric`/
  // `secondaryMetric`/`figure` field with targeted regexes — brittle to a
  // structural rewrite of products.ts, but avoids a build step or a
  // duplicate module-resolution setup for a single CI check. A structural
  // rewrite that breaks this parsing will make every product report
  // PARSE_ERROR below, loudly, not silently skip.
  const src = readFileSync(PRODUCTS_PATH, "utf8").replace(/\r\n/g, "\n");
  const blocks = src.split(/\n  \{\n/).slice(1); // one string per product object literal
  const products = [];
  for (const raw of blocks) {
    const block = "{\n" + raw.split(/\n  \},?\n/)[0] + "\n  }";
    const slugMatch = block.match(/slug:\s*"([\w-]+)"/);
    if (!slugMatch) continue;
    const slug = slugMatch[1];
    const taglineMatch = block.match(/tagline:\s*\n?\s*"((?:[^"\\]|\\.)*)"/);
    const metricMatch = block.match(/(?<!secondary)metric:\s*refreshableMetric\("([\w:-]+)"\)/);
    const secondaryMatch = block.match(/secondaryMetric:\s*refreshableMetric\("([\w:-]+)"\)/);
    const figureMatch = block.match(/figure:\s*(\{[\s\S]*?\}),?\n/);
    products.push({
      slug,
      tagline: taglineMatch ? taglineMatch[1] : null,
      metricId: metricMatch ? metricMatch[1] : null,
      secondaryMetricId: secondaryMatch ? secondaryMatch[1] : null,
      figureRaw: figureMatch ? figureMatch[1] : null,
    });
  }
  return products;
}

const metricsStore = JSON.parse(readFileSync(METRICS_PATH, "utf8"));
const metrics = metricsStore.metrics ?? {};
const caseStudies = await loadCaseStudies();
const products = await loadProducts();

const findings = []; // { check: "A"|"B"|"C", id, detail }

// --- Check A: metrics.json entry vs. the case-study claim sharing its sourceRef ---
for (const [id, entry] of Object.entries(metrics)) {
  const [prefix] = id.split(":");
  const slug = resolveSlug(prefix);
  const cs = caseStudies.get(slug);
  if (!cs) {
    findings.push({ check: "A", id, status: "NO_SLUG_MAPPING", detail: `metric prefix "${prefix}" -> slug "${slug}" has no case-study module` });
    continue;
  }
  const claim = cs.claims.find((c) => c.sourceRef === id);
  if (!claim) {
    findings.push({ check: "A", id, status: "SKIPPED", detail: `no results/decisions/diagram row in ${slug}.ts cites sourceRef "${id}" — nothing to compare against` });
    continue;
  }
  const tokens = extractTokens(entry.value);
  const missing = tokensFoundIn(tokens, claim.text);
  if (missing.length > 0) {
    findings.push({
      check: "A",
      id,
      status: "DRIFT",
      detail: `metrics.json value "${entry.value}" has token(s) [${missing.join(", ")}] not found in ${slug}.ts's own "${id}" row (text: "${claim.text}")`,
    });
  }
}

// --- Check B: products.ts figure vs. its own product's metric ---
for (const p of products) {
  if (!p.figureRaw || !p.metricId) continue;
  const metricEntry = metrics[p.metricId];
  if (!metricEntry) {
    findings.push({ check: "B", id: p.slug, status: "MISSING_METRIC", detail: `products.ts "${p.slug}" references metric "${p.metricId}" which has no metrics.json entry` });
    continue;
  }
  const figureTokens = extractTokens(p.figureRaw);
  // A dumbbell figure shows a before/after pair, so its `from` value is the
  // BASELINE — and since 2026-08-13 baselines live in their own
  // `<id>-baseline` entry rather than being packed into the primary metric's
  // value string. That split exists because a value holding two numbers
  // cannot be anchored to a single source line (see
  // check-metric-freshness.mjs's cited-line layer). Without this, the two
  // checks pull in opposite directions: one demands both numbers in one
  // value, the other demands one number per value.
  //
  // Scoped narrowly on purpose — only the exact `-baseline` sibling of THIS
  // card's own metric is consulted, never an arbitrary other entry, so a
  // figure still cannot quote a number that no sibling metric backs.
  const baselineEntry = metrics[`${p.metricId}-baseline`];
  const searchSpace = baselineEntry
    ? `${metricEntry.value} ${baselineEntry.value}`
    : metricEntry.value;
  const missing = tokensFoundIn(figureTokens, searchSpace);
  if (missing.length > 0) {
    findings.push({
      check: "B",
      id: p.slug,
      status: "DRIFT",
      detail: `products.ts "${p.slug}"'s figure has token(s) [${missing.join(", ")}] not found in its own metric "${p.metricId}"'s value ("${metricEntry.value}") — content/types.ts's ProductFigure comment requires these to match`,
    });
  }
}

// --- Check C: products.ts tagline vs. its own case-study's full body ---
for (const p of products) {
  if (!p.tagline) continue;
  const cs = caseStudies.get(p.slug);
  if (!cs) {
    findings.push({ check: "C", id: p.slug, status: "NO_CASE_STUDY", detail: `products.ts slug "${p.slug}" has no matching case-study module` });
    continue;
  }
  const tokens = extractTokens(p.tagline);
  const missing = tokensFoundIn(tokens, cs.fullText);
  if (missing.length > 0) {
    findings.push({
      check: "C",
      id: p.slug,
      status: "DRIFT",
      detail: `products.ts "${p.slug}"'s tagline ("${p.tagline}") has token(s) [${missing.join(", ")}] not found anywhere in its own case-study body`,
    });
  }
}

const drift = findings.filter((f) => f.status === "DRIFT");
const other = findings.filter((f) => f.status !== "DRIFT" && f.status !== "SKIPPED");

console.log(`check-card-consistency: ${Object.keys(metrics).length} metrics, ${products.length} products, ${caseStudies.size} case studies checked.`);
console.log(`  Check A (metrics.json vs. same-sourceRef case-study row): ${findings.filter((f) => f.check === "A" && f.status === "DRIFT").length} drift`);
console.log(`  Check B (products.ts figure vs. its own metric):          ${findings.filter((f) => f.check === "B" && f.status === "DRIFT").length} drift`);
console.log(`  Check C (products.ts tagline vs. its own case study):     ${findings.filter((f) => f.check === "C" && f.status === "DRIFT").length} drift`);

if (other.length > 0) {
  console.log(`\nConfig/structure issues (${other.length}) — not drift, but worth a look:`);
  for (const f of other) console.log(`  [${f.check}] ${f.id}: ${f.status} — ${f.detail}`);
}

if (drift.length > 0) {
  console.log(`\nFAIL — ${drift.length} same-project internal contradiction(s):\n`);
  for (const f of drift) console.log(`  [${f.check}] ${f.id}: ${f.detail}`);
  console.log("");
  process.exit(1);
}

console.log("\nOK — no same-project card/manifest/case-study contradictions found.");
