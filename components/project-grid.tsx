import { ProjectCard } from "@/components/project-card";
import { ProjectFilter } from "@/components/project-filter";
import { RevealGroup } from "@/components/reveal-group";
import { products } from "@/content/products";
import {
  getRepoFreshness,
  getTracegaugeDownloads,
  getWarmerPuzzleNumber,
} from "@/lib/live-data";

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

/**
 * Wave 13 — the one project grid (all 12 projects, AI/ML-depth order from
 * content/products.ts, category-filterable), shared by the home Work
 * section and /projects. Live freshness datelines and PyPI downloads are
 * ISR fetches that fail soft to no-badge (lib/live-data.ts).
 */
export async function ProjectGrid() {
  const repoSlugs = products
    .map((p) => repoSlug(p.repoUrl))
    .filter((s): s is string => s !== null);

  const [freshness, puzzle, downloads] = await Promise.all([
    getRepoFreshness(repoSlugs),
    getWarmerPuzzleNumber(),
    getTracegaugeDownloads(),
  ]);

  function datelineFor(product: (typeof products)[number]): string | undefined {
    // Warmer's repo is private — its right-edge anchor is the stronger
    // live signal it does have: the daily puzzle number (fail-soft).
    if (product.slug === "warmer") {
      return puzzle ? `puzzle #${puzzle.number} live today` : undefined;
    }
    const slug = repoSlug(product.repoUrl);
    const repoData = slug ? freshness[slug] : undefined;
    return repoData ? formatFreshness(repoData.lastCommitDate) : undefined;
  }

  return (
    <ProjectFilter cats={products.map((p) => ({ slug: p.slug, categories: p.categories }))}>
      <RevealGroup
        mode="onview"
        className="project-grid mt-8 grid gap-4 lg:grid-cols-2 lg:gap-5"
      >
        {products.map((product) => (
          <ProjectCard
            key={product.slug}
            product={product}
            dateline={datelineFor(product)}
            downloads={product.pypi ? downloads : undefined}
          />
        ))}
      </RevealGroup>
    </ProjectFilter>
  );
}
