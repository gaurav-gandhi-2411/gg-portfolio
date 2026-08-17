/**
 * Nearest-neighbour links in the projected embedding field.
 *
 * Why this exists: with points alone, the hero field read as a generic
 * starfield. Indigo dots glowing on near-black is one step from a space
 * background, which is a cliché and undercuts the only thing that makes the
 * element honest, namely that every dot is a real term at a real position.
 * The fix is not fewer dots, it is making the structure legible. Joining
 * each term to its nearest neighbours draws the local neighbourhood of the
 * projection, which is exactly what a projection is for and is real data
 * rather than decoration.
 *
 * Deliberately not filtered by cluster label. Linking only within clusters
 * would look tidier and would be imposing the labels back onto the geometry;
 * the neighbourhood is whatever the coordinates say it is. Long links are
 * dropped by distance instead, which is a geometric statement rather than a
 * categorical one, and keeps a stray hairline from implying a relationship
 * across the width of the field.
 *
 * Shared by the WebGL layer and the still SVG so the two cannot draw
 * different structure from the same data.
 */

export interface NeighbourPair {
  /** Indices into the point array, always with a < b so pairs dedupe. */
  a: number;
  b: number;
}

export interface NeighbourOptions {
  /** Neighbours per point before deduping. */
  k?: number;
  /** Share of the resulting links to keep, shortest first. */
  keepFraction?: number;
}

const DEFAULT_K = 2;
/**
 * Drops the longest sixth of the links. Tuned against the rendered field:
 * below about 0.8 the structure starts losing the strands that connect one
 * lobe of a cluster to the next, and above about 0.9 the occasional link
 * long enough to read as a stray line across open space survives.
 */
const DEFAULT_KEEP_FRACTION = 0.84;

type Vec3 = readonly [number, number, number];

function squaredDistance(p: Vec3, q: Vec3): number {
  const dx = p[0] - q[0];
  const dy = p[1] - q[1];
  const dz = p[2] - q[2];
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Brute force, which is the right call at this size: 419 points is about
 * 88,000 distance calculations, a couple of milliseconds once. A spatial
 * index would be faster asymptotically and slower here, and would be one
 * more thing to get subtly wrong for no gain.
 *
 * Fully deterministic for a given input, including the tie-break, so the
 * same field renders identically on every load and a screenshot test of it
 * would mean something.
 */
export function nearestNeighbourPairs(
  positions: readonly Vec3[],
  { k = DEFAULT_K, keepFraction = DEFAULT_KEEP_FRACTION }: NeighbourOptions = {}
): NeighbourPair[] {
  const seen = new Set<string>();
  const pairs: { a: number; b: number; d2: number }[] = [];

  for (let i = 0; i < positions.length; i++) {
    // k smallest by insertion into a tiny sorted list; k is 2 or 3, so this
    // beats sorting all n candidates per point by a wide margin.
    const best: { index: number; d2: number }[] = [];
    for (let j = 0; j < positions.length; j++) {
      if (j === i) continue;
      const d2 = squaredDistance(positions[i], positions[j]);
      if (best.length < k) {
        best.push({ index: j, d2 });
        best.sort((x, y) => x.d2 - y.d2 || x.index - y.index);
        continue;
      }
      if (d2 < best[best.length - 1].d2) {
        best[best.length - 1] = { index: j, d2 };
        best.sort((x, y) => x.d2 - y.d2 || x.index - y.index);
      }
    }

    for (const { index, d2 } of best) {
      const a = Math.min(i, index);
      const b = Math.max(i, index);
      const key = `${a}:${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ a, b, d2 });
    }
  }

  pairs.sort((x, y) => x.d2 - y.d2 || x.a - y.a || x.b - y.b);
  const keep = Math.max(0, Math.min(pairs.length, Math.round(pairs.length * keepFraction)));
  return pairs.slice(0, keep).map(({ a, b }) => ({ a, b }));
}
