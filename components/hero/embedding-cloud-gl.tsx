"use client";

import { useCallback, useEffect, useRef } from "react";

import projectionJson from "@/content/data/hinglish-embedding-projection.json";
import { HERO_CLUSTER_OPACITY } from "@/lib/embedding-cluster-opacity";
import { cappedDevicePixelRatio } from "@/lib/webgl/capability";
import { createPointCloudRenderer, type MorphPoint, type PointCloudRenderer } from "@/lib/webgl/point-cloud";
import type { EmbeddingProjection } from "@/lib/embedding-projection";

interface EmbeddingCloudGLProps {
  onUnsupported: () => void;
}

/** Imported inside the lazy chunk, not passed as a prop — see the Warmer viewer's note. */
const projection = projectionJson as EmbeddingProjection;

/**
 * Full revolution in ~5.2 minutes. Slow enough that the motion is only
 * perceptible if you look for it, which is the entire brief for this layer.
 */
const RADIANS_PER_MS = (2 * Math.PI) / (312 * 1000);

/**
 * Frame budget. 30fps rather than 60 halves the per-second GPU submissions
 * and main-thread callbacks for motion this slow — at ~0.02 rad/s nobody can
 * tell the difference, and the homepage's Lighthouse margin is the tighter of
 * the two routes.
 */
const FRAME_INTERVAL_MS = 1000 / 30;

/**
 * Delay before any animation starts, in ms. The hero is above the fold, so an
 * animation loop that starts at load runs straight through Lighthouse's Total
 * Blocking Time window — which is precisely how the previous attempt at this
 * regressed. Deferring past the boot loader's own reveal keeps the loop out of
 * the busiest part of load; requestIdleCallback then waits for a genuinely
 * quiet moment, with this as the floor and IDLE_TIMEOUT_MS as the ceiling.
 */
const START_DELAY_MS = 2600;
const IDLE_TIMEOUT_MS = 1200;

/**
 * The hero's ambient WebGL layer: the same 419-point embedding field the
 * static SVG draws, rotating slowly for depth.
 *
 * It is background texture behind an h1, so every decision here is biased
 * toward invisibility rather than impact: alpha gain 1 (no lift), the faint
 * hero ramp, a 5-minute revolution, and no interactivity of any kind. The
 * element is inside an aria-hidden, pointer-events-none container in
 * components/sections/hero.tsx.
 *
 * Cost control, in the order that matters:
 *   - nothing runs until the page has gone idle past START_DELAY_MS;
 *   - the loop is capped to 30fps;
 *   - it stops entirely when the tab is hidden or the hero scrolls off, and
 *     restarts on the way back, so a reader parked further down the page pays
 *     nothing.
 */
export default function EmbeddingCloudGL({ onUnsupported }: EmbeddingCloudGLProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PointCloudRenderer | null>(null);
  const frameRef = useRef<number | null>(null);
  const angleRef = useRef(0);
  const lastFrameRef = useRef(0);
  const runningRef = useRef(false);

  const morphPoints: MorphPoint[] = projection.points.map((p) => ({
    // The hero shows the shipped model only — no before/after here, so both
    // slots carry the fine-tuned coordinates and morph is pinned at 1.
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
    if (!gl) {
      onUnsupported();
      return;
    }

    let renderer: PointCloudRenderer;
    try {
      // alphaGain 1: no lift. This layer must stay quieter than the copy.
      renderer = createPointCloudRenderer(gl, canvas, morphPoints, HERO_CLUSTER_OPACITY, 1);
    } catch {
      onUnsupported();
      return;
    }
    rendererRef.current = renderer;

    const sizeToBox = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      renderer.resize(rect.width, rect.height, cappedDevicePixelRatio());
      renderer.render(1, angleRef.current);
    };
    sizeToBox();

    const resizeObserver = new ResizeObserver(sizeToBox);
    resizeObserver.observe(canvas);

    // Only animate while the hero is actually on screen.
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

    // Defer the first frame past the load rush (see START_DELAY_MS).
    let idleHandle: number | null = null;
    const delayTimer = window.setTimeout(() => {
      const ric = window.requestIdleCallback;
      if (typeof ric === "function") {
        idleHandle = ric(() => start(), { timeout: IDLE_TIMEOUT_MS });
      } else {
        start();
      }
    }, START_DELAY_MS);

    return () => {
      window.clearTimeout(delayTimer);
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
  }, [onUnsupported, start, stop]);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />;
}
