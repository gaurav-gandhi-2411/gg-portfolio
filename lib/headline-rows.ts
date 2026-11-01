/**
 * The case-study proof strip's rows: exactly the results rows flagged
 * `headline: true` (content/types.ts), in Results order. Explicit by design:
 * until 2026-11-01 the strip took "the first three eligible rows", so a
 * correction elsewhere in Results could silently change which numbers led a
 * page. Which rows lead is now a decision recorded in each study's data, and
 * e2e/case-study-proof-strip.spec.ts checks every flagged row is a short
 * sourced numeral and that a study flags two or three rows, or none.
 */
export function headlineRows<T extends { headline?: true }>(results: readonly T[] | undefined): T[] {
  return (results ?? []).filter((r) => r.headline === true);
}
