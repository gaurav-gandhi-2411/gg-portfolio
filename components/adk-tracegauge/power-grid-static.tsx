import { POWER_GRID, type PowerRow } from "@/lib/adk-tracegauge-power";

/**
 * Every number the interactive version can show, in one server-rendered
 * page: three tables (Regime A, Regime B two-sample, Regime B paired) plus
 * the one real evalset's own numbers. This is what a visitor with no
 * JavaScript gets, and it is not a lesser view -- the picker built on top
 * only adds selection and a running comparison, never a number this does
 * not already carry.
 */
export function PowerGridStatic() {
  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <PowerTable
        title={`Regime A -- ${POWER_GRID.regimeA.label}`}
        approximates={POWER_GRID.regimeA.approximates}
        rowLabel={POWER_GRID.regimeA.row_label}
        rows={POWER_GRID.regimeA.rows}
      />
      <PowerTable
        title={`Regime B, two-sample -- ${POWER_GRID.regimeB.label}`}
        approximates={POWER_GRID.regimeB.modes.twoSample.note}
        rowLabel={POWER_GRID.regimeB.row_label}
        rows={POWER_GRID.regimeB.modes.twoSample.rows}
      />
      <PowerTable
        title={`Regime B, paired -- ${POWER_GRID.regimeB.label}`}
        approximates={POWER_GRID.regimeB.modes.paired.note}
        rowLabel={POWER_GRID.regimeB.row_label}
        rows={POWER_GRID.regimeB.modes.paired.rows}
      />

      <div className="border-accent/40 bg-accent/10 flex flex-col gap-[var(--space-2)] rounded-md border px-[var(--space-4)] py-[var(--space-3)]">
        <p className="text-accent text-xs tracking-eyebrow uppercase">
          One real evalset, run twice
        </p>
        <p className="text-sm leading-relaxed text-foreground">{POWER_GRID.realMeasured.detail}</p>
        <ul className="flex flex-col gap-[var(--space-1)] font-mono text-caption text-foreground">
          {POWER_GRID.realMeasured.points.map((p) => (
            <li key={`${p.n}-${p.effectPct}`}>
              n={p.n}, {p.effectPct}% rise: {p.power}% [{p.ci[0]}%, {p.ci[1]}%] ({p.trials})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PowerTable({
  title,
  approximates,
  rowLabel,
  rows,
}: {
  title: string;
  approximates: string;
  rowLabel: string;
  rows: PowerRow[];
}) {
  const ns = POWER_GRID.n_values;
  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-muted-foreground text-sm leading-relaxed">{approximates}</p>
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label={`${title} table, scrollable`}
      >
        <table className="w-full min-w-[26rem] border-collapse font-mono text-caption">
          <thead>
            <tr>
              <th className="border-border/40 border-b px-[var(--space-2)] py-[var(--space-1)] text-left text-muted-foreground">
                {rowLabel}
              </th>
              {ns.map((n) => (
                <th
                  key={n}
                  className="border-border/40 border-b px-[var(--space-2)] py-[var(--space-1)] text-right text-muted-foreground"
                >
                  n={n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.value}>
                <td className="border-border/40 border-b px-[var(--space-2)] py-[var(--space-1)] text-foreground">
                  {row.display}
                  {row.note ? (
                    <span className="text-muted-foreground"> ({row.note})</span>
                  ) : null}
                </td>
                {row.power.map((cell) => (
                  <td
                    key={cell.n}
                    className="border-border/40 border-b px-[var(--space-2)] py-[var(--space-1)] text-right text-foreground"
                    style={{
                      backgroundColor: `color-mix(in oklab, var(--accent) ${Math.max(4, Math.min(60, cell.pct * 0.55))}%, transparent)`,
                    }}
                  >
                    {cell.pct}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
