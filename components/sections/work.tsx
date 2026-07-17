import { EvalFigure } from "@/components/eval-figure";
import { InlineLink } from "@/components/inline-link";
import { RevealGroup } from "@/components/reveal-group";
import { Section } from "@/components/section";
import { HeatToyShell } from "@/components/heat-toy-shell";
import { TriageiqClassifyDisclosure } from "@/components/triageiq-classify-disclosure";
import { workLede } from "@/content/about";
import { liveProductCount, products } from "@/content/products";
import type { Product } from "@/content/types";
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
 * Wave 11 — wow moment #3. The slider is retired after two passes of GG
 * feedback ("can't slide it", then "classy modern is not there"): eleven
 * heterogeneous cards fought the pattern both times, and the brief's own
 * bar — usability + beauty over the slider concept — points at a crafted
 * static presentation instead. Three flagship showcase cards carry the
 * concentrated craft (eval-figure rail, hover lift with the tokenized
 * indigo shadow, storyline); the remaining projects sit in a quiet
 * two-column index grid. Everything is server-rendered except the
 * existing EvalFigure draw-in and the TriageIQ disclosure — deleting the
 * slider removes its whole client bundle.
 */
export async function Work() {
  const repoSlugs = products
    .map((p) => repoSlug(p.repoUrl))
    .filter((s): s is string => s !== null);

  const [freshness, puzzle, downloads] = await Promise.all([
    getRepoFreshness(repoSlugs),
    getWarmerPuzzleNumber(),
    getTracegaugeDownloads(),
  ]);

  function datelineFor(product: Product): string | undefined {
    // Warmer's repo is private, so it has no freshness dateline — its
    // right-edge anchor is the stronger live signal it does have: the
    // daily puzzle number (fail-soft like every live figure).
    if (product.slug === "warmer") {
      return puzzle ? `puzzle #${puzzle.number} live today` : undefined;
    }
    const slug = repoSlug(product.repoUrl);
    const repoData = slug ? freshness[slug] : undefined;
    return repoData ? formatFreshness(repoData.lastCommitDate) : undefined;
  }

  const flagship = products.filter((p) => p.tier === "flagship");
  const secondary = products.filter((p) => p.tier === "secondary");

  return (
    <Section
      id="work"
      label="Work"
      wide
      // Both counts derived, never hand-typed (rule 65b).
      labelNote={`${products.length} projects · ${liveProductCount(products)} live`}
      // Sentences 2–3 of the wave-10-approved intro paragraph — they
      // describe exactly what follows, so they open the section.
      lede={workLede}
    >
      {/* Flagship showcase — the craft concentrates here. */}
      <RevealGroup mode="onview" className="flex flex-col gap-6">
        {flagship.map((product) => {
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
                      {product.name}
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

                  <div className="mt-5 flex gap-5 text-sm">
                    {product.liveUrl && <InlineLink href={product.liveUrl}>Live ↗</InlineLink>}
                    {product.repoUrl && <InlineLink href={product.repoUrl}>Source ↗</InlineLink>}
                  </div>
                </div>

                {product.figure && product.metric && (
                  <div className="mt-6 md:mt-0 md:self-center md:justify-self-end">
                    <EvalFigure figure={product.figure} label={product.metric.label} />
                  </div>
                )}
              </div>

              {product.slug === "triageiq" && <TriageiqClassifyDisclosure />}
            </article>
          );
        })}
      </RevealGroup>

      <p className="text-muted-foreground mt-14 text-center font-mono text-xs tracking-eyebrow uppercase">
        More projects
      </p>

      {/* Secondary index — same card language, quieter. */}
      <RevealGroup mode="onview" className="mt-6 grid gap-4 sm:grid-cols-2">
        {secondary.map((product) => {
          const dateline = datelineFor(product);
          return (
            <article
              key={product.slug}
              className="border-border/40 bg-card/40 hover:border-accent/40 hover:shadow-card-hover flex h-full flex-col rounded-lg border p-5 transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="font-medium text-foreground">{product.name}</h3>
                {dateline && (
                  <span className="text-muted-foreground font-mono text-xs">{dateline}</span>
                )}
              </div>

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

              <div className="mt-auto flex gap-5 pt-4 text-sm">
                {product.liveUrl && <InlineLink href={product.liveUrl}>Live ↗</InlineLink>}
                {product.repoUrl && <InlineLink href={product.repoUrl}>Source ↗</InlineLink>}
              </div>
            </article>
          );
        })}
      </RevealGroup>

      {/* Warmer's engine, playable — the page's one interactive signature. */}
      <RevealGroup
        as="div"
        mode="onview"
        className="border-border/40 mx-auto mt-16 flex max-w-xl flex-col gap-4 border-t pt-10"
      >
        <div>
          <p className="text-muted-foreground text-xs tracking-eyebrow uppercase">
            From Warmer&apos;s engine
            {puzzle ? (
              <span className="font-mono normal-case tracking-normal">
                {" "}
                — puzzle #{puzzle.number} today
              </span>
            ) : null}
          </p>
          <p className="mt-4 max-w-measure text-base leading-relaxed text-foreground">
            I&apos;ve hidden one word. Type a guess and I&apos;ll tell you how close you are —
            this is the exact matching engine behind Warmer, my daily word game, now shown
            as an actual embedding-space plot.
          </p>
        </div>
        <div>
          <HeatToyShell />
        </div>
      </RevealGroup>
    </Section>
  );
}
