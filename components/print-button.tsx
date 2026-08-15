"use client";

/**
 * Wave 16 — "Print / Save as PDF" for case-study pages. window.print()
 * needs a client boundary; kept as a one-component island so
 * case-study-page.tsx stays server-rendered (no wholesale client
 * conversion — rule 58b). Styled to match LinkButton's secondary variant
 * so it reads as part of the same button row, minus the external-link
 * chrome (this isn't a navigation). `print-hide` (app/globals.css) removes
 * it under the print stylesheet it triggers — no point printing a print
 * button.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print-hide border-border/60 bg-card/60 text-foreground inline-flex min-h-11 items-center gap-[var(--space-2)] rounded-lg border px-[var(--space-4)] py-[var(--space-2-5)] text-sm font-medium transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/60 hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      Print / Save as PDF
    </button>
  );
}
