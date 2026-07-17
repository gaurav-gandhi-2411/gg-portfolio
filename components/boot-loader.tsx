"use client";

import { useEffect, useState } from "react";

/**
 * Wave 11 wow moment #1 — the entrance. A full-viewport curtain in the
 * page's own background color: the GG monogram draws itself (both strokes,
 * staggered), a hairline fills beneath it, and the curtain wipes upward to
 * reveal the hero — all inside ~1s, all pure CSS (app/globals.css owns the
 * timeline).
 *
 * This component's only jobs are (a) rendering the overlay markup into the
 * server HTML so it exists before hydration, and (b) removing the node from
 * the DOM once the CSS exit animation has finished. Whether the overlay is
 * VISIBLE at all is decided by the inline <head> script in app/layout.tsx
 * (html[data-boot="1"]) — no JS or prefers-reduced-motion means the
 * overlay stays display:none forever and this component just unmounts it.
 *
 * Geometry is the same hand-computed monogram as components/monogram.tsx;
 * pathLength=1 lets one dasharray rule drive every stroke's draw-in.
 */
export function BootLoader() {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    // CSS finishes at ~1.0s (0.62s delay + 0.38s exit); remove shortly
    // after. If the head script chose not to boot, remove immediately.
    const delay = document.documentElement.dataset.boot === "1" ? 1150 : 0;
    const t = window.setTimeout(() => {
      delete document.documentElement.dataset.boot;
      setGone(true);
    }, delay);
    return () => window.clearTimeout(t);
  }, []);

  if (gone) return null;

  return (
    <div id="boot-loader" aria-hidden="true">
      <div className="boot-inner">
        <svg width="56" height="56" viewBox="0 0 64 64">
          <path
            d="M 35.37 41.96 A 15.50 15.50 0 1 1 35.37 22.04"
            pathLength={1}
            className="boot-path"
            fill="none"
            stroke="var(--text-hi)"
            strokeWidth="4.6"
            strokeLinecap="round"
          />
          <path
            d="M 39.00 32.00 L 30.48 32.00"
            pathLength={1}
            className="boot-path boot-path-delay-2"
            fill="none"
            stroke="var(--text-hi)"
            strokeWidth="4.6"
            strokeLinecap="round"
          />
          <path
            d="M 28.63 22.04 A 15.50 15.50 0 1 1 28.63 41.96"
            pathLength={1}
            className="boot-path boot-path-delay-1"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4.6"
            strokeLinecap="round"
          />
          <path
            d="M 25.00 32.00 L 33.52 32.00"
            pathLength={1}
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
