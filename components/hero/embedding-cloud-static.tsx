import { HERO_CLUSTER_OPACITY as CLUSTER_OPACITY } from "@/lib/embedding-cluster-opacity";
import { nearestNeighbourPairs } from "@/lib/embedding-neighbours";
import type { EmbeddingPoint } from "@/lib/embedding-projection";

interface EmbeddingCloudStaticProps {
  points: EmbeddingPoint[];
}

/**
 * The neighbour strands as one path rather than several hundred line
 * elements. Same structure the GL layer draws, from the same function, so
 * the two layers cannot disagree about the data.
 *
 * One path and three decimal places is a deliberate size choice: this SVG is
 * in the server-rendered HTML of the site's most performance-sensitive
 * route, and a line element per pair would be several hundred extra DOM
 * nodes and roughly twice the bytes for an identical picture. Path data this
 * repetitive also compresses well, which a pile of separate elements with
 * their own attribute names does not.
 */
function linkPath(points: EmbeddingPoint[]): string {
  const pairs = nearestNeighbourPairs(points.map((p) => p.finetuned));
  const round = (n: number) => n.toFixed(3);
  return pairs
    .map(({ a, b }) => {
      const [ax, ay] = points[a].finetuned;
      const [bx, by] = points[b].finetuned;
      return `M${round(ax)} ${round(ay)}L${round(bx)} ${round(by)}`;
    })
    .join("");
}

/**
 * The still composition: no WebGL, no canvas, no animation.
 *
 * This is what reduced-motion visitors and low-end devices get, and it is
 * also the server-rendered default everybody sees before the capability
 * check can run. The brief for the reduced-motion path was specific and
 * worth restating: the answer to "this visitor asked for less motion" is a
 * still design that looks composed, not the same page with the life removed.
 * So this layer got the same density work the animated one did, and lands at
 * roughly the same weight on screen.
 *
 * Density without inventing points. The same 419 real terms now cover a full
 * bleed hero rather than a 488px panel, so at the old radii they read as
 * dust. Rather than doubling the node count with a second circle per point,
 * one filter does both jobs: a wide Gaussian blur merged twice for the bloom,
 * with the crisp source drawn back over the top for the core. Same 419
 * nodes in the HTML, roughly the same look as the two-pass GL field.
 *
 * Sizing note that cost a mobile screenshot to find the first time round.
 * preserveAspectRatio stays "meet" (contain), never "slice" (cover): on a
 * tall narrow viewport, cover scales the small square viewBox by the larger
 * dimension ratio and blows the circles up over the headline. The frame is
 * filled instead by squaring the SVG's own box in CSS (.hero-field-fit),
 * which gets full bleed out of a contain fit with no scaling surprises.
 */
export function EmbeddingCloudStatic({ points }: EmbeddingCloudStaticProps) {
  return (
    <svg
      viewBox="-1.3 -1.3 2.6 2.6"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="presentation"
    >
      <defs>
        <filter id="embedding-cloud-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.022" result="bloom" />
          <feMerge>
            {/* Twice, because one pass of a blur this wide is too faint to
                register once the field is spread across a whole viewport. */}
            <feMergeNode in="bloom" />
            <feMergeNode in="bloom" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Structure first, dots over it, matching the GL layer's draw order.
          Outside the glow filter on purpose: blurring hairlines this thin
          erases them, and the strands want to stay legible as strands. */}
      <path
        d={linkPath(points)}
        fill="none"
        stroke="var(--indigo)"
        strokeWidth="0.0018"
        opacity="0.34"
      />
      <g filter="url(#embedding-cloud-glow)">
        {points.map((p) => {
          const [x, y, z] = p.finetuned;
          // z folds into radius as a cheap depth cue, the same way the GL
          // layer folds it into point size.
          const radius = 0.004 + ((z + 1) / 2) * 0.005;
          return (
            <circle
              key={p.term}
              cx={x}
              cy={y}
              r={radius}
              fill="var(--indigo)"
              opacity={CLUSTER_OPACITY[p.cluster % CLUSTER_OPACITY.length]}
            />
          );
        })}
      </g>
    </svg>
  );
}
