import "server-only";

import type { Product } from "@/content/types";
import { getPypiStats, getRepoFreshness, getWarmerPuzzleNumber } from "@/lib/live-data";

/**
 * Wave 15 — factored out of project-grid.tsx so /projects/[category] can
 * share the exact same live-data ISR fetch + dateline formatting instead of
 * duplicating it (previously only ProjectGrid computed this).
 */

function repoSlug(repoUrl: string | undefined): string | null {
  if (!repoUrl) return null;
  const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+?)\/?$/);
  return match ? match[1] : null;
}

function formatFreshness(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "shipped today";
  if (days === 1) return "shipped yesterday";
  if (days < 30) return `shipped ${days}d ago`;
  if (days < 365) return `shipped ${Math.floor(days / 30)}mo ago`;
  return `shipped ${Math.floor(days / 365)}y ago`;
}

export async function getProjectDisplayData(products: Product[]) {
  const repoSlugs = products
    .map((p) => repoSlug(p.repoUrl))
    .filter((s): s is string => s !== null);

  const packageNames = products
    .map((p) => p.pypi?.packageName)
    .filter((name): name is string => Boolean(name));

  const [freshness, puzzle, pypiStats] = await Promise.all([
    getRepoFreshness(repoSlugs),
    getWarmerPuzzleNumber(),
    getPypiStats(packageNames),
  ]);

  function datelineFor(product: Product): string | undefined {
    // Warmer's repo is private — its right-edge anchor is the stronger
    // live signal it does have: the daily puzzle number (fail-soft).
    if (product.slug === "warmer") {
      return puzzle ? `puzzle #${puzzle.number} live today` : undefined;
    }
    const slug = repoSlug(product.repoUrl);
    const repoData = slug ? freshness[slug] : undefined;
    return repoData ? formatFreshness(repoData.lastCommitDate) : undefined;
  }

  /**
   * By the card's own package name, never "the PyPI stats" as a single
   * blob — see getPypiStats's header for the misattribution this shape
   * exists to make impossible.
   */
  function pypiStatsFor(product: Product) {
    const name = product.pypi?.packageName;
    return name ? pypiStats[name] : undefined;
  }

  return { datelineFor, pypiStatsFor };
}
