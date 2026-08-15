"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import projectionJson from "@/content/data/project-embedding-projection.json";
import { PROJECT_CLUSTER_OPACITY } from "@/lib/embedding-cluster-opacity";
import type { ProjectEmbeddingProjection } from "@/lib/project-embedding-projection";
import { cappedDevicePixelRatio } from "@/lib/webgl/capability";
import { createPointCloudRenderer, type MorphPoint, type PointCloudRenderer } from "@/lib/webgl/point-cloud";

interface ProjectEmbeddingGLProps {
  /** This case study's own project slug, pre-labeled on mount. */
  highlightSlug: string;
  /** Called if GL is unavailable or the renderer throws, so the parent can stay static. */
  onUnsupported: () => void;
}

/** Imported inside the lazy chunk, not passed as a prop — see the Warmer viewer's own note. */
const projection = projectionJson as ProjectEmbeddingProjection;

/** Pointer distance, in CSS px, within which a dot counts as hovered. */
const HOVER_RADIUS_PX = 16;

/**
 * The case-study "explore in 3D" layer: the same real, PCA-projected
 * portfolio embedding field the static SVG draws, as an interactive WebGL
 * point cloud. Reuses lib/webgl/point-cloud.ts exactly, same shape as
 * components/warmer/embedding-viewer-gl.tsx — a still field (no continuous
 * render loop; this is a user-triggered "explore" feature, not ambient
 * texture), hover/tap reveals a project's name via the same precomputed
 * screen-space hit-test.
 *
 * Only mounted after a visitor clicks "Explore in 3D" (see
 * project-embedding-toggle.tsx) — the whole module is a next/dynamic
 * ssr:false chunk, so nothing here is in the initial bundle or requested on
 * page load.
 */
export default function ProjectEmbeddingGL({ highlightSlug, onUnsupported }: ProjectEmbeddingGLProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PointCloudRenderer | null>(null);
  const projectedRef = useRef<Float32Array | null>(null);
  const [hovered, setHovered] = useState<{ term: string; x: number; y: number } | null>(null);

  // No before/after here — both slots carry the same real PCA position, so
  // the shared renderer's morph term is pinned at a constant 1 (matches the
  // hero cloud's "shipped model only" convention).
  const morphPoints: MorphPoint[] = projection.points.map((p) => ({
    base: p.finetuned,
    finetuned: p.finetuned,
    cluster: p.cluster,
  }));
  const terms = projection.points.map((p) => p.term);
  const highlightIndex = terms.indexOf(highlightSlug);

  const drawStill = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.render(1);
    projectedRef.current = renderer.project(1);
    if (highlightIndex >= 0 && projectedRef.current) {
      setHovered({
        term: terms[highlightIndex],
        x: projectedRef.current[highlightIndex * 2],
        y: projectedRef.current[highlightIndex * 2 + 1],
      });
    }
    // terms/highlightIndex derive from the module-level projection import and
    // are stable for the component's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      renderer = createPointCloudRenderer(gl, canvas, morphPoints, PROJECT_CLUSTER_OPACITY);
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
      drawStill();
    };

    // Same forced-reflow-safe shape as the sibling GL layers (fix/perf round
    // 4): no eager getBoundingClientRect() here — ResizeObserver's own
    // initial callback already delivers a fresh box once layout has settled.
    const observer = new ResizeObserver(sizeToBox);
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      renderer.dispose();
      rendererRef.current = null;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // morphPoints/terms/highlightIndex derive from a module-level import and
    // are stable for the component's life; listing them would recreate the
    // GL context on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUnsupported, drawStill]);

  const onPointerProbe = (event: React.PointerEvent<HTMLCanvasElement>) => {
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

    if (bestIndex === -1) {
      // Fall back to the highlighted project's own label rather than clearing
      // it entirely — this is an "explore" tool anchored on the case study
      // it's embedded in, not a free-floating chart.
      if (highlightIndex >= 0) {
        setHovered({
          term: terms[highlightIndex],
          x: projected[highlightIndex * 2],
          y: projected[highlightIndex * 2 + 1],
        });
      } else {
        setHovered(null);
      }
      return;
    }
    setHovered({ term: terms[bestIndex], x: projected[bestIndex * 2], y: projected[bestIndex * 2 + 1] });
  };

  return (
    <div
      className="border-border/40 relative aspect-square overflow-hidden rounded-lg border sm:aspect-[16/10]"
      data-testid="project-embedding-gl"
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        onPointerMove={onPointerProbe}
        onPointerDown={onPointerProbe}
        // The canvas carries no information a screen reader can use; the
        // live region below is the accessible equivalent.
        aria-hidden="true"
      />
      {hovered ? (
        <span
          aria-live="polite"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded border border-border/60 bg-background/95 px-2 py-[var(--space-1)] font-mono text-caption text-foreground"
          style={{ left: hovered.x, top: hovered.y }}
        >
          {hovered.term}
        </span>
      ) : null}
    </div>
  );
}
