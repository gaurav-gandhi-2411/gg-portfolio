import type { ProductFigure } from "@/content/types";

/**
 * A flagship row's eval metric, drawn (wave 7, GG-approved Option A of
 * reports/wave7-right-rail-proposal-2026-07-17.md). Server-rendered static
 * SVG — zero client JS. Data comes exclusively from the product's typed
 * `figure` field, which mirrors its `metric` (same values, same sourceRef,
 * rule 65b) — this component never carries numbers of its own.
 *
 * Accessibility: each <svg> is role="img" with an aria-label that states
 * the metric in words (values included), so a screen reader gets the full
 * claim, not "image". SVG text children are presentational under role="img";
 * the visible <figcaption> repeats the metric's label for sighted scanning.
 * Single-hue marks with direct-printed values: the binding palette check is
 * contrast (indigo on graphite = 6.6:1, documented in globals.css); see the
 * proposal for the validator run.
 *
 * Restraint rules (from the proposal): flagship rows only, ≤72px tall, one
 * hue + muted track, no gridlines, no legend, no animation.
 */

const TRACK = "color-mix(in oklab, var(--border) 40%, transparent)";
const MARK = "var(--indigo)";
const MONO = "var(--font-jetbrains-mono)";
// Matches the caption's text-xs (12px) so the figure's own labels and its
// caption sit on one size (design-review finding: 11px was a tokenless 1px
// mismatch with the figcaption directly below).
const FIG_TEXT_PX = 12;
// Keep in sync with the rail column: work.tsx grid-cols-[..._13rem] and the
// figure wrapper's w-[13rem] — 208 = 13rem at the 16px root. A root-size
// change must update all three together.
const W = 208;

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

/** Two points on a track — a before → after delta (e.g. Warmer's eval fix). */
function Dumbbell({
  from,
  to,
  scaleNote,
  label,
}: {
  from: number;
  to: number;
  scaleNote: string;
  label: string;
}) {
  const x = (v: number) => 8 + Math.max(0, Math.min(1, v)) * (W - 16);
  // Track sits at y=20 so the 12px labels above it (baseline y=10) keep
  // their ascenders inside the svg box.
  const y = 20;
  return (
    <figure className="w-[13rem]">
      <svg
        width={W}
        height={38}
        role="img"
        aria-label={`${label}: improved from ${from} to ${to}, on a ${scaleNote}.`}
      >
        <line x1={8} y1={y} x2={W - 8} y2={y} stroke={TRACK} strokeWidth={2} />
        <line x1={x(from)} y1={y} x2={x(to)} y2={y} stroke={MARK} strokeWidth={2} />
        <circle cx={x(from)} cy={y} r={4} fill="var(--text-lo)" />
        <circle cx={x(to)} cy={y} r={5} fill={MARK} />
        <text
          x={Math.max(0, x(from) - 14)}
          y={y - 10}
          textAnchor="start"
          fill="var(--text-lo)"
          fontSize={FIG_TEXT_PX}
          fontFamily={MONO}
        >
          {from}
        </text>
        <text
          x={x(to)}
          y={y - 10}
          textAnchor="end"
          fill="var(--text-hi)"
          fontSize={FIG_TEXT_PX}
          fontFamily={MONO}
        >
          {to}
        </text>
      </svg>
      <Caption>
        {label} ({scaleNote})
      </Caption>
    </figure>
  );
}

/** One proportion on a 0–100% track. */
function Bar({ pct, valueText, label }: { pct: number; valueText: string; label: string }) {
  const w = (Math.max(0, Math.min(100, pct)) / 100) * (W - 16);
  return (
    <figure className="w-[13rem]">
      <svg width={W} height={32} role="img" aria-label={`${label}: ${valueText}.`}>
        <rect x={8} y={16} width={W - 16} height={6} rx={3} fill={TRACK} />
        <rect x={8} y={16} width={w} height={6} rx={3} fill={MARK} />
        <text
          x={8 + w}
          y={10}
          textAnchor="end"
          fill="var(--text-hi)"
          fontSize={FIG_TEXT_PX}
          fontFamily={MONO}
        >
          {valueText}
        </text>
      </svg>
      <Caption>{label}</Caption>
    </figure>
  );
}

/** The same measure across named cases — labeled thin bars. */
function Bars({
  rows,
  label,
}: {
  rows: { name: string; pct: number }[];
  label: string;
}) {
  const barW = (pct: number) => (Math.max(0, Math.min(100, pct)) / 100) * (W - 108);
  return (
    <figure className="w-[13rem]">
      <svg
        width={W}
        height={rows.length * 22 + 4}
        role="img"
        aria-label={`${label}: ${rows.map((r) => `${r.pct}% on ${r.name}`).join(", ")}.`}
      >
        {rows.map((r, i) => {
          const y = i * 22 + 6;
          return (
            <g key={r.name}>
              <text
                x={0}
                y={y + 8}
                fill="var(--text-lo)"
                fontSize={FIG_TEXT_PX}
                fontFamily={MONO}
              >
                {r.name}
              </text>
              <rect x={56} y={y + 1} width={W - 108} height={6} rx={3} fill={TRACK} />
              <rect x={56} y={y + 1} width={barW(r.pct)} height={6} rx={3} fill={MARK} />
              <text
                x={56 + barW(r.pct) + 6}
                y={y + 8}
                fill="var(--text-hi)"
                fontSize={FIG_TEXT_PX}
                fontFamily={MONO}
              >
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

export function EvalFigure({ figure, label }: { figure: ProductFigure; label: string }) {
  switch (figure.kind) {
    case "dumbbell":
      return (
        <Dumbbell from={figure.from} to={figure.to} scaleNote={figure.scaleNote} label={label} />
      );
    case "bar":
      return <Bar pct={figure.pct} valueText={figure.valueText} label={label} />;
    case "bars":
      return <Bars rows={figure.rows} label={label} />;
  }
}
