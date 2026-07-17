import type { Metadata } from "next";
import Link from "next/link";
import { InlineLink } from "@/components/inline-link";
import { RevealGroup } from "@/components/reveal-group";
import { liveProductCount, products } from "@/content/products";
import { getTracegaugeDownloads } from "@/lib/live-data";

export const metadata: Metadata = {
  title: "All projects — Gaurav Gandhi",
  description:
    "Every AI product and research tool I've built and shipped — each with an honest, sourced case study.",
};

/**
 * Wave 12 — the full project index (maninder's /projects structural
 * pattern). One card per project, every card links to its case study;
 * clean and scannable, no interactive weight. Same card language as the
 * home showcase, one size quieter.
 */
export default async function ProjectsPage() {
  const downloads = await getTracegaugeDownloads();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 pt-12 pb-20 md:pt-16">
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

      <RevealGroup mode="onview" className="mt-12 grid gap-4 sm:grid-cols-2">
        {products.map((product) => (
          <article
            key={product.slug}
            className="border-border/40 bg-card/40 hover:border-accent/40 hover:shadow-card-hover flex h-full flex-col rounded-lg border p-5 transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <h2 className="font-medium text-foreground">
              <Link
                href={`/work/${product.slug}`}
                className="focus-visible:outline-ring transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
              >
                {product.name}
              </Link>
            </h2>

            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {product.tagline}
            </p>

            {product.metric && (
              <p className="mt-3 text-sm">
                <span className="font-mono font-medium text-foreground">
                  {product.metric.value}
                </span>{" "}
                <span className="text-muted-foreground">— {product.metric.label}</span>
              </p>
            )}

            {product.slug === "tracegauge" && (
              <div className="mt-3 flex flex-col gap-2">
                <code className="border-border/60 bg-background text-foreground w-fit rounded-md border px-3 py-1.5 font-mono text-xs">
                  pip install tracegauge
                </code>
                {downloads?.lastWeek !== undefined && (
                  <p className="text-muted-foreground font-mono text-xs">
                    {downloads.lastWeek.toLocaleString()} downloads last week
                  </p>
                )}
              </div>
            )}

            <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 pt-4 text-sm">
              <Link
                href={`/work/${product.slug}`}
                className="text-accent focus-visible:outline-ring font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
              >
                Case study →
              </Link>
              {product.liveUrl && <InlineLink href={product.liveUrl}>Live ↗</InlineLink>}
              {product.repoUrl && <InlineLink href={product.repoUrl}>Source ↗</InlineLink>}
            </div>
          </article>
        ))}
      </RevealGroup>

      <p className="mt-12 text-center">
        <Link
          href="/"
          className="text-accent focus-visible:outline-ring text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
