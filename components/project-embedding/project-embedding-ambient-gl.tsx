"use client";

import { useCallback, useEffect, useRef } from "react";

import projectionJson from "@/content/data/project-embedding-projection.json";
import { PROJECT_CLUSTER_OPACITY } from "@/lib/embedding-cluster-opacity";
import type { ProjectEmbeddingProjection } from "@/lib/project-embedding-projection";
import { cappedDevicePixelRatio } from "@/lib/webgl/capability";
import { createPointCloudRenderer, type MorphPoint, type PointCloudRenderer } from "@/lib/webgl/point-cloud";

/** Imported inside the lazy chunk, not passed as a prop — see the hero cloud's own note. */
const projection = projectionJson as ProjectEmbeddingProjection;

/** Same ~5.2-minute revolution as the hero cloud — slow enough to read as texture, not motion. */
const RADIANS_PER_MS = (2 * Math.PI) / (312 * 1000);

/** 30fps cap — same rationale as components/hero/embedding-cloud-gl.tsx. */
const FRAME_INTERVAL_MS = 1000 / 30;

/**
 * Ambient WebGL layer behind the /projects grid: the real portfolio
 * embedding field, rotating slowly for depth. No interactivity, no labels —
 * this is background texture, not a second copy of the case-study explorer.
 *
 * Cost control, same order as the hero cloud:
 *   - the loop only starts once mounted (parent already gates on
 *     IntersectionObserver + mayUseWebGL, so this component only exists once
 *     both are satisfied);
 *   - capped to 30fps;
 *   - stops entirely when the tab is hidden or the grid scrolls off, restarts
 *     on the way back.
 */
export default function ProjectEmbeddingAmbientGL() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PointCloudRenderer | null>(null);
  const frameRef = useRef<number | null>(null);
  const angleRef = useRef(0);
  const lastFrameRef = useRef(0);
  const runningRef = useRef(false);

  const morphPoints: MorphPoint[] = projection.points.map((p) => ({
    base: p.finetuned,
    finetuned: p.finetuned,
    cluster: p.cluster,
  }));

  const stop = useCallback(() => {
    runningRef.current = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (runningRef.current || !rendererRef.current) return;
    runningRef.current = true;
    lastFrameRef.current = performance.now();

    const step = (now: number) => {
      if (!runningRef.current || !rendererRef.current) return;
      const elapsed = now - lastFrameRef.current;
      if (elapsed >= FRAME_INTERVAL_MS) {
        angleRef.current += elapsed * RADIANS_PER_MS;
        rendererRef.current.render(1, angleRef.current);
        lastFrameRef.current = now;
      }
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      canvas.getContext("webgl", { alpha: true, antialias: true, depth: false }) ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return;

    let renderer: PointCloudRenderer;
    try {
      // alphaGain 1: no lift — this layer must stay quieter than the grid.
      renderer = createPointCloudRenderer(gl, canvas, morphPoints, PROJECT_CLUSTER_OPACITY, 1);
    } catch {
      return;
    }
    rendererRef.current = renderer;

    const sizeToBox = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      renderer.resize(rect.width, rect.height, cappedDevicePixelRatio());
      renderer.render(1, angleRef.current);
    };

    // Same forced-reflow-safe shape as every sibling GL layer: no eager
    // getBoundingClientRect() here.
    const resizeObserver = new ResizeObserver(sizeToBox);
    resizeObserver.observe(canvas);

    const visibility = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        if (!document.hidden) start();
      } else {
        stop();
      }
    });
    visibility.observe(canvas);

    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // This component only mounts once the parent's own IntersectionObserver
    // has already confirmed the grid is approaching the viewport, so there is
    // no separate load-rush to defer past here — start on the next idle tick.
    let idleHandle: number | null = null;
    const ric = window.requestIdleCallback;
    if (typeof ric === "function") {
      idleHandle = ric(() => start());
    } else {
      start();
    }

    return () => {
      if (idleHandle !== null) window.cancelIdleCallback?.(idleHandle);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      visibility.disconnect();
      resizeObserver.disconnect();
      stop();
      renderer.dispose();
      rendererRef.current = null;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // morphPoints derives from a module-level import and is stable for the
    // component's life; listing it would recreate the GL context every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, stop]);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />;
}
