import { HERO_CLUSTER_OPACITY as CLUSTER_OPACITY } from "@/lib/embedding-cluster-opacity";
import type { EmbeddingPoint } from "@/lib/embedding-projection";

interface EmbeddingCloudStaticProps {
  points: EmbeddingPoint[];
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
