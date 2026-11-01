import assert from "node:assert/strict";
import { test } from "node:test";

import { warmerPuzzleState } from "./warmer-puzzle.ts";

/**
 * Intent, written before the implementation: the site may say "puzzle #N
 * live today" only when the payload manifest actually holds a puzzle dated
 * today (UTC). Warmer's app fetches today's payload by date, so a manifest
 * that stops short of today means the game cannot load today's puzzle, and
 * the site must say the daily puzzle is paused instead.
 *
 * Incident (2026-11-01): the manifest ended 2026-08-18. The old code fell
 * back to "the most recent day at or before today" and rendered "puzzle #68
 * live today" for ten weeks while the live game showed "Failed to load
 * puzzle".
 */
const days = (dates: string[]) => dates.map((date) => ({ date }));

test("a manifest holding today's date is live, numbered by its 1-indexed position", () => {
  assert.deepEqual(warmerPuzzleState(days(["2026-10-30", "2026-10-31", "2026-11-01"]), "2026-11-01"), {
    state: "live",
    number: 3,
    date: "2026-11-01",
  });
});

test("a manifest that ends yesterday is paused, not live", () => {
  assert.deepEqual(warmerPuzzleState(days(["2026-10-30", "2026-10-31"]), "2026-11-01"), {
    state: "paused",
    lastDate: "2026-10-31",
  });
});

test("the 2026-11-01 incident shape: manifest ends 2026-08-18, so paused", () => {
  const result = warmerPuzzleState(days(["2026-06-12", "2026-08-17", "2026-08-18"]), "2026-11-01");
  assert.equal(result?.state, "paused");
});

test("unordered manifests use the latest date at or before today", () => {
  assert.deepEqual(warmerPuzzleState(days(["2026-08-18", "2026-06-12"]), "2026-11-01"), {
    state: "paused",
    lastDate: "2026-08-18",
  });
});

test("a manifest with only future dates says nothing (no badge), never live", () => {
  assert.equal(warmerPuzzleState(days(["2026-12-01"]), "2026-11-01"), null);
});

test("an empty manifest says nothing (no badge)", () => {
  assert.equal(warmerPuzzleState([], "2026-11-01"), null);
});
