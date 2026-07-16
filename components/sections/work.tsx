import { InlineLink } from "@/components/inline-link";
import { Section } from "@/components/section";
import { HeatToyShell } from "@/components/heat-toy-shell";
import { liveProductCount, products } from "@/content/products";
import {
  getRepoFreshness,
  getTracegaugeDownloads,
  getWarmerPuzzleNumber,
} from "@/lib/live-data";
import type { Product } from "@/content/types";

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

function ProductLinks({ product }: { product: Product }) {
  return (
    <span className="flex shrink-0 gap-5 text-sm">
      {product.liveUrl && <InlineLink href={product.liveUrl}>Live ↗</InlineLink>}
      {product.repoUrl && <InlineLink href={product.repoUrl}>Source ↗</InlineLink>}
    </span>
  );
}

/**
 * Wave 6: the carousel is gone. Nine products behind five clicks was the
 * wrong pattern for an audience that scans (audit finding 6 — plus its
 * visible native scrollbar and uneven slide heights). All work is now flat
 * and scannable in one pass: three flagship entries with room to breathe,
 * then a compact index of everything else — including tracegauge, out of
 * the footer it was hiding in. Live freshness datelines stay (real data,
 * fail-soft: rows without a public repo simply show none). The Warmer heat
 * toy keeps its annex at the end of the section — the page's one signature
 * interaction, still zero eager bytes until touched.
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

  function datelineFor(repoUrl: string | undefined): string | undefined {
    const slug = repoSlug(repoUrl);
    const repoData = slug ? freshness[slug] : undefined;
    return repoData ? formatFreshness(repoData.lastCommitDate) : undefined;
  }

  const flagship = products.filter((p) => p.tier === "flagship");
  const index = products.filter((p) => p.tier === "secondary");

  return (
    <Section
      id="work"
      label="Work"
      labelNote={`${liveProductCount(products)} products live`}
    >
      {/* Flagship — generous editorial entries */}
      <div className="flex flex-col gap-10">
        {flagship.map((product) => {
          // Warmer's repo is private, so it has no freshness dateline — its
          // right-edge anchor is the stronger live signal it does have: the
          // daily puzzle number (fail-soft like every live figure).
          const dateline =
            product.slug === "warmer"
              ? puzzle
                ? `puzzle #${puzzle.number} live today`
                : undefined
              : datelineFor(product.repoUrl);
          return (
            <article key={product.slug} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h3 className="font-heading text-title font-semibold text-foreground">
                  {product.name}
                </h3>
                {dateline && (
                  <span className="text-muted-foreground font-mono text-xs">{dateline}</span>
                )}
              </div>

              <p className="text-muted-foreground max-w-measure text-base leading-relaxed">
                {product.tagline}
              </p>

              {product.metric && (
                <p className="text-sm">
                  <span className="font-mono font-medium text-foreground">
                    {product.metric.value}
                  </span>{" "}
                  <span className="text-muted-foreground">— {product.metric.label}</span>
                </p>
              )}

              {product.storyLine && (
                <p className="text-muted-foreground max-w-measure text-sm leading-relaxed">
                  {product.storyLine.text}
                </p>
              )}

              <ProductLinks product={product} />
            </article>
          );
        })}
      </div>

      {/* Index — everything else, one scan */}
      <ul className="mt-14 flex flex-col">
        {index.map((product) => (
          <li
            key={product.slug}
            className="border-border/40 flex flex-col gap-1.5 border-t py-4 first:border-t-0"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h3 className="text-base font-medium text-foreground">{product.name}</h3>
              <span className="flex items-baseline gap-5">
                {product.slug === "tracegauge" && (
                  <span className="text-muted-foreground font-mono text-xs">
                    pip install tracegauge
                    {downloads ? ` · ${downloads.lastWeek.toLocaleString()}/wk` : ""}
                  </span>
                )}
                <ProductLinks product={product} />
              </span>
            </div>
            <p className="text-muted-foreground max-w-measure text-sm leading-relaxed">
              {product.tagline}
            </p>
            {product.metric && (
              <p className="text-muted-foreground font-mono text-xs">
                {product.metric.value} — {product.metric.label}
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Warmer's engine, playable — the page's one interactive signature. */}
      <div className="border-border/40 mt-12 max-w-xl border-t pt-8">
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
          I&apos;ve hidden one word. Type a guess and I&apos;ll tell you how close you are — this
          is the exact matching engine behind Warmer, my daily word game.
        </p>
        <div className="mt-5">
          <HeatToyShell />
        </div>
      </div>
    </Section>
  );
}
