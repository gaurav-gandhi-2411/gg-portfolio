// Assertion smoke test for identity-drift-diff.mjs's computeFieldDiffs — run
// directly with `node scripts/lib/identity-drift-diff.smoketest.mjs`. No
// framework, same posture as resume-lint.smoketest.mjs (this repo has no
// unit-test runner for scripts/).
//
// Regression coverage for issues #200 and #214: a product's first-ever
// observation of a field (no prior recorded value) must never be reported as
// drift, and a README-name drift that already matches content/products.ts's
// current name must never be reported either.

import assert from "node:assert";
import { computeFieldDiffs, DIFF_FIELDS } from "./identity-drift-diff.mjs";

// --- null prior → baseline, no diff (issue #214's exact shape: "Was: (no
// prior recorded value)", "Now: adk-tracegauge") ---
{
  const previous = {};
  const current = { name: "adk-tracegauge", checkedAt: "2026-09-23" };
  const { diffs, justArchived } = computeFieldDiffs(previous, current, "adk-tracegauge");
  assert.deepStrictEqual(diffs, [], "a field with no prior recorded value must not be reported as drift");
  assert.strictEqual(justArchived, false);
}

// --- changed, non-null prior name that still disagrees with products.ts →
// real drift, must be reported ---
{
  const previous = { name: "Old Product Name" };
  const current = { name: "New Product Name" };
  const { diffs } = computeFieldDiffs(previous, current, "Old Product Name");
  assert.strictEqual(diffs.length, 1, "a genuine README rename must be reported");
  assert.deepStrictEqual(diffs[0], { field: "name", old: "Old Product Name", new: "New Product Name" });
}

// --- new README name equals content/products.ts's current name → not
// actionable, no diff (even though it differs from the previously recorded
// value) ---
{
  const previous = { name: "Old Product Name" };
  const current = { name: "Site Display Name" };
  const { diffs } = computeFieldDiffs(previous, current, "Site Display Name");
  assert.deepStrictEqual(
    diffs,
    [],
    "a new README name that already matches products.ts's site name must not be reported",
  );
}

// --- non-name fields still diff normally when the prior value was recorded
// (the null-prior fix must not swallow real drift elsewhere) ---
{
  const previous = { repoArchived: false };
  const current = { repoArchived: true };
  const { diffs, justArchived } = computeFieldDiffs(previous, current, null);
  assert.strictEqual(diffs.length, 1, "a real repoArchived flip must still be reported");
  assert.deepStrictEqual(diffs[0], { field: "repoArchived", old: false, new: true });
  assert.strictEqual(justArchived, true, "a false->true repoArchived flip must set justArchived");
}

// --- a field with no prior recorded value AND no current value either is a
// no-op, not a diff ---
{
  const { diffs } = computeFieldDiffs({}, {}, null);
  assert.deepStrictEqual(diffs, [], "no data on either side must not be reported as drift");
}

// --- sanity: DIFF_FIELDS still includes "name" and "repoArchived" (the two
// fields exercised above) ---
assert.ok(DIFF_FIELDS.includes("name"));
assert.ok(DIFF_FIELDS.includes("repoArchived"));

console.log("identity-drift-diff.smoketest.mjs: all assertions passed");
