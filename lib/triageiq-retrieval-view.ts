/**
 * The parts of the retrieval explainer both the server and the browser need:
 * the shapes, the opacity ramp, and the rule for which points are emphasised.
 *
 * Separate from lib/triageiq-retrieval.ts because that module is marked
 * "server-only" so the 38 KB projection can never be pulled into a client
 * bundle by accident. A client component importing a value from it fails the
 * build, which is the guard working. This file holds no data, only the rules,
 * so both sides can share them without either one importing the other's.
 *
 * Same split, and the same reason, as lib/embedding-cluster-opacity.ts next to
 * lib/embedding-projection.ts.
 */

/** One issue in the sampled corpus. Short keys: 700 of these ship as JSON. */
export interface RetrievalPoint {
  /** GitHub issue number, as a string, and the only id anything joins on. */
  n: string;
  /** 3D t-SNE position, normalised to roughly -1..1. Layout, not the space. */
  p: [number, number, number];
  /** k-means group over the same embeddings, for opacity banding only. */
  c: number;
}

export interface RetrievedIssue {
  n: string;
  title: string;
  score: number;
  rank: number;
  /** True when this is the issue the gold set says the query is related to. */
  gold: boolean;
}

export interface RetrievalQuery {
  n: string;
  title: string;
  gold: string;
  gold_title: string;
  /** Where the gold answer actually landed. Can be worse than top_k. */
  gold_rank: number;
  gold_in_top_k: boolean;
  retrieved: RetrievedIssue[];
}

export interface RetrievalProjection {
  version: number;
  model: string;
  query_instruction: string;
  query_instruction_applies: string;
  similarity: string;
  projection: string;
  repo: string;
  corpus_size: number;
  corpus_total: number;
  n_clusters: number;
  top_k: number;
  source: string;
  generated_at: string;
  points: RetrievalPoint[];
  queries: RetrievalQuery[];
}

/**
 * Opacity per k-means group, dimmest to brightest.
 *
 * Shared by the static SVG and the GL layer so the two cannot drift, which is
 * the same reason the Warmer viewer passes its ramp in rather than each layer
 * holding a copy. Deliberately a narrow band: the corpus is background, and
 * the only thing that should draw the eye is an emphasised point.
 */
export const CLUSTER_OPACITY = [0.22, 0.26, 0.3, 0.34, 0.38, 0.42, 0.46, 0.5] as const;

/**
 * Emphasis levels, 0 to 1, feeding the renderer's per-point emphasis.
 *
 * These are large on purpose. The first version used a narrower spread and
 * the highlighted issues were genuinely hard to find in a field of 700, which
 * makes the picture decorative: if you cannot see which dot the retriever
 * returned, the canvas is illustrating nothing. The corpus was dimmed at the
 * same time, so the contrast comes from both ends rather than from pushing
 * the highlight past what the accent can do.
 */
export const EMPHASIS = {
  /** The issue you asked about. */
  query: 1,
  /** The issue the gold set says is the right answer. */
  gold: 0.78,
  /** Everything else the retriever returned. */
  retrieved: 0.4,
} as const;

/**
 * Emphasis for every corpus point, given the selected query.
 *
 * Returned as a plain array in corpus order because that is what both the GL
 * buffer and the SVG need, and computing it once keeps the two layers showing
 * the same set rather than each deciding for itself what is highlighted.
 */
export function emphasisFor(
  points: readonly RetrievalPoint[],
  query: RetrievalQuery | undefined
): number[] {
  const levels = new Array<number>(points.length).fill(0);
  if (!query) return levels;
  const byNumber = new Map<string, number>();
  points.forEach((point, i) => byNumber.set(point.n, i));

  for (const hit of query.retrieved) {
    const i = byNumber.get(hit.n);
    if (i !== undefined) levels[i] = EMPHASIS.retrieved;
  }
  // Gold and query are set after the retrieved loop so that a gold answer
  // which IS in the top five keeps its own, stronger level rather than
  // whichever of the two happened to be written last.
  const goldIndex = byNumber.get(query.gold);
  if (goldIndex !== undefined) levels[goldIndex] = EMPHASIS.gold;
  const queryIndex = byNumber.get(query.n);
  if (queryIndex !== undefined) levels[queryIndex] = EMPHASIS.query;
  return levels;
}
