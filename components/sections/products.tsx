import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { GithubIcon } from "@/components/icons/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CursorGlow } from "@/components/cursor-glow";
import { products } from "@/content/products";
import type { Product } from "@/content/types";
import {
  getRepoFreshness,
  getTracegaugeDownloads,
  getWarmerPuzzleNumber,
} from "@/lib/live-data";

const STAGGER_STEP_MS = 70;
const STAGGER_MAX_MS = 280;

function staggerDelayMs(index: number): number {
  return Math.min(index * STAGGER_STEP_MS, STAGGER_MAX_MS);
}

const STAGGER_CLASSES =
  "opacity-0 translate-y-3 transition-[opacity,transform] duration-500 ease-out " +
  "group-data-[visible=true]/reveal:opacity-100 group-data-[visible=true]/reveal:translate-y-0 " +
  "motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none";

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

function ProductCard({
  product,
  flagship,
  liveNote,
  index,
}: {
  product: Product;
  flagship: boolean;
  liveNote?: string;
  index: number;
}) {
  const delayMs = staggerDelayMs(index);

  const card = (
    <Card
      style={flagship ? undefined : { transitionDelay: `${delayMs}ms` }}
      className={`flex h-full flex-col gap-3 p-6 transition-shadow duration-300 hover:ring-accent/40 hover:shadow-[0_8px_28px_-16px_color-mix(in_oklab,var(--accent)_45%,transparent)] ${flagship ? "gap-4 p-8" : STAGGER_CLASSES}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className={
            flagship
              ? "font-heading text-2xl font-semibold text-foreground"
              : "font-heading text-lg font-semibold text-foreground"
          }
        >
          {product.name}
        </h3>
        <div className="flex shrink-0 gap-2">
          {product.liveUrl && (
            <a
              href={product.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${product.name} live demo`}
              className="text-muted-foreground transition-colors hover:text-accent"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
          {product.repoUrl && (
            <a
              href={product.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${product.name} GitHub repo`}
              className="text-muted-foreground transition-colors hover:text-accent"
            >
              <GithubIcon className="size-4" />
            </a>
          )}
        </div>
      </div>

      <p className={`text-muted-foreground ${flagship ? "text-base" : "text-sm"}`}>
        {product.tagline}
      </p>

      {product.storyLine && (
        <p className="border-l-2 border-accent/40 pl-3 text-sm leading-relaxed text-foreground">
          {product.storyLine.text}
        </p>
      )}

      {product.metric && (
        <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
          <span className="font-mono text-sm font-semibold text-accent">
            {product.metric.value}
          </span>
          <span className="text-xs text-muted-foreground">{product.metric.label}</span>
        </div>
      )}

      {product.secondaryMetric && (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm font-medium text-foreground">
            {product.secondaryMetric.value}
          </span>
          <span className="text-xs text-muted-foreground">{product.secondaryMetric.label}</span>
        </div>
      )}

      {product.pypi && (
        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
          <Image
            src={product.pypi.badgeUrl}
            alt={`${product.pypi.packageName} PyPI version`}
            width={100}
            height={20}
            unoptimized
          />
          <code className="rounded-md bg-secondary px-2 py-1 font-mono text-xs text-secondary-foreground">
            {product.pypi.installCommand}
          </code>
        </div>
      )}

      {product.techChips && (
        <div className="flex flex-wrap gap-1.5">
          {product.techChips.map((chip) => (
            <Badge key={chip} variant="outline" className="font-mono text-[10px]">
              {chip}
            </Badge>
          ))}
        </div>
      )}

      {liveNote && (
        <div className="flex items-center gap-1.5 border-t border-border pt-2.5">
          <span className="size-1.5 rounded-full bg-status-open" aria-hidden />
          <span className="font-mono text-[11px] text-muted-foreground">{liveNote}</span>
        </div>
      )}
    </Card>
  );

  // Cursor-glow micro-interaction: flagship cards only, per scope. Stagger
  // lives on whichever element is outermost (CursorGlow's wrapper div for
  // flagship, the Card itself otherwise) so it composes with h-full grid
  // stretch either way.
  return flagship ? (
    <CursorGlow className={`h-full ${STAGGER_CLASSES}`} style={{ transitionDelay: `${delayMs}ms` }}>
      {card}
    </CursorGlow>
  ) : (
    card
  );
}

export async function Products() {
  const repoSlugs = products
    .map((p) => repoSlug(p.repoUrl))
    .filter((s): s is string => s !== null);

  const [freshness, tracegaugeDownloads, warmerPuzzle] = await Promise.all([
    getRepoFreshness(repoSlugs),
    getTracegaugeDownloads(),
    getWarmerPuzzleNumber(),
  ]);

  function liveNoteFor(product: Product): string | undefined {
    if (product.slug === "warmer" && warmerPuzzle) {
      return `Puzzle #${warmerPuzzle.number} live today`;
    }
    if (product.slug === "tracegauge" && tracegaugeDownloads) {
      return `${tracegaugeDownloads.lastWeek.toLocaleString()} PyPI downloads this week`;
    }
    const slug = repoSlug(product.repoUrl);
    const repoData = slug ? freshness[slug] : undefined;
    if (repoData) return formatFreshness(repoData.lastCommitDate);
    return undefined;
  }

  const flagship = products.filter((p) => p.tier === "flagship");
  const secondary = products.filter((p) => p.tier === "secondary");

  return (
    <section id="products" className="mx-auto w-full max-w-4xl px-6 py-16">
      <h2 className="font-heading text-sm font-semibold tracking-widest text-accent uppercase">
        Products
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {flagship.map((product, index) => (
          <ProductCard
            key={product.slug}
            product={product}
            flagship
            liveNote={liveNoteFor(product)}
            index={index}
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {secondary.map((product, index) => (
          <ProductCard
            key={product.slug}
            product={product}
            flagship={false}
            liveNote={liveNoteFor(product)}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}
