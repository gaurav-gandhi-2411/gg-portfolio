"use client";

import { useCallback, useEffect, useRef } from "react";

import { cappedDevicePixelRatio } from "@/lib/webgl/capability";
import {
  createPointCloudRenderer,
  type MorphPoint,
  type PointCloudRenderer,
} from "@/lib/webgl/point-cloud";
import { CLUSTER_OPACITY, type ItemPoint } from "@/lib/mmfr-projection-view";

interface ItemSpaceGLProps {
  points: readonly ItemPoint[];
  /** Emphasis per point, in `points` order. Changing it animates the swap. */
  emphasis: readonly number[];
  /** Called if GL is unavailable or the renderer throws, so the parent stays static. */
  onUnsupported: () => void;
}

/** How long the highlight takes to arrive when a different anchor is picked. */
const REVEAL_MS = 520;
/** How far the field turns during that reveal, in radians. */
const SWING_RAD = 0.16;

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * The WebGL layer of the MMFR item space.
 *
 * Same performance contract as the TriageIQ retrieval space and the Warmer
 * viewer, and for the same reason: there is no idle render loop. Frames are
 * drawn only while a highlight is arriving (about half a second after an
 * anchor is picked) or on a resize. A visitor who picks nothing costs zero
 * rAF callbacks and zero GPU work, which is what keeps a case-study route's
 * Total Blocking Time out of this.
 *
 * The rotation is a short swing during that same window rather than a
 * permanent drift, so the field reads as three-dimensional at the moment
 * anyone is looking at it changing, and stops the instant it settles.
 */
export default function ItemSpaceGL({ points, emphasis, onUnsupported }: ItemSpaceGLProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PointCloudRenderer | null>(null);
  const frameRef = useRef<number | null>(null);
  const angleRef = useRef(0);
  // Emphasis is read inside the animation frame, so it lives in a ref as well
  // as in props; the alternative is restarting the effect on every change.
  const targetRef = useRef<readonly number[]>(emphasis);
  const scratchRef = useRef<Float32Array>(new Float32Array(points.length));

  const drawStill = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setEmphasis(targetRef.current);
    renderer.render(0, angleRef.current);
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

    // The renderer morphs between two coordinate sets; this cloud has one, so
    // both slots hold the same position and every frame is drawn at morph 0.
    // Reusing the shared renderer rather than writing a second one is the
    // whole point: one shader, one buffer path, one place where a projection
    // bug would have to be fixed.
    const morphPoints: MorphPoint[] = points.map((p) => ({
      base: p.p,
      finetuned: p.p,
      cluster: p.c,
    }));

    let renderer: PointCloudRenderer;
    try {
      renderer = createPointCloudRenderer(gl, canvas, morphPoints, CLUSTER_OPACITY, 1.15);
    } catch {
      onUnsupported();
      return;
    }
    rendererRef.current = renderer;

    const sizeToBox = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      renderer.resize(rect.width, rect.height, cappedDevicePixelRatio());
      drawStill();
    };

    const observer = new ResizeObserver(sizeToBox);
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      renderer.dispose();
      rendererRef.current = null;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // `points` comes from a module-level import in the parent and is stable
    // for the life of the component; listing it would rebuild the GL context
    // on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUnsupported, drawStill]);

  // Animate to the new highlight whenever the selected anchor changes.
  useEffect(() => {
    targetRef.current = emphasis;
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    const scratch = scratchRef.current;
    const fromAngle = angleRef.current;
    const toAngle = fromAngle + SWING_RAD;
    const start = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / REVEAL_MS);
      const eased = easeOut(t);
      for (let i = 0; i < scratch.length; i++) {
        scratch[i] = (emphasis[i] ?? 0) * eased;
      }
      angleRef.current = fromAngle + (toAngle - fromAngle) * eased;
      renderer.setEmphasis(scratch);
      renderer.render(0, angleRef.current);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        // Settled: stop the loop entirely rather than idling on rAF.
        frameRef.current = null;
        angleRef.current = toAngle;
      }
    };
    frameRef.current = requestAnimationFrame(step);
  }, [emphasis]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      data-testid="mmfr-item-space-gl"
      // The canvas carries nothing a screen reader can use. The result list
      // beside it is the accessible equivalent, and it is not a summary of
      // the picture, it is the data the picture was drawn from.
      aria-hidden="true"
    />
  );
}
