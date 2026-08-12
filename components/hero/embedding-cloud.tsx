"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import { mayUseWebGL } from "@/lib/webgl/capability";

const EmbeddingCloudGL = dynamic(() => import("./embedding-cloud-gl"), {
  ssr: false,
  loading: () => null,
});

interface EmbeddingCloudProps {
  /** The server-rendered static scatter. Always in the SSR'd HTML. */
  children: React.ReactNode;
}

/**
 * Chooses between the hero's static SVG scatter and its ambient WebGL layer.
 *
 * This is the file two shipped components already pointed at in their own
 * docblocks ("components/hero/embedding-cloud.tsx decides which one to
 * render") before it existed — the decision was described and documented for
 * a while before anything actually made it.
 *
 * Same inversion as the Warmer viewer and the boot loader: the static layer
 * ships server-rendered and is the default; WebGL opts in per device, and
 * every failure path lands back on the static layer. Reduced-motion visitors
 * and low-end devices never create a context at all.
 *
 * Unlike the Warmer viewer there is no IntersectionObserver gate on mounting
 * here — the hero is above the fold, so it is on screen by definition. The GL
 * component does its own visibility-based pausing once mounted.
 */
export function EmbeddingCloud({ children }: EmbeddingCloudProps) {
  const [useGL, setUseGL] = useState(false);

  const handleUnsupported = useCallback(() => setUseGL(false), []);

  useEffect(() => {
    // Decided on the next frame rather than synchronously in the effect. The
    // capability check cannot run during render (it needs window, and a
    // useState initializer would desync hydration), and switching layers
    // during hydration is the one moment worth staying off — the enhancement
    // is deferred by design anyway, so a frame costs nothing.
    const handle = requestAnimationFrame(() => {
      if (mayUseWebGL()) setUseGL(true);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  return useGL ? <EmbeddingCloudGL onUnsupported={handleUnsupported} /> : <>{children}</>;
}
