/**
 * Whether Warmer's daily puzzle is playable today, from the payload
 * manifest's list of dated puzzles. Pure, so it is unit-tested without a
 * network (lib/warmer-puzzle.test.ts).
 *
 * "live" only when the manifest holds a puzzle dated today (UTC): the game
 * fetches today's payload by date, so a manifest that stops short of today
 * means today's puzzle cannot load. Until 2026-11-01 this fell back to the
 * most recent earlier day and kept rendering "puzzle #68 live today" for
 * ten weeks after the manifest stopped at 2026-08-18.
 */
export type WarmerPuzzleState =
  | { state: "live"; number: number; date: string }
  | { state: "paused"; lastDate: string };

export function warmerPuzzleState(
  days: { date: string }[],
  todayIso: string
): WarmerPuzzleState | null {
  const idx = days.findIndex((d) => d.date === todayIso);
  if (idx !== -1) return { state: "live", number: idx + 1, date: todayIso };
  const past = days.map((d) => d.date).filter((date) => date < todayIso);
  if (past.length === 0) return null;
  return { state: "paused", lastDate: past.reduce((a, b) => (b > a ? b : a)) };
}
