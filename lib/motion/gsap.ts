/**
 * The site's one animation system, loaded on demand rather than eagerly.
 *
 * GSAP rather than Framer Motion, decided once and up front rather than per
 * surface. Every GSAP plugin became free in April 2025, so ScrollTrigger,
 * Flip and the rest cost bytes and nothing else, and ScrollTrigger's scrub
 * and progress model is what the thirteen case study pages need. Running
 * two animation systems side by side is a tax paid on every surface after
 * the first, so there is only this one.
 *
 * WHY THIS IS A LOADER AND NOT AN IMPORT. It used to import gsap and
 * ScrollTrigger at module top, and because the scroll driver and the nav both
 * sit in the root layout, that put 51,697 bytes of gzip on every route whether
 * anything animated or not:
 *
 *   gsap core       28,268
 *   ScrollTrigger   17,998
 *   lenis            5,431
 *
 * Eager JS came to 245,355 bytes against a 220,160 ceiling. The gate that
 * exists to catch exactly that could not see it, because it never ran on the
 * branch (CHECKS.md instance 22), and reports/wave3-budget-reratification's
 * own escalation rule had already refused a third re-ratification of the
 * ceiling: dynamic-import the new cost or cut it. This is the dynamic import.
 *
 * Worse than the total, and the thing that decided the shape: reduced-motion
 * visitors downloaded all of it and used none of it. The scroll driver checked
 * `prefers-reduced-motion` inside its effect, long after the static import had
 * already been paid. A no-op that costs 51 KB is not a no-op. Now the check
 * happens before the import, so that path loads nothing at all.
 *
 * Rules for using it, both of which come from the round-nine crash:
 *
 *   GSAP may write inline styles on elements handed to it by ref. It may
 *   not insert, remove or reparent a node React rendered. Style writes are
 *   invisible to the reconciler; node writes are what produced a stale
 *   insertBefore anchor and took the site down.
 *
 *   So: no ScrollTrigger `pin` (it wraps the pinned element in a spacer
 *   div it creates itself), and no SplitText on React-rendered copy (it
 *   replaces text nodes with generated spans). Sticky positioning covers
 *   the first in plain CSS. If per-line or per-word animation is ever
 *   wanted, the split happens in the component's own JSX so React renders
 *   the spans and still owns them.
 */

type Motion = {
  gsap: typeof import("gsap").gsap;
  ScrollTrigger: typeof import("gsap/ScrollTrigger").ScrollTrigger;
};

/**
 * Memoised so the three consumers that want GSAP share one download and one
 * `registerPlugin`, however close together they ask.
 */
let pending: Promise<Motion> | null = null;

export function loadMotion(): Promise<Motion> {
  pending ??= (async () => {
    const [gsapMod, stMod] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
    const gsap = gsapMod.default ?? gsapMod.gsap;
    const { ScrollTrigger } = stMod;
    // Idempotent, so a second caller arriving mid-load costs nothing.
    gsap.registerPlugin(ScrollTrigger);
    return { gsap, ScrollTrigger };
  })();
  return pending;
}

/** True when this visitor has asked for less motion, checked before any import. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
