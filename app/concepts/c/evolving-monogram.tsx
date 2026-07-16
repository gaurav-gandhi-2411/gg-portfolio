/**
 * Concept C's persistent, evolving monogram — the signature element of this
 * concept. Forked from components/animated-monogram.tsx (same underlying GG
 * geometry, same pathLength=100 draw-in trick) rather than modified in place,
 * because this version needs strokes that can be independently recolored via
 * the cc-mono-stroke-a/b classes (see concept-c.css) — something the shared
 * original doesn't need and shouldn't be complicated with.
 *
 * Rendered exactly once, fixed-positioned by concept-c.css, and left to
 * evolve for the whole page:
 *   - draw-in once on mount (pure CSS, global `draw-in` keyframe already
 *     shipped in app/globals.css — reused, not duplicated)
 *   - continuous rotation + graphite<->indigo stroke cross-fade tied to
 *     total page scroll position (CSS animation-timeline: scroll())
 *   - a deliberate scale/position jump between five resting states, one per
 *     act, driven by the data-current-act attribute (see act-scroll-tracker)
 *
 * Purely decorative relative to the real content, so it's aria-hidden and
 * pointer-events-none (see concept-c.css) — it never gates or hides anything
 * a screen-reader or keyboard user needs.
 */
export function EvolvingMonogram() {
  return (
    <div className="cc-monogram-fixed" aria-hidden="true">
      <svg viewBox="0 0 64 64" role="img" width="100%" height="100%">
        <path
          d="M 35.37 41.96 A 15.50 15.50 0 1 1 35.37 22.04"
          fill="none"
          strokeWidth="4.6"
          strokeLinecap="round"
          pathLength={100}
          className="cc-mono-stroke-a animate-[draw-in_1.1s_ease-out_forwards] [stroke-dasharray:100] [stroke-dashoffset:100] motion-reduce:[stroke-dashoffset:0]"
        />
        <path
          d="M 39.00 32.00 L 30.48 32.00"
          fill="none"
          strokeWidth="4.6"
          strokeLinecap="round"
          pathLength={100}
          className="cc-mono-stroke-a animate-[draw-in_0.4s_ease-out_0.9s_forwards] [stroke-dasharray:100] [stroke-dashoffset:100] motion-reduce:[stroke-dashoffset:0]"
        />
        <path
          d="M 28.63 22.04 A 15.50 15.50 0 1 1 28.63 41.96"
          fill="none"
          strokeWidth="4.6"
          strokeLinecap="round"
          pathLength={100}
          className="cc-mono-stroke-b animate-[draw-in_1.1s_ease-out_0.2s_forwards] [stroke-dasharray:100] [stroke-dashoffset:100] motion-reduce:[stroke-dashoffset:0]"
        />
        <path
          d="M 25.00 32.00 L 33.52 32.00"
          fill="none"
          strokeWidth="4.6"
          strokeLinecap="round"
          pathLength={100}
          className="cc-mono-stroke-b animate-[draw-in_0.4s_ease-out_1.1s_forwards] [stroke-dasharray:100] [stroke-dashoffset:100] motion-reduce:[stroke-dashoffset:0]"
        />
      </svg>
    </div>
  );
}
