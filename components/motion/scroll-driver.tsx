"use client";

import { useEffect } from "react";
import Lenis from "lenis";

import { gsap, ScrollTrigger } from "@/lib/motion/gsap";

/**
 * Weighted scrolling, and the single clock everything scroll-linked runs on.
 *
 * Lenis rather than GSAP's own ScrollSmoother: Lenis is about 3KB, it drives
 * the real window scroll position instead of transforming a wrapper element,
 * and it needs no wrapper/content div pair around the whole page. Given the
 * standing rule about not restructuring DOM React owns, a smooth-scroll
 * approach that leaves the document structure alone is worth a lot more than
 * the small amount of integration code it costs.
 *
 * The integration is the documented one: Lenis raf is driven by gsap.ticker
 * so there is exactly one clock, and every Lenis scroll event pushes
 * ScrollTrigger forward. Without that, ScrollTrigger reads the native scroll
 * position while Lenis is mid-interpolation and every scrubbed animation
 * lags the content it is supposed to be pinned to.
 *
 * lagSmoothing(0) is deliberate. GSAP's default is to detect a long frame
 * and quietly fake a short one, which keeps ordinary tweens looking fine but
 * makes a scrubbed timeline drift out of step with the scroll position it is
 * meant to be reading. Scroll-linked motion wants real elapsed time.
 *
 * Renders nothing, and no-ops entirely for reduced-motion visitors, who get
 * plain native scrolling. Smoothed scrolling is motion, and taking the
 * scroll position away from someone who asked for less of it is exactly the
 * kind of thing that setting exists to prevent.
 */
export function ScrollDriver() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      // ~0.9s to settle. Long enough to read as mass, short enough that a
      // long flick to the footer does not feel like waiting for an elevator.
      duration: 0.9,
      // Exponential ease out. Fast at the start so the page answers the
      // gesture immediately, then decays.
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // Touch devices keep their native scrolling. Momentum scrolling on a
      // phone is already weighted, and layering a second interpolation on
      // top of it is the classic way to make a site feel broken on mobile.
      syncTouch: false,
    });

    lenis.on("scroll", ScrollTrigger.update);

    /*
     * Let an outside scroll win over one Lenis is still animating.
     *
     * Lenis syncs itself to native scroll events, but only while its own
     * state is idle or native. If a scroll arrives from anywhere else while
     * it is mid-smooth-scroll, it ignores it and keeps animating toward the
     * target it already had, which drags the page back where the visitor
     * just left.
     *
     * That is not a test-harness curiosity. The case that matters is the
     * keyboard: tab to a control below the fold while a smooth scroll is
     * still settling, the browser scrolls it into view, and Lenis pulls it
     * straight back off screen. Same mechanism for scrollIntoView from any
     * script, and it is how this surfaced, as a Playwright click landing on
     * whatever slid under the cursor.
     *
     * Telling the two apart without reaching into Lenis internals: while
     * Lenis is driving, the real scroll position and the one it thinks it
     * animated to agree, because it wrote that position itself a frame ago.
     * Anything else moves them apart, and past a few pixels of tolerance
     * that gap is somebody else scrolling. Retargeting Lenis at where the
     * page actually is ends its animation there rather than fighting it.
     *
     * An immediate scrollTo rather than the internal reset() that does
     * exactly this, because reset() is private; immediate + force lands the
     * same place through the public surface, and force means it still works
     * if something has stopped the instance.
     */
    const SYNC_TOLERANCE_PX = 6;
    const syncOnForeignScroll = () => {
      if (lenis.isScrolling !== "smooth") return;
      if (Math.abs(lenis.actualScroll - lenis.animatedScroll) < SYNC_TOLERANCE_PX) return;
      lenis.scrollTo(lenis.actualScroll, { immediate: true, force: true });
    };
    window.addEventListener("scroll", syncOnForeignScroll, { passive: true, capture: true });

    const tick = (time: number) => {
      // gsap.ticker reports seconds, Lenis wants milliseconds.
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      window.removeEventListener("scroll", syncOnForeignScroll, { capture: true });
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);

  return null;
}
