import "server-only";

import projectionJson from "@/content/data/project-embedding-projection.json";

export interface ProjectEmbeddingPoint {
  /** Project slug, matching content/products.ts. */
  term: string;
  cluster: number;
  finetuned: [number, number, number];
}

export interface ProjectEmbeddingProjection {
  version: number;
  model: string;
  projection: string;
  n_terms: number;
  n_clusters: number;
  source: string;
  generated_at: string;
  points: ProjectEmbeddingPoint[];
}

/**
 * Real PCA projection of the portfolio's own project embeddings (see
 * scripts/build_project_embedding_projection.mjs) — precomputed offline,
 * never computed client-side. Same "read server-side, pass down as a prop"
 * shape as lib/embedding-projection.ts, so the static SVG fallback renders in
 * the initial SSR'd HTML with zero extra client fetch.
 */
export function getProjectEmbeddingProjection(): ProjectEmbeddingProjection {
  return projectionJson as ProjectEmbeddingProjection;
}
