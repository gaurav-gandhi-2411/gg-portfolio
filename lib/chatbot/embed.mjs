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
// Zero dependencies beyond @huggingface/transformers; Node 20+.

import { pipeline } from "@huggingface/transformers";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

/** Module-level cache so repeated calls (many chunks in one build run, or many
 * requests to a warm Vercel function instance) don't reload the model each time. */
let extractorPromise = null;

/**
 * Lazily loads (once) and returns the feature-extraction pipeline.
 * @returns {Promise<import("@huggingface/transformers").FeatureExtractionPipeline>}
 */
function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_ID, { dtype: "q8" });
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
