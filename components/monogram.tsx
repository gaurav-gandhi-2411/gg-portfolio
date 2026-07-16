/**
 * GG monogram — same geometry as public/logo-mark.svg, inlined static.
 * Wave 6 removed the draw-in animation: no reference site animates on
 * entry, and the mark reads better arriving whole.
 */
export function Monogram({ className }: { className?: string }) {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 64 64"
      role="img"
      aria-label="GG monogram"
      className={className}
    >
      <path
        d="M 35.37 41.96 A 15.50 15.50 0 1 1 35.37 22.04"
        fill="none"
        stroke="var(--text-hi)"
        strokeWidth="4.6"
        strokeLinecap="round"
      />
      <path
        d="M 39.00 32.00 L 30.48 32.00"
        fill="none"
        stroke="var(--text-hi)"
        strokeWidth="4.6"
        strokeLinecap="round"
      />
      <path
        d="M 28.63 22.04 A 15.50 15.50 0 1 1 28.63 41.96"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="4.6"
        strokeLinecap="round"
      />
      <path
        d="M 25.00 32.00 L 33.52 32.00"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="4.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
