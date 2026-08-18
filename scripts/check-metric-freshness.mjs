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
// Wave 21 — a fourth artifact class: the gh-profile README banner
// (gaurav-gandhi-2411/gaurav-gandhi-2411, a different repo from this one)
// bakes three headline metrics as literal SVG text so they can animate via
// SMIL (see that repo's assets/build-banner.js). Nothing previously re-read
// those numbers against anything — a metrics.json update would silently
// leave the banner showing a stale figure forever. checkSvgMetrics() closes
// that gap the same way the rest of this file works: text-presence, not a
// re-measurement, checked against metrics.json's current value (not the
// upstream repo again — see that function's own comment for why).
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
// Overridable for testing checkSvgMetrics() against a branch before it
// merges to the gh-profile repo's default branch — same override
// convention as METRICS_PATH_OVERRIDE above. Production always uses HEAD
// (the default branch), never a specific ref, since the point of this
// check is "does the live banner match" — pinning it to a branch would
// silently stop checking the thing that's actually deployed.
const SVG_REF_OVERRIDE = process.env.SVG_REF_OVERRIDE ?? "HEAD";
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
  "adk-tracegauge": "gaurav-gandhi-2411/adk-tracegauge",
  "expense-tracker": "gaurav-gandhi-2411/expense-tracker",
};

// Wave 21 — a fourth artifact class, added after the animated gh-profile
// banner shipped: a headline metric baked as literal text inside a
// COMMITTED SVG in a DIFFERENT repo (gaurav-gandhi-2411/gaurav-gandhi-2411,
// not this one). Unlike content/metrics.json (refreshed weekly) or a
// case-study claim (checked above via checkCaseStudyClaims), nothing
// re-reads this SVG's numbers against anything, ever — if metrics.json's
// value changes, the banner silently keeps displaying the old one forever.
//
// Scope is deliberately narrow: this checks the SVG against
// content/metrics.json's CURRENT value, not against the upstream source
// repo a second time — metrics.json is already the gated source of truth
// (that's what the per-metric loop above exists for), so re-fetching e.g.
// triage-iq's README here would just duplicate that check against a
// different artifact for no new signal. If metrics.json itself is stale,
// the per-metric loop above already reports that.
//
// Hand-maintained, same convention as CASE_STUDY_REPO above: a new SVG or a
// new metric baked into an existing one needs its own line here, or it's
// silently uncovered rather than erroring loudly. `displayToken` is the
// exact number the SVG is expected to show — not the full metrics.json
// `value` string, which is usually longer ("3.06× (0.0328 vs. 0.0107)")
// than what a space-constrained decorative asset actually displays ("3.06×"
// only). Comparing the full value string would produce a permanent false
// PARTIAL for every entry here, for a reason that has nothing to do with
// real drift — the abbreviation is intentional, not incomplete.
// Reduced from three metrics per banner to one on 2026-08-13, when the banner
// was rebuilt around a single framed metric instead of three bare numbers
// floating on a rising line. `mmfr:recall10` (3.06) and
// `triageiq:classifier-top3` (87.1) are no longer displayed in this asset AT
// ALL — that is the new design, not drift — so continuing to track them here
// would report a permanent false POSITIVE for two metrics the file cannot
// contain. Both are still covered by the per-metric section above, which is
// where their real verification lives; this layer only ever covered the
// additional risk of a number baked into a decorative asset going stale.
//
// If a future banner displays more metrics again, add them back here — an
// unlisted baked-in number is silently uncovered rather than erroring.
const SVG_METRIC_SOURCES = [
  {
    repo: "gaurav-gandhi-2411/gaurav-gandhi-2411",
    path: "assets/banner-light.svg",
    metrics: [{ key: "warmer:hinglish-fix", displayToken: "0.813" }],
  },
  {
    repo: "gaurav-gandhi-2411/gaurav-gandhi-2411",
    path: "assets/banner-dark.svg",
    metrics: [{ key: "warmer:hinglish-fix", displayToken: "0.813" }],
  },
];

// Scoped strictly to <text class="mval">...</text> content — NEVER a raw
// file scan. These SVGs embed woff2 font subsets as base64 inside
// @font-face src urls (10-13KB of digit-laden noise each, per font weight);
// a naive whole-file number scan would treat font-blob bytes as candidate
// metric tokens, and would also pick up decorative/ordinal text ("1200",
// "400" from viewBox, "16s"/"2.5s" from animation timing, "01" from a
// section eyebrow elsewhere in this asset family) as false signal. `mval`
// is the class these generated banners apply ONLY to verifiable
// metric-value text nodes (see gh-profile's scripts/build-banner.js) —
// restricting to it is what makes a text-presence check here safe at all.
const MVAL_TEXT_RE = /<text[^>]*\bclass="mval"[^>]*>([^<]*)<\/text>/g;
function extractMvalTexts(svgText) {
  return [...svgText.matchAll(MVAL_TEXT_RE)].map((m) => m[1]);
}

// Same two-state-plus-fetch-failure shape as the per-metric loop above, but
// with an extra state PARTIAL logic there doesn't need: MAPPING_STALE. That
// fires when the hand-maintained `displayToken` no longer appears in
// metrics.json's CURRENT value — i.e. metrics.json changed since this
// mapping was written, so the comparison itself is no longer meaningful
// (checking the live SVG against an already-wrong expectation would either
// false-positive CURRENT by coincidence or false-positive POSSIBLE_DRIFT
// for the wrong reason). Checked before ever fetching the SVG, so a stale
// mapping doesn't cost a network round-trip and doesn't get misreported as
// the SVG's own fault.
async function checkSvgMetrics(store) {
  const results = []; // { path, key, status, detail }
  const svgCache = new Map(); // path -> { ok: true, text } | { ok: false, error }

  for (const source of SVG_METRIC_SOURCES) {
    for (const m of source.metrics) {
      const base = { path: source.path, key: m.key };
      const entry = store.metrics?.[m.key];
      if (!entry) {
        results.push({
          ...base,
          status: "NO_METRICS_ENTRY",
          detail: `content/metrics.json has no "${m.key}" entry (renamed or removed?)`,
        });
        continue;
      }

      const displayTokens = extractTokens(m.displayToken);
      if (displayTokens.length !== 1) {
        results.push({
          ...base,
          status: "BAD_MAPPING",
          detail: `SVG_METRIC_SOURCES displayToken "${m.displayToken}" must contain exactly one numeric token — fix the mapping in this script`,
        });
        continue;
      }
      const displayToken = displayTokens[0];

      const sourceNumbers = extractSourceNumbers(entry.value ?? "");
      if (!tokenFoundIn(displayToken, sourceNumbers)) {
        results.push({
          ...base,
          status: "MAPPING_STALE",
          detail: `mapped display value "${m.displayToken}" no longer appears in metrics.json "${m.key}".value ("${entry.value}") — metrics.json changed since this mapping was written; the SVG (and/or this script's SVG_METRIC_SOURCES entry) needs a human look`,
        });
        continue;
      }

      if (!svgCache.has(source.path)) {
        const url = `https://raw.githubusercontent.com/${source.repo}/${SVG_REF_OVERRIDE}/${source.path}`;
        try {
          svgCache.set(source.path, { ok: true, text: await fetchText(url) });
        } catch (err) {
          svgCache.set(source.path, { ok: false, error: err.message });
        }
      }
      const cached = svgCache.get(source.path);
      if (!cached.ok) {
        results.push({ ...base, status: "UNVERIFIABLE", detail: `fetch failed for ${source.repo}/${source.path}: ${cached.error}` });
        continue;
      }

      const mvalTexts = extractMvalTexts(cached.text);
      const mvalNumbers = mvalTexts.flatMap((t) => extractSourceNumbers(t));
      if (tokenFoundIn(displayToken, mvalNumbers)) {
        results.push({
          ...base,
          status: "CURRENT",
          detail: `"${m.displayToken}" confirmed present in ${source.path}'s <text class="mval"> content`,
        });
      } else {
        results.push({
          ...base,
          status: "POSSIBLE_DRIFT",
          detail:
            `"${m.displayToken}" (still current per metrics.json "${m.key}") not found in ${source.path}'s ` +
            `<text class="mval"> content (found: [${mvalTexts.join(", ")}]) — the SVG may be out of sync and needs regenerating`,
        });
      }
    }
  }
  return results;
}
// Numeric tokens shorter than this (after stripping a trailing '%') are
// skipped as match candidates — a bare "5" or "0" appears in almost any
// file by chance, which would make "at least one token found" a
// meaningless signal. Decimals and 3+ digit numbers are specific enough to
// be real evidence.
const MIN_TOKEN_LEN = 3;

// ---------------------------------------------------------------------------
// Layer 5: is each cited commit_sha actually reachable from its source repo's
// default branch?
//
// WHY THIS EXISTS: every other layer checks whether a metric's VALUE is still
// right. None of them checks whether the CITATION still resolves. Those fail
// differently — a stale value is wrong today and detectable today, while an
// unreachable SHA is correct today and silently dies later, taking the
// provenance with it.
//
// The failure is systematic, not incidental, and it comes from squash-merging.
// You measure on a branch, record that branch commit in metrics.json, then the
// PR squash-merges: GitHub creates a NEW commit with the combined diff and the
// branch commit you cited is never an ancestor of the default branch. It stays
// resolvable for a while — GitHub keeps orphaned commits addressable — and then
// stops, whenever the branch is deleted and the object is pruned. So the
// citation looks fine right up until it doesn't, and nothing was watching.
//
// Found 2026-08-13 via warmer:embedding-separation, which cited the pre-merge
// branch commit. Auditing the rest found four more, all the same shape.
//
// UNREACHABLE is reported separately from UNVERIFIABLE on purpose. They are
// opposite situations: UNREACHABLE means we successfully checked and the answer
// is bad (act on it), UNVERIFIABLE means we could not check (no credential,
// rate limit, network) and know nothing. Collapsing them would let a real
// UNREACHABLE hide inside the pile of private-repo entries this script can
// never reach.
const GITHUB_API = "https://api.github.com";
// Optional. Unauthenticated works for public repos at 60 req/hr, which covers
// this table; a token raises that ceiling AND is the only way private repos
// get checked at all (see the report's own note on what that would take).
const GH_TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null;

async function githubApi(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers = { Accept: "application/vnd.github+json" };
    if (GH_TOKEN) headers.Authorization = `Bearer ${GH_TOKEN}`;
    const res = await fetch(`${GITHUB_API}${path}`, { signal: controller.signal, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function checkShaReachability(store) {
  const results = [];
  const defaultBranchCache = new Map(); // repo -> branch | null

  for (const [key, entry] of Object.entries(store.metrics ?? {})) {
    if (!entry?.repo || !entry?.commit_sha) continue;
    const base = { key, repo: entry.repo, sha: entry.commit_sha };

    let defaultBranch = defaultBranchCache.get(entry.repo);
    if (defaultBranch === undefined) {
      try {
        defaultBranch = (await githubApi(`/repos/${entry.repo}`)).default_branch;
      } catch (err) {
        defaultBranch = null;
        defaultBranchCache.set(entry.repo, null);
        results.push({
          ...base,
          status: "UNVERIFIABLE",
          detail:
            `cannot read ${entry.repo} (${err.message}) — private repo or rate limit. ` +
            `Set GITHUB_TOKEN (read-only, contents:read) to cover it.`,
        });
        continue;
      }
      defaultBranchCache.set(entry.repo, defaultBranch);
    }
    if (defaultBranch === null) {
      results.push({
        ...base,
        status: "UNVERIFIABLE",
        detail: `${entry.repo} unreadable without a credential — set GITHUB_TOKEN to cover it.`,
      });
      continue;
    }

    try {
      // compare/base...head: "identical" or "behind" both mean head IS an
      // ancestor of base. "ahead"/"diverged" mean it is not — the squash-merge
      // signature.
      const cmp = await githubApi(
        `/repos/${entry.repo}/compare/${defaultBranch}...${entry.commit_sha}`
      );
      if (cmp.status === "identical" || cmp.status === "behind") {
        results.push({
          ...base,
          status: "REACHABLE",
          detail: `${entry.commit_sha.slice(0, 7)} is an ancestor of ${defaultBranch} (${cmp.status})`,
        });
      } else {
        results.push({
          ...base,
          status: "UNREACHABLE",
          detail:
            `${entry.commit_sha.slice(0, 7)} is NOT an ancestor of ${entry.repo}'s ${defaultBranch} ` +
            `(compare status: ${cmp.status}) — almost certainly a pre-squash-merge branch commit. ` +
            `It resolves today and will stop resolving when that branch is pruned. ` +
            `Re-point this entry at the merge commit that actually landed.`,
        });
      }
    } catch (err) {
      results.push({
        ...base,
        status: "UNVERIFIABLE",
        detail: `compare failed for ${entry.repo} (${err.message})`,
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Layer 6: does the cited LINE, at the cited SHA, actually contain the value?
//
// WHY THIS EXISTS: `source_line` was never read by anything. Every other layer
// fetches the whole source file and searches it for the value's numbers, so a
// metric whose line number pointed at a completely different row still passed
// every check — the number was somewhere in the file, and no check cared where.
//
// That is exactly how triageiq:classifier-top3 stayed wrong through multiple
// audits. Its value led with the kubernetes 87.1% while its cited line held the
// vscode row, and it survived because "87.1 appears in README.md" was true.
// The field looked like provenance and functioned as decoration.
//
// The consequence is not cosmetic. `source_line` exists so a reader can follow
// a number to the exact row that produced it. A wrong line sends them to a
// different metric that looks plausible — the most expensive kind of wrong,
// because it is silently confirmable.
//
// This is also the check that catches a whole-file value match that happens to
// be a coincidence: a number appearing SOMEWHERE in a long report is weak
// evidence; the same number on the line the entry names is strong evidence.
//
// Line numbers are 1-based and counted over raw newlines, including blank
// lines. (Worth stating: `nl` skips blank lines by default, which is itself a
// way to arrive at an off-by-N line number while looking careful.)
async function checkCitedLines(store) {
  const results = [];
  const fileCache = new Map();

  for (const [key, entry] of Object.entries(store.metrics ?? {})) {
    if (!entry?.repo || !entry?.commit_sha) continue;
    const base = { key, repo: entry.repo, sha: entry.commit_sha, line: entry.source_line };

    if (entry.source_line === null || entry.source_line === undefined) {
      results.push({ ...base, status: "NO_LINE", detail: "entry declares no source_line" });
      continue;
    }
    const path = extractPath(entry.source_file);
    if (!path || !/\.[a-z0-9]+$/i.test(path) || /\s/.test(path)) {
      results.push({ ...base, status: "NO_LINE", detail: `source_file is not a fetchable path: ${entry.source_file}` });
      continue;
    }

    const tokens = extractTokens(entry.value ?? "", LINE_SCOPED_MIN_TOKEN_LEN);
    if (tokens.length === 0) {
      // QUALITATIVE is reported apart from NO_LINE so a future reader does not
      // mistake it for an unfixed defect. gold-rate-tracker:headline's value is
      // "Naive wins — ships the honest baseline, not the model": there is no
      // number in it, so there is nothing a line could anchor, and no amount of
      // work would ever move it into LINE_MATCH. That is a permanent, correct
      // end state, unlike a NO_LINE entry which is simply not yet anchored.
      //
      // Note the two reasons a value yields no token are different: genuinely
      // having no digits (this case, correct forever), versus having digits
      // below MIN_TOKEN_LEN — see aetherart:vram, "6.2GB peak VRAM", where the
      // 3-digit floor that prevents coincidental whole-file matches also
      // suppresses a perfectly valid short citation. That one IS a gap.
      const hasAnyDigit = /\d/.test(String(entry.value ?? ""));
      results.push({
        ...base,
        status: hasAnyDigit ? "TOKEN_TOO_SHORT" : "QUALITATIVE",
        detail: hasAnyDigit
          ? `value's number(s) fall below the ${LINE_SCOPED_MIN_TOKEN_LEN}-digit line-scoped floor: ${entry.value}`
          : `value is qualitative — no number to anchor, and none expected: ${entry.value}`,
      });
      continue;
    }

    // Pin to the cited SHA, not HEAD — the question is whether the citation was
    // correct when made, not whether the file drifted since.
    const url = `https://raw.githubusercontent.com/${entry.repo}/${entry.commit_sha}/${path}`;
    let text = fileCache.get(url);
    if (text === undefined) {
      try {
        text = await fetchText(url);
      } catch (err) {
        text = null;
        results.push({ ...base, status: "UNVERIFIABLE", detail: `fetch failed for ${path} @ ${entry.commit_sha.slice(0, 7)}: ${err.message}` });
        fileCache.set(url, null);
        continue;
      }
      fileCache.set(url, text);
    }
    if (text === null) {
      results.push({ ...base, status: "UNVERIFIABLE", detail: `${path} unreadable at ${entry.commit_sha.slice(0, 7)} (private repo or missing)` });
      continue;
    }

    const lines = text.split(/\r?\n/);
    if (entry.source_line > lines.length) {
      results.push({
        ...base,
        status: "LINE_MISMATCH",
        detail: `cited line ${entry.source_line} is past end of ${path} (${lines.length} lines) at ${entry.commit_sha.slice(0, 7)}`,
      });
      continue;
    }
    const lineText = lines[entry.source_line - 1] ?? "";
    const lineNumbers = extractSourceNumbers(lineText);
    const missing = tokens.filter((t) => !tokenFoundIn(t, lineNumbers));

    if (missing.length === 0) {
      results.push({ ...base, status: "LINE_MATCH", detail: `all ${tokens.length} token(s) present on ${path}:${entry.source_line}` });
    } else {
      results.push({
        ...base,
        status: "LINE_MISMATCH",
        detail:
          `${path}:${entry.source_line} at ${entry.commit_sha.slice(0, 7)} does not contain ` +
          `${missing.map((t) => `"${t.display}"`).join(", ")} — that line reads: ` +
          `"${lineText.trim().slice(0, 100)}"`,
      });
    }
  }
  return results;
}

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

// Matches a comma-grouped number ("2,300") before falling back to a plain
// one — alternation order matters in JS regex (first alternative that
// matches wins, not the longest), so the comma-pattern must come first or
// "2,300" would match as bare "2" then "300" as two unrelated tokens.
const NUMBER_PATTERN = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

function parseNumber(raw) {
  return Number(raw.replace(/,/g, ""));
}

// A "~"-marked span — a lone approximate value ("~94%") or a dash-joined
// range ("~1,500-2,300") — makes every number inside it a deliberately
// rounded estimate, not a value expected to match a source exactly. Numbers
// in an unmarked range ("18.0% (kubernetes) / 50.5% (vscode)") are NOT
// covered by this — only a literal "~" earns the wider tolerance below.
const APPROXIMATE_SPAN_PATTERN = /~\s*\d[\d,]*(?:\.\d+)?(?:\s*[-–—]\s*\d[\d,]*(?:\.\d+)?)?/g;

function findApproximateRanges(text) {
  return [...text.matchAll(APPROXIMATE_SPAN_PATTERN)].map((m) => [m.index, m.index + m[0].length]);
}

// A changelog/narrative transition span — "k8s R@5 18.0%→24.67%", "was 18.0%,
// now 24.67%", "from 18.0% to 24.67%" — states that a number was ONCE true, not
// that it still is. The old side's literal digits survive in the document
// forever as historical narrative, even after a results table or diagram
// elsewhere has moved on to the corrected figure. extractSourceNumbers (used by
// both the per-metric whole-file loop and checkCaseStudyClaims) has no notion
// of "this text describes change over time" and so treated an old number's
// mere presence ANYWHERE in the file as current evidence — a superseded value
// stayed reporting CURRENT through two more real corrections in triage-iq's own
// README before this was caught (content/provenance.md's Wave 22 entry).
//
// Same span-exclusion shape as findApproximateRanges/APPROXIMATE_SPAN_PATTERN
// above: find spans, exclude every number whose match index falls inside one,
// rather than trying to classify which side of the span is "old" vs "new".
// Deliberately conservative — the fix only needs the OLD number gone, and
// excluding the NEW one too from THIS particular sentence costs nothing as
// long as the current figure is also restated somewhere else untouched by
// "→"/"was"/"from...to" framing, which every live-shipped metric checked
// against this repo's real sources is: a headline number that only ever
// appears inside its own changelog sentence, nowhere else in the document,
// would report POSSIBLE_DRIFT under this fix even while correct — a real,
// stated trade (same shape as this file's other documented tolerances), not
// hidden.
const CHANGELOG_TRANSITION_PATTERN = new RegExp(
  [
    // "18.0%→24.67%" / "18.0% -> 24.67%" — arrow-joined pair, optional %, comma-grouped
    String.raw`\d[\d,]*(?:\.\d+)?%?\s*(?:→|->)\s*\d[\d,]*(?:\.\d+)?%?`,
    // "was 18.0%, now 24.67%" / "was 18.0% (post-fix now 24.67%)"
    String.raw`\bwas\s+\d[\d,]*(?:\.\d+)?%?\b[^.]{0,60}?\bnow\s+\d[\d,]*(?:\.\d+)?%?\b`,
    // "from 18.0% to 24.67%"
    String.raw`\bfrom\s+\d[\d,]*(?:\.\d+)?%?\s+to\s+\d[\d,]*(?:\.\d+)?%?\b`,
  ].join("|"),
  "gi"
);

function findChangelogTransitionRanges(text) {
  return [...text.matchAll(CHANGELOG_TRANSITION_PATTERN)].map((m) => [m.index, m.index + m[0].length]);
}

// Extract numeric tokens worth checking for presence, as actual numbers —
// not strings compared by substring. Two real false-positive/negative
// classes this fixes (found 2026-08-07, auditing the 6 PARTIAL claims the
// any-vs-all fix surfaced): a thousands separator used to split a token in
// two ("2,300" -> spurious "2" + "300", since the old digits-only regex
// never treated a comma as part of the number), and a trailing-zero
// formatting difference used to read as two different numbers ("293.10"
// displayed vs. "293.1" in the source — byte-different strings, identical
// value). Comparing as numbers makes both a non-issue by construction
// instead of needing an ever-growing list of string alternates.
//
// Each token also carries its own rounding precision: `decimalPlaces` (the
// digits after "." in how it's displayed — 0 for a bare integer) and
// `approximate` (true if it falls inside a "~"-marked span above). Both
// feed tokenFoundIn's rounding tolerance, not exact-equality — a page is
// allowed to round a source's more precise number for readability without
// that reading as drift every week.
// The floor is per-caller because the risk it guards against scales with how
// much text is being searched.
//
// A WHOLE-FILE scan compares a token against every number in a long report, so
// a short value like 6.2 stands a real chance of coinciding with an unrelated
// figure — hence MIN_TOKEN_LEN of 3. A LINE-SCOPED check compares against the
// handful of numbers on ONE named line, where that risk nearly vanishes, so
// the same floor there is pure loss: it suppressed aetherart:vram's perfectly
// valid "6.2GB" citation for a danger that does not exist at that scope.
//
// Worth being precise about what the floor never did: it does not prevent
// SUBSTRING collisions. NUMBER_PATTERN already matches maximal numeric runs
// and comparison is numeric, so 116.2, 46.2 and 6.25 all correctly fail to
// match a 6.2 token. The floor only ever addressed genuine coincidence.
//
// 2, not 1: at 1 a bare single digit becomes a required token, which breaks
// style-maitri:catalogue-size — its value reads "52,494 items across 8 stores"
// and the "8" lives on the following line. A single digit is also the most
// likely thing to coincide even within one line.
const LINE_SCOPED_MIN_TOKEN_LEN = 2;

function extractTokens(value, minTokenLen = MIN_TOKEN_LEN) {
  if (!value) return [];
  const approximateRanges = findApproximateRanges(value);
  const matches = [...value.matchAll(NUMBER_PATTERN)];
  const seen = new Set();
  const tokens = [];
  for (const m of matches) {
    const raw = m[0];
    const digitsOnly = raw.replace(/[,.]/g, "");
    if (digitsOnly.length < minTokenLen) continue;
    const n = parseNumber(raw);
    if (seen.has(n)) continue; // dedupe by value, not by the string that produced it
    seen.add(n);
    const dot = raw.indexOf(".");
    const decimalPlaces = dot === -1 ? 0 : raw.length - dot - 1;
    const approximate = approximateRanges.some(([start, end]) => m.index >= start && m.index < end);
    tokens.push({ display: raw, value: n, decimalPlaces, approximate });
  }
  return tokens;
}

// Same extraction, applied to a source file's full text — not deduped or
// length-filtered, since a short number in the source is still valid
// evidence for a token that itself passed extractTokens' length filter.
// Numbers whose match falls inside a changelog transition span (see
// findChangelogTransitionRanges above) are excluded — they document that a
// value changed, not what it currently is, and so are not valid evidence
// that a claim's number is still current.
function extractSourceNumbers(text) {
  const transitionRanges = findChangelogTransitionRanges(text);
  const matches = [...text.matchAll(NUMBER_PATTERN)];
  return matches
    .filter((m) => !transitionRanges.some(([start, end]) => m.index >= start && m.index < end))
    .map((m) => parseNumber(m[0]));
}

const NUMBER_EPSILON = 1e-9;
function numbersEqual(a, b) {
  return Math.abs(a - b) < NUMBER_EPSILON;
}

// Rounds `n` to `decimalPlaces` digits after the decimal point. Used for
// both directions: a plain decimal token's own displayed precision (0.239
// at 3dp), and — for a "~"-marked integer — a precision derived from its
// trailing zeros instead (see roundToMagnitude below).
function roundTo(n, decimalPlaces) {
  const factor = 10 ** decimalPlaces;
  return Math.round(n * factor) / factor;
}

// For a "~"-marked integer like "1,500", the trailing zeros ARE the stated
// precision — "~1,500" means "to the nearest hundred", not "exactly
// 1500.000...". Rounds `n` to that same magnitude: trailingZeros(1500) = 2
// -> round to the nearest 100. An integer with no trailing zeros (e.g.
// "~94") rounds to the nearest 1, i.e. ordinary integer rounding.
function trailingZeroMagnitude(displayValue) {
  const s = String(displayValue);
  const match = s.match(/0+$/);
  return match ? match[0].length : 0;
}
function roundToMagnitude(n, magnitude) {
  const step = 10 ** magnitude;
  return Math.round(n / step) * step;
}

// A token counts as found if its value, or its percent<->fraction
// alternate, numerically equals — or, per the rules below, numerically
// ROUNDS to — any number extracted from the source text.
//
// The fraction alternate is its own real false-positive class (caught on
// this check's first run): reclaim's case study displays "7.64%" /
// "100.00%" while its source states the identical measurement as "0.0764"
// / "1.0000" — same number, different convention, not drift.
//
// Rounding tolerance (added 2026-08-08, auditing 3 of the 6 PARTIAL claims
// the numeric-comparison fix surfaced): a page is allowed to display FEWER
// digits than its source without that reading as drift every week — a
// checker that flags a correct, intentionally-rounded claim gets ignored.
// Two distinct cases:
//   1. Plain decimal precision — "0.239" (3dp) matches a source's 0.2391
//      because 0.2391 rounds to 0.239 at 3 decimal places. Applies
//      unconditionally to any token with decimal places; no "~" needed,
//      since displaying fewer decimals than the source is an ordinary,
//      unmarked convention (aetherart:lora-quality).
//   2. "~"-marked magnitude — "~1,500" only matches a source's 1,488
//      because it's explicitly marked approximate AND its trailing zeros
//      state the rounding magnitude (nearest 100); an unmarked "1,500"
//      would NOT get this tolerance, since an uncorrected exact claim
//      should still flag (triageiq:classifier-bakeoff).
function tokenFoundIn(token, sourceNumbers) {
  const fraction = token.value >= 0 && token.value <= 100 ? token.value / 100 : null;
  const candidates = [token.value, fraction].filter((v) => v !== null);
  return sourceNumbers.some((n) => {
    if (candidates.some((c) => numbersEqual(n, c))) return true;
    if (token.decimalPlaces > 0 && numbersEqual(roundTo(n, token.decimalPlaces), token.value)) return true;
    if (token.approximate && token.decimalPlaces === 0) {
      const magnitude = trailingZeroMagnitude(token.value);
      if (numbersEqual(roundToMagnitude(n, magnitude), token.value)) return true;
    }
    return false;
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
const CITATION_PATH_PATTERN = /`([\w./-]+\.[a-zA-Z0-9]+)(:[\d,-]+)?(@[0-9a-f]{7,40})?`/g;

// Real over-extraction bug (found 2026-08-08): the old version scanned the
// ENTIRE Source cell for backtick-quoted paths, so a filename mentioned
// only in explanatory prose — "`data/backtest.json` is bot-refreshed
// continuously (`weekly-backtest.yml`)" — was treated as an additional
// citation. It isn't one: `weekly-backtest.yml` isn't even the real path
// (the actual file is `.github/workflows/weekly-backtest.yml`), so that
// "citation" 404s on every fetch — silently, since the union-across-paths
// match logic just treats a failed fetch on one path as a non-contributor
// rather than an error, and the drift check on the REAL cited path(s)
// still worked, so this went unnoticed.
//
// Two prior attempts at a fix didn't hold up: cutting at the first
// comma-continuation broke rows whose real citation list has per-source
// parentheticals ("`path` (note) @ `sha`, `path` (note) @ `sha`" —
// agentgauge:mde-curve); cutting at the first em-dash broke rows where a
// "Wave N correction:" PREAMBLE ends in an em-dash BEFORE the citation
// list even starts (triageiq:classifier-top3) — this file uses "—" both
// ways, so dash position alone doesn't reliably mark the boundary.
//
// The signal that actually holds: `weekly-backtest.yml` is a backtick
// mention wrapped alone in its own parentheses — "(`weekly-backtest.yml`)"
// — a casual aside, not a list item. A real citation is never individually
// parenthesized like that; it's either bare or a list-comma-separated
// sibling of other citations. Excluding only matches with "(" immediately
// before and ")" immediately after fixes the one confirmed-broken case
// without touching any of the row shapes above.
function extractPathsFromSource(source, repoSlug) {
  const matches = [...source.matchAll(CITATION_PATH_PATTERN)].filter((m) => {
    const before = source[m.index - 1];
    const after = source[m.index + m[0].length];
    return !(before === "(" && after === ")");
  });
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
    // A body paragraph can override the story's default sourceRef with its
    // own (see content/types.ts's doc comment) — a mid-story topic shift
    // that's really evidenced by a different, existing claim's citation.
    // Overridden paragraphs are excluded from the main "story" claim's
    // joined text (checking them against the story's default source would
    // be exactly the wrong-citation bug this mechanism exists to fix) and
    // instead become their own claim, each against its own sourceRef.
    const plainParagraphs = study.story.body.filter((p) => typeof p === "string");
    const overrideParagraphs = study.story.body.filter((p) => typeof p !== "string");
    claims.push({ sourceRef: study.story.sourceRef, text: plainParagraphs.join(" "), kind: "story" });
    for (const seg of overrideParagraphs) {
      claims.push({ sourceRef: seg.sourceRef, text: seg.text, kind: "story-segment" });
    }
    // A story's optional leadIn restates a fact really evidenced by a
    // different claim's own source (see content/types.ts's doc comment) —
    // checked as its own claim against its own sourceRef, not folded into
    // the main story text above, which would check it against the wrong
    // citation.
    if (study.story.leadIn) {
      claims.push({ sourceRef: study.story.leadIn.sourceRef, text: study.story.leadIn.text, kind: "story-leadIn" });
    }
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
        const sourceNumbers = extractSourceNumbers(sourceText);
        for (const t of tokens) {
          if (tokenFoundIn(t, sourceNumbers)) foundIn.add(t.display);
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
  const sourceNumbers = extractSourceNumbers(text);
  const found = tokens.filter((t) => tokenFoundIn(t, sourceNumbers));
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

const svgResults = await checkSvgMetrics(store);
const svgByStatus = (s) => svgResults.filter((r) => r.status === s);

const shaResults = await checkShaReachability(store);
const shaByStatus = (s) => shaResults.filter((r) => r.status === s);

const lineResults = await checkCitedLines(store);
const lineByStatus = (s) => lineResults.filter((r) => r.status === s);
const svgCurrent = svgByStatus("CURRENT");
const svgDrift = svgByStatus("POSSIBLE_DRIFT");
const svgMappingStale = svgByStatus("MAPPING_STALE");
const svgUnverifiable = svgByStatus("UNVERIFIABLE");
const svgNoEntry = svgByStatus("NO_METRICS_ENTRY");
const svgBadMapping = svgByStatus("BAD_MAPPING");

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

lines.push(`## SVG-embedded metric coverage (gh-profile banner)`);
lines.push("");
lines.push(
  "A fourth artifact class: headline numbers baked as literal text inside a committed SVG in " +
    "gaurav-gandhi-2411/gaurav-gandhi-2411 (not this repo). Checked against content/metrics.json's " +
    "CURRENT value only — metrics.json is already the gated source of truth (see the per-metric " +
    "section above), so this does not re-fetch the upstream repo a second time."
);
lines.push("");
lines.push(
  `**${svgResults.length} SVG/metric pairs tracked** (${SVG_METRIC_SOURCES.length} SVG file(s)): ` +
    `${svgCurrent.length} current, ${svgDrift.length} possible drift, ${svgMappingStale.length} mapping stale, ` +
    `${svgUnverifiable.length} unverifiable, ${svgNoEntry.length} no metrics.json entry, ${svgBadMapping.length} bad mapping.`
);
lines.push("");
if (svgDrift.length > 0) {
  lines.push(`### Possible drift — ${svgDrift.length} SVG/metric pair(s) (needs a human look)`);
  lines.push("");
  lines.push("The SVG's baked text no longer matches metrics.json's current value — regenerate the SVG.");
  lines.push("");
  for (const r of svgDrift) lines.push(`- \`${r.path}\` / \`${r.key}\`: ${r.detail}`);
  lines.push("");
}
if (svgMappingStale.length > 0) {
  lines.push(`### Mapping stale — ${svgMappingStale.length} SVG/metric pair(s)`);
  lines.push("");
  lines.push(
    "metrics.json's value changed since SVG_METRIC_SOURCES' displayToken was written, so the " +
      "comparison itself is no longer meaningful — this is reported before the SVG is even fetched, " +
      "distinct from possible drift above (which means the mapping is still valid but the SVG isn't)."
  );
  lines.push("");
  for (const r of svgMappingStale) lines.push(`- \`${r.path}\` / \`${r.key}\`: ${r.detail}`);
  lines.push("");
}
if (svgUnverifiable.length > 0) {
  lines.push(`### Unverifiable this run — ${svgUnverifiable.length} SVG/metric pair(s)`);
  lines.push("");
  lines.push("Fetch failed; NOT treated as fresh. Re-check manually or next scheduled run.");
  lines.push("");
  for (const r of svgUnverifiable) lines.push(`- \`${r.path}\` / \`${r.key}\`: ${r.detail}`);
  lines.push("");
}
if (svgNoEntry.length > 0 || svgBadMapping.length > 0) {
  lines.push(`### Broken mapping — ${svgNoEntry.length + svgBadMapping.length} SVG/metric pair(s) (fix SVG_METRIC_SOURCES)`);
  lines.push("");
  for (const r of [...svgNoEntry, ...svgBadMapping]) lines.push(`- \`${r.path}\` / \`${r.key}\`: ${r.detail}`);
  lines.push("");
}
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
// --- Layer 5: commit-SHA reachability -------------------------------------
const shaReachable = shaByStatus("REACHABLE");
const shaUnreachable = shaByStatus("UNREACHABLE");
const shaUnverifiable = shaByStatus("UNVERIFIABLE");

lines.push("## Commit-SHA reachability");
lines.push("");
lines.push(
  "Every other layer asks whether a metric's VALUE is still right. This one asks " +
    "whether its CITATION still resolves — specifically, whether each `commit_sha` is " +
    "an ancestor of its source repo's default branch. A squash-merged PR produces a " +
    "NEW commit, so the branch commit you measured on is never an ancestor of `main`; " +
    "it stays addressable until the branch is pruned, then the provenance dies quietly."
);
lines.push("");
lines.push(
  `**${shaResults.length} cited SHA(s) checked**: ${shaReachable.length} reachable, ` +
    `${shaUnreachable.length} UNREACHABLE, ${shaUnverifiable.length} unverifiable.`
);
lines.push("");

if (shaUnreachable.length > 0) {
  lines.push(`### UNREACHABLE — ${shaUnreachable.length} entr(ies), re-point at the merge commit`);
  lines.push("");
  for (const r of shaUnreachable) lines.push(`- \`${r.key}\`: ${r.detail}`);
  lines.push("");
}
if (shaUnverifiable.length > 0) {
  lines.push(`### Unverifiable — ${shaUnverifiable.length} entr(ies)`);
  lines.push("");
  lines.push(
    "Distinct from UNREACHABLE above: these were not checked at all, so they are " +
      "neither confirmed nor flagged. To cover them, either (a) give CI a **read-only " +
      "token** with `contents:read` on the private source repos and expose it as " +
      "`GITHUB_TOKEN` to this step, or (b) move the cited artifact into a public repo. " +
      "Until one of those happens, treat these as unverified, not as passing."
  );
  lines.push("");
  for (const r of shaUnverifiable) lines.push(`- \`${r.key}\`: ${r.detail}`);
  lines.push("");
}
if (shaUnreachable.length === 0 && shaUnverifiable.length === 0) {
  lines.push(`All ${shaResults.length} cited SHAs are reachable from their default branch.`);
  lines.push("");
}

// --- Layer 6: cited-line content -------------------------------------------
const lineMatch = lineByStatus("LINE_MATCH");
const lineMismatch = lineByStatus("LINE_MISMATCH");
const lineUnverifiable = lineByStatus("UNVERIFIABLE");
const lineNone = lineByStatus("NO_LINE");
const lineQualitative = lineByStatus("QUALITATIVE");
const lineTooShort = lineByStatus("TOKEN_TOO_SHORT");

lines.push("## Cited-line content");
lines.push("");
lines.push(
  "Does the line each entry names actually contain that entry's value, at the commit " +
    "it cites? Until 2026-08-13 nothing asked. Every other layer searches the WHOLE " +
    "source file, so an entry whose `source_line` pointed at an unrelated row still " +
    "passed — the number was somewhere in the file and no check cared where. That is " +
    "how `triageiq:classifier-top3` stayed wrong through multiple audits: its value led " +
    "with the kubernetes 87.1% while its cited line held the vscode row, and " +
    '"87.1 appears in README.md" was true the whole time.'
);
lines.push("");
lines.push(
  `**${lineResults.length} entr(ies) with a cited SHA**: ${lineMatch.length} line-match, ` +
    `${lineMismatch.length} LINE MISMATCH, ${lineUnverifiable.length} unverifiable, ` +
    `${lineNone.length} no line cited, ${lineQualitative.length} qualitative (no anchor possible), ` +
    `${lineTooShort.length} below the token floor.`
);
lines.push("");

if (lineQualitative.length > 0) {
  lines.push(`### Qualitative — ${lineQualitative.length} entr(ies), CORRECT AS-IS`);
  lines.push("");
  lines.push(
    "Not a defect and not a backlog item. These values contain no number, so there is " +
      "nothing a line could anchor and no work that would ever move them into " +
      "line-match. Listed separately so nobody re-opens them as unfinished."
  );
  lines.push("");
  for (const r of lineQualitative) lines.push(`- \`${r.key}\`: ${r.detail}`);
  lines.push("");
}
if (lineTooShort.length > 0) {
  lines.push(`### Below the token floor — ${lineTooShort.length} entr(ies), a real gap`);
  lines.push("");
  lines.push(
    `These DO have a number, but one shorter than the ${LINE_SCOPED_MIN_TOKEN_LEN}-digit minimum this ` +
      "check uses to avoid matching a coincidental figure elsewhere in a long file. The " +
      "citation may be perfectly correct; this check simply cannot confirm it. Unlike the " +
      "qualitative entries above, this one is a limitation of the checker, not a property " +
      "of the metric."
  );
  lines.push("");
  for (const r of lineTooShort) lines.push(`- \`${r.key}\`: ${r.detail}`);
  lines.push("");
}

if (lineMismatch.length > 0) {
  lines.push(`### LINE MISMATCH — ${lineMismatch.length} entr(ies)`);
  lines.push("");
  lines.push(
    "The value is not on the line the entry names. Either the line number is wrong, or " +
      "the entry's value spans rows and needs splitting so each number has one line."
  );
  lines.push("");
  for (const r of lineMismatch) lines.push(`- \`${r.key}\`: ${r.detail}`);
  lines.push("");
}
if (lineUnverifiable.length > 0) {
  lines.push(`### Unverifiable — ${lineUnverifiable.length} entr(ies)`);
  lines.push("");
  for (const r of lineUnverifiable) lines.push(`- \`${r.key}\`: ${r.detail}`);
  lines.push("");
}
if (lineMismatch.length === 0 && lineUnverifiable.length === 0) {
  lines.push(
    `All ${lineMatch.length} anchorable cited lines contain their entry's value.` +
      (lineQualitative.length > 0 || lineTooShort.length > 0
        ? " (Qualitative and below-floor entries are listed above and are not failures.)"
        : "")
  );
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
    `svg: ${svgCurrent.length}/${svgResults.length} current (${svgDrift.length} drift, ${svgMappingStale.length} mapping stale, ${svgUnverifiable.length} unverifiable, ${svgNoEntry.length + svgBadMapping.length} broken mapping). ` +
    `verification: ${staleVerification.length} overdue, ${missingVerification.length} unreadable, of ${verifiedRows.length} case studies. ` +
    `sha-reachability: ${shaReachable.length} reachable, ${shaUnreachable.length} UNREACHABLE, ${shaUnverifiable.length} unverifiable, of ${shaResults.length} cited. ` +
    `cited-line: ${lineMatch.length} match, ${lineMismatch.length} MISMATCH, ${lineUnverifiable.length} unverifiable, ${lineNone.length} no line, ${lineQualitative.length} qualitative, ${lineTooShort.length} below-floor, of ${lineResults.length}.`
);
