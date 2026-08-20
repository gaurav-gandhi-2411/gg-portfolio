import "server-only";

import projectionJson from "@/content/data/mmfr-projection.json";
import type { MmfrProjection } from "@/lib/mmfr-projection-view";

export type { ItemAnchor, ItemNeighbor, ItemPoint, MmfrProjection } from "@/lib/mmfr-projection-view";

/**
 * The real, trained two-tower item embedding space, run over one real brand
 * catalogue offline by scripts/build_mmfr_projection.py. Same encoders, same
 * fusion weights, same cosine ranking as production; see that script's header
 * for what is faithful and what is deliberately not.
 *
 * "server-only" is load-bearing, not decoration: this is the one module that
 * holds the ~34 KB projection, and importing it from a client component is a
 * build failure rather than a page that quietly got 34 KB heavier. The rules
 * both sides need live in lib/mmfr-projection-view.ts, which holds no data.
 */
export function getMmfrProjection(): MmfrProjection {
  return projectionJson as MmfrProjection;
}
