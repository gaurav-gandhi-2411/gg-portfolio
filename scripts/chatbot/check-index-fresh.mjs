// Verifies content/chatbot/index.json is up to date with content/*.ts +
// content/provenance.md, without leaving the working tree modified.
//
// WHY THIS EXISTS: this exact check already ran in CI (ci.yml's build job)
// on every PR, so "run the check on PRs" was never the gap — main broke
// twice anyway (2026-08-05, 2026-08-07) because both times the stale index
// slipped in via a path CI's own gate didn't stop (a since-fixed
// branch-protection bypass, and a direct content-only edit landed without
// re-running build-index.mjs before commit). Extracted from ci.yml's former
// inline step into its own script so the exact same comparison logic can
// run BEFORE a commit ever happens (.pre-commit-config.yaml), catching this
// at author-time for free instead of relying only on CI to catch it after
// the fact.
//
// Regenerates content/chatbot/index.json via build-index.mjs, diffs it
// against the committed version with the same embedding-similarity
// tolerance CI has always used (two real, different sentences embed at
// 0.3-0.7 similarity with this model; two runs of identical text land
// 0.99+ — see build-index.mjs's own header for why exact float equality
// isn't the bar), then restores the original committed file so running
// this check never itself creates an uncommitted diff.
//
// Usage: node scripts/chatbot/check-index-fresh.mjs
// Exit 0 = fresh. Exit 1 = stale, with the specific chunks that changed.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { serializeIndex } from "../../lib/chatbot/index-format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const INDEX_PATH = join(ROOT, "content", "chatbot", "index.json");
const SIMILARITY_FLOOR = 0.99;

function cosineSim(a, b) {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const committedRaw = readFileSync(INDEX_PATH, "utf8");
const committed = JSON.parse(committedRaw);

// CHATBOT_INDEX_REEMBED=1: build-index.mjs normally reuses the committed
// embeddings for unchanged chunks. Reuse would make this check compare the
// file against itself, so it is switched off here and every chunk is embedded
// from scratch (the same tolerance-based comparison as before).
execFileSync("node", [join(ROOT, "scripts", "chatbot", "build-index.mjs")], {
  cwd: ROOT,
  env: { ...process.env, CHATBOT_INDEX_REEMBED: "1" },
  stdio: "pipe", // build-index.mjs's own progress output isn't useful here; only its written file is
});
const fresh = JSON.parse(readFileSync(INDEX_PATH, "utf8"));

// Regenerating overwrote the committed file as a side effect — restore it
// immediately so this check never itself leaves an uncommitted diff behind,
// whether it passes or fails.
writeFileSync(INDEX_PATH, committedRaw);

const problems = [];

// The merge-friendly layout (one chunk per line, sorted by id) is part of the
// contract: a hand-edited or differently-formatted file would silently bring
// back whole-file merge conflicts. Re-serialising must reproduce it byte for byte.
if (serializeIndex(committed) !== committedRaw) {
  problems.push("file is not in canonical layout (one chunk per line, sorted by id, no volatile fields)");
}

if (committed.model !== fresh.model) {
  problems.push(
    "model mismatch: " + JSON.stringify({ committed: committed.model, fresh: fresh.model })
  );
}

const freshById = new Map(fresh.chunks.map((c) => [c.id, c]));
for (const c of committed.chunks) {
  const f = freshById.get(c.id);
  if (!f) {
    problems.push("chunk " + c.id + " missing from fresh regeneration");
    continue;
  }
  const { embedding: cEmb, ...cRest } = c;
  const { embedding: fEmb, ...fRest } = f;
  if (JSON.stringify(cRest) !== JSON.stringify(fRest)) {
    problems.push("chunk " + c.id + " non-embedding fields differ");
    continue;
  }
  const sim = cosineSim(cEmb, fEmb);
  if (sim < SIMILARITY_FLOOR) {
    problems.push("chunk " + c.id + " embedding similarity " + sim.toFixed(6) + " below floor " + SIMILARITY_FLOOR);
  }
}
if (fresh.chunks.length !== committed.chunks.length) {
  problems.push("chunk count changed: committed " + committed.chunks.length + " vs fresh " + fresh.chunks.length);
}

if (problems.length > 0) {
  console.error("content/chatbot/index.json is stale relative to content/*.ts + content/provenance.md.");
  console.error("Run: node scripts/chatbot/build-index.mjs, then commit the result.");
  problems.forEach((p) => console.error("  - " + p));
  process.exit(1);
}
console.log("content/chatbot/index.json is up to date (" + committed.chunks.length + " chunks, embeddings within tolerance).");
