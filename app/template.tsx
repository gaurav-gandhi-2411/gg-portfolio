"use client";

import { useEffect, useState } from "react";

/**
 * Wave 12 page transition — a 240ms fade-and-rise on client-side route
 * changes only. The `hasNavigated` module flag stays false for the very
 * first template mount, so the INITIAL load never animates: no LCP cost,
 * and no re-opening of the wave-9 class of bugs (onload opacity
 * animations racing axe's contrast checks). Reduced motion is handled in
 * CSS (`.page-enter` is a no-op under prefers-reduced-motion).
 *
 * Wave 13 added a View Transitions API layer on top of this (see the old
 * components/transition-link.tsx / lib/view-transition.ts), removed as a
 * P0 fix: startViewTransition's DOM-snapshot window raced React's own
 * commit on the destination page and threw uncaught insertBefore/
 * removeChild DOMExceptions, reproduced 6/8 locally and 10/10 on real
 * production (crashing the Chromium renderer to "This page couldn't
 * load" on roughly a third of navigations) — see fix/remove-view-
 * transitions's PR body for the full repro. This plain CSS fade is what's
 * left: it cannot crash the same way because it never touches DOM
 * mutation timing, only an opacity/transform animation applied after
 * React has already committed the new route.
 */
let hasNavigated = false;

export default function Template({ children }: { children: React.ReactNode }) {
  const [animate] = useState(() => hasNavigated);
  useEffect(() => {
    hasNavigated = true;
  }, []);
  return <div className={animate ? "page-enter" : undefined}>{children}</div>;
}
