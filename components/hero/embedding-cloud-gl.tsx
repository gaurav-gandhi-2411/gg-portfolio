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
 * The field settles instead of rotating forever.
 *
 * The persistent version cost the homepage 4.83 Lighthouse points on
 * production — and the damage was overwhelmingly Speed Index, 1389ms -> 3929ms.
 * SI scores how quickly the viewport stops changing, so a canvas that never
 * stops means a viewport that never visually completes, no matter how slow or
 * subtle the motion is. Frame rate was never the lever; *termination* was.
 *
 * So: one eased rotation over SETTLE_MS, then the rAF loop is cancelled
 * outright. Not paused, not throttled — no frames are scheduled at all, and the
 * canvas holds its last rendered image indefinitely.
 */
const SETTLE_MS = 4500;

/**
 * Total radians travelled across the settle. Enough that the parallax reads as
 * depth arriving rather than a static texture appearing, small enough that no
 * point crosses the frame.
 */
const SETTLE_RADIANS = 0.42;

/**
 * Delay before the settle begins. The hero is above the fold, so animating
 * during the load rush lands in Lighthouse's Total Blocking Time window.
 * Deferring past the boot loader's reveal keeps the work out of the busiest
 * part of load; requestIdleCallback then waits for a genuinely quiet moment,
 * with this as the floor and IDLE_TIMEOUT_MS as the ceiling.
 *
 * Kept short relative to SETTLE_MS on purpose: start + duration has to finish
 * well inside the filmstrip window SI is computed over, or deferring the motion
 * simply moves the SI damage later rather than avoiding it.
 */
const START_DELAY_MS = 900;
const IDLE_TIMEOUT_MS = 600;

/** Ease-out cubic — fast at first, asymptotically still, so the stop is not a cut. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

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
 *   - it animates ONCE, for SETTLE_MS, then cancels the loop outright — after
 *     that the component costs nothing per frame, per second, or per scroll;
 *   - it abandons the remaining frames if the tab is hidden or the hero
 *     scrolls off, and does not resume: a resting angle a few hundredths of a
 *     radian from the intended one is indistinguishable from it.
 */
export default function EmbeddingCloudGL({ onUnsupported }: EmbeddingCloudGLProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PointCloudRenderer | null>(null);
  const frameRef = useRef<number | null>(null);
  const angleRef = useRef(0);
  const runningRef = useRef(false);
  /** Once true, the settle has completed and no frame is ever scheduled again. */
  const settledRef = useRef(false);

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

  /**
   * Runs ONE eased rotation and then stops scheduling frames.
   *
   * The terminal branch is the whole point: `frameRef.current = null` with no
   * further requestAnimationFrame. After it runs, this component costs nothing
   * per frame, per second, or per scroll — the canvas simply holds its last
   * image. `settledRef` makes that permanent, so nothing can restart it.
   */
  const runSettle = useCallback(() => {
    if (runningRef.current || settledRef.current || !rendererRef.current) return;
    runningRef.current = true;
    const from = angleRef.current;
    const startedAt = performance.now();

    const step = (now: number) => {
      const renderer = rendererRef.current;
      if (!runningRef.current || !renderer) return;
      const t = Math.min(1, (now - startedAt) / SETTLE_MS);
      angleRef.current = from + SETTLE_RADIANS * easeOutCubic(t);
      renderer.render(1, angleRef.current);

      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
        return;
      }
      // Settled. No further frames are scheduled, ever.
      frameRef.current = null;
      runningRef.current = false;
      settledRef.current = true;
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

    // Only run the settle while the hero is on screen. Once settled, the
    // observers still fire but runSettle() is a no-op — the guard is in
    // runSettle rather than here so there is exactly one place that decides
    // whether a frame may be scheduled.
    const visibility = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        if (!document.hidden) runSettle();
      } else {
        stop();
      }
    });
    visibility.observe(canvas);

    // A tab hidden mid-settle abandons the remaining frames and keeps whatever
    // angle it reached. Resuming would mean scheduling frames again for motion
    // nobody watched happen; the field is ambient, and a slightly different
    // resting angle is indistinguishable from the intended one.
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else runSettle();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Defer the settle past the load rush (see START_DELAY_MS).
    let idleHandle: number | null = null;
    const delayTimer = window.setTimeout(() => {
      const ric = window.requestIdleCallback;
      if (typeof ric === "function") {
        idleHandle = ric(() => runSettle(), { timeout: IDLE_TIMEOUT_MS });
      } else {
        runSettle();
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
  }, [onUnsupported, runSettle, stop]);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />;
}
