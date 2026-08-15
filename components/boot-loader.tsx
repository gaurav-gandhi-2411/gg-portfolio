/**
 * Wave 11 wow moment #1 — the entrance. A full-viewport curtain in the
 * page's own background color: the GG monogram draws itself (both strokes,
 * staggered), a hairline fills beneath it, and the curtain wipes upward to
 * reveal the hero — all inside ~1s, all pure CSS (app/globals.css owns the
 * timeline).
 *
 * fix/perf: deliberately NOT a Client Component. It used to be one whose
 * only jobs were (a) rendering this same markup into the server HTML and
 * (b) removing the node from the DOM once the CSS exit animation finished —
 * (b) was cosmetic cleanup, not gating: globals.css's own comment already
 * documented that "the exit is pure CSS with fixed delays, so even if
 * hydration lags, the overlay is visually gone at ~1s (React removes the
 * node later as cleanup, it does not gate the reveal)," and #boot-loader is
 * `pointer-events: none` unconditionally, so the un-removed node was never
 * capable of blocking interaction either. A real-devtools-throttled trace
 * (reports/lighthouse-perf-fix-2026-08-14.md's follow-up) found the biggest
 * single pre-LCP long task on `/` sitting almost exactly under the LCP
 * paint — moving this component's mount/hydration cost out of that budget
 * entirely (not just deferring it) was worth measuring since the DOM-removal
 * step was never load-bearing. The removal itself now happens from a plain
 * `<script>` in app/layout.tsx's existing pre-paint inline script, which
 * already runs outside React — see that file for the timing.
 *
 * Whether the overlay is VISIBLE at all is still decided entirely by that
 * same inline script (html[data-boot="1"]) — no JS or prefers-reduced-motion
 * means the overlay stays display:none forever, same as before.
 *
 * Geometry is the same hand-computed monogram as components/monogram.tsx.
 *
 * fix/perf round 3: each stroke used to draw itself in via an animated
 * `stroke-dashoffset` (which is why every path carried `pathLength={1}` —
 * it normalized the dasharray driving that draw-in). PSI flagged all 4 as
 * non-composited animations; app/globals.css's `.boot-path` now animates
 * `opacity`/`transform` (scale) instead, so `pathLength` no longer does
 * anything and was removed rather than left as a dead, misleading prop.
 */
export function BootLoader() {
  return (
    <div id="boot-loader" aria-hidden="true">
      <div className="boot-inner">
        <svg width="56" height="56" viewBox="0 0 64 64">
          <path
            d="M 35.37 41.96 A 15.50 15.50 0 1 1 35.37 22.04"
            className="boot-path"
            fill="none"
            stroke="var(--text-hi)"
            strokeWidth="4.6"
            strokeLinecap="round"
          />
          <path
            d="M 39.00 32.00 L 30.48 32.00"
            className="boot-path boot-path-delay-2"
            fill="none"
            stroke="var(--text-hi)"
            strokeWidth="4.6"
            strokeLinecap="round"
          />
          <path
            d="M 28.63 22.04 A 15.50 15.50 0 1 1 28.63 41.96"
            className="boot-path boot-path-delay-1"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4.6"
            strokeLinecap="round"
          />
          <path
            d="M 25.00 32.00 L 33.52 32.00"
            className="boot-path boot-path-delay-3"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4.6"
            strokeLinecap="round"
          />
        </svg>
        <div className="boot-bar">
          <div className="boot-bar-fill" />
        </div>
      </div>
    </div>
  );
}
