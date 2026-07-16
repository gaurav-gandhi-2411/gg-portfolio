/**
 * MOCKUP (explore/wave7-right-rail) — per-flagship eval figure, Option A of
 * reports/wave7-right-rail-proposal-2026-07-17.md. Static inline SVG, zero
 * JS, tokens only. Values duplicate the row's metric (same sourceRef) — in
 * the real build the figure absorbs the metric line instead.
 */

const TRACK = "color-mix(in oklab, var(--border) 40%, transparent)";
const MARK = "var(--indigo)";
const W = 208;

function Caption({ children }: { children: React.ReactNode }) {
  return <figcaption className="text-muted-foreground mt-2 text-xs leading-snug">{children}</figcaption>;
}

/** Warmer: before → after on a 0–1 scale (Spearman correlation). */
export function DumbbellFigure({
  from,
  to,
  label,
}: {
  from: number;
  to: number;
  label: string;
}) {
  const x = (v: number) => 8 + Math.max(0, Math.min(1, v)) * (W - 16);
  const y = 18;
  return (
    <figure className="w-[13rem] shrink-0">
      <svg width={W} height={36} role="img" aria-label={`${label}: ${from} to ${to}`}>
        <line x1={8} y1={y} x2={W - 8} y2={y} stroke={TRACK} strokeWidth={2} />
        <line x1={x(from)} y1={y} x2={x(to)} y2={y} stroke={MARK} strokeWidth={2} />
        <circle cx={x(from)} cy={y} r={4} fill="var(--text-lo)" />
        <circle cx={x(to)} cy={y} r={5} fill={MARK} />
        <text x={Math.max(0, x(from) - 14)} y={y - 10} textAnchor="start" fill="var(--text-lo)" fontSize={11} fontFamily="var(--font-jetbrains-mono)">
          {from}
        </text>
        <text x={x(to)} y={y - 10} textAnchor="end" fill="var(--text-hi)" fontSize={11} fontFamily="var(--font-jetbrains-mono)">
          {to}
        </text>
      </svg>
      <Caption>{label} (0–1 scale)</Caption>
    </figure>
  );
}

/** Style Maitri: one proportion on a 0–100% track. */
export function BarFigure({
  pct,
  valueText,
  label,
}: {
  pct: number;
  valueText: string;
  label: string;
}) {
  const w = (Math.max(0, Math.min(100, pct)) / 100) * (W - 16);
  return (
    <figure className="w-[13rem] shrink-0">
      <svg width={W} height={30} role="img" aria-label={`${label}: ${valueText}`}>
        <rect x={8} y={14} width={W - 16} height={6} rx={3} fill={TRACK} />
        <rect x={8} y={14} width={w} height={6} rx={3} fill={MARK} />
        <text x={8 + w} y={8} textAnchor="end" fill="var(--text-hi)" fontSize={11} fontFamily="var(--font-jetbrains-mono)">
          {valueText}
        </text>
      </svg>
      <Caption>{label}</Caption>
    </figure>
  );
}

/** TriageIQ: two magnitudes of the same measure, labeled bars. */
export function PairedBarFigure({
  rows,
  label,
}: {
  rows: { name: string; pct: number }[];
  label: string;
}) {
  const barW = (pct: number) => (Math.max(0, Math.min(100, pct)) / 100) * (W - 108);
  return (
    <figure className="w-[13rem] shrink-0">
      <svg width={W} height={rows.length * 22 + 4} role="img" aria-label={`${label}: ${rows.map((r) => `${r.name} ${r.pct}%`).join(", ")}`}>
        {rows.map((r, i) => {
          const y = i * 22 + 6;
          return (
            <g key={r.name}>
              <text x={0} y={y + 8} fill="var(--text-lo)" fontSize={11} fontFamily="var(--font-jetbrains-mono)">
                {r.name}
              </text>
              <rect x={56} y={y + 1} width={W - 108} height={6} rx={3} fill={TRACK} />
              <rect x={56} y={y + 1} width={barW(r.pct)} height={6} rx={3} fill={MARK} />
              <text x={56 + barW(r.pct) + 6} y={y + 8} fill="var(--text-hi)" fontSize={11} fontFamily="var(--font-jetbrains-mono)">
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
