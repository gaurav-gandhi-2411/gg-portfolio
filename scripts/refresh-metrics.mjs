// Wave 13 — autonomous metric refresh (runs weekly via
// .github/workflows/metrics-refresh.yml, or locally: node scripts/refresh-metrics.mjs).
//
// Reads content/metrics.json (the site's machine-refreshable metric store),
// fetches each source repo's .portfolio/metrics.json from its default
// branch, and rewrites content/metrics.json with any drifted values. The
// workflow turns a non-empty diff into a PR — NEVER a direct commit — so a
// human reviews every number before it reaches the site (rule 65b's gate).
//
// Fail-soft by design: an unreachable repo or malformed manifest skips that
// project with a note; nothing is ever blanked. Metrics not re-measured in
// 90+ days are flagged in the summary rather than silently re-asserted.
//
// Zero dependencies; Node 20+ (global fetch).

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const METRICS_PATH = join(ROOT, "content", "metrics.json");
const PRODUCTS_PATH = join(ROOT, "content", "products.ts");
const RESUME_MANIFEST_PATH = join(ROOT, "content", "resume-metrics.json");
const RESUME_PDF_PATH = join(ROOT, "public", "resume.pdf");
const SUMMARY_PATH = process.env.SUMMARY_PATH ?? join(ROOT, "metrics-refresh-summary.md");

const STALE_DAYS = 90;
const FETCH_TIMEOUT_MS = 20_000;
// Default HEAD = each repo's default branch. Overridable for testing the
// pipeline against not-yet-merged manifest branches
// (METRICS_REF=refs/heads/chore/portfolio-metrics node scripts/refresh-metrics.mjs).
const METRICS_REF = process.env.METRICS_REF ?? "HEAD";
const HF_AUTHOR = "gauravgandhi2411";
// The agreed bar (wave 13) below which the HF download count is tracked
// but not shown on the site; crossing it is worth a PR on its own.
const HF_DISPLAY_BAR = 1000;

const changes = []; // { id, field, old, new, source }
const notes = []; // free-form markdown bullets
const staleFlags = []; // { id, measured_at }

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

function daysSince(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// ── 1. Refresh repo-sourced metrics ─────────────────────────────────────

const store = JSON.parse(readFileSync(METRICS_PATH, "utf8"));

const repos = [...new Set(Object.values(store.metrics).map((m) => m.repo))];
for (const repo of repos) {
  const ids = Object.entries(store.metrics)
    .filter(([, m]) => m.repo === repo)
    .map(([id]) => id);

  let manifest;
  try {
    manifest = await fetchJson(
      `https://raw.githubusercontent.com/${repo}/${METRICS_REF}/.portfolio/metrics.json`
    );
  } catch (err) {
    notes.push(
      `**Skipped \`${repo}\`** (${ids.join(", ")}): could not fetch \`.portfolio/metrics.json\` — ${err.message}. Site keeps its current values.`
    );
    continue;
  }
  if (!Array.isArray(manifest?.metrics)) {
    notes.push(
      `**Skipped \`${repo}\`**: manifest malformed (no \`metrics\` array). Site keeps its current values.`
    );
    continue;
  }

  const byId = new Map(manifest.metrics.map((m) => [m.id, m]));
  for (const id of ids) {
    const incoming = byId.get(id);
    const current = store.metrics[id];
    if (!incoming) {
      notes.push(
        `**\`${id}\`**: no longer present in \`${repo}\`'s manifest — the claim may be retired upstream. Kept current value; needs a human look.`
      );
      continue;
    }
    for (const field of ["value", "label", "source_file", "source_line", "commit_sha", "measured_at"]) {
      const oldVal = current[field] ?? null;
      const newVal = incoming[field] ?? null;
      if (oldVal !== newVal) {
        changes.push({
          id,
          field,
          old: oldVal,
          new: newVal,
          source: `${repo}/${incoming.source_file ?? "?"}`,
        });
        current[field] = newVal;
      }
    }
  }
}

// Stale-data guard — flag, never silently re-assert.
for (const [id, m] of Object.entries(store.metrics)) {
  if (!m.measured_at || daysSince(m.measured_at) > STALE_DAYS) {
    staleFlags.push({ id, measured_at: m.measured_at ?? "unknown" });
  }
}

// ── 2. Hugging Face cumulative downloads (informational) ────────────────

try {
  const models = await fetchJson(
    `https://huggingface.co/api/models?author=${HF_AUTHOR}&expand[]=downloadsAllTime`
  );
  const total = models.reduce((sum, m) => sum + (m.downloadsAllTime ?? 0), 0);
  const entry = store.informational?.["hf:downloads-alltime"];
  if (entry && total !== entry.value) {
    const crossedBar = entry.value < HF_DISPLAY_BAR && total >= HF_DISPLAY_BAR;
    changes.push({
      id: "hf:downloads-alltime",
      field: "value",
      old: entry.value,
      new: total,
      source: "huggingface.co API",
    });
    entry.value = total;
    entry.measured_at = new Date().toISOString().slice(0, 10);
    if (crossedBar) {
      notes.push(
        `**Hugging Face downloads crossed ${HF_DISPLAY_BAR.toLocaleString()}** (now ${total.toLocaleString()}) — the agreed bar for considering a visible site stat. Worth a decision this review.`
      );
    }
  }
} catch (err) {
  notes.push(`Hugging Face download count unavailable this run (${err.message}).`);
}

// ── 3. Live-link health (report-only — a downed demo is a human call) ───

const productsSrc = readFileSync(PRODUCTS_PATH, "utf8");
const liveUrls = [...productsSrc.matchAll(/liveUrl:\s*"([^"]+)"/g)].map((m) => m[1]);
const linkResults = [];
for (const url of liveUrls) {
  // Two attempts: serverless demos (Cloud Run) cold-start past the first
  // timeout and answer the retry — a known false-positive class since the
  // wave-2 link audit. Only a double failure is reported.
  let result = null;
  for (let attempt = 0; attempt < 2 && !result?.ok; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { method: "GET" });
      result = { url, ok: res.ok, status: res.status };
    } catch (err) {
      result = { url, ok: false, status: err.name === "AbortError" ? "timeout" : err.message };
    }
  }
  linkResults.push(result);
}
const brokenLinks = linkResults.filter((r) => !r.ok);

// ── 4. Resume drift (wave-13 follow-up: the resume shouldn't silently rot
//       while the site self-heals). content/resume-metrics.json records,
//       per resume claim, the STORE value at the last resume sync — so
//       drift detection is an exact string compare against site truth, no
//       PDF parsing. The recorded PDF hash catches the inverse failure: a
//       resume swap that skipped the manifest. Both are report-only; fixing
//       the resume is a human job (it's a designed document). ─────────────

const resumeDrift = []; // { id, resume_says, at_sync, now }
let resumeHashNote = null;
try {
  const manifest = JSON.parse(readFileSync(RESUME_MANIFEST_PATH, "utf8"));
  const pdfHash = createHash("sha256").update(readFileSync(RESUME_PDF_PATH)).digest("hex");
  if (pdfHash !== manifest.resume_pdf_sha256) {
    resumeHashNote = `public/resume.pdf changed (sha256 ${pdfHash.slice(0, 12)}…) without a content/resume-metrics.json re-sync (manifest expects ${String(manifest.resume_pdf_sha256).slice(0, 12)}…, synced ${manifest.synced_at}). Re-run the resume sync so drift tracking stays truthful.`;
  }
  for (const [id, claim] of Object.entries(manifest.claims ?? {})) {
    const current = store.metrics[id]?.value ?? null;
    if (current === null) {
      resumeDrift.push({ id, resume_says: claim.resume_says, at_sync: claim.store_value_at_sync, now: "(id no longer in metrics.json)" });
    } else if (current !== claim.store_value_at_sync) {
      resumeDrift.push({ id, resume_says: claim.resume_says, at_sync: claim.store_value_at_sync, now: current });
    }
  }
} catch (err) {
  notes.push(`Resume drift check unavailable this run (${err.message}).`);
}

// ── 5. Write store + summary ─────────────────────────────────────────────

const metricChanges = changes.filter((c) => c.id !== "hf:downloads-alltime");
const hfOnlyChange = changes.length > 0 && metricChanges.length === 0;
const hfCrossedBar = notes.some((n) => n.includes("crossed"));

// An HF-count tick alone isn't worth a weekly PR — it changes every week
// by design. It rides along with real changes, or triggers on bar-cross.
const shouldWrite = metricChanges.length > 0 || (hfOnlyChange && hfCrossedBar);

if (shouldWrite) {
  store.updated_at = new Date().toISOString().slice(0, 10);
  writeFileSync(METRICS_PATH, JSON.stringify(store, null, 2) + "\n");
}

const lines = [];
lines.push(`## Weekly metric refresh — ${new Date().toISOString().slice(0, 10)}`);
lines.push("");
if (metricChanges.length > 0) {
  lines.push("### Changed metrics (old → new)");
  lines.push("");
  lines.push("| Metric | Field | Old | New | Source |");
  lines.push("|---|---|---|---|---|");
  for (const c of changes) {
    lines.push(`| \`${c.id}\` | ${c.field} | ${c.old ?? "—"} | ${c.new ?? "—"} | ${c.source} |`);
  }
  lines.push("");
  lines.push(
    "> Review each value against its source artifact before merging — this PR is the human gate. If a changed metric has a drawn figure on the site (`figure:` in content/products.ts), update the figure's numbers in this PR too; they mirror the metric by rule."
  );
} else {
  lines.push("No repo-sourced metric changes this week.");
}
if (staleFlags.length > 0) {
  lines.push("");
  lines.push(`### Stale metrics (not re-measured in ${STALE_DAYS}+ days)`);
  lines.push("");
  for (const s of staleFlags) {
    lines.push(`- \`${s.id}\` — last measured ${s.measured_at}. Re-run its eval or consciously re-affirm it.`);
  }
}
if (brokenLinks.length > 0) {
  lines.push("");
  lines.push("### Live links failing right now");
  lines.push("");
  for (const b of brokenLinks) {
    lines.push(`- ${b.url} → ${b.status}`);
  }
  lines.push("");
  lines.push("> Report-only: taking a live link off the site is a human decision (see wave 12's expense-tracker precedent).");
}
if (resumeDrift.length > 0 || resumeHashNote) {
  lines.push("");
  lines.push("### Resume drift (public/resume.pdf vs site metrics)");
  lines.push("");
  if (resumeHashNote) lines.push(`- ⚠ ${resumeHashNote}`);
  for (const d of resumeDrift) {
    lines.push(
      `- \`${d.id}\`: the site now says **${d.now}**, but the resume was synced when it said "${d.at_sync}" (resume claims: "${d.resume_says}"). Regenerate the resume or consciously accept the gap.`
    );
  }
  lines.push("");
  lines.push(
    "> Report-only: the resume is a designed 2-page document — a human regenerates it (see .assets/resume-sources/ + content/resume-metrics.json's _readme)."
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
  "_Generated by scripts/refresh-metrics.mjs. Sources: each repo's `.portfolio/metrics.json` (see the portfolio README's “Autonomous metric refresh” section)._"
);

writeFileSync(SUMMARY_PATH, lines.join("\n") + "\n");
console.log(lines.join("\n"));
console.log(
  `\n--> ${shouldWrite ? "content/metrics.json updated" : "no store change"}; ${metricChanges.length} metric change(s), ${staleFlags.length} stale flag(s), ${brokenLinks.length} broken link(s), ${resumeDrift.length} resume drift(s)${resumeHashNote ? " + resume-hash mismatch" : ""}.`
);
