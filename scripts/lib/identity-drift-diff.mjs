// Pure diff-decision logic for scripts/identity-drift.mjs, extracted so it
// can be unit-tested directly — identity-drift.mjs itself does real network
// I/O and file reads at module load and isn't safe to import in a test.
//
// Two false-positive fixes here (root cause of issues #200 and #214):
//   1. A field whose *prior* recorded value is null/absent has nothing to
//      diff against yet — that's a baseline observation, not drift. Skip it
//      silently; the caller still records the new value into
//      content/identity-state.json, it's just not reported as a change.
//   2. A "name" drift (this run's README H1 vs. the previously recorded
//      README H1) is only actionable if the new name *also* disagrees with
//      what content/products.ts currently displays for that product. If the
//      new README name already matches the site's own name, the site
//      already reflects reality and there's nothing to flag.
//
// "checkedAt" is deliberately excluded from this field list — it's internal
// bookkeeping (this run's timestamp), not an externally-sourced value, so
// diffing it would make every single run look like a change (contrast with
// refresh-metrics.mjs's measured_at, which IS diff-worthy because it's
// sourced from the repo's own manifest, not stamped by this script).
export const DIFF_FIELDS = [
  "name",
  "liveUrl",
  "demoUrl",
  "httpStatus",
  "demoStatus",
  "repoVisibility",
  "repoArchived",
  "hfPresence",
  "pypiPresence",
];

/**
 * Computes the drift-worthy field diffs for one product between its
 * previously recorded state and this run's freshly checked state.
 *
 * @param {Record<string, unknown>} previous - previously recorded values (content/identity-state.json)
 * @param {Record<string, unknown>} current - this run's freshly checked values
 * @param {string | null} siteName - content/products.ts's current `name` for this product
 * @returns {{ diffs: Array<{ field: string, old: unknown, new: unknown }>, justArchived: boolean }}
 */
export function computeFieldDiffs(previous, current, siteName) {
  const diffs = [];
  let justArchived = false;
  for (const field of DIFF_FIELDS) {
    const oldVal = previous[field] ?? null;
    const newVal = current[field] ?? null;
    if (oldVal === newVal) continue;
    // Fix (issue #214 root cause): no prior recorded value means there is
    // nothing to compare against yet — a first observation is a baseline,
    // not a rename/drift.
    if (oldVal === null) continue;
    // Fix: a "name" drift that already matches the site's current name
    // isn't actionable — the site already reflects it.
    if (field === "name" && newVal === siteName) continue;
    diffs.push({ field, old: oldVal, new: newVal });
    if (field === "repoArchived" && newVal === true) justArchived = true;
  }
  return { diffs, justArchived };
}
