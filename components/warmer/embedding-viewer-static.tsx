import { WARMER_CLUSTER_OPACITY as CLUSTER_OPACITY } from "@/lib/embedding-cluster-opacity";
import type { EmbeddingPoint } from "@/lib/embedding-projection";

interface EmbeddingViewerStaticProps {
  points: EmbeddingPoint[];
}

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
 * route ships. A real react-three-fiber toggle version was built and,
 * per two separate contemporaneous accounts, measured as a regression:
 * mobile Lighthouse Performance dropped from a baseline of ~82 (this
 * file's own prior comment) or 80.8/n=6 (commit dc27535's message) to
 * either 61-69/n=3 (this file) or 76.7/n=3 (dc27535) — the two records of
 * the SAME measurement disagree with each other, and Total Blocking Time
 * is the only figure that actually agrees between them (~1.0-1.1s vs. a
 * ~350ms baseline).
 *
 * DOCBLOCK HONESTY NOTE (2026-08-12): both figures above are marked
 * UNREPRODUCIBLE, not adjudicated — neither is silently corrected to
 * match the other. Both came from an unpinned `npx lighthouse` (no
 * committed Lighthouse/Chrome version, no committed raw report) run on a
 * machine whose state has since changed, measuring a react-three-fiber
 * toggle prototype that was never committed (per GG's own instruction to
 * ship the static path instead — see below) and no longer exists to
 * re-measure. There is no artifact and no code left to adjudicate which
 * account was honest; both stay here as historical record of why the
 * static path shipped, not as trustworthy numbers. See
 * scripts/lighthouse.mjs's own header for the full incident writeup and
 * why this repo now pins Lighthouse + Chrome versions and commits n>=6
 * run artifacts going forward.
 *
 * The one reproducible fact both accounts agree on qualitatively (a real
 * regression, TBT roughly tripling under Lighthouse's CPU-throttled
 * simulation) is superseded by a real, pinned baseline of the CURRENT
 * static-only implementation: see `reports/lighthouse-*-work-warmer-*
 * .summary.json` (scripts/lighthouse.mjs, n>=6, mobile, against
 * `npm run start`) for the enforceable ongoing regression baseline. That
 * baseline cannot retroactively validate either old WebGL-toggle figure
 * above — it only re-establishes a trustworthy floor for what ships now.
 *
 * Per GG's own explicit instruction for exactly this outcome ("ship the
 * static projection with a labelled before/after image pair instead and
 * report why"), that's what ships. The working, typechecked r3f prototype
 * (toggle + hover + position-lerp transition) is not committed — ask GG
 * before resuming it.
 *
 * A labelled before/after PAIR is the static analog of the intended
 * toggle: side by side rather than swapped in place, but showing the exact
 * same real projected points, so the improvement is still visible as
 * structure without needing motion or interactivity — same real data,
 * degraded interaction, not degraded content.
 */
export function EmbeddingViewerStatic({ points }: EmbeddingViewerStaticProps) {
  return (
    <div className="grid grid-cols-1 gap-[var(--space-6)] sm:grid-cols-2">
      <figure className="border-border/40 flex flex-col gap-[var(--space-2)] rounded-lg border">
        <div className="aspect-square">
          <Scatter points={points} coordKey="base" />
        </div>
        <figcaption className="text-muted-foreground border-border/40 border-t px-[var(--space-3)] py-[var(--space-2)] text-caption">
          <span className="font-medium text-foreground">Before</span>, base model
          (paraphrase-multilingual-MiniLM-L12-v2), Hinglish terms scattered
        </figcaption>
      </figure>
      <figure className="border-border/40 flex flex-col gap-[var(--space-2)] rounded-lg border">
        <div className="aspect-square">
          <Scatter points={points} coordKey="finetuned" />
        </div>
        <figcaption className="text-muted-foreground border-border/40 border-t px-[var(--space-3)] py-[var(--space-2)] text-caption">
          <span className="font-medium text-foreground">After</span>, fine-tuned model
          (hinglish-relatedness-sbert), the same terms now cluster by meaning
        </figcaption>
      </figure>
    </div>
  );
}
