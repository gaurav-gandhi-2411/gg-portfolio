"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Pauses the ambient-motion CSS animations (.ambient-plane's breathing
 * glow, .section-rule/.case-heading-modular-rule's shimmer, ProjectMark's
 * .mark-idle ring) while their host element is off-screen, and resumes
 * them once it's back in (or near) the viewport.
 *
 * Measured, not assumed: at page load, before any scroll, 0 of the ~24
 * concurrently-animating elements on home are visible at all (the hero
 * fills the initial viewport; every Section-based block sits below it) —
 * yet all 24 were ticking anyway, which is exactly what Lighthouse's own
 * initial-load trace measures and exactly why it showed inflated
 * main-thread work (see app/globals.css's "Ambient / idle motion" block
 * for the full investigation, including two approaches that didn't help
 * and one, content-visibility, that did but was reverted for the
 * box-sizing side effects it carries). Gating on `animation-play-state`
 * instead changes nothing about layout, box size, or content rendering —
 * it cannot produce a CLS event or feed a wrong estimate to anything
 * measuring geometry (site-nav.tsx's scroll-position indicator included),
 * because no box ever changes size or gets skipped.
 *
 * Additive by construction: every element runs its animation normally
 * until this observer explicitly marks it `data-out-of-view` — a visitor
 * with JavaScript disabled, or who sees the page before this effect has
 * mounted, gets the animation running everywhere, exactly like before this
 * component existed. `rootMargin` starts the animation slightly before an
 * element is actually on screen and lets it keep running slightly after
 * it's left, so nothing visibly snaps on or off at the viewport edge.
 */
const AMBIENT_MOTION_SELECTOR = ".ambient-plane, .section-rule, .case-heading-modular-rule, .mark-idle";

export function AmbientVisibilityGate() {
  // This component lives once in the root layout and never unmounts across
  // client-side navigations — but the marks/glows/rules it needs to observe
  // are different DOM nodes on every route. Re-querying and rebuilding the
  // observer on pathname change is what makes it actually see the page a
  // visitor is currently on, not just whichever page happened to be first.
  const pathname = usePathname();

  useEffect(() => {
    const hosts = document.querySelectorAll<HTMLElement>(AMBIENT_MOTION_SELECTOR);
    if (hosts.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.toggleAttribute("data-out-of-view", !entry.isIntersecting);
        }
      },
      { rootMargin: "200px 0px" }
    );

    for (const host of hosts) observer.observe(host);
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
