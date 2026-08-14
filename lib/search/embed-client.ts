// BL-9 — tier 2 of project search: client-side (in-browser) query
// embedding, deliberately DIFFERENT from lib/chatbot/embed.mjs's pattern.
//
// The /ask chatbot's runtime embedding runs server-side (app/api/chat's
// route handler imports lib/chatbot/retrieve.ts, which imports embed.mjs —
// Node, os.tmpdir() cache, single-threaded WASM for determinism). This
// module runs the SAME model family entirely in the visitor's browser
// instead. That's a deliberate scope decision, not an oversight:
//   - the task this ships for requires demonstrating, with a captured
//     network log, that the model never loads until the visitor interacts
//     with the search box — a property that's only meaningfully verifiable
//     client-side (a server-side call is invisible to the page's own
//     network panel).
//   - zero added server cost/latency: ranking runs on hardware the visitor
//     is already using, with no request to our own backend at all (the
//     lean-startup "$0-cost local path" default, taken further than the
//     chatbot's server-hosted-but-still-local-model approach).
//   - determinism doesn't matter here the way it does for embed.mjs: that
//     module's single-threaded WASM setting exists because
//     check-index-fresh.mjs diffs committed embeddings byte-for-byte across
//     runs. Query embeddings here are never committed or compared run-to-
//     run — only used once, per visitor, to rank a fixed 13-item list — so
//     this module intentionally does NOT set numThreads or a cacheDir
//     override; the browser's own default (multi-threaded where available,
//     IndexedDB-backed HTTP cache) is strictly better for this use.
//
// Same model ID as embed.mjs (Xenova/all-MiniLM-L6-v2, q8/int8 quantized)
// so query embeddings and the build-time project embeddings
// (content/search/project-embeddings.json) live in the same vector space —
// verified by scripts/search/check-project-embeddings-fresh.mjs comparing
// the committed `model` field.
//
// This file is imported ONLY via a dynamic `await import()` from
// components/project-search.tsx's focus/input handlers — never a static
// top-level import — so Next's bundler code-splits it into its own chunk
// that is not fetched until the visitor actually interacts with the search
// box (see that component's header for the network-request evidence this
// exists to produce).

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

export const SEARCH_EMBEDDING_MODEL_ID = MODEL_ID;

// Structurally matches @huggingface/transformers' FeatureExtractionPipeline
// closely enough for this module's one call site — avoiding a static import
// of the package's own types here keeps this file importable without the
// optional dependency present at typecheck time.
type Extractor = (
  texts: string[],
  options: { pooling: "mean"; normalize: boolean }
) => Promise<{ tolist(): number[][] }>;

let extractorPromise: Promise<Extractor> | null = null;

async function loadExtractor(): Promise<Extractor> {
  const { pipeline } = await import("@huggingface/transformers");
  // dtype: "q8" — the quantized (int8) ONNX export; see
  // reports/BL-9-model-size.md for the measured on-disk size of this exact
  // artifact. No env overrides: see module header for why the browser
  // defaults (multi-threaded WASM, IndexedDB HTTP cache) are the right
  // choice here, unlike embed.mjs's Node build-time path.
  const extractor = await pipeline("feature-extraction", MODEL_ID, { dtype: "q8" });
  return extractor as unknown as Extractor;
}

/** Lazily loads (once per page) and returns the feature-extraction
 * pipeline. A rejected promise stays cached — see embed.mjs's getExtractor
 * for the identical reasoning (a missing/blocked dependency stays missing
 * for this page's whole life; retrying per keystroke would turn one
 * unavailable enhancement into a stream of failed fetches). */
function getExtractor(): Promise<Extractor> {
  extractorPromise ??= loadExtractor();
  return extractorPromise;
}

/**
 * Triggers the model load without waiting for a query — call this from the
 * search input's onFocus handler so the download starts the moment a
 * visitor shows intent to search, overlapping with however long they take
 * to actually type something.
 * @returns resolves once the pipeline is ready; rejects if the optional
 *   dependency or the model fetch is unavailable (caller degrades to the
 *   keyword-only tier and must not surface this as a user-facing error)
 */
export function preloadExtractor(): Promise<Extractor> {
  return getExtractor();
}

/**
 * Embeds one query string into a 384-dim normalized vector, in the same
 * space as content/search/project-embeddings.json.
 * @param text - the visitor's raw search query
 * @returns the mean-pooled, L2-normalized embedding as a plain array
 */
export async function embedQuery(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor([text], { pooling: "mean", normalize: true });
  return output.tolist()[0];
}

/**
 * Cosine similarity between two equal-length vectors. Duplicated from
 * lib/chatbot/embed.mjs rather than imported — that module is Node-only
 * (dynamic-imports the optional dependency with Node-specific env setup)
 * and pulling it into the client bundle risks dragging along code that
 * assumes a Node runtime. Ten lines of pure math is cheaper to duplicate
 * than to couple these two features' bundles together.
 * @param a
 * @param b
 * @returns cosine similarity in [-1, 1]; 0 if either vector has zero norm
 */
export function cosineSimilarity(a: number[], b: number[]): number {
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
