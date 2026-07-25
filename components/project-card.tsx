import { EvalFigure } from "@/components/eval-figure";
import { InlineLink } from "@/components/inline-link";
import { TransitionLink } from "@/components/transition-link";
import type { Product } from "@/content/types";
import type { TracegaugeDownloads } from "@/lib/live-data";

/**
 * Wave 13 — the one project card, used identically by the home Work
 * section and /projects (the flagship/secondary tiering is retired; the
 * card renders whatever data a project has — figure, metric, pip install —
 * with no visual classes).
 *
 * `data-cats` drives the CSS category filtering (globals.css +
 * components/project-filter.tsx). The card is a @container: on wide cards
 * (≥30rem — the 2-column desktop grid) the eval figure sits in a right
 * rail beside the text; on narrow cards it stacks below. The title carries
 * a per-slug view-transition-name that pairs with the case-study h1, so
 * supporting browsers morph the title you clicked into the page heading.
 */
export function ProjectCard({
  product,
  dateline,
  downloads,
}: {
  product: Product;
  dateline?: string;
  downloads?: TracegaugeDownloads | null;
}) {
  return (
    <article
      data-cats={product.categories.join(" ")}
      className="border-border/40 bg-card/50 hover:border-accent/50 hover:shadow-card-hover @container flex h-full flex-col rounded-xl border p-6 transition-[transform,box-shadow,border-color,opacity] duration-300 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="grid gap-x-8 gap-y-6 @[30rem]:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h3 className="font-heading text-lead font-semibold text-foreground">
              <TransitionLink
                href={`/work/${product.slug}`}
                className="focus-visible:outline-ring transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                style={{ viewTransitionName: `vt-title-${product.slug}` }}
              >
                {product.name}
              </TransitionLink>
            </h3>
            {dateline && (
              <span className="text-muted-foreground font-mono text-xs">{dateline}</span>
            )}
          </div>

          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{product.tagline}</p>

          {product.pypi && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <code className="border-border/60 bg-background text-foreground w-fit rounded-md border px-3 py-1.5 font-mono text-xs">
                {product.pypi.installCommand}
              </code>
              {downloads?.lastWeek !== undefined && (
                <span className="text-muted-foreground font-mono text-xs">
                  {downloads.lastWeek.toLocaleString()} downloads last week
                </span>
              )}
            </div>
          )}

          <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 pt-5 text-sm">
            <TransitionLink
              href={`/work/${product.slug}`}
              className="text-accent focus-visible:outline-ring font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
            >
              Case study →
            </TransitionLink>
            {product.liveUrl && <InlineLink href={product.liveUrl}>Live ↗</InlineLink>}
            {product.repoUrl && <InlineLink href={product.repoUrl}>Source ↗</InlineLink>}
          </div>
        </div>

        {product.figure && product.metric && (
          <div className="@[30rem]:self-center @[30rem]:justify-self-end">
            <EvalFigure figure={product.figure} label={product.metric.label} />
          </div>
        )}

        {!product.figure && product.metric && (
          <p className="text-sm @[30rem]:max-w-[13rem] @[30rem]:self-center @[30rem]:justify-self-end @[30rem]:text-right">
            <span className="font-mono font-medium text-foreground">{product.metric.value}</span>{" "}
            <span className="text-muted-foreground">— {product.metric.label}</span>
          </p>
        )}
      </div>
    </article>
  );
}
