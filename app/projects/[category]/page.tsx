import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectCard } from "@/components/project-card";
import { RevealGroup } from "@/components/reveal-group";
import { TransitionLink } from "@/components/transition-link";
import { products } from "@/content/products";
import { CATEGORIES, type CategoryId } from "@/content/types";
import { getProjectDisplayData } from "@/lib/project-display";

/**
 * Wave 15 — the progressive-disclosure destination: home and /projects both
 * tease a category to 4 cards + "See all N in [Label] →"; this is that
 * page, server-rendered and SEO-indexed, one per category, listing every
 * matching project uncapped. No filter pills here — you're already inside
 * one category; "← All projects" returns to the unfiltered index.
 */

function findCategory(id: string) {
  return CATEGORIES.find((c) => c.id === id);
}

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = findCategory(category);
  if (!cat) return {};
  return {
    title: `${cat.label} projects — Gaurav Gandhi`,
    description: `Every AI product and research tool I've built and shipped in ${cat.label} — each with an honest, sourced case study.`,
  };
}

export default async function CategoryProjectsPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = findCategory(category);
  if (!cat) notFound();

  const matching = products.filter((p) => p.categories.includes(cat.id as CategoryId));
  const { datelineFor, downloads } = await getProjectDisplayData(matching);

  return (
    <main
      id="main"
      className="mx-auto w-full max-w-3xl flex-1 px-6 pt-12 pb-20 md:pt-16 lg:max-w-5xl"
    >
      <div className="flex flex-col items-center text-center">
        <p className="text-muted-foreground font-mono text-xs tracking-eyebrow uppercase">
          <TransitionLink
            href="/projects"
            className="focus-visible:outline-ring -my-2.5 inline-flex min-h-11 items-center transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            ← All projects
          </TransitionLink>
        </p>
        <h1 className="font-heading text-heading mt-6 font-semibold tracking-tight text-foreground">
          {cat.label}
        </h1>
        {/* Count derived, never hand-typed (rule 65b). */}
        <p className="text-muted-foreground mt-3 font-mono text-xs">
          {matching.length} {matching.length === 1 ? "project" : "projects"}
        </p>
      </div>

      <div className="mt-10">
        <RevealGroup
          mode="onview"
          className="project-grid mt-6 grid gap-4 lg:grid-cols-2 lg:gap-5"
        >
          {matching.map((product) => (
            <ProjectCard
              key={product.slug}
              product={product}
              dateline={datelineFor(product)}
              downloads={product.pypi ? downloads : undefined}
              headingLevel="h2"
            />
          ))}
        </RevealGroup>
      </div>

      <p className="mt-12 text-center">
        <TransitionLink
          href="/projects"
          className="text-accent focus-visible:outline-ring -my-2.5 inline-flex min-h-11 items-center text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          ← Back to all projects
        </TransitionLink>
      </p>
    </main>
  );
}
