"use client";

import { useEffect, useRef } from "react";
import { EvolvingMonogram } from "./evolving-monogram";

/**
 * Drives the "current act" state the monogram (and only the monogram) reacts
 * to. Same established pattern as components/reveal.tsx — one focused
 * IntersectionObserver, no scroll event handlers, no per-frame work.
 *
 * Each top-level `<section data-act="...">` this wraps is watched; whichever
 * one is crossing the vertical center of the viewport becomes
 * data-current-act on the shell div, which concept-c.css reads via attribute
 * selectors to reposition the fixed monogram. This is the only client-side
 * logic on the page — layout, sticky columns, and reduced-motion fallbacks
 * are all plain CSS/Tailwind.
 */
export function ActScrollTracker({ children }: { children: React.ReactNode }) {
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const sections = Array.from(shell.querySelectorAll<HTMLElement>("[data-act]"));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const act = entry.target.getAttribute("data-act");
            if (act) shell.dataset.currentAct = act;
          }
        }
      },
      // Fires when a section's boundary crosses the viewport's vertical
      // center — a standard scrollspy technique, reliable for very tall
      // sticky-chapter sections without needing per-pixel scroll math.
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={shellRef} className="cc-shell" data-current-act="hero">
      <EvolvingMonogram />
      {children}
    </div>
  );
}
