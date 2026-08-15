// BL-9 round 5 (task A3) — a zero-runtime-dependency static-embedding
// query encoder, built to evaluate as a smaller cold-start alternative to
// the client-side MiniLM tier this feature originally shipped. Tokenize +
// dequantize + mean-pool + re-normalize against the pruned int8 word-vector
// table (content/search/static-embeddings.json, built by
// scripts/search/build-static-embeddings.mjs), entirely in this file.
//
// NOT WIRED INTO components/project-search.tsx. This module is a measured,
// working candidate (see reports/BL-9-round5-static-embedding-and-decision
// .md for its real recall/size numbers) that the round-5 decision rule did
// not select for shipping — keyword-only ranking's own recall was
// statistically indistinguishable from this tier's at n=28, and
// keyword-only is smaller (zero additional bytes vs. this table's ~1.2
// MiB). Kept, and still typechecked/tested, as a reproducible artifact for
// that comparison and for any future round with a larger eval set that
// might resolve the tie differently — not dead code in the sense of
// "abandoned," but explicitly not in production's call graph. Out-of-
// vocabulary words are silently dropped — a query with zero in-vocabulary
// words returns null.

/** Shape of content/search/static-embeddings.json. */
export interface StaticEmbeddingTable {
  dim: number;
  scale: number;
  vocab: string[];
  vectors: number[][];
}

const WORD_RE = /[a-z0-9]+/g;

/** Lowercases and splits text into words — same tokenization the build
 * script used to derive the vocabulary, so query-side and vocab-side words
 * are comparable by exact string match. */
export function tokenizeWords(text: string): string[] {
  return [...text.toLowerCase().matchAll(WORD_RE)].map((m) => m[0]);
}

/**
 * Embeds `text` against a pruned static word-vector table: looks up each
 * word, dequantizes (int8 * scale / 127), mean-pools, and L2-normalizes.
 * @param text - raw query text
 * @param table - the loaded static-embeddings.json contents
 * @returns a normalized 384-dim vector, or null if no word in `text` is in-vocabulary
 */
export function embedStatic(text: string, table: StaticEmbeddingTable): number[] | null {
  const vocabIndex = new Map(table.vocab.map((w, i) => [w, i]));
  const rows = tokenizeWords(text)
    .map((w) => vocabIndex.get(w))
    .filter((i): i is number => i !== undefined)
    .map((i) => table.vectors[i]);
  if (rows.length === 0) return null;

  const mean = new Array<number>(table.dim).fill(0);
  for (const row of rows) {
    for (let i = 0; i < table.dim; i++) mean[i] += (row[i] * table.scale) / 127;
  }
  for (let i = 0; i < table.dim; i++) mean[i] /= rows.length;

  let norm = 0;
  for (const x of mean) norm += x * x;
  norm = Math.sqrt(norm);
  return norm === 0 ? null : mean.map((x) => x / norm);
}
