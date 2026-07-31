// Wave 19 — metric freshness check (runs weekly via
// .github/workflows/metrics-refresh.yml, or locally: node scripts/check-metric-freshness.mjs).
//
// WHY THIS EXISTS (root-cause context, not narrative for its own sake):
// the existing refresh job (scripts/refresh-metrics.mjs) diffs
// content/metrics.json against each source repo's OWN committed
// `.portfolio/metrics.json` manifest. That's structurally blind to the
// exact drift class this was built to catch: if a source repo's own
// manifest is never refreshed (nobody re-runs its measurement and commits
// the new number there), refresh-metrics.mjs faithfully finds "no diff"
// forever, even while the repo's real, current state has moved on. This
// happened for real: dealhunter's test count drifted 597 -> 727 while its
// own `.portfolio/metrics.json` stayed frozen at a 2026-06-09 snapshot —
// the weekly refresh ran, found no diff, and never flagged it (see
// content/provenance.md's wave-18/19 dealhunter entry).
//
// This script closes that gap a different way: instead of trusting an
// intermediate manifest, it re-reads the actual CURRENT source file
// (README.md, CHANGELOG.md, etc.) that each metric's `source_file` field
// already points to, and checks whether the recorded value's numbers are
// still present verbatim. It cannot re-run a repo's test suite or
// regenerate a report (no per-repo build environment here) — it is a
// text-presence check, not a re-measurement. That's a real, stated limit,
// not hidden: a number that happens to still appear in the file for an
// unrelated reason would false-negative (report CURRENT when it shouldn't).
// What it reliably catches: a number that's been edited OUT of its cited
// source (the exact failure mode found in triageiq, style-maitri,
// gold-rate-tracker, warmer, tracegauge this wave).
//
// Fails CLOSED, not open (rule 98a): a fetch failure (network error, 404,
// timeout) is reported as UNVERIFIABLE, a distinct state from CURRENT —
// never silently treated as "no drift found." Live-tested with a
// deliberately unfetchable fixture entry (a 404 against a real repo) via
// METRICS_PATH_OVERRIDE below; see the PR that introduced this file for the
// captured output. Note: `warmer:hinglish-fix`'s source lives in the
// private `mindmeld` repo — its non-standard `source_file` annotation
// format ("mindmeld (private): <path>") doesn't parse as a fetchable path
// by extractPath()'s heuristic, so it reports SKIPPED rather than
// UNVERIFIABLE. Both are "not verified this run," so the practical effect
// (no false CURRENT) is the same; SKIPPED is the more honest label for "we
// didn't even try" vs. UNVERIFIABLE's "we tried and failed."
//
// Runs independent of whether content/metrics.json itself has a diff this
// week (unlike refresh-metrics.mjs's PR, which only opens on a file diff)
// — the whole point is to surface drift metrics.json's own diff can't see.
// Reports via a single stable-titled issue (update-in-place, same
// convention as the "new repos"/"README renames" issues already in this
// workflow), not a PR — no proposed fix to review, just a signal.
//
// Wave 19, second half — the `verified-staleness` check below is a
// DIFFERENT signal from the drift check above, added for a different
// incident: triageiq's case study was touched by a commit (24a258d,
// 2026-07-26) two days after its cited source had already changed
// underneath it, and that commit's own message says every number was left
// "unchanged" — it was a copy-only framing pass. Git's mtime said "fresh."
// The page's numbers were already stale. A drift check (like the one
// above) only catches staleness AFTER a number has visibly diverged from
// its source text; it says nothing about whether anyone has actually
// looked. `CaseStudy.verifiedAt` (content/types.ts) is a field a human (or
// an explicit audit pass) sets ONLY when they've gone back to source and
// confirmed the numbers — never advanced by an unrelated edit touching the
// same file. This check flags any case study whose verifiedAt is more than
// VERIFIED_STALE_DAYS old, regardless of whether any numeric drift was
// separately detected — staleness of verification is its own signal, not
// a proxy for numeric drift and not implied by its absence.
//
// Zero dependencies; Node 20+ (global fetch + dynamic import).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Overridable for testing the failure path against a fixture that isn't
// the real content/metrics.json (same override convention as
// refresh-metrics.mjs's METRICS_REF).
const METRICS_PATH = process.env.METRICS_PATH_OVERRIDE ?? join(ROOT, "content", "metrics.json");
const CASE_STUDIES_INDEX_PATH = join(ROOT, "content", "case-studies", "index.ts");
const CASE_STUDIES_DIR = join(ROOT, "content", "case-studies");
const SUMMARY_PATH = process.env.FRESHNESS_SUMMARY_PATH ?? "/tmp/metric-freshness-summary.md";
const FETCH_TIMEOUT_MS = 20_000;
// Suggested by the task that requested this check; a case study older than
// this is flagged regardless of whether numeric drift was also found.
const VERIFIED_STALE_DAYS = 30;
// Numeric tokens shorter than this (after stripping a trailing '%') are
// skipped as match candidates — a bare "5" or "0" appears in almost any
// file by chance, which would make "at least one token found" a
// meaningless signal. Decimals and 3+ digit numbers are specific enough to
// be real evidence.
const MIN_TOKEN_LEN = 3;

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// A metrics.json `source_file` value is sometimes a real repo-relative
// path ("CHANGELOG.md"), sometimes a path with an explanatory parenthetical
// appended by a hand-edit ("CHANGELOG.md (CURRENT_STATE.md's 601 is ...)"),
// and sometimes not a fetchable path at all ("pytest --collect-only (...)").
// Extract just the leading path token; the caller decides fetchability from
// whether it looks like a real file (has a dot-extension, no spaces).
function extractPath(sourceFile) {
  if (!sourceFile) return null;
  const first = sourceFile.split(/\s+\(/)[0].trim();
  if (/\s/.test(first)) return null; // "pytest --collect-only" etc. — not a path
  if (!/\.[a-zA-Z0-9]+$/.test(first)) return null; // no extension — not a file path
  return first;
}

// Extract numeric tokens worth checking for verbatim presence. Percent
// signs are stripped (a source file might render "94.4%" as "94.4 percent"
// or inside different punctuation) but the digits themselves are the
// actual evidence.
function extractTokens(value) {
  if (!value) return [];
  const matches = value.match(/\d+(?:\.\d+)?/g) ?? [];
  return [...new Set(matches)].filter((t) => t.replace(".", "").length >= MIN_TOKEN_LEN);
}

// Same discovery convention as scripts/chatbot/build-index.mjs: parse
// index.ts's own import statements rather than hardcoding the slug list,
// so a newly-added case study is picked up automatically.
function discoverCaseStudyModules() {
  const indexSrc = readFileSync(CASE_STUDIES_INDEX_PATH, "utf8");
  return [...indexSrc.matchAll(/import \{ (\w+) \} from "\.\/([\w-]+)";/g)].map(
    ([, exportName, fileName]) => ({ exportName, fileName })
  );
}

async function checkVerifiedStaleness() {
  const modules = discoverCaseStudyModules();
  const today = new Date();
  const rows = []; // { slug, verifiedAt, daysOld, stale: boolean } | { slug, error }

  for (const { exportName, fileName } of modules) {
    const fileUrl = pathToFileURL(join(CASE_STUDIES_DIR, `${fileName}.ts`)).href;
    let mod;
    try {
      mod = await import(fileUrl);
    } catch (err) {
      rows.push({ slug: fileName, error: `failed to load: ${err.message}` });
      continue;
    }
    const study = mod[exportName];
    if (!study?.verifiedAt) {
      rows.push({ slug: fileName, error: "no verifiedAt field set" });
      continue;
    }
    const verifiedDate = new Date(study.verifiedAt);
    if (Number.isNaN(verifiedDate.getTime())) {
      rows.push({ slug: fileName, error: `verifiedAt "${study.verifiedAt}" is not a parseable date` });
      continue;
    }
    const daysOld = Math.floor((today - verifiedDate) / (1000 * 60 * 60 * 24));
    rows.push({ slug: study.slug ?? fileName, verifiedAt: study.verifiedAt, daysOld, stale: daysOld > VERIFIED_STALE_DAYS });
  }
  return rows;
}

const store = JSON.parse(readFileSync(METRICS_PATH, "utf8"));
const entries = Object.entries(store.metrics ?? {});

const results = []; // { id, status: "CURRENT" | "POSSIBLE_DRIFT" | "UNVERIFIABLE" | "SKIPPED", detail }

for (const [id, m] of entries) {
  const path = extractPath(m.source_file);
  if (!path || !m.repo) {
    results.push({ id, status: "SKIPPED", detail: `source_file "${m.source_file ?? "—"}" isn't a fetchable file path` });
    continue;
  }

  const tokens = extractTokens(m.value);
  if (tokens.length === 0) {
    results.push({ id, status: "SKIPPED", detail: `value "${m.value}" has no numeric tokens to check` });
    continue;
  }

  const url = `https://raw.githubusercontent.com/${m.repo}/HEAD/${path}`;
  let text;
  try {
    text = await fetchText(url);
  } catch (err) {
    // Fails CLOSED: a fetch failure is reported, never silently dropped or
    // treated as "no drift" (rule 98a). A private repo (e.g. mindmeld,
    // behind warmer:hinglish-fix's mindmeld-payloads mirror) is the
    // expected real case this hits.
    results.push({ id, status: "UNVERIFIABLE", detail: `fetch failed for ${url}: ${err.message}` });
    continue;
  }

  const found = tokens.filter((t) => text.includes(t));
  if (found.length === 0) {
    results.push({
      id,
      status: "POSSIBLE_DRIFT",
      detail: `none of [${tokens.join(", ")}] found in current ${m.repo}/${path} (value: "${m.value}")`,
    });
  } else {
    results.push({ id, status: "CURRENT", detail: `${found.length}/${tokens.length} token(s) confirmed present` });
  }
}

const byStatus = (s) => results.filter((r) => r.status === s);
const drift = byStatus("POSSIBLE_DRIFT");
const unverifiable = byStatus("UNVERIFIABLE");
const current = byStatus("CURRENT");
const skipped = byStatus("SKIPPED");

const verifiedRows = await checkVerifiedStaleness();
const staleVerification = verifiedRows.filter((r) => r.stale);
const missingVerification = verifiedRows.filter((r) => r.error);

const today = new Date().toISOString().slice(0, 10);
const lines = [];
lines.push(`## Weekly metric freshness check — ${today}`);
lines.push("");
lines.push(
  "Re-checks each tracked metric's numbers against its cited source file's CURRENT content " +
    "(not against the source repo's own possibly-stale `.portfolio/metrics.json` manifest — " +
    "see scripts/check-metric-freshness.mjs's header for why that distinction matters). " +
    "A text-presence check, not a re-measurement: it can miss drift where the old number " +
    "coincidentally still appears, but a confirmed absence is real signal."
);
lines.push("");

if (drift.length > 0) {
  lines.push(`### Possible drift — ${drift.length} metric(s) (needs a human look)`);
  lines.push("");
  for (const r of drift) lines.push(`- \`${r.id}\`: ${r.detail}`);
  lines.push("");
}

if (unverifiable.length > 0) {
  lines.push(`### Unverifiable this run — ${unverifiable.length} metric(s)`);
  lines.push("");
  lines.push("Fetch failed; NOT treated as fresh. Re-check manually or next scheduled run.");
  lines.push("");
  for (const r of unverifiable) lines.push(`- \`${r.id}\`: ${r.detail}`);
  lines.push("");
}

lines.push(
  `### Summary: ${current.length} current, ${drift.length} possible drift, ${unverifiable.length} unverifiable, ${skipped.length} skipped (no fetchable path or no numeric tokens)`
);
lines.push("");
lines.push(
  "_Metric coverage: content/metrics.json's tracked product-card metrics only — not every " +
    "number on every case-study page (most case-study prose/results numbers aren't wired " +
    "through metrics.json and have no numeric-drift check above)._"
);
lines.push("");

lines.push(`## Case-study verification staleness (>${VERIFIED_STALE_DAYS} days)`);
lines.push("");
lines.push(
  "Independent of numeric drift above — a page with zero detected drift can still be overdue " +
    "for a real re-check. `verifiedAt` is a human-set field (content/types.ts), never advanced " +
    "by an unrelated edit touching the same file — see that field's own doc comment for the " +
    "incident (triageiq, wave 15) this check exists to prevent recurring."
);
lines.push("");
if (staleVerification.length > 0) {
  lines.push(`### Overdue for re-verification — ${staleVerification.length} case stud${staleVerification.length === 1 ? "y" : "ies"}`);
  lines.push("");
  for (const r of staleVerification) {
    lines.push(`- \`${r.slug}\`: verifiedAt ${r.verifiedAt}, ${r.daysOld} days ago`);
  }
  lines.push("");
}
if (missingVerification.length > 0) {
  lines.push(`### Could not check — ${missingVerification.length} case stud${missingVerification.length === 1 ? "y" : "ies"}`);
  lines.push("");
  for (const r of missingVerification) lines.push(`- \`${r.slug}\`: ${r.error}`);
  lines.push("");
}
if (staleVerification.length === 0 && missingVerification.length === 0) {
  lines.push(`All ${verifiedRows.length} case studies verified within the last ${VERIFIED_STALE_DAYS} days.`);
  lines.push("");
}
lines.push(
  "_Generated by scripts/check-metric-freshness.mjs._"
);

const summary = lines.join("\n") + "\n";
process.stdout.write(summary);
writeFileSync(SUMMARY_PATH, summary);

// Deliberately always exits 0 — same convention as identity-drift.mjs and
// refresh-metrics.mjs: this script's job is to report, never to fail the
// CI step itself. The workflow's next step decides whether to open/update
// an issue by checking this summary's content, not this process's exit
// code (a non-zero exit here would mark the whole job failed for a normal,
// expected "found some drift" outcome, which is the opposite of what a
// weekly report job should do).
console.log(
  `\n--> metrics: ${current.length} current, ${drift.length} possible drift, ${unverifiable.length} unverifiable, ${skipped.length} skipped. ` +
    `verification: ${staleVerification.length} overdue, ${missingVerification.length} unreadable, of ${verifiedRows.length} case studies.`
);
