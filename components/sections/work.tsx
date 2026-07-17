import Link from "next/link";
import { EvalFigure } from "@/components/eval-figure";
import { InlineLink } from "@/components/inline-link";
import { RevealGroup } from "@/components/reveal-group";
import { Section } from "@/components/section";
import { workLede } from "@/content/about";
import { liveProductCount, products, showcaseSlugs } from "@/content/products";
import type { Product } from "@/content/types";
import { getRepoFreshness, getWarmerPuzzleNumber } from "@/lib/live-data";

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
 * Wave 12 — the home page now TEASES (maninder's structural pattern): the
 * five showcase projects, each linking to its /work/[slug] case study,
 * with the full set one click away on /projects. The wave-11 card craft
 * (eval-figure rail, tokenized hover lift) carries over unchanged; the
 * heat toy and TriageIQ classifier moved to their products' case-study
 * pages, where the teaching happens.
 */
export async function Work() {
  const showcase = showcaseSlugs
    .map((slug) => products.find((p) => p.slug === slug))
    .filter((p): p is Product => p !== undefined);

  const repoSlugs = showcase
    .map((p) => repoSlug(p.repoUrl))
    .filter((s): s is string => s !== null);

  const [freshness, puzzle] = await Promise.all([
    getRepoFreshness(repoSlugs),
    getWarmerPuzzleNumber(),
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

  return (
    <Section
      id="work"
      label="Selected work"
      wide
      // Both counts derived, never hand-typed (rule 65b).
      labelNote={`${showcase.length} of ${products.length} projects · ${liveProductCount(products)} live`}
      lede={workLede}
    >
      <RevealGroup mode="onview" className="flex flex-col gap-6">
        {showcase.map((product) => {
          const dateline = datelineFor(product);
          return (
            <article
              key={product.slug}
              className="border-border/40 bg-card/60 hover:border-accent/50 hover:shadow-card-hover rounded-xl border p-6 transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 md:p-8 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <div className="md:grid md:grid-cols-[1fr_13rem] md:gap-x-8">
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <h3 className="font-heading text-title font-semibold text-foreground">
                      <Link
                        href={`/work/${product.slug}`}
                        className="focus-visible:outline-ring transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                      >
                        {product.name}
                      </Link>
                    </h3>
                    {dateline && (
                      <span className="text-muted-foreground font-mono text-xs">{dateline}</span>
                    )}
                  </div>

                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed md:text-base">
                    {product.tagline}
                  </p>

                  {product.storyLine && (
                    <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                      {product.storyLine.text}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    <Link
                      href={`/work/${product.slug}`}
                      className="text-accent focus-visible:outline-ring font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                    >
                      Read the case study →
                    </Link>
                    {product.liveUrl && <InlineLink href={product.liveUrl}>Live ↗</InlineLink>}
                    {product.repoUrl && <InlineLink href={product.repoUrl}>Source ↗</InlineLink>}
                  </div>
                </div>

                {product.figure && product.metric && (
                  <div className="mt-6 md:mt-0 md:self-center md:justify-self-end">
                    <EvalFigure figure={product.figure} label={product.metric.label} />
                  </div>
                )}

                {!product.figure && product.metric && (
                  <p className="mt-6 text-sm md:mt-0 md:max-w-[13rem] md:self-center md:justify-self-end md:text-right">
                    <span className="font-mono font-medium text-foreground">
                      {product.metric.value}
                    </span>{" "}
                    <span className="text-muted-foreground">— {product.metric.label}</span>
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </RevealGroup>

      <p className="mt-10 text-center">
        <Link
          href="/projects"
          className="border-border/60 bg-card/60 hover:border-accent/60 hover:bg-card focus-visible:outline-ring inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium text-foreground transition-[transform,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          View all {products.length} projects →
        </Link>
      </p>
    </Section>
  );
}
