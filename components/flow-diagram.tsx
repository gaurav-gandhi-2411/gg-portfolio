import type { FlowStage } from "@/content/types";

/**
 * Wave 12 — architecture diagram for case-study pages. A vertical flow of
 * stages (top → bottom = data flow), with `parallel` sub-boxes rendered
 * side-by-side inside a stage (e.g. dense + sparse retrieval). Plain
 * server-rendered HTML/CSS, zero JS: it reflows at every viewport,
 * inherits the token palette, and the DOM order IS the reading order —
 * a screen reader hears the same flow a sighted visitor sees. Input and
 * output stages are visually distinguished so a novice can find "where
 * data enters" and "what comes out" at a glance.
 */
export function FlowDiagram({ stages, label }: { stages: FlowStage[]; label: string }) {
  return (
    <figure aria-label={label} className="my-2">
      <ol className="flex flex-col items-stretch">
        {stages.map((stage, i) => (
          <li key={stage.label} className="flex flex-col items-stretch">
            {i > 0 && (
              <span
                aria-hidden="true"
                className="text-muted-foreground/70 self-center py-0.5 leading-none select-none"
              >
                ↓
              </span>
            )}
            <div
              className={
                stage.kind === "input" || stage.kind === "output"
                  ? "border-accent/50 bg-accent/5 rounded-lg border border-dashed px-4 py-3"
                  : "border-border/50 bg-card/60 rounded-lg border px-4 py-3"
              }
            >
              <p className="text-sm font-medium text-foreground">{stage.label}</p>
              {stage.detail && (
                <p className="text-muted-foreground mt-0.5 font-mono text-xs leading-relaxed">
                  {stage.detail}
                </p>
              )}
              {stage.parallel && (
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  {stage.parallel.map((branch) => (
                    <div
                      key={branch.label}
                      className="border-border/40 bg-background/60 rounded-md border px-3 py-2"
                    >
                      <p className="text-xs font-medium text-foreground">{branch.label}</p>
                      {branch.detail && (
                        <p className="text-muted-foreground mt-0.5 font-mono text-xs leading-relaxed">
                          {branch.detail}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}
