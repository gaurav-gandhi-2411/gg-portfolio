import assert from "node:assert/strict";
import { test } from "node:test";

import { headlineRows } from "./headline-rows.ts";

/**
 * Intent, written before the implementation: the case-study proof strip
 * shows exactly the results rows the study's author flagged `headline: true`,
 * in the order they appear in Results, and nothing else. Position is not a
 * selector: an unflagged short numeral sitting first stays out, and a study
 * with no flags gets no strip.
 *
 * Incident (2026-11-01): selection was "the first three eligible rows". A
 * StyleMaitri correction made a retrieval row eligible, which silently pushed
 * the page's thesis number ("15 of 32" in the live audit) out of the strip.
 */
const row = (label: string, value: string, headline?: true) => ({
  label,
  value,
  sourceRef: label,
  ...(headline ? { headline } : {}),
});

test("only flagged rows are selected, even when unflagged numerals come first", () => {
  const rows = [row("a", "99%"), row("b", "88%", true), row("c", "77%"), row("d", "15 of 32", true)];
  assert.deepEqual(
    headlineRows(rows).map((r) => r.label),
    ["b", "d"]
  );
});

test("flagged rows keep their Results order", () => {
  const rows = [row("x", "1", true), row("y", "2"), row("z", "3", true)];
  assert.deepEqual(
    headlineRows(rows).map((r) => r.label),
    ["x", "z"]
  );
});

test("no flags means no headline rows, with no positional fallback", () => {
  assert.deepEqual(headlineRows([row("a", "99%"), row("b", "88%")]), []);
});

test("missing results means no headline rows", () => {
  assert.deepEqual(headlineRows(undefined), []);
});
