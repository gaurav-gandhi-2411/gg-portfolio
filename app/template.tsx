"use client";

import { useEffect, useState } from "react";
import { consumeViewTransitionFlag, settleViewTransition } from "@/lib/view-transition";

/**
 * Wave 12 page transition — a 240ms fade-and-rise on client-side route
 * changes only. The `hasNavigated` module flag stays false for the very
 * first template mount, so the INITIAL load never animates: no LCP cost,
 * and no re-opening of the wave-9 class of bugs (onload opacity
 * animations racing axe's contrast checks). Reduced motion is handled in
 * CSS (`.page-enter` is a no-op under prefers-reduced-motion).
 *
 * Wave 13: when the navigation came through the View Transitions API
 * (components/transition-link.tsx), .page-enter is skipped — the browser
 * animates the route change instead, and this template's mount effect
 * settles the pending transition once the new DOM has committed.
 */
let hasNavigated = false;

export default function Template({ children }: { children: React.ReactNode }) {
  const [animate] = useState(() => hasNavigated && !consumeViewTransitionFlag());
  useEffect(() => {
    hasNavigated = true;
    settleViewTransition();
  }, []);
  return <div className={animate ? "page-enter" : undefined}>{children}</div>;
}
