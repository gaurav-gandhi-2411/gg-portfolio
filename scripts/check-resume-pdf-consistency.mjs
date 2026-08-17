// 2026-08-10 — public/resume.pdf vs. content/resume-data.json consistency
// gate (run locally: node scripts/check-resume-pdf-consistency.mjs; wired
// into ci.yml).
//
// WHY THIS EXISTS: public/resume.pdf is a hand-built docx export (see
// content/resume-metrics.json's header) — it is the one artifact on the site
// that sits entirely outside every other gate in this repo. It went stale
// unnoticed: it kept claiming TriageIQ's pre-ADR-0036 classifier accuracy
// (82.5%/90.4%) for weeks after content/resume-data.json — the actively
// maintained, audited source of truth for resume content — had already been
// corrected to 87.1%/89.8%. content/resume-metrics.json's own
// store_value_at_sync field theoretically could have caught this, but that
// field is a manually-maintained proxy for what the PDF says, never verified
// against the PDF's actual bytes — it can itself go stale (and did, in this
// exact incident). This check reads the PDF directly instead of trusting a
// proxy.
//
// Mechanism: for each project resume-data.json describes, if that project
// has its own full bulleted entry in the PDF (see isCoveredByFullBullet
// below — not every project resume-data.json tracks makes it into every
// resume build, and a bare name-drop in an "other projects" summary
// sentence doesn't count), every "significant" numeric token resume-data
// .json's own text for that project contains must appear somewhere in the
// PDF's full text too. A text-presence check, not a full semantic
// re-verification (same stated limit as check-metric-freshness.mjs and
// check-card-consistency.mjs) — it cannot prove a present number is
// attached to the *right* claim, only that resume-data.json's current
// numbers weren't silently dropped/replaced. That's exactly the failure
// shape the TriageIQ incident took, and exactly what this catches.
//
// MIN_TOKEN_LEN=3 (digits-only length), same threshold and same reasoning as
// check-metric-freshness.mjs: the haystack here is the *whole* resume PDF
// across every project, not one project's own narrow scope (contrast
// check-card-consistency.mjs's deliberate no-filter), so short numbers like
// a bare "8 stores" are real coincidental-match noise risk, not signal —
// same stated, deliberate limit, not hidden.
//
// Needs pdfjs-dist (only script in this repo with that dependency — every
// other check here is zero-dependency by design).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RESUME_DATA_PATH = join(ROOT, "content", "resume-data.json");
const RESUME_PDF_PATH = join(ROOT, "public", "resume.pdf");

const MIN_TOKEN_LEN = 3;
const NUMBER_PATTERN = /\d[\d,]*(?:\.\d+)?/g;

function extractTokens(text) {
  if (!text) return [];
  const matches = text.match(NUMBER_PATTERN) ?? [];
  const seen = new Set();
  const tokens = [];
  for (const raw of matches) {
    const digitsOnly = raw.replace(/[,.]/g, "");
    if (digitsOnly.length < MIN_TOKEN_LEN) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    const n = Number(raw.replace(/,/g, ""));
    const alternates = [raw];
    if (n >= 0 && n <= 100) {
      const asFraction = (n / 100).toFixed(6).replace(/0+$/, "").replace(/\.$/, ".0");
      alternates.push(asFraction);
    }
    // A precise count (52,494) legitimately reads as a rounded "~52K" in a
    // space-constrained resume bullet — not drift. Round() and floor() can
    // differ by one (52,567 -> 53K rounded, 52K floored); accept either
    // rather than pick one and risk a false FAIL on a correct rounding.
    if (n >= 1000) {
      alternates.push(`${Math.round(n / 1000)}K`, `${Math.floor(n / 1000)}K`);
    }
    tokens.push({ display: raw, alternates });
  }
  return tokens;
}

function tokensFoundIn(tokens, haystack) {
  return tokens.filter((t) => !t.alternates.some((a) => haystack.includes(a))).map((t) => t.display);
}

// resume-data.json's bold heading text_run is the project's display line,
// e.g. "TriageIQ — ML issue-triage service" or "Multimodal Fashion
// Recommender" (no dash for single-clause headings). The part before " — "
// (an em dash, not a hyphen) is the anchor used to detect PDF coverage.
function projectAnchor(entry) {
  const heading = entry.text_runs?.[0]?.text ?? "";
  return heading.split(" — ")[0].trim();
}

// A project's name can appear in the PDF two ways that must NOT be treated
// the same: as its own full bulleted entry (this resume's hand-written
// version of that project's write-up — the thing whose numbers should
// match resume-data.json), or as a bare name-drop inside a denser "other
// projects" summary sentence covering several projects at once (a
// deliberate editorial compression, not drift — e.g. this resume's actual
// text: "tracegauge (published PyPI package...); Gold Rate Tracker (the
// forecaster that ships its naive baseline...)"). Both patterns put the
// name immediately before punctuation, but only a full bullet's heading is
// followed by an em dash within a short window (allowing for "Live GitHub"/
// "Demo GitHub" link-label text the PDF layout inserts between the name and
// the dash) — a name-drop is followed by "(" or ";" with no dash nearby.
// Checked across every occurrence, not just the first: a project can be
// mentioned once in prose (e.g. the summary paragraph) AND separately given
// its own full bullet lower down.
const BULLET_DASH_WINDOW = 80;

function isCoveredByFullBullet(anchor, haystack) {
  let idx = 0;
  while (true) {
    idx = haystack.indexOf(anchor, idx);
    if (idx === -1) return false;
    const after = haystack.slice(idx + anchor.length, idx + anchor.length + BULLET_DASH_WINDOW);
    if (after.includes("—")) return true;
    idx += anchor.length;
  }
}

async function extractPdfText(path) {
  const data = new Uint8Array(readFileSync(path));
  const doc = await getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return text;
}

const resumeData = JSON.parse(readFileSync(RESUME_DATA_PATH, "utf8"));
const projects = resumeData.entries.filter((e) => e.section === "project" && e.text_runs?.length);

const pdfText = await extractPdfText(RESUME_PDF_PATH);

// Which projects this resume writes up as full bullets. Everything above
// derives that from formatting: the anchor comes from splitting a heading on
// " — ", and the full-bullet test looks for an em dash after the name in the
// PDF. So an edit that reflows a heading changes what gets checked, and the
// only signal was a count nobody read. Rewriting the four project entries in
// site style, commas instead of the separator, took coverage from five to one
// and turned the gate green by making it stop looking.
//
// This is the second, hand-maintained reading of the same fact. A project
// that stops being detected fails here by name instead of vanishing from a
// denominator. When the resume itself changes, edit this list in the same
// commit: that is a deliberate act with a visible diff, which is the whole
// difference between updating a gate and quietly disabling it.
const EXPECTED_PDF_COVERAGE = ["agentgauge", "reviewiq", "style-maitri", "tracegauge", "triageiq"];

const findings = [];
const covered = [];

for (const entry of projects) {
  const anchor = projectAnchor(entry);
  if (!anchor || !isCoveredByFullBullet(anchor, pdfText)) continue; // not in this resume as a full entry — nothing to check
  covered.push(entry.project ?? anchor);

  const fullText = entry.text_runs.map((r) => r.text).join("");
  const tokens = extractTokens(fullText);
  const missing = tokensFoundIn(tokens, pdfText);
  if (missing.length > 0) {
    findings.push({
      id: entry.project ?? anchor,
      anchor,
      detail: `resume-data.json's "${anchor}" entry has number(s) [${missing.join(", ")}] not found anywhere in public/resume.pdf's text, even though "${anchor}" is covered there — the PDF may be citing stale/different values`,
    });
  }
}

const coveredSet = new Set(covered);
const dropped = EXPECTED_PDF_COVERAGE.filter((p) => !coveredSet.has(p)).sort();
const gained = covered.filter((p) => !EXPECTED_PDF_COVERAGE.includes(p)).sort();

console.log(
  `check-resume-pdf-consistency: ${projects.length} projects in resume-data.json, ` +
    `${covered.length} covered by public/resume.pdf and checked (expected ${EXPECTED_PDF_COVERAGE.length}).`
);
console.log(`  checked: ${covered.slice().sort().join(", ") || "(none)"}`);

if (dropped.length > 0 || gained.length > 0) {
  console.log("\nFAIL — the set of projects this check can see has moved:\n");
  if (dropped.length > 0) {
    console.log(`  no longer detected: ${dropped.join(", ")}`);
    console.log("    Their numbers are no longer compared against the PDF at all. Usually a");
    console.log('    heading in resume-data.json that lost its " — " separator, which is what');
    console.log("    the anchor is split on. Restore the separator, or update EXPECTED_PDF_COVERAGE");
    console.log("    in this file if the resume genuinely stopped covering the project.");
  }
  if (gained.length > 0) {
    console.log(`  newly detected: ${gained.join(", ")}`);
    console.log("    Add them to EXPECTED_PDF_COVERAGE so the next drop is visible.");
  }
  console.log("");
  process.exit(1);
}

if (findings.length > 0) {
  console.log(`\nFAIL — ${findings.length} project(s) where public/resume.pdf contradicts content/resume-data.json:\n`);
  for (const f of findings) console.log(`  ${f.id}: ${f.detail}`);
  console.log(
    "\npublic/resume.pdf is hand-regenerated from a gitignored .docx master (see content/provenance.md's " +
      "resume section) — a human needs to rebuild and re-export it, then re-run this check locally before pushing."
  );
  process.exit(1);
}

console.log("\nOK — no public/resume.pdf vs. content/resume-data.json contradictions found.");
