import type { Metadata } from "next";
import { ProjectGrid } from "@/components/project-grid";
import { ProjectSearch } from "@/components/project-search";
import { SearchMethodology } from "@/components/search-methodology";
import { TransitionLink } from "@/components/transition-link";
import { liveProductCount, products } from "@/content/products";

export const metadata: Metadata = {
  title: "All projects — Gaurav Gandhi",
  description:
    "Every AI product and research tool I've built and shipped — each with an honest, sourced case study.",
};

/**
 * Wave 13 — the full project index shares its grid, ordering, and
 * category filters with the home Work section (components/project-grid.tsx).
 * This page stays as the stable deep-link target; a filtered view is
 * shareable from either place via ?category=.
 */
export default function ProjectsPage() {
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-3xl flex-1 px-6 pt-12 pb-20 md:pt-16 lg:max-w-5xl"
    >
      <div className="flex flex-col items-center text-center">
        <h1 className="font-heading text-heading font-semibold tracking-tight text-foreground">
          All projects
        </h1>
        {/* Both counts derived, never hand-typed (rule 65b). */}
        <p className="text-muted-foreground mt-3 font-mono text-xs">
          {products.length} projects · {liveProductCount(products)} live today
        </p>
        <p className="text-muted-foreground mt-5 max-w-measure text-base leading-relaxed">
          Everything I&apos;ve built and shipped, from daily-use products to research tools.
          Each one has a case study explaining the problem, the architecture, and the honest
          numbers — including the ones that didn&apos;t flatter me.
        </p>
      </div>

      {/* BL-9 — /projects is the uncapped "see all 13" destination (the home
          teaser only ever shows 4), so it's the one place a full re-rank
          over all 13 is meaningful. See components/project-search.tsx's own
          header for the two-tier design and why it lives here rather than
          on home. */}
      <div className="mt-8">
        <ProjectSearch products={products} />
        <SearchMethodology />
      </div>

      <div className="mt-10">
        <ProjectGrid cardHeadingLevel="h2" />
      </div>

      <p className="mt-12 text-center">
        <TransitionLink
          href="/"
          className="text-accent focus-visible:outline-ring -my-2.5 inline-flex min-h-11 items-center text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          ← Back to home
        </TransitionLink>
      </p>
    </main>
  );
}
