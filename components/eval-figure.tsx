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
 * Wave 11: the `rootEl` prop (a custom IntersectionObserver root for
 * figures inside the retired work slider's scroll container) is gone —
 * every figure now lives in normal page flow, so the viewport root is
 * always correct.
 *
 * Accessibility: each <svg> is role="img" with an aria-label that states
 * the metric in words (values included). The visible <figcaption> is
 * aria-hidden — the image's accessible name already subsumes its text,
 * so nothing announces twice (wave-6 review fix).
 */

const TRACK = "color-mix(in oklab, var(--border) 40%, transparent)";
const MARK = "var(--indigo)";
const MONO = "var(--font-jetbrains-mono)";
// Matches the figcaption's text-caption size (12px) so the figure's own labels and its
// caption sit on one size (design-review finding: 11px was a tokenless 1px
// mismatch with the figcaption directly below).
const FIG_TEXT_PX = 12;
// Keep in sync with the flagship card's figure rail (md:grid-cols-[1fr_13rem]
// in components/sections/work.tsx) and this figure's own w-[13rem] wrapper —
// 208 = 13rem at the 16px root. A root-size change must update all three.
const W = 208;
const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

// Matches an ISO date (YYYY-MM-DD) anywhere in a caption string. Generic on
// purpose — every card's caption runs through this, not just metrics that
// happen to carry a date today — so a future label with its own date gets
// the same protection with no per-metric special-casing. Two separate
// regexes on purpose: `String.split` needs the captured group with the `g`
// flag, and `.test()` below must never run against a shared global-flagged
// regex (its stateful `lastIndex` would silently flip true/false on
// alternating calls) — so the whole-token check gets its own, non-global
// instance.
const ISO_DATE_SPLIT_RE = /(\d{4}-\d{2}-\d{2})/g;
const ISO_DATE_FULL_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Splits caption text on ISO-date tokens and wraps each one in
 * `whitespace-nowrap` so a line break can fall between words but never
 * inside a date. This replaced a data-layer fix (a non-breaking hyphen
 * substituted into the date string itself) that shipped briefly in PR #242
 * — reverted because content/metrics.json's `label` is a data source read
 * by other surfaces (the chatbot index, direct JSON reads, an exact-string
 * gate on the canonical metric string), and a non-ASCII hyphen there made
 * those surfaces byte-for-byte different from the plain-ASCII string
 * despite rendering identically (the same failure class as PR #225, where
 * poppler silently dropped a U+2011 from "sentence-transformers" during PDF
 * extraction). The wrap prevention belongs here, in the rendering layer,
 * operating on plain ASCII input.
 */
function wrapDateTokens(text: string): React.ReactNode {
  const parts = text.split(ISO_DATE_SPLIT_RE);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    ISO_DATE_FULL_RE.test(part) ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function Caption({ text }: { text: string }) {
  // aria-hidden: the sibling svg's role="img" aria-label already states the
  // full claim (label + values) — announcing the label phrase twice
  // back-to-back is redundant for SR users (design-review finding, wave 7).
  // The aria-label itself is built from the plain, unwrapped `label` string
  // (see each figure kind's `aria-label` below) — this wrapping is visual
  // only and never touches accessible-name content.
  return (
    <figcaption aria-hidden="true" className="text-muted-foreground mt-[var(--space-2)] text-caption leading-snug">
      {wrapDateTokens(text)}
    </figcaption>
  );
}

type Mark = SVGRectElement | SVGLineElement | SVGCircleElement;

function useDrawIn() {
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
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { svgRef, setMarkRef };
}

export function EvalFigure({ figure, label }: { figure: ProductFigure; label: string }) {
  const { svgRef, setMarkRef } = useDrawIn();

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
        <Caption text={`${label} (${figure.scaleNote})`} />
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
        <Caption text={label} />
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
      <Caption text={label} />
    </figure>
  );
}
