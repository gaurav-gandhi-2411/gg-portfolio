/*
 * No `@/` imports and no `server-only` on purpose -- this is the smallest
 * dependency-free unit that's actually the F14 fix, split out of
 * lib/live-data.ts (which imports "server-only" and unconditionally throws
 * on import outside a Server Component, so it is unresolvable by this
 * repo's plain `node --test` unit-test runner) so it can be exercised
 * directly. Same pattern as lib/format-freshness.ts's own split, see that
 * file's header.
 */

export interface PypistatsOverallRow {
  category: string;
  date: string;
  downloads: number;
}

export interface PypistatsOverallResponse {
  data: PypistatsOverallRow[];
}

export function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function shiftUtcDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateString(d);
}

/**
 * Sums the trailing 7 *complete* calendar days (UTC) of `category` from a
 * parsed pypistats `/overall` response.
 *
 * Window: `[today - 7, today - 1]` inclusive -- the 7 full days immediately
 * before `today`. `today` itself is excluded: pypistats updates once a day,
 * so today's own row, if it exists at all, is a partial count for a day
 * that has not finished yet, and including it would make the figure swing
 * on nothing but what hour the ISR revalidation happened to run.
 *
 * pypistats omits zero-download days from the series entirely rather than
 * emitting a `downloads: 0` row, so a date missing from `response.data`
 * inside the window contributes 0 by construction -- no special-casing for
 * gaps is needed here.
 *
 * Returns `undefined`, not 0, when `category` never appears in the response
 * at all (pypistats has no `without_mirrors` series yet for this package,
 * or the upstream fetch failed) -- so a genuine zero-download week and an
 * absent series never render as the same thing on a card.
 */
export function sumTrailingCompleteDays(
  response: PypistatsOverallResponse | null,
  category: string,
  today: string
): number | undefined {
  if (!response?.data) return undefined;
  const seriesRows = response.data.filter((row) => row.category === category);
  if (seriesRows.length === 0) return undefined;
  const windowStart = shiftUtcDate(today, -7);
  return seriesRows
    .filter((row) => row.date >= windowStart && row.date < today)
    .reduce((sum, row) => sum + row.downloads, 0);
}
