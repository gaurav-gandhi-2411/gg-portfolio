"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductFigure } from "@/content/types";

/**
 * Lab 5 — the real wave-7 eval figures (components/eval-figure.tsx),
 * redrawn to animate in when scrolled into view instead of rendering
 * static. Same real data, same sourceRef-backed values (content/products.ts
 * `figure` fields) — only the reveal is new. A self-contained prototype
 * duplicate, not a change to the production component; if GG advances this,
 * production eval-figure.tsx would gain the entrance behavior in place.
 *
 * Uses IntersectionObserver + Element.animate() (Web Animations API),
 * same safe pattern as Lab 2's stagger: default SVG attributes already
 * hold the REAL final values (width/x2/etc.) so no-JS or pre-hydration
 * renders show the correct static chart immediately — .animate() with
 * fill:"backwards" only retroactively grows them from 0 once JS confirms
 * visibility. Nothing is ever hidden by default.
 */

const TRACK = "color-mix(in oklab, var(--border) 40%, transparent)";
const MARK = "var(--indigo)";
const MONO = "var(--font-jetbrains-mono)";
const W = 208;

function useReveal<T extends Element>() {
  const ref = useRef<T>(null);
  const [armed, setArmed] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setArmed((a) => a + 1);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, armed };
}

function reduceMotionNow() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ScrollDrawFigure({
  figure,
  label,
  replayToken,
}: {
  figure: ProductFigure;
  label: string;
  replayToken: number;
}) {
  const { ref, armed } = useReveal<SVGSVGElement>();
  const trigger = armed + replayToken;

  const barRef = useRef<SVGRectElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const barsRefs = useRef<(SVGRectElement | null)[]>([]);

  useEffect(() => {
    if (trigger === 0 || reduceMotionNow()) return;
    const easing = "cubic-bezier(0.16, 1, 0.3, 1)";
    if (figure.kind === "bar" && barRef.current) {
      const full = barRef.current.getAttribute("width")!;
      barRef.current.animate([{ width: "0px" }, { width: `${full}px` }], {
        duration: 600,
        easing,
        fill: "backwards",
      });
    }
    if (figure.kind === "dumbbell" && lineRef.current && dotRef.current) {
      lineRef.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: "backwards" });
      dotRef.current.animate(
        [{ transform: "scale(0)" }, { transform: "scale(1)" }],
        { duration: 400, delay: 350, easing, fill: "backwards" }
      );
    }
    if (figure.kind === "bars") {
      barsRefs.current.forEach((el, i) => {
        if (!el) return;
        const full = el.getAttribute("width")!;
        el.animate([{ width: "0px" }, { width: `${full}px` }], {
          duration: 500,
          delay: i * 120,
          easing,
          fill: "backwards",
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (figure.kind === "dumbbell") {
    const x = (v: number) => 8 + Math.max(0, Math.min(1, v)) * (W - 16);
    const y = 20;
    return (
      <figure className="w-[13rem]">
        <svg ref={ref} width={W} height={38} role="img" aria-label={`${label}: ${figure.from} to ${figure.to}`}>
          <line x1={8} y1={y} x2={W - 8} y2={y} stroke={TRACK} strokeWidth={2} />
          <line ref={lineRef} x1={x(figure.from)} y1={y} x2={x(figure.to)} y2={y} stroke={MARK} strokeWidth={2} />
          <circle cx={x(figure.from)} cy={y} r={4} fill="var(--text-lo)" />
          <circle ref={dotRef} cx={x(figure.to)} cy={y} r={5} fill={MARK} style={{ transformOrigin: `${x(figure.to)}px ${y}px` }} />
          <text x={Math.max(0, x(figure.from) - 14)} y={y - 10} fill="var(--text-lo)" fontSize={12} fontFamily={MONO}>
            {figure.from}
          </text>
          <text x={x(figure.to)} y={y - 10} textAnchor="end" fill="var(--text-hi)" fontSize={12} fontFamily={MONO}>
            {figure.to}
          </text>
        </svg>
        <figcaption className="text-muted-foreground mt-2 text-xs leading-snug">
          {label} ({figure.scaleNote})
        </figcaption>
      </figure>
    );
  }

  if (figure.kind === "bar") {
    const w = (Math.max(0, Math.min(100, figure.pct)) / 100) * (W - 16);
    return (
      <figure className="w-[13rem]">
        <svg ref={ref} width={W} height={32} role="img" aria-label={`${label}: ${figure.valueText}`}>
          <rect x={8} y={16} width={W - 16} height={6} rx={3} fill={TRACK} />
          <rect ref={barRef} x={8} y={16} width={w} height={6} rx={3} fill={MARK} />
          <text x={8 + w} y={10} textAnchor="end" fill="var(--text-hi)" fontSize={12} fontFamily={MONO}>
            {figure.valueText}
          </text>
        </svg>
        <figcaption className="text-muted-foreground mt-2 text-xs leading-snug">{label}</figcaption>
      </figure>
    );
  }

  // bars
  const barW = (pct: number) => (Math.max(0, Math.min(100, pct)) / 100) * (W - 108);
  return (
    <figure className="w-[13rem]">
      <svg ref={ref} width={W} height={figure.rows.length * 22 + 4} role="img" aria-label={label}>
        {figure.rows.map((r, i) => {
          const y = i * 22 + 6;
          return (
            <g key={r.name}>
              <text x={0} y={y + 8} fill="var(--text-lo)" fontSize={12} fontFamily={MONO}>
                {r.name}
              </text>
              <rect x={56} y={y + 1} width={W - 108} height={6} rx={3} fill={TRACK} />
              <rect
                ref={(el) => {
                  barsRefs.current[i] = el;
                }}
                x={56}
                y={y + 1}
                width={barW(r.pct)}
                height={6}
                rx={3}
                fill={MARK}
              />
              <text x={56 + barW(r.pct) + 6} y={y + 8} fill="var(--text-hi)" fontSize={12} fontFamily={MONO}>
                {r.pct}%
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-muted-foreground mt-2 text-xs leading-snug">{label}</figcaption>
    </figure>
  );
}
