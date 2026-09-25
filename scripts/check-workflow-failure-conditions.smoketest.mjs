// Assertion smoke test for scripts/lib/workflow-failure-conditions.mjs -- run
// directly with `node scripts/check-workflow-failure-conditions.smoketest.mjs`.
// No framework, same posture as canary-verdict.smoketest.mjs (this repo has
// no unit-test runner).
//
// WHY THIS EXISTS: the checker exists specifically to catch a bug class that
// already shipped once undetected (chat-canary.yml's two alerting steps,
// PR #196) -- a checker for "a condition is unreachable" that is itself wrong
// about reachability would recreate exactly the same silent-gap shape. This
// pins the detector against the real pre-fix chat-canary.yml text (so a
// future edit to the detector can't stop catching the actual historical bug
// without failing here first), the fixed version of that same text, and the
// surrounding shapes that must NOT be flagged (success()/always() gates,
// unrelated `.outputs` comparisons, a folded `if: >` block scalar).

import assert from "node:assert";
import { findRawIfExpressions, findViolations } from "./lib/workflow-failure-conditions.mjs";

// --- the actual pre-fix chat-canary.yml bug, both instances, must be caught ---
{
  const preFix = [
    "      - name: Open/update the failure issue (canary tooling broken)",
    "        if: steps.tooling.outcome == 'failure'",
    "        run: echo broken",
    "",
    "      - name: Open/update the failure issue (chatbot not answering)",
    "        if: steps.tooling.outcome == 'success' && steps.probe.outcome == 'failure'",
    "        run: echo failing",
  ].join("\n");

  const violations = findViolations(preFix, "chat-canary.yml");
  assert.strictEqual(violations.length, 2, `expected 2 violations, got: ${JSON.stringify(violations)}`);
  assert.strictEqual(violations[0].line, 2);
  assert.strictEqual(violations[1].line, 6);
}

// --- the fixed version (failure() added) must NOT be flagged ---
{
  const postFix = [
    "      - name: Open/update the failure issue (canary tooling broken)",
    "        if: failure() && steps.tooling.outcome == 'failure'",
    "        run: echo broken",
    "",
    "      - name: Open/update the failure issue (chatbot not answering)",
    "        if: failure() && steps.tooling.outcome == 'success' && steps.probe.outcome == 'failure'",
    "        run: echo failing",
  ].join("\n");

  const violations = findViolations(postFix, "chat-canary.yml");
  assert.strictEqual(violations.length, 0, `expected 0 violations, got: ${JSON.stringify(violations)}`);
}

// --- always()/cancelled() also count as a valid status function, not just failure() ---
{
  assert.strictEqual(
    findViolations("if: always() && steps.x.outcome == 'failure'", "f.yml").length,
    0
  );
  assert.strictEqual(
    findViolations("if: cancelled() && steps.x.outcome == 'failure'", "f.yml").length,
    0
  );
}

// --- unrelated conditions must not false-positive ---
{
  const benign = [
    "if: success()",
    "if: always()",
    "if: steps.tooling.outcome == 'success'", // gating a normal run, not an alert -- see chat-canary.yml line 63's own comment for why this shape is intentional
    "if: steps.metadata.outputs.update-type == 'version-update:semver-patch'",
    "if: github.actor == 'dependabot[bot]'",
  ];
  for (const expr of benign) {
    const violations = findViolations(expr, "f.yml");
    assert.strictEqual(violations.length, 0, `expected no violation for "${expr}", got: ${JSON.stringify(violations)}`);
  }
}

// --- a needs.<job>.result comparison is the identical bug shape at job level ---
{
  const violations = findViolations("if: needs.build.result == 'failure'", "f.yml");
  assert.strictEqual(violations.length, 1);
}

// --- .conclusion is the same trap as .outcome ---
{
  const violations = findViolations("if: steps.x.conclusion == 'failure'", "f.yml");
  assert.strictEqual(violations.length, 1);
}

// --- a folded `if: >` block scalar (dependabot-auto-merge.yml's own shape) is parsed, not skipped ---
{
  const folded = [
    "      - name: Enable auto-merge for patch/minor updates",
    "        if: >",
    "          steps.metadata.outputs.update-type == 'version-update:semver-patch' ||",
    "          steps.metadata.outputs.update-type == 'version-update:semver-minor'",
    "        env:",
    "          FOO: bar",
  ].join("\n");
  const raw = findRawIfExpressions(folded);
  assert.strictEqual(raw.length, 1, `expected the folded if: to parse as one expression, got: ${JSON.stringify(raw)}`);
  assert.ok(raw[0].expr.includes("semver-patch") && raw[0].expr.includes("semver-minor"));
  assert.strictEqual(findViolations(folded, "f.yml").length, 0);

  // A folded block scalar carrying the actual bug shape must still be caught,
  // not silently exempted just because it spans multiple lines.
  const foldedBad = [
    "        if: >",
    "          steps.tooling.outcome == 'success' &&",
    "          steps.probe.outcome == 'failure'",
  ].join("\n");
  assert.strictEqual(findViolations(foldedBad, "f.yml").length, 1);
}

console.log("check-workflow-failure-conditions.smoketest.mjs: all assertions passed");
