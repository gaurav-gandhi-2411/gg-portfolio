"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { mayUseWebGL } from "@/lib/webgl/capability";

/**
 * Loaded only when a visitor actually qualifies for and reaches the viewer.
 * ssr:false because it needs a real canvas, and because keeping it out of the
 * server render is what keeps the WebGL code and the 40.7KB projection out of
 * the initial payload entirely.
 */
const EmbeddingViewerGL = dynamic(() => import("./embedding-viewer-gl"), {
  ssr: false,
  loading: () => null,
});

interface EmbeddingViewerFrameProps {
  /** The server-rendered static viewer. Always present in the SSR'd HTML. */
  children: React.ReactNode;
}

/**
 * Decides whether the Warmer case study shows the static before/after pair or
 * the interactive WebGL viewer, using the same inversion as the boot loader
 * (app/globals.css): the static layer ships in the server-rendered HTML and is
 * what everyone gets by default; WebGL has to opt IN, at runtime, per device.
 *
 * Consequences, all deliberate:
 *   - no-JS visitors keep the full before/after comparison, not a blank box;
 *   - prefers-reduced-motion and low-end devices never create a GL context,
 *     rather than creating one and then declining to animate;
 *   - the GL chunk is not even requested until the section is on screen, so a
 *     visitor who never scrolls to it downloads none of it;
 *   - any failure inside the GL layer (no context, shader compile error on an
 *     exotic driver) calls back here and restores the static layer, so the
 *     worst case is the current shipped experience, never a broken one.
 */
export function EmbeddingViewerFrame({ children }: EmbeddingViewerFrameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [useGL, setUseGL] = useState(false);

  const handleUnsupported = useCallback(() => setUseGL(false), []);

  useEffect(() => {
    if (!mayUseWebGL()) return;
    const container = containerRef.current;
    if (!container) return;

    // Don't pay for the chunk or the context until the section is actually
    // approaching the viewport.
    if (typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setUseGL(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      {useGL ? <EmbeddingViewerGL onUnsupported={handleUnsupported} /> : children}
    </div>
  );
}
