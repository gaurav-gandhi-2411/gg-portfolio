"use client";

import { useDeferredMotion } from "@/lib/motion/use-deferred-motion";

/**
 * Continuous, scroll-position-driven depth for About, Experience, Work,
 * Contact and Research (components/section.tsx renders `.section-ambient`
 * and `.section-content` for every one of them; this is the one component
 * that animates both).
 *
 * GG's launch-review round two, verbatim: "Scroll position should drive
 * continuous change... not a one-shot reveal at a threshold." RevealGroup
 * (components/reveal-group.tsx) is exactly that one-shot: an
 * IntersectionObserver fires once, plays a 600ms rise, and the section is
 * static again for the remaining however-many seconds a visitor spends
 * inside it. This replaces that mechanism for these five sections'
 * `.section-content` (RevealGroup still runs unchanged everywhere else --
 * the project grid's own card-by-card stagger is a different, already-good
 * concern this round never named).
 *
 * Two tweens per section, both `scrub` (GSAP ties the tween's progress
 * directly to ScrollTrigger's own progress number every frame Lenis/native
 * scroll reports — not an IntersectionObserver callback that fires once and
 * is done):
 *
 *   `.section-ambient` parallax across the section's FULL transit (`top
 *   bottom` to `bottom top`) — continuous for as long as any part of the
 *   section is on screen, not just its entrance. This is what makes the
 *   ambient plane read as sitting behind .section-content rather than
 *   painted on the same surface: the two move at different rates the whole
 *   time a visitor is inside the section, not only once on the way in.
 *
 *   `.section-content` translateY across a short entrance band only (`top
 *   95%` to `top 60%`) — transform ONLY, never opacity. That is the hero's
 *   own rule (app/hero.css: "the headline... never gets held below full
 *   opacity here after an axe pass once landed mid-fade and read the
 *   contrast of a half-transparent heading"), applied here for the same
 *   reason: a visitor who stops scrolling mid-transit must never be left
 *   reading text at reduced contrast. A scrubbed transform has no such
 *   risk — the worst case is content sitting a few px off its final
 *   position, never dimmed.
 *
 * No ScrollTrigger `pin` anywhere in this file (lib/motion/gsap.ts's own
 * rule — it wraps its target in a spacer div ScrollTrigger creates itself,
 * a structural DOM change React does not own, which is what took the site
 * down in round nine). Every tween here is a transform/opacity style write
 * on an element React already rendered, nothing else.
 */

const SECTION_IDS = ["about", "experience", "work", "contact", "research"];

export function SectionDepth() {
  useDeferredMotion(({ gsap, ScrollTrigger }) => {
    const ctx = gsap.context(() => {
      for (const id of SECTION_IDS) {
        const section = document.getElementById(id);
        if (!section) continue;

        const ambient = section.querySelector<HTMLElement>(".section-ambient");
        if (ambient) {
          gsap.fromTo(
            ambient,
            { yPercent: -8 },
            {
              yPercent: 8,
              ease: "none",
              scrollTrigger: {
                trigger: section,
                start: "top bottom",
                end: "bottom top",
                scrub: 0.6,
              },
            }
          );
        }

        const content = section.querySelector<HTMLElement>(".section-content");
        if (content) {
          gsap.fromTo(
            content,
            { y: 28 },
            {
              y: 0,
              ease: "none",
              scrollTrigger: {
                trigger: section,
                start: "top 95%",
                end: "top 60%",
                scrub: 0.6,
              },
            }
          );
        }
      }

      ScrollTrigger.refresh();
    });

    return () => ctx.revert();
  }, []);

  return null;
}
