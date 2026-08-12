import type { EmbeddingPoint } from "@/lib/embedding-projection";

interface EmbeddingViewerStaticProps {
  points: EmbeddingPoint[];
}

// Same one-accent-discipline + faint-scatter treatment as the homepage
// hero's static fallback (components/hero/embedding-cloud-static.tsx) —
// see that file's own comment for why these specific radius/opacity/blur
// values (a first version was screenshot-verified too strong on mobile).
const CLUSTER_OPACITY = [0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.82];

function Scatter({ points, coordKey }: { points: EmbeddingPoint[]; coordKey: "base" | "finetuned" }) {
  return (
    <svg viewBox="-1.3 -1.3 2.6 2.6" className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="presentation">
      <defs>
        <filter id={`warmer-cloud-blur-${coordKey}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.01" />
        </filter>
      </defs>
      <g filter={`url(#warmer-cloud-blur-${coordKey})`}>
        {points.map((p) => {
          const coord = coordKey === "base" ? p.base : p.finetuned;
          if (!coord) return null;
          const [x, y, z] = coord;
          const radius = 0.006 + ((z + 1) / 2) * 0.006;
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

/**
 * No WebGL, no <canvas>, no animation, no hover — the only thing this
 * route ships. A real react-three-fiber toggle version was built and
 * measured: mobile Lighthouse Performance dropped from ~82 (baseline) to
 * 61-69 (3 runs) with Total Blocking Time around 1.0-1.1s, driven by the
 * continuous per-frame rotation/raycasting loop under Lighthouse's
 * CPU-throttled measurement window — confirmed by forcing this static
 * path instead, which measured back at 81 / 390ms TBT, in line with
 * baseline. Per GG's own explicit instruction for exactly this outcome
 * ("ship the static projection with a labelled before/after image pair
 * instead and report why"), that's what ships. The working, typechecked
 * r3f prototype (toggle + hover + position-lerp transition) is not
 * committed — ask GG before resuming it.
 *
 * A labelled before/after PAIR is the static analog of the intended
 * toggle: side by side rather than swapped in place, but showing the exact
 * same real projected points, so the improvement is still visible as
 * structure without needing motion or interactivity — same real data,
 * degraded interaction, not degraded content.
 */
export function EmbeddingViewerStatic({ points }: EmbeddingViewerStaticProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <figure className="border-border/40 flex flex-col gap-2 rounded-lg border">
        <div className="aspect-square">
          <Scatter points={points} coordKey="base" />
        </div>
        <figcaption className="text-muted-foreground border-border/40 border-t px-3 py-2 text-xs">
          <span className="font-medium text-foreground">Before</span> — base model
          (paraphrase-multilingual-MiniLM-L12-v2), Hinglish terms scattered
        </figcaption>
      </figure>
      <figure className="border-border/40 flex flex-col gap-2 rounded-lg border">
        <div className="aspect-square">
          <Scatter points={points} coordKey="finetuned" />
        </div>
        <figcaption className="text-muted-foreground border-border/40 border-t px-3 py-2 text-xs">
          <span className="font-medium text-foreground">After</span> — fine-tuned model
          (hinglish-relatedness-sbert), the same terms now cluster by meaning
        </figcaption>
      </figure>
    </div>
  );
}
