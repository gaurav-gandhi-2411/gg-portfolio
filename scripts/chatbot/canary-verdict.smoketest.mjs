// Assertion smoke test for canary-verdict.mjs -- run directly with
// `node scripts/chatbot/canary-verdict.smoketest.mjs`. No framework, same
// posture as resume-lint.smoketest.mjs and resume-select.smoketest.mjs
// (this repo has no unit-test runner).
//
// WHY THIS EXISTS: the canary's verdict logic broke twice in the same file,
// in the same way -- a monitor that can only ever report one thing, because
// nothing had ever run it against anything but production. This runs it
// against a known-good response and a known-bad response for every
// `refusalReason` the runbook covers, plus the shapes that don't come with
// a clean refusalReason at all (malformed JSON, an unrecognised reason
// string, a missing citations array). A verdict this smoketest gets wrong
// fails here, locally and in CI, before the workflow that consumes the same
// function ever runs against real production traffic.

import assert from "node:assert";
import { computeVerdict, RUNBOOK } from "./canary-verdict.mjs";

function goodResponse(overrides = {}) {
  return JSON.stringify({
    answer: "Gaurav Gandhi is a Lead Data Scientist, Applied AI, based in Bengaluru, India.",
    citations: [{ sourceRef: "site:identity", label: "Site identity", url: "/" }],
    refused: false,
    followUps: [],
    ...overrides,
  });
}

function refusedResponse(refusalReason, overrides = {}) {
  return JSON.stringify({
    answer: "I can only answer questions about Gaurav's work.",
    citations: [],
    refused: true,
    refusalReason,
    followUps: [],
    ...overrides,
  });
}

// --- a known-good response passes, and only the good message ---
{
  const v = computeVerdict(goodResponse());
  assert.strictEqual(v.ok, true, "a grounded, non-refused response should verify as OK");
  assert.strictEqual(v.exitCode, 0);
  assert.strictEqual(v.stderr.length, 0, "a passing verdict must not print to stderr");
  assert.ok(
    v.stdout[0].startsWith("canary OK:"),
    `expected a "canary OK:" line, got: ${JSON.stringify(v.stdout)}`
  );
}

// --- every known refusalReason fails, with its own runbook line, nothing else's ---
//
// The expected marker per reason is hand-typed here rather than read back
// from RUNBOOK. Comparing computeVerdict()'s output against the very same
// object it was computed from cannot fail no matter what that object
// contains -- confirmed the hard way: swapping two RUNBOOK values in this
// file and rerunning this smoketest against the swap still printed "all
// assertions passed", because every assertion was checking the map against
// itself. These markers are a second, independently-derived reading of
// what each runbook line is actually supposed to say (CHECKS.md 18's rule:
// a check is only safe when it compares two independently-derived sets).
const EXPECTED_MARKER = {
  provider_unavailable: "GROQ_API_KEY",
  no_grounding: "content/chatbot/index.json",
  unvalidated_citations: "cited nothing that validates",
  embeddings_unavailable: "@huggingface/transformers",
  server_error: "Read the logged stack",
  unreported: "came from a build older than the one that added it",
};

// The two key sets must match exactly -- a RUNBOOK entry added without a
// corresponding fixture here would otherwise go completely unchecked, the
// same "denominator that quietly shrinks" shape CHECKS.md 18 documents.
assert.deepStrictEqual(
  Object.keys(RUNBOOK).sort(),
  Object.keys(EXPECTED_MARKER).sort(),
  "RUNBOOK's keys and this smoketest's fixture keys have drifted apart -- " +
    "add a marker here for any new refusalReason, or remove the stale one"
);

for (const reason of Object.keys(EXPECTED_MARKER)) {
  const v = computeVerdict(refusedResponse(reason));
  assert.strictEqual(v.ok, false, `refusalReason="${reason}" must not verify as OK`);
  assert.strictEqual(v.exitCode, 1);
  assert.strictEqual(v.stdout.length, 0, "a failing verdict must not print to stdout");
  assert.ok(
    v.stderr.some((line) => line === `refusalReason=${reason}`),
    `expected "refusalReason=${reason}" in stderr, got: ${JSON.stringify(v.stderr)}`
  );
  const marker = EXPECTED_MARKER[reason];
  assert.ok(
    v.stderr.some((line) => line.includes(marker)),
    `expected reason "${reason}"'s own runbook line (containing "${marker}") in stderr, ` +
      `got: ${JSON.stringify(v.stderr)} -- a wrong or crossed-wire lookup would send an ` +
      `operator to the wrong fix`
  );
  // Every OTHER reason's marker must not appear -- catches a lookup that
  // accidentally always returns the same entry (an object-key typo falling
  // through to a neighbour, or copy-paste leaving two keys pointing at the
  // same string).
  for (const [otherReason, otherMarker] of Object.entries(EXPECTED_MARKER)) {
    if (otherReason === reason) continue;
    assert.ok(
      !v.stderr.some((line) => line.includes(otherMarker)),
      `refusalReason="${reason}" printed "${otherReason}"'s runbook text -- crossed wires`
    );
  }
}

// --- an unrecognised refusalReason still fails, and says so explicitly rather than "undefined" ---
{
  const v = computeVerdict(refusedResponse("some_future_reason_nobody_added_a_runbook_for"));
  assert.strictEqual(v.ok, false);
  assert.ok(
    v.stderr.some((line) => line.includes('no runbook entry for refusalReason "some_future_reason_nobody_added_a_runbook_for"')),
    `an unrecognised reason must say so explicitly, not silently print "undefined" -- got: ${JSON.stringify(v.stderr)}`
  );
}

// --- refused:false but zero citations is still a failure (unvalidated_citations shape, no reason set) ---
{
  const v = computeVerdict(
    JSON.stringify({ answer: "some answer", citations: [], refused: false, followUps: [] })
  );
  assert.strictEqual(v.ok, false, "refused:false with zero citations must not pass -- nothing to ground the answer in");
  assert.ok(v.stderr.some((line) => line === "refusalReason=unreported"));
}

// --- citations present but not an array (a future response-shape regression) still fails ---
{
  const v = computeVerdict(
    JSON.stringify({ answer: "some answer", citations: "not-an-array", refused: false, followUps: [] })
  );
  assert.strictEqual(v.ok, false, "a non-array citations field must fail, not be treated as truthy and pass");
}

// --- malformed JSON fails with its own distinct message, not a runbook line ---
{
  const v = computeVerdict("{not json");
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.exitCode, 1);
  assert.deepStrictEqual(v.stderr, ["response body did not parse as JSON"]);
}

// --- empty body fails the same way as malformed JSON, not a crash ---
{
  const v = computeVerdict("");
  assert.strictEqual(v.ok, false);
  assert.deepStrictEqual(v.stderr, ["response body did not parse as JSON"]);
}

console.log("canary-verdict.smoketest.mjs: all assertions passed");
