// Wave 16 — identity-drift detection (runs weekly via
// .github/workflows/metrics-refresh.yml, or locally: node scripts/identity-drift.mjs).
//
// Pure deterministic fact-checking — no LLM involved. For each of the 13
// products in content/products.ts, checks whether the world still matches
// what the site claims: does the repo's README still call itself what the
// site calls it, is the live/demo URL still up, has the repo gone archived
// or private, and (for pypi/HF-only products) does that package/space still
// exist. Results are diffed against the previous run's recorded values in
// content/identity-state.json (a machine-owned JSON store, same convention
// as content/metrics.json: mechanically diffed, direct-rewrite-with-PR-gate
// — NOT the append-only-provenance-proposal convention, which is reserved
// for LLM-judged content per docs/content-pipeline-rubric.md).
//
// Fail-soft by design, same philosophy as scripts/refresh-metrics.mjs: an
// unreachable README/repo/URL skips that check with a note; nothing is ever
// blanked. A field only overwrites content/identity-state.json's stored
// value when its check actually succeeded this run — a rate-limited or
// timed-out check just carries the previous value forward.
//
// One deliberate asymmetry vs. refresh-metrics.mjs's new-repo-discovery
// (which explicitly skips archived repos as noise, since an archived repo
// nobody's heard of yet isn't actionable): here, an ALREADY-TRACKED repo
// transitioning to archived is a real regression against a live site claim
// and must be flagged, not suppressed. There's no special-case code for
// this — it falls out of the generic per-field diff below, plus one extra
// note for visibility in the PR body.
//
// Zero dependencies; Node 20+ (global fetch).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_PATH = join(ROOT, "content", "products.ts");
const IDENTITY_STATE_PATH = join(ROOT, "content", "identity-state.json");
const DRIFT_SUMMARY_PATH = process.env.DRIFT_SUMMARY_PATH ?? "/tmp/identity-drift-summary.md";
const DRIFT_RENAMES_PATH = process.env.DRIFT_RENAMES_PATH ?? "/tmp/identity-drift-renames.json";

const FETCH_TIMEOUT_MS = 20_000;
// Fields compared run-over-run to decide whether anything drifted.
// "checkedAt" is deliberately excluded — it's internal bookkeeping (this
// run's timestamp), not an externally-sourced value, so it would make
// every single run look like a diff (see refresh-metrics.mjs's measured_at
// field for the contrast: that one IS diff-worthy because it's sourced from
// the repo's own manifest, not stamped by this script).
const DIFF_FIELDS = [
  "name",
  "liveUrl",
  "demoUrl",
  "httpStatus",
  "demoStatus",
  "repoVisibility",
  "repoArchived",
  "hfPresence",
  "pypiPresence",
];

const diffs = []; // { slug, field, old, new }
const notes = []; // free-form markdown bullets
// Derived after the per-product loop below from diffs where field === "name"
// — see the comment above extractDemoUrl for why it's diff-based, not a
// direct compare against products.ts.

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetchWithTimeout(url, { headers: { Accept: "text/plain" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Two attempts: serverless demos (Cloud Run) cold-start past the first
// timeout and answer the retry — same known false-positive class as
// refresh-metrics.mjs's live-link section (wave-2 link audit). Only a
// double failure is reported.
async function checkUrlTwoAttempt(url) {
  if (!url) return null;
  let result = null;
  for (let attempt = 0; attempt < 2 && !result?.ok; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { method: "GET" });
      result = { ok: res.ok, status: res.status };
    } catch (err) {
      result = { ok: false, status: err.name === "AbortError" ? "timeout" : err.message };
    }
  }
  return result;
}

async function fetchReadme(owner, repo) {
  const text = await fetchText(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`);
  const h1 = text.match(/^#\s+(.+)$/m);
  return { text, name: h1 ? h1[1].trim() : null };
}

async function fetchRepoMeta(owner, repo) {
  const meta = await fetchJson(`https://api.github.com/repos/${owner}/${repo}`);
  return {
    visibility: meta.visibility ?? (meta.private ? "private" : "public"),
    archived: Boolean(meta.archived),
    homepage: meta.homepage || null,
  };
}

// Deliberate design note: renames are derived from the DIFF (this run's
// README name vs. the *previously recorded* README name in
// content/identity-state.json), never from a direct compare against
// products.ts's own `name` field. Several tracked products intentionally
// use a nicer site name than their raw README H1 (e.g. "Samidha Reviews"
// vs. review-iq's own README, "DealHunter" vs. "DealHunter — Agentic
// Flight Search") — that's a permanent, deliberate marketing choice, not
// drift, and comparing against products.ts directly would re-flag it every
// single week forever. A genuine rename — the README's own H1 actually
// changing between two runs — is the real signal worth an issue.

// Best-effort, heuristic: looks for a URL near the word "demo" in the
// README that isn't already the product's known liveUrl — catches a
// distinct secondary surface (e.g. an HF Space alongside a Vercel
// deployment, or a video walkthrough link). A miss just means no demoStatus
// is tracked this run; this is not meant to be exhaustive.
function extractDemoUrl(readmeText, liveUrl) {
  if (!readmeText) return null;
  const stripSlash = (u) => u?.replace(/\/$/, "") ?? u;
  const matches = [...readmeText.matchAll(/demo[^\n]{0,120}?(https?:\/\/[^\s)\]>"'`|]+)/gi)];
  for (const m of matches) {
    const url = m[1].replace(/[).,'"`]+$/, "");
    if (stripSlash(url) === stripSlash(liveUrl)) continue;
    // shields.io badge images ride next to nearly every "Live Demo" link
    // (`[![Live Demo](badge-url)](real-url)`) — the badge itself is never
    // a demo surface, just decoration; skip it and keep scanning.
    if (url.includes("img.shields.io")) continue;
    return url;
  }
  return null;
}

async function checkPypiPresence(packageName) {
  const res = await fetchWithTimeout(`https://pypi.org/pypi/${packageName}/json`);
  return res.status;
}

// ── 1. Parse the 13 tracked products out of content/products.ts's raw text
//       (regex-scrape, same style as refresh-metrics.mjs — no TS-import
//       dependency). Top-level array entries are indented exactly 2 spaces
//       ("  {" / "  },"); nested objects (figure, pypi, etc.) are indented
//       deeper, so a closing brace at 2-space indentation is reliably the
//       end of one product's block. ─────────────────────────────────────

const productsSrc = readFileSync(PRODUCTS_PATH, "utf8").replace(/\r\n/g, "\n");
const arrayBody = productsSrc.match(/products: Product\[\] = \[([\s\S]*)\];/)?.[1] ?? "";
const blocks = [...arrayBody.matchAll(/^ {2}\{\n([\s\S]*?)\n {2}\},?$/gm)].map((m) => m[1]);

const products = blocks.map((b) => ({
  slug: b.match(/slug:\s*"([^"]+)"/)?.[1] ?? null,
  name: b.match(/name:\s*"([^"]+)"/)?.[1] ?? null,
  liveUrl: b.match(/liveUrl:\s*"([^"]+)"/)?.[1] ?? null,
  repoUrl: b.match(/repoUrl:\s*"([^"]+)"/)?.[1] ?? null,
  pypiPackage: b.match(/packageName:\s*"([^"]+)"/)?.[1] ?? null,
}));

// ── 2. Load previous state (fresh, empty store on the very first run — no
//       diffs are reported that run, matching content/metrics.json's shape
//       convention). ─────────────────────────────────────────────────────

const storeExisted = existsSync(IDENTITY_STATE_PATH);
const store = storeExisted
  ? JSON.parse(readFileSync(IDENTITY_STATE_PATH, "utf8"))
  : { updated_at: null, products: {} };
store.products ??= {};

const today = new Date().toISOString().slice(0, 10);
const nextProducts = {};

// ── 3. Check each product ────────────────────────────────────────────────

for (const product of products) {
  const { slug, liveUrl, repoUrl, pypiPackage } = product;
  const previous = store.products[slug] ?? {};
  const current = { ...previous, checkedAt: today };

  const repoMatch = repoUrl?.match(/github\.com\/([^/]+)\/([^/"]+)/) ?? null;

  // README display name + repo metadata (skipped for repo-less products,
  // e.g. Warmer — mindmeld is private, no public repo to check).
  let readmeText = null;
  if (repoMatch) {
    const [, owner, repo] = repoMatch;
    try {
      const readme = await fetchReadme(owner, repo);
      readmeText = readme.text;
      current.name = readme.name;
    } catch (err) {
      notes.push(`**\`${slug}\`**: README fetch failed (${err.message}) — kept previous name value.`);
    }
    try {
      const meta = await fetchRepoMeta(owner, repo);
      current.repoVisibility = meta.visibility;
      current.repoArchived = meta.archived;
    } catch (err) {
      notes.push(`**\`${slug}\`**: repo metadata fetch failed (${err.message}) — kept previous values.`);
    }
  }

  // Live URL health (two-attempt, cold-start tolerant).
  current.liveUrl = liveUrl;
  if (liveUrl) {
    const result = await checkUrlTwoAttempt(liveUrl);
    current.httpStatus = result.status;
    // The HF Space *is* the liveUrl for multimodal-fashion-recommender —
    // no separate fetch needed, just tag the same result as HF presence.
    if (liveUrl.includes("huggingface.co/spaces")) {
      current.hfPresence = result.status;
    }
  }

  // Demo URL (heuristic, best-effort — see extractDemoUrl's own comment).
  // checkUrlTwoAttempt never throws (it catches internally, same as the
  // live-URL check above), so no try/catch needed here.
  const demoUrl = extractDemoUrl(readmeText, liveUrl);
  current.demoUrl = demoUrl;
  if (demoUrl) {
    const result = await checkUrlTwoAttempt(demoUrl);
    current.demoStatus = result.status;
  }

  // PyPI presence (tracegauge today; any future pypi-only product picks
  // this up automatically since it's driven by products.ts's own pypi field).
  if (pypiPackage) {
    try {
      current.pypiPresence = await checkPypiPresence(pypiPackage);
    } catch (err) {
      notes.push(`**\`${slug}\`**: PyPI presence check failed (${err.message}) — kept previous value.`);
    }
  }

  // Per-field diff against the previous run.
  if (storeExisted) {
    for (const field of DIFF_FIELDS) {
      const oldVal = previous[field] ?? null;
      const newVal = current[field] ?? null;
      if (oldVal !== newVal) {
        diffs.push({ slug, field, old: oldVal, new: newVal });
        if (field === "repoArchived" && newVal === true) {
          notes.push(
            `**\`${slug}\`** just went archived on GitHub while still linked live on the site — this is a regression against a live claim, not noise; needs a human look.`
          );
        }
      }
    }
  }

  nextProducts[slug] = current;
}

const repoBySlug = new Map(products.map((p) => [p.slug, p.repoUrl]));
const renames = diffs
  .filter((d) => d.field === "name")
  .map((d) => ({ slug: d.slug, oldName: d.old, newName: d.new, repo: repoBySlug.get(d.slug) ?? null }));

// ── 4. Write store (only when there's something worth diffing — first
//       run always writes to establish the baseline; otherwise a zero-diff
//       run leaves the file untouched so the workflow's git-diff PR gate
//       stays clean and doesn't open an empty PR every week). ────────────

const shouldWrite = !storeExisted || diffs.length > 0;
if (shouldWrite) {
  writeFileSync(
    IDENTITY_STATE_PATH,
    JSON.stringify({ updated_at: today, products: nextProducts }, null, 2) + "\n"
  );
}

// ── 5. Write summary + renames hand-off ──────────────────────────────────

const lines = [];
lines.push(`## Weekly identity-drift check — ${today}`);
lines.push("");
if (diffs.length > 0) {
  lines.push("### Field changes (old → new)");
  lines.push("");
  lines.push("| Product | Field | Old | New |");
  lines.push("|---|---|---|---|");
  for (const d of diffs) {
    lines.push(`| \`${d.slug}\` | ${d.field} | ${d.old ?? "—"} | ${d.new ?? "—"} |`);
  }
} else {
  lines.push(storeExisted ? "No identity drift detected this week." : "First run — baseline established, nothing to diff yet.");
}
if (renames.length > 0) {
  lines.push("");
  lines.push("### README renames (repo's own H1 changed since last run)");
  lines.push("");
  for (const r of renames) {
    lines.push(`- \`${r.slug}\`: [\`${r.repo}\`](${r.repo})'s README changed from **"${r.oldName}"** to **"${r.newName}"** — check whether content/products.ts's name still fits.`);
  }
  lines.push("");
  lines.push(
    "> Report-only: renaming a product on the site is a content decision (case study, categories, etc. may reference the old name too). A per-repo issue is also opened/updated so this doesn't get lost if this PR goes unmerged."
  );
}
if (notes.length > 0) {
  lines.push("");
  lines.push("### Notes");
  lines.push("");
  for (const n of notes) lines.push(`- ${n}`);
}
lines.push("");
lines.push(
  "_Generated by scripts/identity-drift.mjs. Checks: README H1 vs. site name, repo visibility/archived state, live+demo URL health, PyPI/HF presence — see content/identity-state.json._"
);

writeFileSync(DRIFT_SUMMARY_PATH, lines.join("\n") + "\n");
writeFileSync(DRIFT_RENAMES_PATH, JSON.stringify(renames, null, 2) + "\n");
console.log(lines.join("\n"));
console.log(
  `\n--> ${shouldWrite ? "content/identity-state.json updated" : "no store change"}; ${diffs.length} field diff(s), ${renames.length} name mismatch(es), ${notes.length} note(s).`
);
