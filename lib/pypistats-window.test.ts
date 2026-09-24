import assert from "node:assert/strict";
import { test } from "node:test";

import { sumTrailingCompleteDays } from "./pypistats-window.ts";

/**
 * F14: project cards showed an unlabelled raw download number from
 * pypistats' `/recent`. The fix sums pypistats' own documented
 * `without_mirrors` series (`/overall?mirrors=false`) over the trailing 7
 * *complete* calendar days instead.
 *
 * The rule these tests assert, stated before reading the implementation:
 *
 *   1. The window is the 7 full calendar days immediately before "today"
 *      (UTC) -- [today-7, today-1] inclusive. Today's own row, if present,
 *      is a partial day and must never be counted.
 *   2. pypistats omits zero-download days from the series rather than
 *      emitting a `downloads: 0` row, so a date missing from the response
 *      inside the window is worth 0, not a shifted window.
 *   3. A category (e.g. "without_mirrors") that never appears in the
 *      response at all is a *different* fact from a category that appears
 *      but sums to zero in-window -- the former must return `undefined`
 *      (signalling "fall back to /recent"), the latter must return 0 (a
 *      real, reportable zero-download week).
 */

function row(category: string, date: string, downloads: number) {
  return { category, date, downloads };
}

test("sums exactly the 7 complete calendar days before today, ignoring today's own row", () => {
  const response = {
    data: [
      row("without_mirrors", "2026-09-15", 999), // outside window (8 days back)
      row("without_mirrors", "2026-09-16", 10),
      row("without_mirrors", "2026-09-17", 20),
      row("without_mirrors", "2026-09-18", 30),
      row("without_mirrors", "2026-09-19", 40),
      row("without_mirrors", "2026-09-20", 50),
      row("without_mirrors", "2026-09-21", 60),
      row("without_mirrors", "2026-09-22", 70),
      row("without_mirrors", "2026-09-23", 100000), // today: partial, must be excluded
      row("with_mirrors", "2026-09-22", 999999), // wrong category, must be excluded
    ],
  };
  const sum = sumTrailingCompleteDays(response, "without_mirrors", "2026-09-23");
  assert.equal(sum, 10 + 20 + 30 + 40 + 50 + 60 + 70);
});

test("a calendar day missing from the response counts as 0, not a shifted window", () => {
  // pypistats never emits a downloads:0 row -- 2026-09-19 is simply absent.
  // The window must still be the calendar dates [09-16, 09-22]; the missing
  // day contributes 0 rather than pulling an 8th day into the sum.
  const response = {
    data: [
      row("without_mirrors", "2026-09-16", 1),
      row("without_mirrors", "2026-09-17", 1),
      row("without_mirrors", "2026-09-18", 1),
      // 2026-09-19 missing -- a real zero-download day
      row("without_mirrors", "2026-09-20", 1),
      row("without_mirrors", "2026-09-21", 1),
      row("without_mirrors", "2026-09-22", 1),
      row("without_mirrors", "2026-09-15", 500), // would corrupt the sum if the
      // window shifted to "last 7 rows" instead of "last 7 calendar days"
    ],
  };
  const sum = sumTrailingCompleteDays(response, "without_mirrors", "2026-09-23");
  assert.equal(sum, 6, "6 real days of 1 each, the missing day contributes 0");
});

test("a category with no rows at all returns undefined, signalling fallback", () => {
  const response = {
    data: [row("with_mirrors", "2026-09-22", 100)],
  };
  const sum = sumTrailingCompleteDays(response, "without_mirrors", "2026-09-23");
  assert.equal(sum, undefined);
});

test("a category present but genuinely zero in-window returns 0, not undefined", () => {
  // Distinguishes "no data" from "data says zero" -- collapsing the two
  // would render an absent series and a real zero-download week identically.
  const response = {
    data: [row("without_mirrors", "2026-08-01", 40)], // real data, just outside the window
  };
  const sum = sumTrailingCompleteDays(response, "without_mirrors", "2026-09-23");
  assert.equal(sum, 0);
});

test("a null response (failed upstream fetch) returns undefined", () => {
  const sum = sumTrailingCompleteDays(null, "without_mirrors", "2026-09-23");
  assert.equal(sum, undefined);
});
