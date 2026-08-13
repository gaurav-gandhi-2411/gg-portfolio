"use client";

import { useEffect, useRef } from "react";

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
 * The fixed angle the field is rendered at.
 *
 * Inherited from where the (removed) settle animation used to come to rest, so
 * the composition is the one that was designed and reviewed — the drift is gone,
 * the resting picture is not.
 */
const RESTING_ANGLE_RADIANS = 0.42;

/**
 * The hero's WebGL layer: the real 419-point embedding field, rendered ONCE.
 *
 * It does not animate, and that is the result of measuring rather than a
 * preference. Three versions were measured on deployed Vercel builds, n=6 each,
 * against a 93.00 ±2.00 baseline:
 *
 *   continuous 30fps rotation   88.17   Speed Index 3929ms
 *   4.5s eased settle, then stop 89.33  Speed Index 3102ms
 *   this — one static frame      see PR #91's final measurement
 *
 * Speed Index scores how quickly the viewport STOPS changing. Ambient motion
 * during load costs SI regardless of its duration, frame rate, or subtlety,
 * because the filmstrip cannot mark the frame complete while pixels are still
 * moving. Terminating the loop recovered only about a quarter of the loss; the
 * remaining cost was the animation existing during load at all.
 *
 * What survives is what the layer was actually for: the field is the real t-SNE
 * projection of the fine-tuned model's own eval vocabulary, with per-point
 * depth (size and alpha by z) and the one-accent opacity ramp. It was never the
 * movement that made it worth shipping.
 *
 * Cost after mount: one draw call, then nothing. No rAF is ever scheduled, so
 * there is no loop to pause, throttle, or forget to cancel — and no reason to
 * observe visibility or intersection, since a static canvas costs the same
 * off-screen as on.
 */
export default function EmbeddingCloudGL({ onUnsupported }: EmbeddingCloudGLProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PointCloudRenderer | null>(null);

  const morphPoints: MorphPoint[] = projection.points.map((p) => ({
    // The hero shows the shipped model only — no before/after here, so both
    // slots carry the fine-tuned coordinates and morph is pinned at 1.
    base: p.finetuned,
    finetuned: p.finetuned,
    cluster: p.cluster,
  }));

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

    // The only draw path. Called once at mount and again only if the element's
    // box actually changes — a rotation, a window resize, a font settling. Not
    // a loop: ResizeObserver fires on real geometry changes, not per frame.
    const drawOnce = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      renderer.resize(rect.width, rect.height, cappedDevicePixelRatio());
      renderer.render(1, RESTING_ANGLE_RADIANS);
    };
    drawOnce();

    const resizeObserver = new ResizeObserver(drawOnce);
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
      renderer.dispose();
      rendererRef.current = null;
      // Release the GPU context rather than waiting for GC — this page is
      // often reached mid-session from other routes.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // morphPoints derives from a module-level import and is stable for the
    // component's life; listing it would recreate the GL context every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUnsupported]);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />;
}
