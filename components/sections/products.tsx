import { SectionMark } from "@/components/section-mark";
import { FlagshipFeature } from "@/components/flagship-feature";
import { SecondaryIndex } from "@/components/secondary-index";
import { products } from "@/content/products";
import { getRepoFreshness } from "@/lib/live-data";

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

export async function Products() {
  const repoSlugs = products
    .map((p) => repoSlug(p.repoUrl))
    .filter((s): s is string => s !== null);

  const freshness = await getRepoFreshness(repoSlugs);

  function datelineFor(repoUrl: string | undefined): string | undefined {
    const slug = repoSlug(repoUrl);
    const repoData = slug ? freshness[slug] : undefined;
    return repoData ? formatFreshness(repoData.lastCommitDate) : undefined;
  }

  const flagship = products.filter((p) => p.tier === "flagship");
  // tracegauge gets its own colophon/footnote treatment (its pip install
  // command doesn't fit an editorial index row the way a benchmark metric
  // does) — everything else in the secondary tier renders as usual.
  const secondary = products.filter((p) => p.tier === "secondary" && p.slug !== "tracegauge");

  return (
    <section id="products" className="mx-auto w-full max-w-4xl px-6 py-16">
      <SectionMark index="02" label="Work" />

      <div className="mt-12 flex flex-col gap-16">
        {flagship.map((product, i) => (
          <FlagshipFeature
            key={product.slug}
            product={product}
            order={i + 1}
            dateline={datelineFor(product.repoUrl)}
          />
        ))}
      </div>

      <SecondaryIndex products={secondary} startingIndex={4} />
    </section>
  );
}
