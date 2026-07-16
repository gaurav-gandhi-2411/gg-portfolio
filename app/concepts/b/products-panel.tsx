import { ExternalLink } from "lucide-react";
import { GithubIcon } from "@/components/icons/brand-icons";
import type { Product } from "@/content/types";
import type { RepoFreshness, TracegaugeDownloads, WarmerPuzzleInfo } from "@/lib/live-data";
import { formatFreshness, repoSlug } from "./format";
import { TechChips } from "./tech-chips";

interface ProductsPanelProps {
  products: Product[];
  freshness: Record<string, RepoFreshness>;
  warmerPuzzle: WarmerPuzzleInfo | null;
  tracegaugeDownloads: TracegaugeDownloads | null;
}

/** Mirrors the liveNoteFor() logic in components/sections/products.tsx —
 *  reimplemented locally rather than imported, per this route's scope. */
function liveNoteFor(
  product: Product,
  freshness: Record<string, RepoFreshness>,
  warmerPuzzle: WarmerPuzzleInfo | null,
  tracegaugeDownloads: TracegaugeDownloads | null
): string | undefined {
  if (product.slug === "warmer" && warmerPuzzle) {
    return `puzzle #${warmerPuzzle.number} live today`;
  }
  if (product.slug === "tracegauge" && tracegaugeDownloads) {
    return `${tracegaugeDownloads.lastWeek.toLocaleString()} installs/wk`;
  }
  const slug = repoSlug(product.repoUrl);
  const repoData = slug ? freshness[slug] : undefined;
  if (repoData) return formatFreshness(repoData.lastCommitDate);
  return undefined;
}

function FlagshipCard({ product, liveNote }: { product: Product; liveNote?: string }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-md border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-mono text-base font-bold text-foreground">{product.name}</h3>
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

      <p className="font-mono text-xs leading-relaxed text-muted-foreground">{product.tagline}</p>

      {product.storyLine && (
        <p className="border-l-2 border-accent/40 pl-3 font-mono text-xs leading-relaxed text-foreground">
          {product.storyLine.text}
        </p>
      )}

      {product.metric && (
        <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
          <span className="font-mono text-sm font-bold text-accent">{product.metric.value}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{product.metric.label}</span>
        </div>
      )}

      {product.secondaryMetric && (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm font-medium text-foreground">
            {product.secondaryMetric.value}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {product.secondaryMetric.label}
          </span>
        </div>
      )}

      {product.techChips && <TechChips chips={product.techChips} />}

      {liveNote && (
        <div className="flex items-center gap-1.5 border-t border-border pt-2.5">
          <span className="size-1.5 rounded-full bg-status-open" aria-hidden />
          <span className="font-mono text-[10px] text-muted-foreground">{liveNote}</span>
        </div>
      )}
    </div>
  );
}

export function ProductsPanel({
  products,
  freshness,
  warmerPuzzle,
  tracegaugeDownloads,
}: ProductsPanelProps) {
  const flagship = products.filter((p) => p.tier === "flagship");
  const secondary = products.filter((p) => p.tier === "secondary");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 font-mono text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          flagship — cat ~/products/flagship/*
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {flagship.map((product) => (
            <FlagshipCard
              key={product.slug}
              product={product}
              liveNote={liveNoteFor(product, freshness, warmerPuzzle, tracegaugeDownloads)}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-mono text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          secondary — ls -la ~/products/secondary
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <caption className="sr-only">Secondary products directory listing</caption>
            <thead>
              <tr className="border-b border-border">
                <th
                  scope="col"
                  className="py-2 pr-3 font-mono text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
                >
                  name
                </th>
                <th
                  scope="col"
                  className="py-2 pr-3 font-mono text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
                >
                  description
                </th>
                <th
                  scope="col"
                  className="py-2 pr-3 font-mono text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
                >
                  metric
                </th>
                <th
                  scope="col"
                  className="py-2 font-mono text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
                >
                  status
                </th>
              </tr>
            </thead>
            <tbody>
              {secondary.map((product) => {
                const href = product.liveUrl ?? product.repoUrl;
                return (
                  <tr key={product.slug} className="border-b border-border/60 align-top">
                    <td className="py-2.5 pr-3 font-mono text-sm font-bold text-foreground">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-accent hover:underline"
                        >
                          {product.name}
                        </a>
                      ) : (
                        product.name
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                      {product.tagline}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-accent">
                      {product.metric?.value ?? product.pypi?.installCommand ?? "—"}
                    </td>
                    <td className="py-2.5 font-mono text-xs text-muted-foreground">
                      {liveNoteFor(product, freshness, warmerPuzzle, tracegaugeDownloads) ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
