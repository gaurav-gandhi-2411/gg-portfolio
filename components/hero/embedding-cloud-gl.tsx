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

interface HeroStatsWindow extends Window {
  /**
   * Rolling render cost, for reading the frame budget off a live
   * deployment instead of guessing at it. Costs one object and two adds
   * per frame.
   */
  __ggHeroStats?: { frames: number; totalMs: number; lastMs: number; fps: number };
}

export default function EmbeddingCloudGL({ onUnsupported }: EmbeddingCloudGLProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<HeroFieldRenderer | null>(null);
  const frameRef = useRef<number | null>(null);
  const angleRef = useRef(0);
  const lastFrameRef = useRef(0);
  const startedAtRef = useRef(0);
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

        if (canvasRef.current && fade < 1) {
          canvasRef.current.style.opacity = String(fade);
        } else if (canvasRef.current && canvasRef.current.style.opacity !== "1") {
          canvasRef.current.style.opacity = "1";
        }

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

    let renderer: HeroFieldRenderer;
    try {
      renderer = createHeroFieldRenderer(gl, canvas, points, HERO_CLUSTER_OPACITY, 1.35);
    } catch {
      onUnsupported();
      return;
    }
    rendererRef.current = renderer;

    /* Where the copy that needs a quiet ground actually is, so the field can
     * open around it. Read from the DOM rather than hardcoded, because the
     * block moves between 390px and 1440px and a hardcoded clearing would sit
     * in the wrong place on one of them. Queried by attribute rather than
     * passed by ref: this component is lazy and the copy is server-rendered
     * in a different subtree, so there is no ref to hand down without
     * threading one through the whole hero for a decorative layer's benefit.
     *
     * It covers the union of everything marked quiet, not just the headline.
     * The headline is 83px and only needs a 3:1 contrast ratio; the byline
     * under it is caption-sized mono and needs 4.5:1, and it was sitting
     * outside a clearing centred on the headline alone. The element that
     * needs the most protection was the one not getting any. */
    const measureTextZone = () => {
      const quiet = document.querySelectorAll<HTMLElement>("[data-hero-quiet]");
      const box = canvas.getBoundingClientRect();
      if (quiet.length === 0 || box.width === 0) {
        renderer.setTextZone(null);
        return;
      }
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      quiet.forEach((el) => {
        const rect = el.getBoundingClientRect();
        left = Math.min(left, rect.left);
        top = Math.min(top, rect.top);
        right = Math.max(right, rect.right);
        bottom = Math.max(bottom, rect.bottom);
      });
      renderer.setTextZone({
        x: left - box.left,
        y: top - box.top,
        width: right - left,
        height: bottom - top,
      });
    };

    const sizeToBox = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      renderer.resize(rect.width, rect.height, cappedDevicePixelRatio());
      measureTextZone();
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

  return <canvas ref={canvasRef} className="h-full w-full opacity-0" aria-hidden="true" />;
}
