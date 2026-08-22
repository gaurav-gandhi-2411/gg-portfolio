/*
 * Perf-walk finding (2026-08-23): this used to diff a commit's ISO timestamp
 * against `Date.now()` directly, which moves every millisecond. Two page
 * loads seconds apart could (and did, observed live on /projects/vision and
 * /projects/forecasting) render two different day counts for the exact same
 * commit — not an ISR-staleness bug (the underlying commit date is itself
 * ISR-cached and stable across those requests), but this function
 * re-deriving "how long ago" from whatever instant it happened to run at,
 * crossing a rolling 24h-from-commit-time boundary with no calendar day
 * having actually turned over. Anchoring to the start of the current UTC
 * day means the value can only change once, at a fixed real boundary
 * (midnight UTC) — a reload can never move it.
 *
 * No `@/` imports on purpose — this is the smallest dependency-free unit
 * that's actually the bug, split out of lib/project-display.ts (which
 * imports lib/live-data.ts, unresolvable by this repo's plain
 * `node --test` unit-test runner) so it can be exercised directly.
 */
export function formatFreshness(iso: string): string {
  const startOfTodayUtc = Math.floor(Date.now() / 86_400_000) * 86_400_000;
  const days = Math.floor((startOfTodayUtc - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "shipped today";
  if (days === 1) return "shipped yesterday";
  if (days < 30) return `shipped ${days}d ago`;
  if (days < 365) return `shipped ${Math.floor(days / 30)}mo ago`;
  return `shipped ${Math.floor(days / 365)}y ago`;
}
