// Wave 16 — shared embedding module for the reconciliation chatbot.
//
// Used by two callers that must stay in the same vector space:
//   1. scripts/chatbot/build-index.mjs (build-time corpus indexing, run via `node`)
//   2. the future runtime API route (query-time embedding, imported into a Next.js
//      route handler)
//
// Model: Xenova/all-MiniLM-L6-v2 — a small, well-known, quantized ONNX sentence
// embedding model (384-dim), run locally via @huggingface/transformers
// (the actively-maintained successor to @xenova/transformers). Deliberately NOT a
// hosted embeddings API: this repo already has Ollama available locally, but Ollama
// can't serve Vercel's production runtime, and a bundled local ONNX model keeps
// corpus + query embeddings in the same vector space with zero external network
// dependency at request time.
//
// @huggingface/transformers is an OPTIONAL dependency and is imported
// dynamically (see loadExtractor). Node 20+.

import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Thrown when @huggingface/transformers cannot be resolved at all.
 *
 * It is an optionalDependency (see package.json): its transitive
 * onnxruntime-node runs a postinstall that downloads a native binary from a
 * CDN, and when that CDN is unreachable `npm ci` fails outright. Making it
 * optional means a production install or a contributor's local setup degrades
 * to "the /ask assistant is unavailable" instead of "nothing installs".
 *
 * Distinct error type on purpose: callers must be able to tell "this feature's
 * dependency is absent" (degrade, show an unavailable state) from "the model
 * failed to load / inference threw" (a real fault worth surfacing as an error).
 * scripts/chatbot/build-index.mjs catches THIS specifically and refuses to
 * write, while letting anything else propagate.
 */
export class EmbeddingUnavailableError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "EmbeddingUnavailableError";
  }
}

/**
 * Applies both settings the rest of this repo depends on, to a transformers
 * `env` object. Exported and taking `env` as a parameter purely so it can be
 * asserted without loading the model (see embed.test.ts) — the
 * single-threaded setting in particular is invisible when correct and only
 * shows up as flaky CI when lost.
 *
 * MUST be called before the first pipeline() call: transformers reads both at
 * pipeline-construction time, so setting them afterwards silently does nothing.
 *
 * @param {{cacheDir: string, backends: {onnx: {wasm: {numThreads: number}}}}} env
 */
export function applyEmbeddingEnv(env) {
  // transformers.js's default cacheDir resolves inside its own node_modules,
  // which is read-only on Vercel's deployed function filesystem — the first
  // model download crashed on mkdir. os.tmpdir() is writable everywhere this
  // runs and is the portable way to say "scratch directory".
  env.cacheDir = join(tmpdir(), "transformers-cache");
  // Multi-threaded WASM reduces matmul/pooling sums in a non-deterministic
  // order, so identical input text produces byte-different float32 vectors
  // between runs — confirmed on two consecutive Actions runs of the same
  // commit (PR #32). scripts/chatbot/check-index-fresh.mjs compares embeddings
  // against a committed index, so determinism is load-bearing, not a nicety.
  env.backends.onnx.wasm.numThreads = 1;
  return env;
}

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

/** Module-level cache so repeated calls (many chunks in one build run, or many
 * requests to a warm Vercel function instance) don't reload the model each time. */
let extractorPromise = null;

/**
 * Resolves the optional dependency, applies the determinism config, and builds
 * the pipeline — in that order, because both env settings are read at
 * pipeline-construction time.
 *
 * The import is dynamic rather than static because a static import of an
 * optionalDependency crashes the whole module at load time when the package is
 * absent, which would take down every route that transitively imports this one
 * instead of just the /ask feature.
 */
async function loadExtractor() {
  let transformers;
  try {
    transformers = await import("@huggingface/transformers");
  } catch (cause) {
    throw new EmbeddingUnavailableError(
      "@huggingface/transformers is not installed. It is an optionalDependency; " +
        "its transitive onnxruntime-node downloads a native binary at install time, " +
        "so a CDN outage or an --omit=optional install leaves it absent.",
      { cause }
    );
  }
  applyEmbeddingEnv(transformers.env);
  return transformers.pipeline("feature-extraction", MODEL_ID, { dtype: "q8" });
}

/**
 * Lazily loads (once) and returns the feature-extraction pipeline.
 *
 * A rejected promise stays cached deliberately. If the package is missing it
 * will be missing for this process's whole life, and retrying per request would
 * turn one unavailable feature into a stream of failed dynamic imports.
 *
 * @returns {Promise<import("@huggingface/transformers").FeatureExtractionPipeline>}
 */
function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = loadExtractor();
  }
  return extractorPromise;
}

/**
 * Embeds a batch of texts into 384-dim normalized sentence vectors.
 * @param {string[]} texts - Input strings to embed. Order is preserved in the output.
 * @returns {Promise<number[][]>} One 384-dim float array per input text, mean-pooled
 *   and L2-normalized, as plain JS arrays (not tensors).
 */
export async function embed(texts) {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  // output is a Tensor of shape [texts.length, 384]; .tolist() gives plain arrays.
  return output.tolist();
}

/**
 * Cosine similarity between two equal-length vectors (dot product over the
 * product of norms). Reused by the future retrieval code — kept here since it's
 * tightly coupled to the embedding format this module produces.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} Cosine similarity in [-1, 1] (NaN-safe: returns 0 if either
 *   vector has zero norm).
 */
export function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const EMBEDDING_MODEL_ID = MODEL_ID;
