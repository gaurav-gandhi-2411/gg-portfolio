// Verifies content/search/project-embeddings.json is up to date with
// content/products.ts + content/types.ts, without leaving the working tree
// modified. Same shape as scripts/chatbot/check-index-fresh.mjs — see that
// script's own header for why this exists as a dedicated pre-commit/CI check
// rather than trusting authors to remember to re-run the build script (main
// broke twice from the analogous chatbot-index gap, 2026-08-05/2026-08-07).
//
// Regenerates content/search/project-embeddings.json via
// build-project-embeddings.mjs, diffs it against the committed version with
// the same embedding-similarity tolerance the chatbot index check uses (two
// runs of identical text land 0.99+ cosine similarity; two different real
// sentences land 0.3-0.7 — see build-index.mjs's header), then restores the
// original committed file so running this check never itself creates an
// uncommitted diff.
//
// Usage: node scripts/search/check-project-embeddings-fresh.mjs
// Exit 0 = fresh. Exit 1 = stale, with the specific slugs that changed.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const INDEX_PATH = join(ROOT, "content", "search", "project-embeddings.json");
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

execFileSync("node", [join(ROOT, "scripts", "search", "build-project-embeddings.mjs")], {
  cwd: ROOT,
  stdio: "pipe", // this script's own progress output isn't useful here; only its written file is
});
const fresh = JSON.parse(readFileSync(INDEX_PATH, "utf8"));

// Regenerating overwrote the committed file as a side effect — restore it
// immediately so this check never itself leaves an uncommitted diff behind,
// whether it passes or fails.
writeFileSync(INDEX_PATH, committedRaw);

delete committed.generatedAt;
delete fresh.generatedAt;

const problems = [];

if (committed.model !== fresh.model || committed.dim !== fresh.dim) {
  problems.push(
    "model/dim mismatch: " +
      JSON.stringify({
        committed: { model: committed.model, dim: committed.dim },
        fresh: { model: fresh.model, dim: fresh.dim },
      })
  );
}

const freshBySlug = new Map(fresh.projects.map((p) => [p.slug, p]));
for (const p of committed.projects) {
  const f = freshBySlug.get(p.slug);
  if (!f) {
    problems.push("project " + p.slug + " missing from fresh regeneration");
    continue;
  }
  const sim = cosineSim(p.embedding, f.embedding);
  if (sim < SIMILARITY_FLOOR) {
    problems.push(
      "project " + p.slug + " embedding similarity " + sim.toFixed(6) + " below floor " + SIMILARITY_FLOOR
    );
  }
}
if (fresh.projects.length !== committed.projects.length) {
  problems.push(
    "project count changed: committed " + committed.projects.length + " vs fresh " + fresh.projects.length
  );
}

if (problems.length > 0) {
  console.error(
    "content/search/project-embeddings.json is stale relative to content/products.ts + content/types.ts."
  );
  console.error("Run: node scripts/search/build-project-embeddings.mjs, then commit the result.");
  problems.forEach((p) => console.error("  - " + p));
  process.exit(1);
}
console.log(
  "content/search/project-embeddings.json is up to date (" +
    committed.projects.length +
    " projects, embeddings within tolerance)."
);
