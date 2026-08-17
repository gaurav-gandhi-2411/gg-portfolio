"use client";

import { useEffect } from "react";

/**
 * Pointer response for the project grid. Renders nothing and adds no
 * wrapper: it finds the grid by class and works on the cards the server
 * already rendered.
 *
 * One delegated listener on the grid rather than one per card. Thirteen
 * cards is thirteen listeners and thirteen closures for an effect that only
 * ever applies to the one card under the cursor, and the grid grows with the
 * body of work.
 *
 * What it writes: two numbers per card, as custom properties, for where the
 * cursor is inside that card. CSS does everything else, so the tilt and the
 * light are compositor work driven by a value this only updates while a
 * pointer is genuinely over a card. Setting a custom property on an element
 * React rendered is invisible to the reconciler; nothing here inserts,
 * removes or reparents a node.
 *
 * Reduced-motion visitors get no listener at all. The cards keep their
 * hover treatment in CSS, which is a colour and a border rather than
 * movement, so the grid still responds to the pointer without tilting.
 */
export function ProjectGridMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Coarse pointers have no hover, so a tilt driven by one is either
    // nothing or a jump on tap.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const grids = Array.from(document.querySelectorAll<HTMLElement>(".project-grid"));
    if (grids.length === 0) return;

    let active: HTMLElement | null = null;

    const clear = (card: HTMLElement) => {
      card.style.removeProperty("--card-px");
      card.style.removeProperty("--card-py");
      card.style.removeProperty("--card-on");
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      const card =
        (event.target as HTMLElement | null)?.closest<HTMLElement>(".project-card") ?? null;

      if (card !== active) {
        if (active) clear(active);
        active = card;
        if (card) card.style.setProperty("--card-on", "1");
      }
      if (!card) return;

      const box = card.getBoundingClientRect();
      // 0..1 across the card, which is what both the light and the tilt want.
      card.style.setProperty("--card-px", ((event.clientX - box.left) / box.width).toFixed(4));
      card.style.setProperty("--card-py", ((event.clientY - box.top) / box.height).toFixed(4));
    };

    const onLeave = () => {
      if (active) clear(active);
      active = null;
    };

    grids.forEach((grid) => {
      grid.addEventListener("pointermove", onMove, { passive: true });
      grid.addEventListener("pointerleave", onLeave);
    });

    return () => {
      grids.forEach((grid) => {
        grid.removeEventListener("pointermove", onMove);
        grid.removeEventListener("pointerleave", onLeave);
      });
      if (active) clear(active);
    };
  }, []);

  return null;
}
