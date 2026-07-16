import "server-only";

// Wave 3 Tier 1: build-time/ISR live data. Every function here is
// self-provenancing — it fetches from a real source rather than asserting a
// claim, and every function fails soft (never throws) so a flaky third-party
// API can never break a build. Callers get `null`/`[]` on failure and render
// nothing for that stat, not a stale/fake number. Revalidated every 6h via
// each fetch's `next.revalidate` — this is ISR, not client-side polling.

const REVALIDATE_SECONDS = 6 * 60 * 60; // 6h

async function safeFetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: "application/json", ...init?.headers },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface TracegaugeDownloads {
  lastWeek: number;
  lastMonth: number;
}

export async function getTracegaugeDownloads(): Promise<TracegaugeDownloads | null> {
  const data = await safeFetchJson<{
    data: { last_week: number; last_month: number };
  }>("https://pypistats.org/api/packages/tracegauge/recent");
  if (!data) return null;
  return { lastWeek: data.data.last_week, lastMonth: data.data.last_month };
}

export interface WarmerPuzzleInfo {
  number: number;
  date: string;
}

export async function getWarmerPuzzleNumber(): Promise<WarmerPuzzleInfo | null> {
  const manifest = await safeFetchJson<{
    langs: { en: { days: { date: string }[] } };
  }>("https://raw.githubusercontent.com/gaurav-gandhi-2411/mindmeld-payloads/main/manifest.json");
  if (!manifest) return null;
  const days = manifest.langs.en.days;
  const todayIso = new Date().toISOString().slice(0, 10);
  // Puzzle N = today's 1-indexed position among precomputed days; falls back
  // to the most recent day at or before today if today isn't in the list yet.
  let idx = days.findIndex((d) => d.date === todayIso);
  if (idx === -1) {
    idx = days.reduce(
      (best, d, i) => (d.date <= todayIso ? i : best),
      -1
    );
  }
  if (idx === -1) return null;
  return { number: idx + 1, date: days[idx].date };
}

export interface RepoFreshness {
  lastCommitDate: string;
}

/** Latest-commit date per repo, for a "last shipped" freshness badge per product card. */
export async function getRepoFreshness(
  repos: string[]
): Promise<Record<string, RepoFreshness>> {
  const entries = await Promise.all(
    repos.map(async (repo) => {
      const commits = await safeFetchJson<{ commit: { committer: { date: string } } }[]>(
        `https://api.github.com/repos/${repo}/commits?per_page=1`
      );
      if (!commits || commits.length === 0) return [repo, null] as const;
      return [repo, { lastCommitDate: commits[0].commit.committer.date }] as const;
    })
  );
  return Object.fromEntries(
    entries.filter((e): e is [string, RepoFreshness] => e[1] !== null)
  );
}

// getShippingLog was removed in wave 5 along with the "Recently shipped"
// band — GG's call, the building-in-public feed is out of the positioning.
// Version control is the archive if it's ever wanted back.
