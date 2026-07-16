import { ExternalLink } from "lucide-react";
import { GithubIcon } from "@/components/icons/brand-icons";
import { InlineLink } from "@/components/inline-link";
import { cn } from "@/lib/utils";
import type { Product } from "@/content/types";

/**
 * One flagship product presented as a magazine feature spread: name, dek,
 * a pull-quote treatment of the storyLine (the concept's signature element),
 * the headline metric as a standalone giant stat, and a dateline ("shipped
 * Nd ago") sourced from live GitHub data. Alternates text/stat column order
 * by `order` to keep the grid asymmetric across the three flagship spreads
 * rather than repeating one fixed layout. Live-demo/GitHub links render as
 * a distinct button-like row (icon + label), not a plain text link, per the
 * "engineer" audience pass — the person who wants to click through should
 * never have to hunt for it.
 */
export function FlagshipFeature({
  product,
  order,
  dateline,
}: {
  product: Product;
  order: number;
  dateline?: string;
}) {
  const flipped = order % 2 === 0;

  return (
    <article
      className={cn(
        "grid grid-cols-12 gap-x-6 gap-y-10 border-t border-border pt-16",
        order === 1 && "border-t-0 pt-0"
      )}
    >
      <div
        className={cn(
          "col-span-12 lg:col-span-7",
          flipped ? "lg:order-2 lg:col-start-6" : "lg:col-start-1"
        )}
      >
        <p className="text-muted-foreground flex flex-wrap items-baseline gap-x-3 text-xs tracking-[0.3em] uppercase">
          <span>Flagship — {String(order).padStart(2, "0")} / 03</span>
          {dateline ? <span className="font-mono normal-case">{dateline}</span> : null}
        </p>
        <h3 className="font-heading mt-3 text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] font-black">
          {product.name}
        </h3>
        <p className="font-heading text-muted-foreground mt-6 max-w-[46ch] text-[clamp(1.25rem,2.2vw,1.75rem)] italic">
          {product.tagline}
        </p>

        {product.storyLine ? (
          <blockquote className="border-accent relative mt-10 max-w-[48ch] border-l-2 pl-8">
            <span
              aria-hidden="true"
              className="font-heading text-accent absolute -top-8 -left-1 text-[6rem] leading-none select-none"
            >
              &ldquo;
            </span>
            <p className="font-heading text-[clamp(1.375rem,2.4vw,2rem)] leading-snug font-normal">
              {product.storyLine.text}
            </p>
          </blockquote>
        ) : null}

        {product.techChips ? (
          <p className="text-muted-foreground mt-8 flex flex-wrap gap-x-3 gap-y-2 text-xs tracking-wider uppercase">
            {product.techChips.map((chip, i) => (
              <span key={chip}>
                {i > 0 ? <span aria-hidden="true"> / </span> : null}
                {chip}
              </span>
            ))}
          </p>
        ) : null}

        {product.liveUrl || product.repoUrl ? (
          <div className="mt-8 flex flex-wrap gap-4">
            {product.liveUrl ? (
              <InlineLink
                href={product.liveUrl}
                className="inline-flex items-center gap-1.5 text-sm font-medium"
              >
                <ExternalLink className="size-4" aria-hidden />
                View it live
              </InlineLink>
            ) : null}
            {product.repoUrl ? (
              <InlineLink
                href={product.repoUrl}
                className="inline-flex items-center gap-1.5 text-sm font-medium"
              >
                <GithubIcon className="size-4" aria-hidden />
                Source
              </InlineLink>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "col-span-12 lg:col-span-4",
          flipped ? "lg:order-1 lg:col-start-1" : "lg:col-start-9"
        )}
      >
        {product.metric ? (
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
              {product.metric.label}
            </p>
            <p className="font-heading mt-3 text-[clamp(2.25rem,5.5vw,4.5rem)] leading-[0.95] font-black tabular-nums">
              {product.metric.value}
            </p>
          </div>
        ) : null}
        {product.secondaryMetric ? (
          <div className="mt-8">
            <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
              {product.secondaryMetric.label}
            </p>
            <p className="font-heading mt-2 text-2xl font-semibold tabular-nums">
              {product.secondaryMetric.value}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
