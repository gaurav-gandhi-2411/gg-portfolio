"use client";

import { useEffect } from "react";

import { gsap, ScrollTrigger } from "@/lib/motion/gsap";

/**
 * Scroll behaviour for the hero's three planes.
 *
 * Renders nothing and adds no wrapper element. It finds the planes by data
 * attribute inside the server-rendered hero and animates them. That is a
 * deliberate shape: the alternative is wrapping the markup in client
 * components purely so a decorative effect has somewhere to hang a ref, and
 * this way the hero stays one readable server component and the motion stays
 * one readable file.
 *
 * What "depth" means here in concrete terms. Scrolling one viewport moves
 * the field about a fifth of that, the copy about three quarters of it, and
 * the page itself the whole way. Three different rates is the entire trick;
 * it is why the same content stops reading as one flat sheet sliding past.
 *
 * No ScrollTrigger pin anywhere. Pinning wraps the pinned element in a
 * spacer div that ScrollTrigger creates and owns, which is a structural DOM
 * change to a subtree React rendered, and that class of change is what took
 * the site down in round nine. Anything that needs to hold position uses CSS
 * sticky instead. Everything below only ever writes transform and opacity on
 * an element it was handed.
 */
export function HeroMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const stage = document.querySelector<HTMLElement>("[data-hero]");
    if (!stage) return;

    const field = stage.querySelector<HTMLElement>('[data-hero-plane="field"]');
    const content = stage.querySelector<HTMLElement>('[data-hero-plane="content"]');

    // gsap.context scopes every tween and trigger created inside it, so
    // revert() on unmount removes all of them and restores the inline styles
    // it wrote. Without it, a client-side route change away from the
    // homepage leaves live ScrollTriggers pointing at detached elements.
    const ctx = gsap.context(() => {
      const scrub = {
        trigger: stage,
        start: "top top",
        end: "bottom top",
        scrub: 0.6,
      } as const;

      if (field) {
        gsap.to(field, {
          // The far plane barely moves, which is what makes it read as far.
          yPercent: 18,
          scale: 1.12,
          opacity: 0.15,
          ease: "none",
          scrollTrigger: scrub,
        });
      }

      if (content) {
        gsap.to(content, {
          yPercent: -14,
          ease: "none",
          scrollTrigger: scrub,
        });
      }
    }, stage);

    // The hero is the first thing on the page, so its trigger positions are
    // computed while fonts may still be swapping and the field canvas is
    // still sizing itself. One refresh after that settles keeps the start
    // and end points honest.
    const refresh = () => ScrollTrigger.refresh();
    const settleTimer = window.setTimeout(refresh, 1200);
    if (document.fonts?.ready) void document.fonts.ready.then(refresh);

    return () => {
      window.clearTimeout(settleTimer);
      ctx.revert();
    };
  }, []);

  return null;
}
