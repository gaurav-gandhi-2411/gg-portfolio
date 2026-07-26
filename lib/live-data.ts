import "server-only";

import { products } from "@/content/products";

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
    langs: Record<string, { days?: { date: string }[] }>;
  }>("https://raw.githubusercontent.com/gaurav-gandhi-2411/mindmeld-payloads/main/manifest.json");
  if (!manifest?.langs) return null;
  // Wave 13: the manifest dropped the `en` track (hi-en only now) and the
  // old hard `langs.en.days` access threw — the one function in this file
  // that could violate its own fail-soft contract. Prefer `en` if it ever
  // returns, else use the first track that has days; shape surprises
  // degrade to no-badge, never a build/ISR failure.
  const days =
    manifest.langs.en?.days ??
    Object.values(manifest.langs).find((lang) => (lang?.days?.length ?? 0) > 0)?.days;
  if (!days || days.length === 0) return null;
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

export interface CurrentlyBuilding {
  slug: string;
  name: string;
  pushedAt: string;
}

function repoFullNameFromUrl(url: string): string | null {
  const match = url.match(/github\.com\/([^/]+\/[^/]+?)\/?$/);
  return match ? match[1] : null;
}

/**
 * Wave 16 — "currently building" hero signal: the tracked product whose
 * GitHub repo was pushed to most recently. Warmer (mindmeld) has no
 * `repoUrl` — private repo — so it's naturally excluded from the tracked
 * set. Same fail-soft contract as every other function here: any shape
 * surprise or API failure degrades to no signal, never a stale/fake one.
 */
export async function getCurrentlyBuilding(): Promise<CurrentlyBuilding | null> {
  const trackedByFullName = new Map<string, { slug: string; name: string }>();
  for (const product of products) {
    if (!product.repoUrl) continue;
    const fullName = repoFullNameFromUrl(product.repoUrl);
    if (fullName) trackedByFullName.set(fullName.toLowerCase(), product);
  }
  if (trackedByFullName.size === 0) return null;

  const repos = await safeFetchJson<{ full_name: string; pushed_at: string }[]>(
    "https://api.github.com/users/gaurav-gandhi-2411/repos?per_page=100&type=public&sort=pushed"
  );
  if (!repos) return null;

  let best: CurrentlyBuilding | null = null;
  for (const repo of repos) {
    const product = trackedByFullName.get(repo.full_name?.toLowerCase());
    if (!product) continue;
    if (!best || repo.pushed_at > best.pushedAt) {
      best = { slug: product.slug, name: product.name, pushedAt: repo.pushed_at };
    }
  }
  return best;
}
