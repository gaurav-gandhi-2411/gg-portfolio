"use client";

import { useEffect } from "react";

/**
 * Pointer response for content cards below the hero -- Experience's company
 * cards, Research's paper cards, About's skills panel. Same shape as
 * components/project-grid-motion.tsx, deliberately: one delegated listener
 * writing --card-px/--card-py per active card, CSS does the tilt
 * (app/sections-motion.css's `.section-card` rules). Reusing that
 * established vocabulary rather than inventing a second one for what is the
 * same interaction on a different set of elements.
 *
 * Renders nothing, adds no wrapper, inserts/removes/reparents no node --
 * the round-nine rule (lib/motion/gsap.ts's own header). Reduced-motion and
 * coarse-pointer visitors get no listener at all; the cards keep their
 * lift/border/shadow hover treatment in CSS either way (app/sections-
 * motion.css's `(hover: none)` block), just without a cursor position to
 * tilt toward.
 */
export function SectionCardMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let active: HTMLElement | null = null;

    const clear = (card: HTMLElement) => {
      card.style.removeProperty("--card-px");
      card.style.removeProperty("--card-py");
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      const card = (event.target as HTMLElement | null)?.closest<HTMLElement>(".section-card") ?? null;

      if (card !== active) {
        if (active) clear(active);
        active = card;
      }
      if (!card) return;

      const box = card.getBoundingClientRect();
      card.style.setProperty("--card-px", ((event.clientX - box.left) / box.width).toFixed(4));
      card.style.setProperty("--card-py", ((event.clientY - box.top) / box.height).toFixed(4));
    };

    const onLeave = () => {
      if (active) clear(active);
      active = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (active) clear(active);
    };
  }, []);

  return null;
}
