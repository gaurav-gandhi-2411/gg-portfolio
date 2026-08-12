import "server-only";

import projectionJson from "@/content/data/hinglish-embedding-projection.json";

export interface EmbeddingPoint {
  term: string;
  cluster: number;
  finetuned: [number, number, number];
  /** Same term's position under the pre-fix base model (v2+ only — see version). */
  base?: [number, number, number];
}

export interface EmbeddingProjection {
  version: number;
  model: string;
  /** Pre-fix model — paraphrase-multilingual-MiniLM-L12-v2, per mindmeld/spec-hinglish-fix.md:7. v2+ only. */
  base_model?: string;
  projection: string;
  n_terms: number;
  n_clusters: number;
  source: string;
  generated_at: string;
  points: EmbeddingPoint[];
}

/**
 * Real t-SNE projection of gauravgandhi2411/hinglish-relatedness-sbert
 * embeddings for the actual term vocabulary from mindmeld's production eval
 * (see scripts/build_embedding_projection.py) — precomputed offline, never
 * computed client-side. Read server-side and passed as a prop into the
 * client hero/case-study components so the static SVG fallback renders in
 * the initial SSR'd HTML with zero extra client fetch.
 */
export function getEmbeddingProjection(): EmbeddingProjection {
  return projectionJson as EmbeddingProjection;
}
