/**
 * Same GG monogram geometry as public/logo-mark.svg, inlined so its
 * strokes can be individually animated on load (stroke-dashoffset
 * draw-in). Pure CSS animation — zero JS. Respects prefers-reduced-motion
 * via the motion-reduce: variant forcing the final (fully-drawn) state.
 */
export function AnimatedMonogram({ className }: { className?: string }) {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 64 64"
      role="img"
      aria-label="GG monogram"
      className={className}
    >
      <path
        d="M 35.37 41.96 A 15.50 15.50 0 1 1 35.37 22.04"
        fill="none"
        stroke="#EDEEF0"
        strokeWidth="4.6"
        strokeLinecap="round"
        pathLength={100}
        className="animate-[draw-in_1.1s_ease-out_forwards] [stroke-dasharray:100] [stroke-dashoffset:100] motion-reduce:[stroke-dashoffset:0]"
      />
      <path
        d="M 39.00 32.00 L 30.48 32.00"
        fill="none"
        stroke="#EDEEF0"
        strokeWidth="4.6"
        strokeLinecap="round"
        pathLength={100}
        className="animate-[draw-in_0.4s_ease-out_0.9s_forwards] [stroke-dasharray:100] [stroke-dashoffset:100] motion-reduce:[stroke-dashoffset:0]"
      />
      <path
        d="M 28.63 22.04 A 15.50 15.50 0 1 1 28.63 41.96"
        fill="none"
        stroke="#818CF8"
        strokeWidth="4.6"
        strokeLinecap="round"
        pathLength={100}
        className="animate-[draw-in_1.1s_ease-out_0.2s_forwards] [stroke-dasharray:100] [stroke-dashoffset:100] motion-reduce:[stroke-dashoffset:0]"
      />
      <path
        d="M 25.00 32.00 L 33.52 32.00"
        fill="none"
        stroke="#818CF8"
        strokeWidth="4.6"
        strokeLinecap="round"
        pathLength={100}
        className="animate-[draw-in_0.4s_ease-out_1.1s_forwards] [stroke-dasharray:100] [stroke-dashoffset:100] motion-reduce:[stroke-dashoffset:0]"
      />
    </svg>
  );
}
