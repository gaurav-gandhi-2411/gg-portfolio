import { RevealGroup } from "@/components/reveal-group";
import { Section } from "@/components/section";
import { HeatToyShell } from "@/components/heat-toy-shell";
import { WorkSlider, type WorkSlideData } from "@/components/work-slider";
import { liveProductCount, products } from "@/content/products";
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
 * Wave 9 — production integration of wave 8's Lab 3 (momentum slider) and
 * Lab 5 (scroll-linked figure draw-in, merged into the slider's cards per
 * GG's integration map). Replaces wave 6's flat flagship-entries + index
 * list. This server component still owns all real data (freshness, live
 * puzzle number, tracegauge downloads) — the client-side WorkSlider
 * receives fully-resolved slide data as props, same division of labor
 * wave 5/6/7's carousel/list used.
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

  const ordered = [
    ...products.filter((p) => p.tier === "flagship"),
    ...products.filter((p) => p.tier === "secondary"),
  ];

  const slides: WorkSlideData[] = ordered.map((product) => ({
    product,
    // Warmer's repo is private, so it has no freshness dateline — its
    // right-edge anchor is the stronger live signal it does have: the
    // daily puzzle number (fail-soft like every live figure).
    dateline:
      product.slug === "warmer"
        ? puzzle
          ? `puzzle #${puzzle.number} live today`
          : undefined
        : datelineFor(product.repoUrl),
    tracegaugeDownloads: product.slug === "tracegauge" ? downloads?.lastWeek : undefined,
  }));

  return (
    <Section
      id="work"
      label="Work"
      labelNote={`${liveProductCount(products)} products live`}
    >
      <WorkSlider slides={slides} />

      {/* Warmer's engine, playable — the page's one interactive signature. */}
      <RevealGroup
        as="div"
        mode="onview"
        className="border-border/40 mt-12 flex max-w-xl flex-col gap-4 border-t pt-8"
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
