import "server-only";

import type { Product } from "@/content/types";
import { getRepoFreshness, getTracegaugeDownloads, getWarmerPuzzleNumber } from "@/lib/live-data";

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

  const [freshness, puzzle, downloads] = await Promise.all([
    getRepoFreshness(repoSlugs),
    getWarmerPuzzleNumber(),
    getTracegaugeDownloads(),
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

  return { datelineFor, downloads };
}
