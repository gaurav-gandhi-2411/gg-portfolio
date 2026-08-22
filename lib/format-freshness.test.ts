import assert from "node:assert/strict";
import { test } from "node:test";

import { formatFreshness } from "./format-freshness.ts";

/**
 * Perf-walk finding (2026-08-23): formatFreshness used to diff a commit's
 * ISO timestamp against `Date.now()` directly. Two page loads seconds apart
 * could render two different day counts for the exact same commit — not an
 * ISR-staleness bug (the underlying commit date is itself ISR-cached and
 * stable), but this function re-deriving "how long ago" from whatever
 * instant it happened to run at, crossing a rolling 24h-from-commit-time
 * boundary with no calendar day having actually turned over. Observed live
 * on /projects/vision and /projects/forecasting (AetherArt "5d ago" ->
 * "6d ago", TriageIQ "6d ago" -> "7d ago" within seconds).
 *
 * Fixed by anchoring to the start of the current UTC day instead of the
 * exact millisecond — the value can then only change once, at a fixed real
 * boundary (midnight UTC), never from a reload alone.
 */
function withMockedNow<T>(nowIso: string, fn: () => T): T {
  const real = Date.now;
  Date.now = () => new Date(nowIso).getTime();
  try {
    return fn();
  } finally {
    Date.now = real;
  }
}

test("formatFreshness cannot flip within the same UTC calendar day", () => {
  // A commit whose own time-of-day (23:59 UTC) sits right before the two
  // "now" instants below cross it — the exact shape that broke before: a
  // rolling 24h-from-commit boundary crossed by a few seconds of real time,
  // with the calendar day (2026-08-22, UTC) never actually turning over.
  const commitIso = "2026-08-17T23:59:00Z";
  const before = withMockedNow("2026-08-22T23:58:55Z", () => formatFreshness(commitIso));
  const after = withMockedNow("2026-08-22T23:59:05Z", () => formatFreshness(commitIso));
  assert.equal(
    before,
    after,
    `two reads 10s apart, same UTC calendar day, must render identically — got "${before}" then "${after}"`
  );
});

test("formatFreshness only changes at an actual UTC midnight boundary", () => {
  const commitIso = "2026-08-17T23:59:00Z";
  const justBeforeMidnight = withMockedNow("2026-08-22T23:59:59Z", () => formatFreshness(commitIso));
  const justAfterMidnight = withMockedNow("2026-08-23T00:00:01Z", () => formatFreshness(commitIso));
  assert.notEqual(
    justBeforeMidnight,
    justAfterMidnight,
    "crossing an actual UTC midnight must still advance the day count by one"
  );
});

test("formatFreshness boundary labels", () => {
  assert.equal(withMockedNow("2026-08-22T12:00:00Z", () => formatFreshness("2026-08-22T06:00:00Z")), "shipped today");
  assert.equal(
    withMockedNow("2026-08-22T12:00:00Z", () => formatFreshness("2026-08-20T06:00:00Z")),
    "shipped yesterday"
  );
  assert.equal(
    withMockedNow("2026-08-22T12:00:00Z", () => formatFreshness("2026-08-15T00:00:00Z")),
    "shipped 7d ago"
  );
});
