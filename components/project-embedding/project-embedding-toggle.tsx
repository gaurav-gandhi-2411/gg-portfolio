"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import { mayUseWebGL } from "@/lib/webgl/capability";

/**
 * Loaded only after a visitor clicks "Explore in 3D". ssr:false because it
 * needs a real canvas, and because keeping it out of the server render is
 * what keeps the WebGL code out of the case-study page's initial payload
 * entirely — same rationale as components/warmer/embedding-viewer-frame.tsx.
 */
const ProjectEmbeddingGL = dynamic(() => import("./project-embedding-gl"), {
  ssr: false,
  loading: () => (
    <div
      className="border-border/40 flex aspect-square items-center justify-center rounded-lg border sm:aspect-[16/10]"
      role="status"
    >
      <p className="text-muted-foreground text-caption">Loading 3D view…</p>
    </div>
  ),
});

interface ProjectEmbeddingToggleProps {
  /** The server-rendered static scatter. Always present in the SSR'd HTML. */
  children: React.ReactNode;
  highlightSlug: string;
}

/**
 * Case-study "explore in 3D" surface (perf/lcp-final Task 4, surface 1).
 *
 * Unlike components/warmer/embedding-viewer-frame.tsx (which auto-swaps on
 * scroll-into-view), this one is an explicit, visitor-triggered toggle — the
 * task's own brief for this surface is "a button that swaps the existing
 * static chart," so nothing here mounts on page load OR on scroll, only on
 * click. The static SVG stays the default and the one thing every visitor
 * (no-JS, reduced-motion, low-end device) gets.
 *
 * The button itself only renders once mayUseWebGL() has resolved true on the
 * client — offering a toggle that would immediately bounce back to static is
 * worse than not offering one, same "opt in only when qualified" philosophy
 * as the hero/Warmer layers.
 */
export function ProjectEmbeddingToggle({ children, highlightSlug }: ProjectEmbeddingToggleProps) {
  const [qualifies, setQualifies] = useState(false);
  const [showGL, setShowGL] = useState(false);

  const handleUnsupported = useCallback(() => {
    setShowGL(false);
    setQualifies(false);
  }, []);

  useEffect(() => {
    // Deferred rather than called synchronously in the effect body — the
    // capability check needs `window` (so it can't run during render), and
    // this avoids the cascading-render lint (react-hooks/set-state-in-effect)
    // that a bare synchronous setState-in-effect trips.
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled && mayUseWebGL()) setQualifies(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      {showGL ? (
        <ProjectEmbeddingGL highlightSlug={highlightSlug} onUnsupported={handleUnsupported} />
      ) : (
        children
      )}
      {qualifies ? (
        <button
          type="button"
          onClick={() => setShowGL((v) => !v)}
          aria-pressed={showGL}
          className="border-border/40 text-muted-foreground hover:text-foreground focus-visible:outline-ring inline-flex min-h-11 w-fit items-center gap-2 rounded-md border px-[var(--space-4)] text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          {showGL ? "Back to 2D view" : "Explore in 3D"}
        </button>
      ) : null}
    </div>
  );
}
