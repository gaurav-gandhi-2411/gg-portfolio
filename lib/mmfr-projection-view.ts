/**
 * The parts of the MMFR item-space explainer both the server and the browser
 * need: the shapes and the rule for which points are emphasised.
 *
 * Separate from lib/mmfr-projection.ts because that module is marked
 * "server-only" so the ~34 KB projection can never be pulled into a client
 * bundle by accident. This file holds no data, only the rules, so both sides
 * can share them without either one importing the other's -- same split as
 * lib/triageiq-retrieval-view.ts next to lib/triageiq-retrieval.ts.
 */

/** One item in the sampled catalogue. Short keys: 500 of these ship as JSON. */
export interface ItemPoint {
  /** Shopify product_id, as a string, and the only id anything joins on. */
  id: string;
  /** 3D t-SNE position, normalised to roughly -1..1. Layout, not the space. */
  p: [number, number, number];
  /** Real catalogue category, indexed into `categories`, for opacity banding only. */
  c: number;
}

export interface ItemNeighbor {
  id: string;
  title: string;
  category: string;
  score: number;
  rank: number;
  /** True when this neighbor shares the anchor's own real catalogue category. */
  same_category: boolean;
}

export interface ItemAnchor {
  id: string;
  title: string;
  category: string;
  neighbors: ItemNeighbor[];
}

export interface MmfrProjection {
  version: number;
  brand: string;
  image_model: string;
  text_model: string;
  fusion: string;
  similarity: string;
  projection: string;
  categories: string[];
  checkpoint_epoch: number;
  checkpoint_val_recall_at_10: number;
  source: string;
  generated_at: string;
  n_points: number;
  points: ItemPoint[];
  anchors: ItemAnchor[];
}

/**
 * Opacity per real catalogue category, dimmest to brightest.
 *
 * Shared by the static SVG and the GL layer so the two cannot drift -- same
 * reason CLUSTER_OPACITY exists in lib/triageiq-retrieval-view.ts. Ten real
 * categories cycle through eight bands (renderer takes `cluster % length`),
 * which is fine: the ramp exists to keep the background field from reading as
 * a flat wall of dots, not to give every category its own visually distinct
 * value.
 */
export const CLUSTER_OPACITY = [0.22, 0.26, 0.3, 0.34, 0.38, 0.42, 0.46, 0.5] as const;

/**
 * Emphasis levels, 0 to 1, feeding the renderer's per-point emphasis.
 *
 * Same two-tier shape as TriageIQ's EMPHASIS (query vs. retrieved), collapsed
 * to one tier here since MMFR has no "gold answer" concept -- every neighbor
 * the model actually returned is equally a real result, not a graded one.
 */
export const EMPHASIS = {
  /** The anchor item you picked. */
  anchor: 1,
  /** The five neighbors the fused embedding space actually returned for it. */
  neighbor: 0.55,
} as const;

/**
 * Emphasis for every catalogue point, given the selected anchor.
 *
 * Returned as a plain array in catalogue order because that is what both the
 * GL buffer and the SVG need, and computing it once keeps the two layers
 * showing the same set rather than each deciding for itself what is
 * highlighted.
 */
export function emphasisFor(
  points: readonly ItemPoint[],
  anchor: ItemAnchor | undefined
): number[] {
  const levels = new Array<number>(points.length).fill(0);
  if (!anchor) return levels;
  const byId = new Map<string, number>();
  points.forEach((point, i) => byId.set(point.id, i));

  for (const neighbor of anchor.neighbors) {
    const i = byId.get(neighbor.id);
    if (i !== undefined) levels[i] = EMPHASIS.neighbor;
  }
  // The anchor is set after the neighbor loop so it keeps its own, stronger
  // level rather than whichever of the two happened to be written last (the
  // anchor is never one of its own neighbors in this data, but the ordering
  // is defensive in the same spirit as emphasisFor in triageiq-retrieval-view).
  const anchorIndex = byId.get(anchor.id);
  if (anchorIndex !== undefined) levels[anchorIndex] = EMPHASIS.anchor;
  return levels;
}
