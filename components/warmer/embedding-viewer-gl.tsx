"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import projectionJson from "@/content/data/hinglish-embedding-projection.json";
import { WARMER_CLUSTER_OPACITY } from "@/lib/embedding-cluster-opacity";
import { cappedDevicePixelRatio } from "@/lib/webgl/capability";
import { createPointCloudRenderer, type MorphPoint, type PointCloudRenderer } from "@/lib/webgl/point-cloud";
// Type-only, so the "server-only" marker in that module is erased at compile
// time and never reaches the client bundle.
import type { EmbeddingProjection } from "@/lib/embedding-projection";

interface EmbeddingViewerGLProps {
  /** Called if GL is unavailable or the renderer throws, so the parent can stay static. */
  onUnsupported: () => void;
}

/**
 * The projection is imported directly here rather than passed down as a prop.
 * Passing 419 points into a client component would serialize the whole 40.7KB
 * projection into the RSC payload of every visitor to this page — including
 * the ones who never get the WebGL layer at all. Importing it inside this
 * dynamically-loaded module puts it in the lazy chunk instead, so only
 * visitors who actually activate the viewer pay for it, and none of it lands
 * in the eager bundle the size gate measures.
 */
const projection = projectionJson as EmbeddingProjection;

/** Morph duration. Long enough to read as structure forming, short enough not to feel like a wait. */
const MORPH_MS = 1100;
/** Pointer distance, in CSS px, within which a dot counts as hovered. */
const HOVER_RADIUS_PX = 14;

/** Standard ease-in-out — the morph should settle, not arrive at constant speed. */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * The interactive layer of the /work/warmer embedding viewer.
 *
 * Performance contract, which is the whole reason this exists in this shape —
 * a previous react-three-fiber version regressed mobile Lighthouse TBT from
 * ~350ms to ~1000ms:
 *
 *   - There is no continuous render loop. Frames are drawn only while a
 *     morph is in flight (~1.1s after a toggle) or on a resize. Idle costs
 *     zero rAF callbacks and zero GPU work.
 *   - Hit-testing scans precomputed screen-space positions, rebuilt only when
 *     the morph settles or the canvas resizes — never per frame, and never a
 *     3D raycast. 419 squared-distance comparisons per pointermove is a few
 *     microseconds, so no spatial index is warranted.
 *   - DPR is capped (see capability.ts).
 *   - The context is created only once the viewer is actually on screen, and
 *     the whole module is dynamically imported, so nothing here is in the
 *     initial bundle.
 */
export default function EmbeddingViewerGL({ onUnsupported }: EmbeddingViewerGLProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PointCloudRenderer | null>(null);
  const projectedRef = useRef<Float32Array | null>(null);
  const frameRef = useRef<number | null>(null);
  const morphRef = useRef(1);

  const [showFinetuned, setShowFinetuned] = useState(true);
  const [hovered, setHovered] = useState<{ term: string; x: number; y: number } | null>(null);

  // Only terms carrying both coordinate sets can morph; v2 of the projection
  // has base for every point, but the type allows its absence.
  const morphable = projection.points.filter(
    (p): p is typeof p & { base: [number, number, number] } => Boolean(p.base)
  );
  const morphPoints: MorphPoint[] = morphable.map((p) => ({
    base: p.base,
    finetuned: p.finetuned,
    cluster: p.cluster,
  }));
  const terms = morphable.map((p) => p.term);

  const drawStill = useCallback((morph: number) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.render(morph);
    projectedRef.current = renderer.project(morph);
  }, []);

  /** Animates morph to `target`, drawing frames only for the duration. */
  const animateTo = useCallback(
    (target: number) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

      const from = morphRef.current;
      const start = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / MORPH_MS);
        const value = from + (target - from) * easeInOut(t);
        morphRef.current = value;
        renderer.render(value);
        if (t < 1) {
          frameRef.current = requestAnimationFrame(step);
        } else {
          // Settled: stop the loop entirely and refresh hit targets once.
          frameRef.current = null;
          morphRef.current = target;
          projectedRef.current = renderer.project(target);
        }
      };
      frameRef.current = requestAnimationFrame(step);
    },
    []
  );

  // Create the context and renderer once, on mount (the parent only mounts
  // this component when the section is on screen and the device qualifies).
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
      renderer = createPointCloudRenderer(gl, canvas, morphPoints, WARMER_CLUSTER_OPACITY);
    } catch {
      // Shader compile/link failure on an exotic driver is a fallback, not a crash.
      onUnsupported();
      return;
    }
    rendererRef.current = renderer;

    const sizeToBox = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      renderer.resize(rect.width, rect.height, cappedDevicePixelRatio());
      drawStill(morphRef.current);
    };

    // fix/perf round 4: no longer called eagerly here — same forced-reflow
    // shape as the hero's embedding-cloud-gl.tsx sibling (see that file's
    // comment for the mechanism). ResizeObserver.observe() already delivers
    // an initial callback with the target's current box once layout is
    // fresh, so the eager synchronous getBoundingClientRect() read here was
    // both forced and redundant.
    const observer = new ResizeObserver(sizeToBox);
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      renderer.dispose();
      rendererRef.current = null;
      // Release the GPU context rather than waiting for GC — this page is
      // often reached mid-session from other case studies.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // morphPoints/terms derive from a module-level import and are stable for
    // the life of the component; listing them would recreate the GL context
    // on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUnsupported, drawStill]);

  const onToggle = (next: boolean) => {
    if (next === showFinetuned) return;
    setShowFinetuned(next);
    setHovered(null);
    animateTo(next ? 1 : 0);
  };

  // Bound to pointerdown as well as pointermove: on a touch device there is
  // no hover, so without this the "tap a point to see its term" affordance
  // would simply not exist on mobile.
  const onPointerProbe = (event: React.PointerEvent<HTMLCanvasElement>) => {
    // Skip while a morph is in flight — the hit targets are stale by design.
    if (frameRef.current !== null) return;
    const projected = projectedRef.current;
    if (!projected) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;

    let bestIndex = -1;
    let bestDistanceSq = HOVER_RADIUS_PX * HOVER_RADIUS_PX;
    for (let i = 0; i < terms.length; i++) {
      const dx = projected[i * 2] - px;
      const dy = projected[i * 2 + 1] - py;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestIndex = i;
      }
    }

    setHovered(
      bestIndex === -1
        ? null
        : { term: terms[bestIndex], x: projected[bestIndex * 2], y: projected[bestIndex * 2 + 1] }
    );
  };

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <div
        className="border-border/40 relative aspect-square overflow-hidden rounded-lg border sm:aspect-[16/10]"
        data-testid="warmer-embedding-gl"
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          onPointerMove={onPointerProbe}
          onPointerDown={onPointerProbe}
          onPointerLeave={() => setHovered(null)}
          // The canvas carries no information a screen reader can use; the
          // caption and the live region below are the accessible equivalent.
          aria-hidden="true"
        />
        {hovered ? (
          <span
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded border border-border/60 bg-background/95 px-2 py-[var(--space-1)] font-mono text-caption text-foreground"
            style={{ left: hovered.x, top: hovered.y }}
          >
            {hovered.term}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        <div className="border-border/40 inline-flex overflow-hidden rounded-md border">
          <button
            type="button"
            aria-pressed={!showFinetuned}
            onClick={() => onToggle(false)}
            className={`min-h-11 px-[var(--space-4)] text-sm transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] ${
              !showFinetuned
                ? "bg-accent/15 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Base model
          </button>
          <button
            type="button"
            aria-pressed={showFinetuned}
            onClick={() => onToggle(true)}
            className={`border-border/40 min-h-11 border-l px-[var(--space-4)] text-sm transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] ${
              showFinetuned
                ? "bg-accent/15 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Fine-tuned
          </button>
        </div>
        {/*
          Describes which projection is on screen and nothing more. An earlier
          version said the base model "collapsed into one undifferentiated
          ball" — true of this t-SNE layout, but it implied the base embedding
          space lacks structure, which the silhouette control disproved (it has
          slightly more at k=7). The caveat paragraph beside the viewer carries
          that, so this line stays neutral rather than restating a claim the
          measurement withdrew.
        */}
        <p aria-live="polite" className="text-muted-foreground text-caption">
          {showFinetuned
            ? "Fine-tuned: the same terms, after fine-tuning."
            : "Base model: the same terms, before fine-tuning."}
        </p>
      </div>
    </div>
  );
}
