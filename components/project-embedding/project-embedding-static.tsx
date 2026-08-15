import type { ProjectEmbeddingPoint } from "@/lib/project-embedding-projection";

interface ProjectEmbeddingStaticProps {
  points: ProjectEmbeddingPoint[];
  /** Project slug to draw larger/labeled, e.g. this case study's own point. */
  highlightSlug?: string;
}

/**
 * No WebGL, no <canvas> — the SSR/no-JS default and the
 * prefers-reduced-motion/low-end-device fallback for the case-study
 * "explore in 3D" toggle (components/project-embedding/project-embedding-toggle.tsx
 * decides whether the visitor ever sees the GL swap-in). A flat SVG scatter
 * of the same real PCA-projected points the GL layer draws, x/y only (z folds
 * into point size, same depth-cue convention as
 * components/hero/embedding-cloud-static.tsx).
 */
export function ProjectEmbeddingStatic({ points, highlightSlug }: ProjectEmbeddingStaticProps) {
  return (
    <svg
      viewBox="-1.3 -1.3 2.6 2.6"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="A 2D scatter showing this project's position among the portfolio's 13 projects, by semantic similarity."
    >
      <defs>
        <filter id="project-embedding-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.006" />
        </filter>
      </defs>
      <g filter="url(#project-embedding-blur)">
        {points.map((p) => {
          const [x, y, z] = p.finetuned;
          const isHighlight = p.term === highlightSlug;
          const radius = (isHighlight ? 0.014 : 0.009) + ((z + 1) / 2) * 0.006;
          return (
            <circle
              key={p.term}
              cx={x}
              cy={-y}
              r={radius}
              fill="var(--indigo)"
              opacity={isHighlight ? 0.95 : 0.35 + ((z + 1) / 2) * 0.35}
            />
          );
        })}
      </g>
    </svg>
  );
}
