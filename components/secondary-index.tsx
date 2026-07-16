import { ExternalLink } from "lucide-react";
import { GithubIcon } from "@/components/icons/brand-icons";
import type { Product } from "@/content/types";

/**
 * Secondary products rendered as a plain editorial index — one row per
 * product (number, title, tagline, headline figure, live/repo links) — with
 * no card chrome, as distinct from the flagship spreads. Live/GitHub links
 * render as small icon links per row (not a plain-text "here"), matching the
 * flagship spreads' link prominence for the "engineer" audience segment.
 */
export function SecondaryIndex({
  products,
  startingIndex,
}: {
  products: Product[];
  startingIndex: number;
}) {
  return (
    <ol className="divide-border mt-6 divide-y border-t border-border">
      {products.map((product, i) => (
        <li
          key={product.slug}
          className="grid grid-cols-12 items-baseline gap-x-6 gap-y-2 py-6"
        >
          <span
            aria-hidden="true"
            className="font-heading text-muted-foreground col-span-2 text-lg md:col-span-1"
          >
            {String(startingIndex + i).padStart(2, "0")}
          </span>
          <span className="font-heading col-span-10 text-lg font-semibold md:col-span-3">
            {product.name}
          </span>
          <span className="text-muted-foreground col-span-12 text-sm md:col-span-5">
            {product.tagline}
          </span>
          {product.metric ? (
            <span className="col-span-12 text-sm tabular-nums md:col-span-2 md:text-right">
              {product.metric.value}
            </span>
          ) : (
            <span aria-hidden="true" className="hidden md:col-span-2 md:block" />
          )}
          {product.liveUrl || product.repoUrl ? (
            <span className="col-span-12 col-start-2 flex gap-4 md:col-span-11 md:col-start-2">
              {product.liveUrl ? (
                <a
                  href={product.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${product.name} — view live`}
                  className="text-muted-foreground hover:text-accent inline-flex items-center gap-1 text-xs uppercase transition-colors"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Live
                </a>
              ) : null}
              {product.repoUrl ? (
                <a
                  href={product.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${product.name} — view source`}
                  className="text-muted-foreground hover:text-accent inline-flex items-center gap-1 text-xs uppercase transition-colors"
                >
                  <GithubIcon className="size-3.5" aria-hidden />
                  Source
                </a>
              ) : null}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
