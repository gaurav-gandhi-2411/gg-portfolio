import { SectionMark } from "@/components/section-mark";
import { WorkCarousel, type CarouselSlide } from "@/components/work-carousel";
import { HeatToyShell } from "@/components/heat-toy-shell";
import { products } from "@/content/products";
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
 * Wave 5: all work detail lives here, presented as a sliding carousel
 * (flagship products lead, secondary follow) instead of stacked spreads —
 * one calm treatment for every product rather than a size hierarchy.
 * tracegauge keeps its colophon footnote (a pip install doesn't fit a
 * metric-shaped card). The Warmer heat toy sits directly below as an annex
 * to the Warmer entry — its engine, with context, out of the hero.
 */
export async function Products() {
  const repoSlugs = products
    .map((p) => repoSlug(p.repoUrl))
    .filter((s): s is string => s !== null);

  const [freshness, puzzle] = await Promise.all([
    getRepoFreshness(repoSlugs),
    getWarmerPuzzleNumber(),
  ]);

  function datelineFor(repoUrl: string | undefined): string | undefined {
    const slug = repoSlug(repoUrl);
    const repoData = slug ? freshness[slug] : undefined;
    return repoData ? formatFreshness(repoData.lastCommitDate) : undefined;
  }

  const ordered = [
    ...products.filter((p) => p.tier === "flagship"),
    ...products.filter((p) => p.tier === "secondary" && p.slug !== "tracegauge"),
  ];

  const slides: CarouselSlide[] = ordered.map((product) => ({
    product,
    dateline: datelineFor(product.repoUrl),
  }));

  return (
    <section id="products" className="mx-auto w-full max-w-4xl px-6 py-16 md:py-24">
      <SectionMark index="02" label="Work" />

      <div className="mt-10">
        <WorkCarousel slides={slides} />
      </div>

      {/* Warmer's engine, playable — annexed to the Warmer entry, not the
          hero. Intro copy is GG's exact wording, verbatim. */}
      <div className="mt-16 max-w-xl border-t border-border pt-10">
        <p className="text-muted-foreground text-xs tracking-[0.25em] uppercase">
          From Warmer&apos;s engine
          {puzzle ? (
            <span className="font-mono normal-case tracking-normal"> — puzzle #{puzzle.number} today</span>
          ) : null}
        </p>
        <p className="mt-4 text-lg leading-relaxed text-foreground">
          I&apos;ve hidden one word. Type a guess and I&apos;ll tell you how close you are — this
          is the exact matching engine behind Warmer, my daily word game.
        </p>
        <div className="mt-6">
          <HeatToyShell />
        </div>
      </div>
    </section>
  );
}
