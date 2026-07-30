import { ProjectCard } from "@/components/project-card";
import { ProjectFilter } from "@/components/project-filter";
import { RevealGroup } from "@/components/reveal-group";
import { products } from "@/content/products";
import { getProjectDisplayData } from "@/lib/project-display";

/**
 * Wave 13 — the one project grid (all 13 projects, AI/ML-depth order from
 * content/products.ts, category-filterable), shared by the home Work
 * section and /projects. Live freshness datelines and PyPI downloads are
 * ISR fetches that fail soft to no-badge (lib/live-data.ts via
 * lib/project-display.ts).
 *
 * Wave 15 — capAllAt4 adds the home teaser behavior (4 cards + "See all 13
 * →" to /projects); /projects itself stays uncapped for "All" since it IS
 * the see-all destination. Category filters cap on both pages regardless
 * (their own destination is /projects/[category]).
 */
export async function ProjectGrid({
  cardHeadingLevel = "h3",
  capAllAt4 = false,
}: {
  /** See ProjectCard — h3 on home (under the section h2), h2 on /projects. */
  cardHeadingLevel?: "h2" | "h3";
  capAllAt4?: boolean;
} = {}) {
  const { datelineFor, downloads } = await getProjectDisplayData(products);

  return (
    <ProjectFilter
      cats={products.map((p) => ({ slug: p.slug, categories: p.categories }))}
      capAllAt4={capAllAt4}
    >
      <RevealGroup
        mode="onview"
        // Columns engage at lg, exactly where Section's width step does —
        // container is 5xl there (2026-07-30: both moved from xl to lg
        // together, see section.tsx — the original design-review finding-6
        // objection was that two columns would squeeze the cards while the
        // container was still 3xl at that breakpoint, which no longer
        // applies now that the container itself steps up at the same point).
        // mt-6, not mt-8: the filter's now-visible result counter (wave 14)
        // already carries mt-4 of its own above this grid.
        className="project-grid mt-6 grid gap-4 lg:grid-cols-2 lg:gap-5"
      >
        {products.map((product) => (
          <ProjectCard
            key={product.slug}
            product={product}
            dateline={datelineFor(product)}
            downloads={product.pypi ? downloads : undefined}
            headingLevel={cardHeadingLevel}
          />
        ))}
      </RevealGroup>
    </ProjectFilter>
  );
}
