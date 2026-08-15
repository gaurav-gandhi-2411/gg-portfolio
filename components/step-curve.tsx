"use client";

import { useEffect, useRef } from "react";
import type { CurvePoint } from "@/content/types";

/**
 * Wave 17 — a labeled multi-point line chart for a metric that improves
 * across discrete method changes (e.g. AgentGauge's minimum-detectable-
 * effect curve across three estimator changes). Distinct from
 * components/eval-figure.tsx's `dumbbell`/`bar`/`bars` kinds, which are
 * sized for the narrow product-card rail (w-13rem) and only handle a
 * two-point before/after — this one is sized for the case-study body
 * column and handles an arbitrary number of ordered points.
 *
 * Same accessibility/motion conventions as eval-figure.tsx: role="img"
 * with a full-text aria-label (values included), a visually-duplicate
 * <figcaption> hidden from assistive tech, and a scroll-triggered
 * fade-in gated on prefers-reduced-motion.
 */

const TRACK = "color-mix(in oklab, var(--border) 40%, transparent)";
const MARK = "var(--indigo)";
const MONO = "var(--font-jetbrains-mono)";

const VIEW_W = 640;
const VIEW_H = 220;
const PAD_X = 24;
const PAD_TOP = 36;
const PAD_BOTTOM = 44;

function useFadeIn() {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: "backwards" });
        el.querySelectorAll("[data-draw]").forEach((node, i) => {
          node.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 400,
            delay: 250 + i * 150,
            fill: "backwards",
          });
        });
        observer.disconnect();
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

export function StepCurve({
  points,
  unit,
  label,
}: {
  points: CurvePoint[];
  unit: string;
  label: string;
}) {
  const svgRef = useFadeIn();

  const values = points.map((p) => p.value);
  const maxVal = Math.max(...values);
  const chartTop = PAD_TOP;
  const chartBottom = VIEW_H - PAD_BOTTOM;
  const chartLeft = PAD_X;
  const chartRight = VIEW_W - PAD_X;

  const x = (i: number) =>
    points.length === 1 ? (chartLeft + chartRight) / 2 : chartLeft + (i / (points.length - 1)) * (chartRight - chartLeft);
  // Higher value renders higher on the chart (conventional axis orientation) —
  // the line descending left-to-right is what "improvement" looks like here.
  const y = (v: number) => chartBottom - (maxVal === 0 ? 0 : (v / maxVal) * (chartBottom - chartTop));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" ");

  const ariaLabel = `${label}: ${points.map((p) => `${p.label}, ${p.value} ${unit}`).join("; then ")}.`;

  return (
    <figure className="w-full max-w-xl">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        role="img"
        aria-label={ariaLabel}
      >
        <line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke={TRACK} strokeWidth={1} />
        <path data-draw="" d={linePath} fill="none" stroke={MARK} strokeWidth={2} />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle data-draw="" cx={x(i)} cy={y(p.value)} r={5} fill={MARK} />
            <text
              x={x(i)}
              y={y(p.value) - 14}
              textAnchor="middle"
              fill="var(--text-hi)"
              fontSize={13}
              fontWeight={600}
              fontFamily={MONO}
            >
              {p.value}
            </text>
            <text
              x={x(i)}
              y={chartBottom + 20}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              fill="var(--text-lo)"
              fontSize={11}
              fontFamily={MONO}
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      <figcaption aria-hidden="true" className="text-muted-foreground mt-[var(--space-1)] text-caption leading-snug">
        {label} ({unit})
      </figcaption>
    </figure>
  );
}
