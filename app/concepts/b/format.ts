/**
 * Local formatting/parsing helpers for the terminal/systems concept panels.
 *
 * These intentionally mirror logic that already lives in
 * components/sections/products.tsx and components/sections/shipping-log.tsx
 * rather than importing from those files — this route's scope only permits
 * importing components/ui/*, components/heat-toy.tsx, and calling
 * lib/live-data.ts directly (see the app/concepts/b task brief), so the
 * small date/slug helpers are duplicated here rather than shared.
 */

const MS_PER_DAY = 86_400_000;

/** Extracts "owner/repo" from a GitHub repo URL, or null if it isn't one. */
export function repoSlug(repoUrl: string | undefined): string | null {
  if (!repoUrl) return null;
  const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+?)\/?$/);
  return match ? match[1] : null;
}

/** "owner/repo" -> "repo", for compact display. */
export function shortRepo(fullName: string): string {
  return fullName.split("/")[1] ?? fullName;
}

/** Human "shipped Nd ago" freshness readout from an ISO commit date. */
export function formatFreshness(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / MS_PER_DAY);
  if (days <= 0) return "shipped today";
  if (days === 1) return "shipped yesterday";
  if (days < 30) return `shipped ${days}d ago`;
  if (days < 365) return `shipped ${Math.floor(days / 30)}mo ago`;
  return `shipped ${Math.floor(days / 365)}y ago`;
}

/** Compact relative date for log-tail rows ("today" / "3d ago" / "Jul 10"). */
export function formatLogDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / MS_PER_DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Formats a YYYY-MM-DD date string as "Jul 16, 2026", pinned to UTC so the
 *  server-rendered date never shifts by a day relative to its ISO input. */
export function formatIsoDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
