"use client";

import { useEffect, useRef } from "react";
import type { ProductFigure } from "@/content/types";

/**
 * A flagship row's eval metric, drawn (wave 7, GG-approved Option A of
 * reports/wave7-right-rail-proposal-2026-07-17.md). Data comes exclusively
 * from the product's typed `figure` field, which mirrors its `metric`
 * (same values, same sourceRef, rule 65b) — this component never carries
 * numbers of its own.
 *
 * Wave 9: gained a scroll-linked draw-in (production hardening of the
 * wave-8 Lab 5 prototype — reports/wave8-lab-2026-07-17.md — which
 * "merges into item 3", the work slider, per GG's integration map rather
 * than staying a separate component). The SVG's rendered attributes
 * already hold the REAL final values — a no-JS or pre-hydration render is
 * the correct static chart, exactly as it shipped in wave 7. `.animate()`
 * with `fill: "backwards"` only retroactively grows the marks from 0 once
 * an IntersectionObserver confirms the figure is actually visible; nothing
 * is hidden by default (same safety pattern as reveal-group.tsx).
 *
 * `rootEl`: when a figure lives inside a horizontally-scrolling container
 * (the work slider), the default viewport-rooted IntersectionObserver
 * would fire for every slide the moment the *section* scrolls into view,
 * regardless of which slide is actually scrolled to — defeating the
 * point. Pass the slider's own scroll container so "visible" means
 * "the slide holding this figure is actually scrolled into view."
 *
 * Accessibility: each <svg> is role="img" with an aria-label that states
 * the metric in words (values included). The visible <figcaption> is
 * aria-hidden — the image's accessible name already subsumes its text,
 * so nothing announces twice (wave-6 review fix).
 */

const TRACK = "color-mix(in oklab, var(--border) 40%, transparent)";
const MARK = "var(--indigo)";
const MONO = "var(--font-jetbrains-mono)";
// Matches the caption's text-xs (12px) so the figure's own labels and its
// caption sit on one size (design-review finding: 11px was a tokenless 1px
// mismatch with the figcaption directly below).
const FIG_TEXT_PX = 12;
// Keep in sync with the rail column: work-slider's card width assumptions
// and this figure's own w-[13rem] wrapper — 208 = 13rem at the 16px root.
// A root-size change must update all three together.
const W = 208;
const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

function Caption({ children }: { children: React.ReactNode }) {
  // aria-hidden: the sibling svg's role="img" aria-label already states the
  // full claim (label + values) — announcing the label phrase twice
  // back-to-back is redundant for SR users (design-review finding, wave 7).
  return (
    <figcaption aria-hidden="true" className="text-muted-foreground mt-2 text-xs leading-snug">
      {children}
    </figcaption>
  );
}

type Mark = SVGRectElement | SVGLineElement | SVGCircleElement;

function useDrawIn(rootEl?: Element | null) {
  const svgRef = useRef<SVGSVGElement>(null);
  const markRefs = useRef<(Mark | null)[]>([]);

  // Ref mutation stays inside the hook that owns markRefs (react-hooks/
  // immutability) — consuming JSX calls setMarkRef(i) to get a stable
  // callback ref rather than writing to markRefs.current directly.
  function setMarkRef(i: number) {
    return (el: Mark | null) => {
      markRefs.current[i] = el;
    };
  }

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        markRefs.current.forEach((mark, i) => {
          if (!mark) return;
          if (mark instanceof SVGRectElement) {
            const full = mark.getAttribute("width")!;
            mark.animate([{ width: "0px" }, { width: `${full}px` }], {
              duration: 550,
              delay: i * 110,
              easing: EASING,
              fill: "backwards",
            });
          } else if (mark instanceof SVGLineElement) {
            mark.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, fill: "backwards" });
          } else if (mark instanceof SVGCircleElement) {
            mark.animate([{ transform: "scale(0)" }, { transform: "scale(1)" }], {
              duration: 400,
              delay: 320,
              easing: EASING,
              fill: "backwards",
            });
          }
        });
        observer.disconnect();
      },
      { threshold: 0.5, root: rootEl ?? null }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootEl]);

  return { svgRef, setMarkRef };
}

export function EvalFigure({
  figure,
  label,
  rootEl,
}: {
  figure: ProductFigure;
  label: string;
  rootEl?: Element | null;
}) {
  const { svgRef, setMarkRef } = useDrawIn(rootEl);

  if (figure.kind === "dumbbell") {
    const x = (v: number) => 8 + Math.max(0, Math.min(1, v)) * (W - 16);
    const y = 20;
    return (
      <figure className="w-[13rem]">
        <svg
          ref={svgRef}
          width={W}
          height={38}
          role="img"
          aria-label={`${label}: improved from ${figure.from} to ${figure.to}, on a ${figure.scaleNote}.`}
        >
          <line x1={8} y1={y} x2={W - 8} y2={y} stroke={TRACK} strokeWidth={2} />
          <line
            ref={setMarkRef(0)}
            x1={x(figure.from)}
            y1={y}
            x2={x(figure.to)}
            y2={y}
            stroke={MARK}
            strokeWidth={2}
          />
          <circle cx={x(figure.from)} cy={y} r={4} fill="var(--text-lo)" />
          <circle
            ref={setMarkRef(1)}
            cx={x(figure.to)}
            cy={y}
            r={5}
            fill={MARK}
            style={{ transformOrigin: `${x(figure.to)}px ${y}px` }}
          />
          <text
            x={Math.max(0, x(figure.from) - 14)}
            y={y - 10}
            textAnchor="start"
            fill="var(--text-lo)"
            fontSize={FIG_TEXT_PX}
            fontFamily={MONO}
          >
            {figure.from}
          </text>
          <text
            x={x(figure.to)}
            y={y - 10}
            textAnchor="end"
            fill="var(--text-hi)"
            fontSize={FIG_TEXT_PX}
            fontFamily={MONO}
          >
            {figure.to}
          </text>
        </svg>
        <Caption>
          {label} ({figure.scaleNote})
        </Caption>
      </figure>
    );
  }

  if (figure.kind === "bar") {
    const w = (Math.max(0, Math.min(100, figure.pct)) / 100) * (W - 16);
    return (
      <figure className="w-[13rem]">
        <svg ref={svgRef} width={W} height={32} role="img" aria-label={`${label}: ${figure.valueText}.`}>
          <rect x={8} y={16} width={W - 16} height={6} rx={3} fill={TRACK} />
          <rect
            ref={setMarkRef(0)}
            x={8}
            y={16}
            width={w}
            height={6}
            rx={3}
            fill={MARK}
          />
          <text x={8 + w} y={10} textAnchor="end" fill="var(--text-hi)" fontSize={FIG_TEXT_PX} fontFamily={MONO}>
            {figure.valueText}
          </text>
        </svg>
        <Caption>{label}</Caption>
      </figure>
    );
  }

  // bars
  const barW = (pct: number) => (Math.max(0, Math.min(100, pct)) / 100) * (W - 108);
  return (
    <figure className="w-[13rem]">
      <svg
        ref={svgRef}
        width={W}
        height={figure.rows.length * 22 + 4}
        role="img"
        aria-label={`${label}: ${figure.rows.map((r) => `${r.pct}% on ${r.name}`).join(", ")}.`}
      >
        {figure.rows.map((r, i) => {
          const y = i * 22 + 6;
          return (
            <g key={r.name}>
              <text x={0} y={y + 8} fill="var(--text-lo)" fontSize={FIG_TEXT_PX} fontFamily={MONO}>
                {r.name}
              </text>
              <rect x={56} y={y + 1} width={W - 108} height={6} rx={3} fill={TRACK} />
              <rect
                ref={setMarkRef(i)}
                x={56}
                y={y + 1}
                width={barW(r.pct)}
                height={6}
                rx={3}
                fill={MARK}
              />
              <text x={56 + barW(r.pct) + 6} y={y + 8} fill="var(--text-hi)" fontSize={FIG_TEXT_PX} fontFamily={MONO}>
                {r.pct}%
              </text>
            </g>
          );
        })}
      </svg>
      <Caption>{label}</Caption>
    </figure>
  );
}
