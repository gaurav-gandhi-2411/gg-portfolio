import powerGridData from "@/content/data/adk-tracegauge-power-grid.json";

/**
 * Real, published, audited power figures from the adk-tracegauge repo (see
 * content/data/adk-tracegauge-power-grid.json's own `_source` field for the
 * exact commit and README line range) -- not a fresh simulation run for this
 * page. The retraction story (content/case-studies/adk-tracegauge.ts's
 * `story` field) says two grids replaced one misleading number; this is
 * those two grids, made operable rather than only narrated.
 */

export interface PowerPoint {
  n: number;
  pct: number;
  ci: [number, number];
}

export interface PowerRow {
  value: number;
  display: string;
  note?: string;
  power: PowerPoint[];
}

export interface RealMeasuredPoint {
  n: number;
  effectPct: number;
  power: number;
  ci: [number, number];
  trials: string;
}

export interface PowerGridData {
  _source: string;
  effect: string;
  n_values: number[];
  regimeA: {
    label: string;
    approximates: string;
    row_label: string;
    rows: PowerRow[];
  };
  regimeB: {
    label: string;
    approximates: string;
    row_label: string;
    modes: {
      twoSample: { label: string; note: string; rows: PowerRow[] };
      paired: { label: string; note: string; rows: PowerRow[] };
    };
  };
  realMeasured: {
    label: string;
    detail: string;
    regime: "B";
    mode: "paired";
    cv: number;
    points: RealMeasuredPoint[];
  };
}

export const POWER_GRID = powerGridData as PowerGridData;

export type Regime = "A" | "B";
export type Mode = "twoSample" | "paired";

/** Rows for a given regime/mode combination. Regime A ignores `mode`. */
export function rowsFor(regime: Regime, mode: Mode): PowerRow[] {
  if (regime === "A") return POWER_GRID.regimeA.rows;
  return POWER_GRID.regimeB.modes[mode].rows;
}

/** The exact cell for a row value + n. Both are always drawn from the grid's own values, so this never needs to interpolate. */
export function cellFor(rows: PowerRow[], rowValue: number, n: number): PowerPoint | undefined {
  const row = rows.find((r) => r.value === rowValue);
  return row?.power.find((p) => p.n === n);
}
