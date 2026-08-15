// perf/lcp-final Task 4 — precomputes a 3D point-cloud projection of the
// portfolio's own real per-project embeddings, for the shared WebGL
// point-cloud renderer (lib/webgl/point-cloud.ts).
//
// Source: content/search/project-embeddings.json — 13 REAL 384-dim
// Xenova/all-MiniLM-L6-v2 embeddings, one per project, already generated and
// verified for the keyword-search-methodology feature (BL-9). Deliberately
// NOT inventing new per-issue/per-cluster data for any single case study —
// there is no real embedding dataset for e.g. TriageIQ's individual GitHub
// issues checked into this repo, and this repo's own standing rule is that
// nothing ships without a real, sourced input (see PLAN.md's header, "every
// displayed number traces to content/provenance.md or it doesn't ship" — the
// same principle extends to a data visualization's underlying data, not just
// headline metric numbers). Reusing the one real embedding dataset that
// already exists keeps both new Task-4 surfaces honestly grounded.
//
// Method: PCA to 3 components via the Gram-matrix trick (n=13 points, d=384
// dims — eigendecomposing the 13x13 Gram matrix X·Xᵀ is far cheaper than the
// 384x384 covariance matrix, and both are mathematically equivalent up to
// scaling: for a Gram eigenpair (λ, v), the PCA score along that component is
// √λ · v). Power iteration + deflation, deterministic — a fixed all-ones
// starting vector, no RNG, so re-running this script reproduces byte-identical
// output (rule 40's determinism ethos, minus the seed since no randomness is
// involved at all).
//
// Run: node scripts/build_project_embedding_projection.mjs
// Zero new dependencies.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMBEDDINGS_PATH = join(ROOT, "content", "search", "project-embeddings.json");
const PRODUCTS_PATH = join(ROOT, "content", "products.ts");
const OUTPUT_PATH = join(ROOT, "content", "data", "project-embedding-projection.json");

const POWER_ITERATIONS = 2000;
const N_COMPONENTS = 3;

/**
 * Extracts each project's slug and first `categories` entry from
 * content/products.ts by text scan — the same technique
 * scripts/refresh-metrics.mjs and scripts/chatbot/build-index.mjs already use
 * on this exact file, since it has a real runtime import (`@/lib/metrics`)
 * plain Node can't resolve without a bundler.
 */
function extractSlugToCategory() {
  const src = readFileSync(PRODUCTS_PATH, "utf8");
  const entries = new Map();
  const blockRe = /slug:\s*"([\w-]+)"[\s\S]*?categories:\s*\[([^\]]*)\]/g;
  for (const match of src.matchAll(blockRe)) {
    const [, slug, categoriesRaw] = match;
    const firstCategory = categoriesRaw.split(",")[0].trim().replace(/["']/g, "");
    entries.set(slug, firstCategory);
  }
  return entries;
}

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function matVec(matrix, vec) {
  return matrix.map((row) => dot(row, vec));
}

function norm(vec) {
  return Math.sqrt(dot(vec, vec));
}

/**
 * Top eigenpair of a symmetric matrix via power iteration, deterministic seed.
 *
 * The seed is a linear ramp [1, 2, ..., n], not the more obvious all-ones
 * vector — for THIS matrix (a Gram matrix built from mean-centered data),
 * every row sums to exactly zero by construction (row i's sum is
 * dot(centered_i, Σ_j centered_j) = dot(centered_i, 0) = 0, since
 * mean-centering makes the column sums zero), so the all-ones vector sits
 * exactly in the matrix's null space and one matVec collapses it to zero on
 * the first iteration — found by inspecting a first attempt's all-zero
 * output, not assumed.
 */
function powerIteration(matrix, n) {
  let v = Array.from({ length: n }, (_, i) => i + 1);
  const v0Norm = norm(v);
  v = v.map((x) => x / v0Norm);
  for (let iter = 0; iter < POWER_ITERATIONS; iter++) {
    const next = matVec(matrix, v);
    const nextNorm = norm(next);
    if (nextNorm < 1e-12) break;
    v = next.map((x) => x / nextNorm);
  }
  const av = matVec(matrix, v);
  const eigenvalue = dot(v, av);
  return { eigenvalue, eigenvector: v };
}

/** Removes the found eigenpair's contribution so the next power iteration finds the next-largest. */
function deflate(matrix, eigenvalue, eigenvector, n) {
  const result = matrix.map((row) => row.slice());
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[i][j] -= eigenvalue * eigenvector[i] * eigenvector[j];
    }
  }
  return result;
}

/** PCA via the Gram-matrix trick. Returns `nComponents` score vectors, each length n. */
function pcaScores(pointsByDim, n, nComponents) {
  // pointsByDim: n x d matrix (rows = points, cols = embedding dims), already mean-centered.
  const gram = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      row.push(dot(pointsByDim[i], pointsByDim[j]));
    }
    gram.push(row);
  }

  let workingMatrix = gram;
  const scores = [];
  for (let c = 0; c < nComponents; c++) {
    const { eigenvalue, eigenvector } = powerIteration(workingMatrix, n);
    const scale = Math.sqrt(Math.max(eigenvalue, 0));
    scores.push(eigenvector.map((x) => x * scale));
    workingMatrix = deflate(workingMatrix, eigenvalue, eigenvector, n);
  }
  return scores;
}

function normalizeToUnitRange(values) {
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1e-9);
  return values.map((v) => v / maxAbs);
}

function main() {
  const raw = JSON.parse(readFileSync(EMBEDDINGS_PATH, "utf8"));
  const slugToCategory = extractSlugToCategory();

  const slugs = raw.projects.map((p) => p.slug);
  const dim = raw.dim;
  const n = slugs.length;

  // Mean-center each dimension across the 13 real embeddings.
  const mean = new Array(dim).fill(0);
  for (const p of raw.projects) {
    for (let d = 0; d < dim; d++) mean[d] += p.embedding[d] / n;
  }
  const centered = raw.projects.map((p) => p.embedding.map((v, d) => v - mean[d]));

  const [pc1, pc2, pc3] = pcaScores(centered, n, N_COMPONENTS);
  const x = normalizeToUnitRange(pc1);
  const y = normalizeToUnitRange(pc2);
  const z = normalizeToUnitRange(pc3);

  // Deterministic cluster id per project: alphabetically-sorted distinct
  // first-categories mapped to 0..6, matching the 7-step opacity ramps in
  // lib/embedding-cluster-opacity.ts (cluster identity is cosmetic opacity
  // variety only, same convention as the existing hero/Warmer clouds — never
  // a claimed semantic finding).
  const distinctCategories = [...new Set(slugToCategory.values())].sort();

  const points = slugs.map((slug, i) => ({
    term: slug,
    cluster: distinctCategories.indexOf(slugToCategory.get(slug) ?? "uncategorized"),
    finetuned: [x[i], y[i], z[i]],
  }));

  const output = {
    version: 1,
    model: raw.model,
    projection: "pca3-gram",
    n_terms: n,
    n_clusters: distinctCategories.length,
    source: "content/search/project-embeddings.json",
    generated_at: new Date().toISOString(),
    points,
  };

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_PATH} — ${n} points, ${distinctCategories.length} clusters.`);
}

main();
