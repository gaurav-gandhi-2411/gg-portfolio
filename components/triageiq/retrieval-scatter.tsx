"use client";

import { CLUSTER_OPACITY, EMPHASIS, type RetrievalPoint } from "@/lib/triageiq-retrieval-view";

/**
 * The SVG rendering of the retrieval space, used whenever the WebGL layer is
 * declined: reduced motion, a low-end device, no WebGL context, or a shader
 * that failed to compile on an exotic driver.
 *
 * It is a still, and it is composed rather than merely degraded: the corpus
 * sits back at low opacity, the five retrieved issues come forward, and the
 * query and its gold answer are the two brightest things in the frame. A
 * reduced-motion visitor loses the drift and the transition, not the picture.
 *
 * The projection here is orthographic on x and y, which is exactly what the
 * GL layer's vertex shader reduces to at angle 0 before its perspective
 * divide. The two are therefore the same view of the same points, not two
 * independent attempts at one.
 */
/**
 * The GL layer draws the same ramp through an alpha gain and a depth factor,
 * so the identical numbers land visibly brighter there than they do here.
 * Compared side by side, the raw ramp made the still look like a fainter
 * picture rather than the same picture without motion, which is the
 * difference between a designed fallback and a degraded one. This closes that
 * gap; it is a rendering correction, not a second opacity scale, and it is
 * why the ramp itself is still the one shared constant.
 */
const CORPUS_LIFT = 1.55;

export function RetrievalScatter({
  points,
  emphasis,
}: {
  points: readonly RetrievalPoint[];
  emphasis: readonly number[];
}) {
  return (
    <svg
      viewBox="-1.15 -1.15 2.3 2.3"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="presentation"
    >
      <defs>
        <filter id="triageiq-cloud-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.008" />
        </filter>
      </defs>

      {/* The corpus. Drawn first and blurred, so it reads as a field rather
          than as 700 things competing with the seven that matter. */}
      <g filter="url(#triageiq-cloud-blur)">
        {points.map((point, i) =>
          emphasis[i] ? null : (
            <circle
              key={point.n}
              cx={point.p[0]}
              cy={-point.p[1]}
              r={0.006 + ((point.p[2] + 1) / 2) * 0.005}
              fill="var(--indigo)"
              opacity={CLUSTER_OPACITY[point.c % CLUSTER_OPACITY.length] * CORPUS_LIFT}
            />
          )
        )}
      </g>

      {/* Emphasised points, unblurred and on top. Size and brightness carry
          the distinction, never a second hue: the token file allows one
          accent, so a highlighted point is the same indigo turned up. */}
      {points.map((point, i) => {
        const level = emphasis[i];
        if (!level) return null;
        const isQuery = level >= EMPHASIS.query;
        const isGold = !isQuery && level >= EMPHASIS.gold;
        const radius = isQuery ? 0.03 : isGold ? 0.024 : 0.016;
        return (
          <g key={point.n}>
            {isQuery || isGold ? (
              <circle
                cx={point.p[0]}
                cy={-point.p[1]}
                r={radius + 0.022}
                fill="none"
                stroke="var(--indigo)"
                strokeWidth={0.005}
                opacity={isQuery ? 0.9 : 0.55}
              />
            ) : null}
            <circle
              cx={point.p[0]}
              cy={-point.p[1]}
              r={radius}
              fill="var(--indigo)"
              opacity={isQuery ? 1 : isGold ? 0.9 : 0.75}
            />
          </g>
        );
      })}
    </svg>
  );
}
