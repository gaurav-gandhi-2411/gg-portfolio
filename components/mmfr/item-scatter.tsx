"use client";

import { CLUSTER_OPACITY, EMPHASIS, type ItemPoint } from "@/lib/mmfr-projection-view";

/**
 * The SVG rendering of the item space, used whenever the WebGL layer is
 * declined: reduced motion, a low-end device, no WebGL context, or a shader
 * that failed to compile on an exotic driver.
 *
 * It is a still, and it is composed rather than merely degraded: the
 * catalogue sits back at low opacity, the five neighbors come forward, and
 * the anchor is the brightest thing in the frame. A reduced-motion visitor
 * loses the drift and the transition, not the picture.
 *
 * The projection here is orthographic on x and y, which is exactly what the
 * GL layer's vertex shader reduces to at angle 0 before its perspective
 * divide. The two are therefore the same view of the same points, not two
 * independent attempts at one -- same discipline as
 * components/triageiq/retrieval-scatter.tsx.
 */
const CORPUS_LIFT = 1.55;

export function ItemScatter({
  points,
  emphasis,
}: {
  points: readonly ItemPoint[];
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
        <filter id="mmfr-cloud-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.008" />
        </filter>
      </defs>

      {/* The catalogue. Drawn first and blurred, so it reads as a field
          rather than as 500 things competing with the six that matter. */}
      <g filter="url(#mmfr-cloud-blur)">
        {points.map((point, i) =>
          emphasis[i] ? null : (
            <circle
              key={point.id}
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
        const isAnchor = level >= EMPHASIS.anchor;
        const radius = isAnchor ? 0.03 : 0.018;
        return (
          <g key={point.id}>
            {isAnchor ? (
              <circle
                cx={point.p[0]}
                cy={-point.p[1]}
                r={radius + 0.022}
                fill="none"
                stroke="var(--indigo)"
                strokeWidth={0.005}
                opacity={0.9}
              />
            ) : null}
            <circle
              cx={point.p[0]}
              cy={-point.p[1]}
              r={radius}
              fill="var(--indigo)"
              opacity={isAnchor ? 1 : 0.8}
            />
          </g>
        );
      })}
    </svg>
  );
}
