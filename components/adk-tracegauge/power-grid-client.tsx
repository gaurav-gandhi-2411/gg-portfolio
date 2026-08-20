"use client";

import { useMemo, useState } from "react";

import { POWER_GRID, cellFor, rowsFor, type Mode, type Regime } from "@/lib/adk-tracegauge-power";

/**
 * The interactive half of the power-vs-variance explainer.
 *
 * Every cell here is the same number PowerGridStatic already rendered; this
 * only adds a picker so a reader can hold one variable still and watch the
 * others move, and a pinned comparison against the one real evalset this
 * package's own retraction was built on. Nothing on screen is computed here
 * -- every value is a lookup into content/data/adk-tracegauge-power-grid.json.
 */
export default function PowerGridClient() {
  const [regime, setRegime] = useState<Regime>("B");
  const [mode, setMode] = useState<Mode>("paired");
  const rows = useMemo(() => rowsFor(regime, mode), [regime, mode]);
  const [rowValue, setRowValue] = useState<number>(0.2);
  const [n, setN] = useState<number>(30);

  const activeRows = rows;
  const currentRow = activeRows.find((r) => r.value === rowValue) ?? activeRows[0];
  const cell = cellFor(activeRows, currentRow.value, n);

  const regimeLabel = regime === "A" ? POWER_GRID.regimeA.label : POWER_GRID.regimeB.label;
  const approximates =
    regime === "A" ? POWER_GRID.regimeA.approximates : POWER_GRID.regimeB.modes[mode].note;
  const rowLabel = regime === "A" ? POWER_GRID.regimeA.row_label : POWER_GRID.regimeB.row_label;

  const showRealPoint = regime === "B" && mode === "paired";
  const realPoint10 = POWER_GRID.realMeasured.points.find((p) => p.effectPct === 10 && p.n === n);

  function pickRegime(next: Regime) {
    setRegime(next);
    const nextRows = rowsFor(next, mode);
    if (!nextRows.some((r) => r.value === rowValue)) setRowValue(nextRows[1]?.value ?? nextRows[0].value);
  }

  function pickMode(next: Mode) {
    setMode(next);
    const nextRows = rowsFor(regime, next);
    if (!nextRows.some((r) => r.value === rowValue)) setRowValue(nextRows[1]?.value ?? nextRows[0].value);
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div className="flex flex-col gap-[var(--space-2)]">
        <p className="text-muted-foreground text-xs tracking-eyebrow uppercase">
          Pick a noise shape
        </p>
        <div className="flex flex-wrap gap-[var(--space-2)]" role="group" aria-label="Noise regime">
          <ToggleButton pressed={regime === "A"} onClick={() => pickRegime("A")}>
            Fixed-dollar noise
          </ToggleButton>
          <ToggleButton pressed={regime === "B"} onClick={() => pickRegime("B")}>
            Cost-proportional noise
          </ToggleButton>
        </div>
        {regime === "B" ? (
          <div className="flex flex-wrap gap-[var(--space-2)]" role="group" aria-label="Comparison mode">
            <ToggleButton pressed={mode === "twoSample"} onClick={() => pickMode("twoSample")}>
              Two-sample
            </ToggleButton>
            <ToggleButton pressed={mode === "paired"} onClick={() => pickMode("paired")}>
              Paired
            </ToggleButton>
          </div>
        ) : null}
        <p className="text-muted-foreground text-sm leading-relaxed">{approximates}</p>
      </div>

      <div className="flex flex-col gap-[var(--space-2)]">
        <p className="text-muted-foreground text-xs tracking-eyebrow uppercase">
          {rowLabel}
        </p>
        <div className="flex flex-wrap gap-[var(--space-2)]" role="group" aria-label={rowLabel}>
          {activeRows.map((row) => (
            <ToggleButton
              key={row.value}
              pressed={row.value === currentRow.value}
              onClick={() => setRowValue(row.value)}
            >
              {row.display}
            </ToggleButton>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-[var(--space-2)]">
        <p className="text-muted-foreground text-xs tracking-eyebrow uppercase">Eval-set size</p>
        <div className="flex flex-wrap gap-[var(--space-2)]" role="group" aria-label="Sample size n">
          {POWER_GRID.n_values.map((nOption) => (
            <ToggleButton key={nOption} pressed={nOption === n} onClick={() => setN(nOption)}>
              n = {nOption}
            </ToggleButton>
          ))}
        </div>
      </div>

      <div
        className="border-border/40 flex flex-col gap-[var(--space-3)] rounded-lg border px-[var(--space-5)] py-[var(--space-4)]"
        aria-live="polite"
      >
        <p className="text-muted-foreground text-sm">
          {regimeLabel}
          {regime === "B" ? `, ${POWER_GRID.regimeB.modes[mode].label.toLowerCase()}` : ""}, {rowLabel}=
          {currentRow.display}, n={n}
        </p>
        <p
          data-testid="power-grid-result"
          className="font-heading text-heading font-semibold leading-none text-foreground"
        >
          {cell ? `${cell.pct}%` : "no data"}
        </p>
        {cell ? (
          <p className="text-muted-foreground text-sm">
            power to catch a true {POWER_GRID.effect}, 95% interval [{cell.ci[0]}%, {cell.ci[1]}%]
          </p>
        ) : null}

        <div className="flex gap-[var(--space-4)] pt-[var(--space-2)]" role="group" aria-label="Power at every eval-set size for this row">
          {currentRow.power.map((p) => (
            <div key={p.n} className="flex flex-col gap-[var(--space-1)]">
              <span className="text-muted-foreground font-mono text-caption">n={p.n}</span>
              <span
                className={`font-mono text-sm ${p.n === n ? "text-accent font-medium" : "text-foreground"}`}
              >
                {p.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {showRealPoint ? (
        <div className="border-accent/40 bg-accent/10 flex flex-col gap-[var(--space-2)] rounded-md border px-[var(--space-4)] py-[var(--space-3)]">
          <p className="text-accent text-xs tracking-eyebrow uppercase">
            Where one real evalset actually landed
          </p>
          <p className="text-sm leading-relaxed text-foreground">
            The same package, run twice against a real 36-case evalset, put its own within-case
            cost CV at {POWER_GRID.realMeasured.cv} -- between the {"0.1"} and {"0.2"} rows above.
            {realPoint10
              ? ` At n=${n}, its own power to catch a ${POWER_GRID.effect} came out at ${realPoint10.power}% [${realPoint10.ci[0]}%, ${realPoint10.ci[1]}%] (${realPoint10.trials}), read directly off this evalset rather than looked up on this grid.`
              : " This grid's n values (30, 50, 100) don't include 36, the evalset's real size -- pick n=30 to see the closest published comparison."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ToggleButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`border-border/40 min-h-11 rounded-md border px-[var(--space-3)] py-[var(--space-2)] font-mono text-caption transition-colors motion-reduce:transition-none ${
        pressed
          ? "bg-accent/15 border-accent/50 text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
