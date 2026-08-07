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
const PROVENANCE_PATH = process.env.PROVENANCE_PATH_OVERRIDE ?? join(ROOT, "content", "provenance.md");
const SUMMARY_PATH = process.env.FRESHNESS_SUMMARY_PATH ?? "/tmp/metric-freshness-summary.md";
const FETCH_TIMEOUT_MS = 20_000;
// Suggested by the task that requested this check; a case study older than
// this is flagged regardless of whether numeric drift was also found.
const VERIFIED_STALE_DAYS = 30;

// Wave 20 — case-study slug -> source repo, "owner/name" or null for a
// private repo (fetch would need auth this script deliberately doesn't
// carry — see warmer below). Hand-maintained; a new case study needs one
// line here or its claims fall into `NO_REPO_MAPPING` below rather than
// silently going unchecked with no explanation.
const CASE_STUDY_REPO = {
  warmer: null, // mindmeld is private; see content/provenance.md's warmer section
  "style-maitri": "gaurav-gandhi-2411/agentic-shopping-assistant",
  triageiq: "gaurav-gandhi-2411/triage-iq",
  dealhunter: "gaurav-gandhi-2411/agentic-travel-booking-system",
  shelfsense: "gaurav-gandhi-2411/shelfsense-m5",
  reviewiq: "gaurav-gandhi-2411/review-iq",
  "multimodal-fashion-recommender": "gaurav-gandhi-2411/multimodal-fashion-recommender",
  "gold-rate-tracker": "gaurav-gandhi-2411/gold-rate-tracker",
  aetherart: "gaurav-gandhi-2411/AetherArt",
  agentgauge: "gaurav-gandhi-2411/agentgauge",
  reclaim: "gaurav-gandhi-2411/reclaim",
  tracegauge: "gaurav-gandhi-2411/token-efficiency-scorer",
  "expense-tracker": "gaurav-gandhi-2411/expense-tracker",
};
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
//
// Each token also carries its fraction-form alternate (94.4 -> 0.944):
// a real false-positive class this caught on first run — reclaim's case
// study displays "7.64%" / "100.00%" while its source (docs/CASE_STUDY.md)
// states the identical measurement as "0.0764" / "1.0000". Same number,
// different convention, not drift. A token matches if EITHER form is
// present in the source text.
function extractTokens(value) {
  if (!value) return [];
  const matches = value.match(/\d+(?:\.\d+)?/g) ?? [];
  const unique = [...new Set(matches)].filter((t) => t.replace(".", "").length >= MIN_TOKEN_LEN);
  return unique.map((t) => {
    const n = Number(t);
    const alternates = [t];
    if (n >= 0 && n <= 100) {
      // Percent -> fraction, e.g. "94.4" -> "0.944"; trim to avoid
      // spurious trailing zeros that would never appear in prose ("0.944"
      // not "0.9440000000000001").
      const asFraction = (n / 100).toFixed(6).replace(/0+$/, "").replace(/\.$/, ".0");
      if (asFraction !== t) alternates.push(asFraction);
    }
    return { display: t, alternates };
  });
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

// Parses content/provenance.md's `| \`id\` | claim | source |` rows into a
// Map. Deliberately simple (one regex, one physical line per row, which is
// what a real markdown table requires) rather than a full markdown parser
// — 133 of 145 rows parse cleanly; rows that don't (multi-line cells, a
// small number of narrative-only rows) are absent from the map, and any
// case-study sourceRef pointing at one reports NO_PROVENANCE_ROW below,
// visibly, rather than silently matching nothing.
function parseProvenance() {
  const lines = readFileSync(PROVENANCE_PATH, "utf8").split(/\r?\n/);
  const idToSource = new Map();
  for (const line of lines) {
    const m = line.match(/^\| `([a-zA-Z0-9:_.#-]+)` \| (.*) \| (.*) \|$/);
    if (!m) continue;
    idToSource.set(m[1], { claim: m[2], source: m[3] });
  }
  return idToSource;
}

// Pulls every plausible repo-relative file path out of a provenance row's
// Source cell — NOT just the first. A real false positive on first run:
// `gold:direction-baseline`'s row cites TWO files
// (`docs/adr/019-....md:16-35,62-72`, `docs/DIRECTION_SIGNAL_STATUS.md:15-20`)
// because the ADR explains the decision but the actual current numbers
// (52.06%, 49.5%, etc.) live in the second, later-updated file. Checking
// only the first file reported real numbers as "missing" when they were
// simply in the row's other cited source. A claim now only flags drift if
// its tokens are absent from ALL cited files, not just the first one.
// Strips a leading `<repoSlug>/` if the caller's repo's own name prefixes
// a path (provenance.md sometimes writes paths repo-qualified when a row
// could be confused with another project's file of the same name).
//
// A path may carry an optional trailing `@<sha>` pin (e.g.
// `` `data/backtest.json@d41372a` ``), checked AFTER the optional
// `:line-range` — this is the fix for issue #45 (rule 98a-adjacent): a
// claim sourced from a file that's rewritten by scheduled automation
// (bot-refreshed continuously, not human-edited) is a moving target at
// `HEAD` — the claim was true of one specific commit's snapshot, and
// checking a LATER commit's content answers a different question ("does
// the bot's current output still say this" rather than "did the site
// correctly report what its cited source said"), producing a false
// POSSIBLE_DRIFT every time the bot runs. A human-committed file (README,
// a one-off report) deliberately stays unpinned, fetched at HEAD — that's
// what lets a real future edit (someone updating the number without
// updating the site) still get caught. Pin only sources the claim's own
// note documents as automated; see `content/provenance.md`'s
// `gold-rate-tracker:headline` row for the convention.
function extractPathsFromSource(source, repoSlug) {
  const matches = [...source.matchAll(/`([\w./-]+\.[a-zA-Z0-9]+)(:[\d,-]+)?(@[0-9a-f]{7,40})?`/g)];
  return matches.map((m) => {
    let path = m[1];
    if (repoSlug && path.startsWith(`${repoSlug}/`)) path = path.slice(repoSlug.length + 1);
    const ref = m[3] ? m[3].slice(1) : null;
    return { path, ref };
  });
}

// Display label for a {path, ref} pair — `path@sha` when pinned, bare
// `path` when it resolves at HEAD (the common case), so report text makes
// the pin visible without cluttering every unpinned citation.
function pathLabel(p) {
  return p.ref ? `${p.path}@${p.ref}` : p.path;
}

// Extensions this check cannot verify by text search — a binary file
// doesn't contain the claim's digits as matchable text (a parquet file's
// "52494" is encoded, not printed), so a text-presence check against one
// can only ever fail, and reporting that failure as UNVERIFIABLE implies
// "try again later" when re-trying changes nothing: the check is
// structurally incapable of verifying this source, full stop (issue #45
// task 3). Claims citing a binary must cite a text artifact (a report or
// JSON summary) that carries the same number instead.
const BINARY_EXTENSIONS = new Set([
  ".parquet", ".pkl", ".pickle", ".npz", ".npy", ".db", ".sqlite", ".sqlite3",
  ".bin", ".pt", ".pth", ".ckpt", ".onnx", ".h5", ".hdf5", ".feather", ".arrow",
]);
function isBinaryPath(path) {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return false;
  return BINARY_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

// Walks one case study's results/decisions/story fields for every
// sourceRef-carrying claim, pairing each with the exact text the site
// displays for it (value+detail for a result row, body for a decision,
// the joined paragraphs for the story) — this is the text that actually
// ships, not a separately-maintained copy of it, so there's no risk of
// this check validating against stale metadata about itself.
function collectCaseStudyClaims(study) {
  const claims = [];
  for (const r of study.results ?? []) {
    claims.push({ sourceRef: r.sourceRef, text: `${r.value} ${r.detail ?? ""}`.trim(), kind: "result" });
  }
  for (const d of study.decisions ?? []) {
    claims.push({ sourceRef: d.sourceRef, text: d.body, kind: "decision" });
  }
  if (study.story) {
    claims.push({ sourceRef: study.story.sourceRef, text: study.story.body.join(" "), kind: "story" });
  }
  if (study.diagram) {
    const pointsText = study.diagram.points.map((p) => `${p.label} ${p.value}`).join(" ");
    claims.push({ sourceRef: study.diagram.sourceRef, text: `${pointsText} ${study.diagram.caption}`, kind: "diagram" });
  }
  return claims;
}

async function checkCaseStudyClaims(provenance) {
  const modules = discoverCaseStudyModules();
  const claimResults = []; // { slug, sourceRef, kind, status, detail }

  for (const { exportName, fileName } of modules) {
    const fileUrl = pathToFileURL(join(CASE_STUDIES_DIR, `${fileName}.ts`)).href;
    let study;
    try {
      study = (await import(fileUrl))[exportName];
    } catch {
      continue; // already reported by checkVerifiedStaleness
    }
    const repo = Object.hasOwn(CASE_STUDY_REPO, fileName) ? CASE_STUDY_REPO[fileName] : undefined;
    const repoSlug = repo ? repo.split("/")[1] : null;

    for (const { sourceRef, text, kind } of collectCaseStudyClaims(study)) {
      const base = { slug: fileName, sourceRef, kind };

      const tokens = extractTokens(text);
      if (tokens.length === 0) {
        claimResults.push({ ...base, status: "NOT_NUMERIC", detail: "no numeric token in displayed text (Task 3's territory, not this check's)" });
        continue;
      }
      if (repo === undefined) {
        claimResults.push({ ...base, status: "NO_REPO_MAPPING", detail: `"${fileName}" has no entry in CASE_STUDY_REPO` });
        continue;
      }
      if (repo === null) {
        claimResults.push({ ...base, status: "SKIPPED_PRIVATE_REPO", detail: "source repo is private; not fetchable without auth this script doesn't carry" });
        continue;
      }
      const row = provenance.get(sourceRef);
      if (!row) {
        claimResults.push({ ...base, status: "NO_PROVENANCE_ROW", detail: `no content/provenance.md row for sourceRef "${sourceRef}"` });
        continue;
      }
      const allPaths = extractPathsFromSource(row.source, repoSlug);
      if (allPaths.length === 0) {
        claimResults.push({ ...base, status: "SKIPPED_NO_PATH", detail: `provenance source "${row.source}" has no extractable file path` });
        continue;
      }

      // Binary paths are split out before any fetch is attempted — a
      // text-presence check against a parquet/pickle/etc. can only ever
      // fail, so it's not "unverifiable this run" (implying a retry might
      // help), it's structurally unverifiable by this method, always
      // (issue #45 task 3). If EVERY cited path is binary, report that
      // distinctly; if some are binary and at least one is text, the text
      // path(s) still carry the check (same union logic as multi-path
      // fetches below) and the binary path is silently excluded from the
      // fetch loop — its presence doesn't block verification via the
      // text sibling, it just can't contribute evidence itself.
      const paths = allPaths.filter((p) => !isBinaryPath(p.path));
      const binaryPaths = allPaths.filter((p) => isBinaryPath(p.path));
      if (paths.length === 0) {
        claimResults.push({
          ...base,
          status: "STRUCTURALLY_UNVERIFIABLE",
          detail: `all ${binaryPaths.length} cited path(s) are binary — a text-presence check cannot verify ${binaryPaths.map(pathLabel).join(", ")}; cite a text artifact (report or JSON summary) that carries the same number instead`,
        });
        continue;
      }

      // Union across every cited file: a token counts as found if it (or
      // its %/fraction alternate) appears in ANY of them. A fetch failure
      // on one cited file doesn't abort the claim if another cited file
      // still resolves — but if EVERY cited file fails to fetch, that's
      // reported as UNVERIFIABLE, not silently treated as drift.
      const foundIn = new Set();
      const fetchErrors = [];
      for (const { path, ref } of paths) {
        const url = `https://raw.githubusercontent.com/${repo}/${ref ?? "HEAD"}/${path}`;
        let sourceText;
        try {
          sourceText = await fetchText(url);
        } catch (err) {
          fetchErrors.push(`${path}: ${err.message}`);
          continue;
        }
        for (const t of tokens) {
          if (t.alternates.some((a) => sourceText.includes(a))) foundIn.add(t.display);
        }
      }
      if (fetchErrors.length === paths.length) {
        claimResults.push({ ...base, status: "UNVERIFIABLE", detail: `all ${paths.length} cited path(s) failed to fetch: ${fetchErrors.join("; ")}` });
        continue;
      }
      // Any-match was a real bug (found 2026-08-06, gold:direction-baseline):
      // a claim with several cited numbers reported CURRENT as soon as ONE
      // happened to still match, even when the rest had drifted. Requiring
      // ALL tokens catches that; PARTIAL is a distinct third state so a
      // claim that's mostly right but has one stale figure reads
      // differently from one that's entirely wrong.
      const shownPaths = paths.map(pathLabel).join(", ");
      if (foundIn.size === tokens.length) {
        claimResults.push({ ...base, status: "CURRENT", detail: `${foundIn.size}/${tokens.length} token(s) confirmed present across ${repo}/{${shownPaths}}` });
      } else if (foundIn.size === 0) {
        const shown = tokens.map((t) => t.display).join(", ");
        claimResults.push({ ...base, status: "POSSIBLE_DRIFT", detail: `none of [${shown}] (or their %/fraction equivalent) found in ${repo}/{${shownPaths}} (text: "${text.slice(0, 100)}")` });
      } else {
        const missing = tokens.filter((t) => !foundIn.has(t.display)).map((t) => t.display).join(", ");
        claimResults.push({ ...base, status: "PARTIAL", detail: `${foundIn.size}/${tokens.length} token(s) confirmed present across ${repo}/{${shownPaths}}, but missing: [${missing}] — some cited numbers may have drifted even though others still match (text: "${text.slice(0, 100)}")` });
      }
    }
  }
  return claimResults;
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

  if (isBinaryPath(path)) {
    results.push({
      id,
      status: "STRUCTURALLY_UNVERIFIABLE",
      detail: `source_file "${path}" is binary — a text-presence check cannot verify it; cite a text artifact (report or JSON summary) instead`,
    });
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

  // Any-match was a real bug (found 2026-08-06, gold:direction-baseline):
  // a claim with several cited numbers reported CURRENT as soon as ONE
  // happened to still match, even when the rest had drifted — a stale
  // n=93/92 base-rate row passed for weeks because its 60.9% figure
  // coincidentally survived a later data-accumulation fix that moved
  // every OTHER number in the same claim. Requiring ALL tokens catches
  // that; PARTIAL is a distinct third state (not folded into DRIFT) so a
  // claim that's mostly right but has one stale figure reads differently
  // from one that's entirely wrong.
  const found = tokens.filter((t) => t.alternates.some((a) => text.includes(a)));
  if (found.length === tokens.length) {
    results.push({ id, status: "CURRENT", detail: `${found.length}/${tokens.length} token(s) confirmed present` });
  } else if (found.length === 0) {
    const shown = tokens.map((t) => t.display).join(", ");
    results.push({
      id,
      status: "POSSIBLE_DRIFT",
      detail: `none of [${shown}] (or their %/fraction equivalent) found in current ${m.repo}/${path} (value: "${m.value}")`,
    });
  } else {
    const missing = tokens.filter((t) => !found.includes(t)).map((t) => t.display).join(", ");
    results.push({
      id,
      status: "PARTIAL",
      detail: `${found.length}/${tokens.length} token(s) confirmed present in current ${m.repo}/${path}, but missing: [${missing}] — some cited numbers may have drifted even though others still match (value: "${m.value}")`,
    });
  }
}

const byStatus = (s) => results.filter((r) => r.status === s);
const drift = byStatus("POSSIBLE_DRIFT");
const partial = byStatus("PARTIAL");
const unverifiable = byStatus("UNVERIFIABLE");
const structurallyUnverifiable = byStatus("STRUCTURALLY_UNVERIFIABLE");
const current = byStatus("CURRENT");
const skipped = byStatus("SKIPPED");

const verifiedRows = await checkVerifiedStaleness();
const staleVerification = verifiedRows.filter((r) => r.stale);
const missingVerification = verifiedRows.filter((r) => r.error);

const provenance = parseProvenance();
const claimResults = await checkCaseStudyClaims(provenance);
const claimsByStatus = (s) => claimResults.filter((r) => r.status === s);
const claimsCurrent = claimsByStatus("CURRENT");
const claimsDrift = claimsByStatus("POSSIBLE_DRIFT");
const claimsPartial = claimsByStatus("PARTIAL");
const claimsUnverifiable = claimsByStatus("UNVERIFIABLE");
const claimsStructurallyUnverifiable = claimsByStatus("STRUCTURALLY_UNVERIFIABLE");
const claimsNotNumeric = claimsByStatus("NOT_NUMERIC");
const claimsSkippedPrivate = claimsByStatus("SKIPPED_PRIVATE_REPO");
const claimsSkippedNoPath = claimsByStatus("SKIPPED_NO_PATH");
const claimsNoProvenanceRow = claimsByStatus("NO_PROVENANCE_ROW");
const claimsNoRepoMapping = claimsByStatus("NO_REPO_MAPPING");
// "Checked" = a real fetch was attempted and resolved one way or another
// (current, drift, or a fetch failure) — the denominator for the coverage
// count this task asked for. NOT_NUMERIC is correctly excluded (Task 3's
// territory, not a numeric claim), matching the task's own scope ("has...
// a numeric value"). Skipped/no-mapping/no-row are claims that COULD be
// numeric-checked in principle but this run's data/config didn't resolve
// far enough to try — reported separately, not folded into either bucket.
const claimsChecked = claimsCurrent.length + claimsDrift.length + claimsPartial.length + claimsUnverifiable.length;
const claimsNumericTotal = claimResults.length - claimsNotNumeric.length;

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

if (partial.length > 0) {
  lines.push(`### Partial drift — ${partial.length} metric(s) (some cited numbers matched, others didn't)`);
  lines.push("");
  lines.push(
    "Distinct from possible drift above: at least one cited number is still present, but not " +
      "all of them are — a claim can coincidentally keep one correct-looking digit while the " +
      "rest of it has moved on. Needs a human look at exactly which figure(s) are stale."
  );
  lines.push("");
  for (const r of partial) lines.push(`- \`${r.id}\`: ${r.detail}`);
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

if (structurallyUnverifiable.length > 0) {
  lines.push(`### Structurally unverifiable — ${structurallyUnverifiable.length} metric(s) (binary source; needs a text-artifact citation)`);
  lines.push("");
  lines.push(
    "Distinct from a fetch failure above: a binary file has nothing this check can retry — " +
      "re-running the job will never resolve it. Repoint `source_file` at a text artifact " +
      "(a report or JSON summary) that carries the same number."
  );
  lines.push("");
  for (const r of structurallyUnverifiable) lines.push(`- \`${r.id}\`: ${r.detail}`);
  lines.push("");
}

lines.push(
  `### Summary: ${current.length} current, ${drift.length} possible drift, ${partial.length} partial drift, ` +
    `${unverifiable.length} unverifiable, ${structurallyUnverifiable.length} structurally unverifiable, ` +
    `${skipped.length} skipped (no fetchable path or no numeric tokens)`
);
lines.push("");
lines.push(
  "_Metric coverage: content/metrics.json's tracked product-card metrics only — not every " +
    "number on every case-study page (most case-study prose/results numbers aren't wired " +
    "through metrics.json and have no numeric-drift check above)._"
);
lines.push("");

lines.push(`## Case-study claim coverage (results/decisions/story, not just product-card metrics)`);
lines.push("");
lines.push(
  `Every sourced numeric claim across all case studies, not just the ~14 promoted to a product-card ` +
    `metric in content/metrics.json. Same text-presence method as the section above, applied to the ` +
    `exact text the site displays (not a separately-maintained copy of it).`
);
lines.push("");
lines.push(
  `**Checked (fetch attempted): ${claimsChecked} of ${claimsNumericTotal} numeric claims** ` +
    `(${claimsCurrent.length} current, ${claimsDrift.length} possible drift, ${claimsPartial.length} partial drift, ${claimsUnverifiable.length} unverifiable). ` +
    `${claimResults.length - claimsNumericTotal} more claims are prose with no numeric anchor (not this check's scope).`
);
lines.push("");
if (claimsDrift.length > 0) {
  lines.push(`### Possible drift — ${claimsDrift.length} claim(s)`);
  lines.push("");
  for (const r of claimsDrift) lines.push(`- \`${r.slug}\` (${r.kind}, \`${r.sourceRef}\`): ${r.detail}`);
  lines.push("");
}
if (claimsPartial.length > 0) {
  lines.push(`### Partial drift — ${claimsPartial.length} claim(s) (some cited numbers matched, others didn't)`);
  lines.push("");
  lines.push(
    "Distinct from possible drift above: at least one cited number is still present, but not " +
      "all of them are — a claim can coincidentally keep one correct-looking digit while the " +
      "rest of it has moved on. Needs a human look at exactly which figure(s) are stale."
  );
  lines.push("");
  for (const r of claimsPartial) lines.push(`- \`${r.slug}\` (${r.kind}, \`${r.sourceRef}\`): ${r.detail}`);
  lines.push("");
}
if (claimsUnverifiable.length > 0) {
  lines.push(`### Unverifiable this run — ${claimsUnverifiable.length} claim(s)`);
  lines.push("");
  for (const r of claimsUnverifiable) lines.push(`- \`${r.slug}\` (\`${r.sourceRef}\`): ${r.detail}`);
  lines.push("");
}
if (claimsStructurallyUnverifiable.length > 0) {
  lines.push(`### Structurally unverifiable — ${claimsStructurallyUnverifiable.length} claim(s) (binary source; needs a text-artifact citation)`);
  lines.push("");
  lines.push(
    "Distinct from a fetch failure above: a binary file has nothing this check can retry — " +
      "re-running the job will never resolve it. Repoint the provenance.md row at a text " +
      "artifact (a report or JSON summary) that carries the same number."
  );
  lines.push("");
  for (const r of claimsStructurallyUnverifiable) lines.push(`- \`${r.slug}\` (\`${r.sourceRef}\`): ${r.detail}`);
  lines.push("");
}

// Deliberately its own prominent, always-visible-when-nonzero section
// rather than a clause inside a denser paragraph (issue #45 task 4):
// silent non-coverage reads as passing. GG's call (documented in the PR
// that added this section) was to surface the gap loudly rather than
// grant this script a cross-repo read token for 6 private repos — a new
// standing credential is a bigger, harder-to-reverse commitment than a
// clearly labeled coverage hole, and the choice is revisitable if the
// gap grows.
if (claimsSkippedPrivate.length > 0) {
  lines.push(`### ${claimsSkippedPrivate.length} claims UNCHECKED (no auth) — private source repo`);
  lines.push("");
  lines.push(
    "This script carries no credential for private repos, so these claims are neither " +
      "confirmed current nor flagged as drift — they are simply not covered this run. Not a " +
      "footnote: treat as unverified, not as passing."
  );
  lines.push("");
  for (const r of claimsSkippedPrivate) lines.push(`- \`${r.slug}\` (\`${r.sourceRef}\`): ${r.detail}`);
  lines.push("");
}

const claimsUncheckedForOtherReasons = claimsSkippedNoPath.length + claimsNoProvenanceRow.length + claimsNoRepoMapping.length;
if (claimsUncheckedForOtherReasons > 0) {
  lines.push(`### Numeric, but not checked this run — ${claimsUncheckedForOtherReasons} claim(s)`);
  lines.push("");
  lines.push(
    `${claimsSkippedNoPath.length} no extractable file path in their provenance row, ` +
      `${claimsNoProvenanceRow.length} no provenance.md row for that sourceRef at all, ` +
      `${claimsNoRepoMapping.length} case study missing from CASE_STUDY_REPO.`
  );
  lines.push("");
}

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
  `\n--> metrics: ${current.length} current, ${drift.length} possible drift, ${partial.length} partial drift, ${unverifiable.length} unverifiable, ` +
    `${structurallyUnverifiable.length} structurally unverifiable, ${skipped.length} skipped. ` +
    `claims: ${claimsChecked}/${claimsNumericTotal} numeric claims checked (${claimsCurrent.length} current, ${claimsDrift.length} drift, ${claimsPartial.length} partial drift, ${claimsUnverifiable.length} unverifiable, ${claimsStructurallyUnverifiable.length} structurally unverifiable). ` +
    `${claimsSkippedPrivate.length} claims UNCHECKED (no auth). ` +
    `verification: ${staleVerification.length} overdue, ${missingVerification.length} unreadable, of ${verifiedRows.length} case studies.`
);
