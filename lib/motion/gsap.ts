import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * The site's one animation system.
 *
 * GSAP rather than Framer Motion, decided once and up front rather than per
 * surface. Every GSAP plugin became free in April 2025, so ScrollTrigger,
 * Flip and the rest cost bytes and nothing else, and ScrollTrigger's scrub
 * and progress model is what the thirteen case study pages need. Running
 * two animation systems side by side is a tax paid on every surface after
 * the first, so there is only this one.
 *
 * Rules for using it here, both of which come from the round-nine crash:
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
 *
 * registerPlugin is idempotent and guarded for the server, so importing
 * this module from any client component is safe.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };
