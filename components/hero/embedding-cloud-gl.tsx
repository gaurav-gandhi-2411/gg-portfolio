"use client";

import { useCallback, useEffect, useRef } from "react";

import projectionJson from "@/content/data/hinglish-embedding-projection.json";
import { HERO_CLUSTER_OPACITY } from "@/lib/embedding-cluster-opacity";
import { getPointer } from "@/lib/pointer";
import { cappedDevicePixelRatio } from "@/lib/webgl/capability";
import { createHeroFieldRenderer, type HeroFieldPoint, type HeroFieldRenderer } from "@/lib/webgl/hero-field";
import type { EmbeddingProjection } from "@/lib/embedding-projection";

interface EmbeddingCloudGLProps {
  onUnsupported: () => void;
  /**
   * Fired once the field has actually put frames on the canvas, so the still
   * on top of it can hand over. Deliberately not fired on mount: a context
   * that exists is not a field that draws, and the cross-fade should reveal
   * something rather than reveal something starting.
   */
  onFirstFrames: () => void;
}

/** Imported inside the lazy chunk, not passed as a prop. */
const projection = projectionJson as EmbeddingProjection;

/**
 * One revolution every 45 seconds.
 *
 * The old value was 312 seconds, with a comment saying it was slow enough
 * that the motion was only perceptible if you went looking for it. It
 * achieved that. On a 488px canvas it worked out to about three pixels a
 * second of horizontal travel, applied as a rigid rotation where every dot
 * moved in lockstep, so there was no relative motion anywhere for the eye
 * to catch and the whole thing read as a still image. Rotation alone is
 * still not what sells it; the per-point drift in the shader is. This rate
 * is the bed that drift sits on.
 */
const RADIANS_PER_MS = (2 * Math.PI) / (45 * 1000);

/**
 * Idle frame budget. The field alone is slow enough that 30fps is
 * indistinguishable from 60, and halving the submissions is free quality
 * elsewhere.
 */
const IDLE_FRAME_INTERVAL_MS = 1000 / 30;

/**
 * The lens is direct manipulation, and direct manipulation under 60fps
 * reads as the page lagging behind the cursor, which would undo the entire
 * point of the effect. So the loop runs uncapped whenever the pointer is
 * engaged and drops back to the idle budget once it has decayed away.
 * Lighthouse never moves a mouse, so the audit only ever sees the idle path.
 */
const ACTIVE_POINTER_THRESHOLD = 0.01;

/**
 * Delay before the first frame, in ms. Enough to clear the boot curtain's
 * own reveal (globals.css runs it to about 1s) without leaving the field
 * frozen through the first seconds anybody actually looks at it, which was
 * half of why the old hero read as dead on arrival.
 */
const START_DELAY_MS = 700;

/** How long the field takes to reach full strength once it starts. */
const FADE_IN_MS = 1400;
/**
 * Frames the field must have drawn before the still hands over. Small on
 * purpose: this is a check that the GL pipeline is producing real output, not
 * a duration. The visible timing belongs to the still's CSS fade.
 */
const HANDOVER_AFTER_FRAMES = 3;

interface HeroStatsWindow extends Window {
  /**
   * Rolling render cost, for reading the frame budget off a live
   * deployment instead of guessing at it. Costs one object and two adds
   * per frame.
   */
  __ggHeroStats?: { frames: number; totalMs: number; lastMs: number; fps: number };
}

export default function EmbeddingCloudGL({ onUnsupported, onFirstFrames }: EmbeddingCloudGLProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<HeroFieldRenderer | null>(null);
  const frameRef = useRef<number | null>(null);
  const angleRef = useRef(0);
  const lastFrameRef = useRef(0);
  const startedAtRef = useRef(0);
  const handedOverRef = useRef(false);
  const runningRef = useRef(false);

  const points: HeroFieldPoint[] = projection.points.map((p) => ({
    position: p.finetuned,
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
    const now = performance.now();
    lastFrameRef.current = now;
    if (startedAtRef.current === 0) startedAtRef.current = now;

    const stats = (window as HeroStatsWindow).__ggHeroStats ?? {
      frames: 0,
      totalMs: 0,
      lastMs: 0,
      fps: 0,
    };
    (window as HeroStatsWindow).__ggHeroStats = stats;

    const step = (now: number) => {
      if (!runningRef.current || !rendererRef.current) return;

      const pointer = getPointer();
      const active = pointer.strength > ACTIVE_POINTER_THRESHOLD;
      const elapsed = now - lastFrameRef.current;

      if (active || elapsed >= IDLE_FRAME_INTERVAL_MS) {
        angleRef.current += elapsed * RADIANS_PER_MS;
        const age = now - startedAtRef.current;
        const fade = Math.min(1, age / FADE_IN_MS);

        const t0 = performance.now();
        rendererRef.current.render({
          timeSeconds: now / 1000,
          angleRadians: angleRef.current,
          pointerX: pointer.x,
          pointerY: pointer.y,
          // Ease the fade so the field arrives rather than switches on, and
          // fold it into pointer strength too so the lens cannot be at full
          // power before the field it is bending is even visible.
          pointerStrength: pointer.strength * fade,
        });
        const cost = performance.now() - t0;

        stats.frames += 1;
        stats.totalMs += cost;
        stats.lastMs = cost;
        stats.fps = elapsed > 0 ? 1000 / elapsed : 0;

        // The canvas no longer fades its own opacity. It used to, and that
        // made sense when it was swapped in over nothing, but the still now
        // sits fully opaque on top of it until the handover, so the fade was
        // invisible and pure delay: waiting for it pushed the visible
        // transition out to nearly six seconds. The still's own fade is the
        // whole transition now. `fade` above still eases pointer strength, so
        // the lens cannot be at full power the instant the field appears.
        if (!handedOverRef.current && stats.frames >= HANDOVER_AFTER_FRAMES) {
          handedOverRef.current = true;
          // Enough frames to know the pipeline is really producing output, not
          // just that a context was created. The visitor has been looking at a
          // finished still the whole time; it now dissolves into a field that
          // is already drawing at full strength.
          onFirstFrames();
        }

        lastFrameRef.current = now;
      }

      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    // onFirstFrames is stable (useCallback with no deps in the parent), so
    // listing it does not recreate the loop or, through `start`, the GL
    // context. Listed anyway rather than silenced: the day it stops being
    // stable, this should break loudly instead of capturing a stale callback.
  }, [onFirstFrames]);

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

    let renderer: HeroFieldRenderer;
    try {
      renderer = createHeroFieldRenderer(gl, canvas, points, HERO_CLUSTER_OPACITY, 1.35);
    } catch {
      onUnsupported();
      return;
    }
    rendererRef.current = renderer;


    const sizeToBox = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      renderer.resize(rect.width, rect.height, cappedDevicePixelRatio());
    };
    sizeToBox();

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

    /* A lost context leaves a canvas that is present, sized and completely
     * blank. Falling back to the static layer is the honest response, and
     * without this handler the failure mode is an empty hero that looks
     * deliberate. */
    const onContextLost = (event: Event) => {
      event.preventDefault();
      stop();
      onUnsupported();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    const delayTimer = window.setTimeout(start, START_DELAY_MS);

    return () => {
      window.clearTimeout(delayTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      visibility.disconnect();
      resizeObserver.disconnect();
      stop();
      renderer.dispose();
      rendererRef.current = null;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // points derives from a module-level import and is stable for the
    // component's life; listing it would recreate the GL context every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUnsupported, start, stop]);

  // Full opacity from the first frame: it mounts underneath an opaque still
  // and is never the only thing on screen, so there is nothing to fade up from.
  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />;
}
