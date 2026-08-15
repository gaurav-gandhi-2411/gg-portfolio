"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { waitForViewTransition } from "@/lib/view-transition";
import { mayUseWebGL } from "@/lib/webgl/capability";

const ProjectEmbeddingAmbientGL = dynamic(() => import("./project-embedding-ambient-gl"), {
  ssr: false,
  loading: () => null,
});

/**
 * /projects grid ambient-depth surface (perf/lcp-final Task 4, surface 2).
 *
 * Purely decorative: a faint, slow-rotating WebGL point cloud of the same
 * real portfolio embedding field the case-study toggle draws, positioned
 * behind the project grid via CSS (see app/projects/page.tsx). Never blocks
 * or replaces the grid — the plain grid is always there; this is an
 * additional background layer, gated twice over:
 *
 *   - mayUseWebGL(): reduced-motion visitors and low-end devices never
 *     create a context at all, same as every other WebGL surface in this repo;
 *   - IntersectionObserver: the GL chunk isn't even requested until the grid
 *     section is approaching the viewport, so a visitor who never scrolls to
 *     /projects downloads none of it (and neither does a visitor to any other
 *     route — this component isn't mounted anywhere except /projects).
 */
export function ProjectEmbeddingAmbient() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mount, setMount] = useState(false);

  useEffect(() => {
    // The observer setup itself is deferred until any in-flight View
    // Transition has actually finished — not a guessed delay. The project
    // grid can already be within IntersectionObserver's `rootMargin` on
    // initial mount (no scroll needed), so `observe()`'s first callback can
    // fire while the browser is still mid-capture of the transition's "new"
    // DOM snapshot on the destination page of a
    // components/transition-link.tsx navigation — a real, reproduced crash
    // (see lib/view-transition.ts's waitForViewTransition doc for the full
    // mechanism; a fixed setTimeout(0) here was tried first and still failed
    // under real parallel-test timing). Resolves immediately when there's no
    // transition in flight, so this costs nothing on a hard navigation or
    // the first page load.
    let cancelled = false;
    let cleanup = () => {};
    waitForViewTransition().then(() => {
      if (cancelled) return;
      if (!mayUseWebGL()) return;
      const container = containerRef.current;
      if (!container) return;
      if (typeof IntersectionObserver !== "function") return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setMount(true);
            observer.disconnect();
          }
        },
        { rootMargin: "200px" }
      );
      observer.observe(container);
      cleanup = () => observer.disconnect();
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {mount ? <ProjectEmbeddingAmbientGL /> : null}
    </div>
  );
}
