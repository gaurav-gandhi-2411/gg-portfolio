import { HERO_CLUSTER_OPACITY as CLUSTER_OPACITY } from "@/lib/embedding-cluster-opacity";
import type { EmbeddingPoint } from "@/lib/embedding-projection";

interface EmbeddingCloudStaticProps {
  points: EmbeddingPoint[];
}

/**
 * No WebGL, no <canvas>, no animation — the prefers-reduced-motion and
 * low-end-device fallback (components/hero/embedding-cloud.tsx decides
 * which one to render), and also the SSR/no-JS default before that decision
 * can run client-side. A flat SVG scatter of the same real projected
 * points, x/y only (z folds into point size for a cheap depth cue).
 *
 * Design-review fix (caught via an actual mobile screenshot, not eyeballed
 * in a desktop-sized preview): the first version used
 * preserveAspectRatio="xMidYMid slice" (cover-fill) — on a tall, narrow
 * mobile viewport that scales the small square viewBox by its LARGER
 * dimension ratio, blowing circle sizes up far past "faintly visible" and
 * scattering them directly over the headline text. "meet" (contain/
 * letterbox) bounds the scale to the smaller ratio instead — same
 * treatment as the .hero-halo it replaces, which was also a bounded blob,
 * not an edge-to-edge fill. Paired with much smaller radii, a much lower
 * opacity ceiling (was 0.28-0.88; the halo it replaces peaked at 0.26),
 * and a blur so points read as soft texture, not crisp competing shapes.
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
        <filter id="embedding-cloud-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.006" />
        </filter>
      </defs>
      <g filter="url(#embedding-cloud-blur)">
        {points.map((p) => {
          const [x, y, z] = p.finetuned;
          const radius = 0.0035 + ((z + 1) / 2) * 0.004;
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
