import type { Product } from "@/content/types";

/**
 * How the project grid gets rhythm without getting holes.
 *
 * Thirteen cards of identical weight is what makes a body of work read as a
 * database table, so the grid has two sizes: a spread across both columns
 * and a standard half-width card. What decides which is not decoration and
 * not a hand-kept list, it is what the project actually has to show. A
 * project with an eval figure has a real visual to put in a right rail, and
 * a spread is the only shape that gives it room; a project without one would
 * just be a half card stretched wide with more empty space in it.
 *
 * The parity rule is the part that matters. A spread has to start a row, or
 * it strands the single standard card next to it and punches a hole in the
 * grid. So a figure-carrying project is only promoted to a spread when the
 * row is empty; if it lands mid-row it stays standard. That is why this is
 * computed rather than written down: the answer depends on everything before
 * it in the list, and a hand-maintained list of "wide ones" silently grows a
 * hole the first time a project is inserted.
 *
 * CSS grid's own `dense` packing would also close the holes, and is the
 * usual answer, but it reorders cards visually to fill gaps. This list is
 * ordered by depth, so a grid that floats the thirteenth project up next to
 * the first is telling the visitor something untrue about the ordering.
 */

export type ProjectSize = "spread" | "standard";

export interface ProjectRhythm {
  size: ProjectSize;
  /** Degrees to rotate the base accent hue by, for this project's tint. */
  hueShift: number;
}

/**
 * Total hue spread across the set, centred on the base accent.
 *
 * Wide enough that two cards side by side are visibly different, narrow
 * enough that all thirteen still read as one palette rather than a rainbow.
 * Only borders, glows and the hover wash use it; every piece of text stays on
 * the neutral tokens, so no amount of hue rotation can move a contrast ratio.
 */
const HUE_SPREAD_DEG = 88;

export function projectRhythm(products: readonly Product[]): Map<string, ProjectRhythm> {
  const rhythm = new Map<string, ProjectRhythm>();
  // 0 = a row is empty and the next card may be a spread; 1 = mid-row.
  let parity = 0;

  products.forEach((product, index) => {
    const canSpread = Boolean(product.figure);
    const size: ProjectSize = canSpread && parity === 0 ? "spread" : "standard";
    parity = size === "spread" ? 0 : (parity + 1) % 2;

    /* Spread evenly across the set by position rather than by hashing the
     * slug: a hash gives neighbouring cards arbitrarily close hues about as
     * often as not, and the whole point is that adjacent cards look
     * different from each other. */
    const t = products.length > 1 ? index / (products.length - 1) : 0.5;
    rhythm.set(product.slug, {
      size,
      hueShift: Math.round((t - 0.5) * HUE_SPREAD_DEG),
    });
  });

  return rhythm;
}
