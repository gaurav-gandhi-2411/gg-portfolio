import Link from "next/link";
import { EvalFigure } from "@/components/eval-figure";
import { InlineLink } from "@/components/inline-link";
import type { Product } from "@/content/types";
import type { PypiPackageStats } from "@/lib/live-data";
import type { ProjectRhythm } from "@/lib/project-rhythm";
import { cn } from "@/lib/utils";

/**
 * Wave 13 — the one project card, used identically by the home Work
 * section and /projects (the flagship/secondary tiering is retired; the
 * card renders whatever data a project has — figure, metric, pip install —
 * with no visual classes).
 *
 * `data-cats` drives the CSS category filtering (globals.css +
 * components/project-filter.tsx). The card is a @container: on wide cards
 * (≥28rem — half the 5xl grid computes to ~478px, so the threshold sits
 * just under it) the eval figure sits in a right rail beside the text; on
 * narrow cards it stacks below.
 *
 * GG's launch-review round three: "only the title opens the case study,
 * the whole card should be clickable." The title link carries
 * `.card-stretch-link` (app/globals.css, shared with Research's cards),
 * the standard stretched-link pattern -- see that rule's own comment for
 * why Live/Source/Case-study need `.card-clickable` to keep landing on
 * themselves.
 */
export function ProjectCard({
  product,
  dateline,
  pypiStats,
  headingLevel = "h3",
  rhythm,
}: {
  product: Product;
  dateline?: string;
  /** This package's own registry figures, looked up by its package name. */
  pypiStats?: PypiPackageStats;
  /** h3 under the home section's h2; h2 on /projects, whose h1 is the page title (heading order, axe). */
  headingLevel?: "h2" | "h3";
  /** Size and tint for this card, from lib/project-rhythm.ts. */
  rhythm?: ProjectRhythm;
}) {
  const Heading = headingLevel;
  const size = rhythm?.size ?? "standard";
  return (
    <article
      data-cats={product.categories.join(" ")}
      data-slug={product.slug}
      data-size={size}
      /* Per-project hue, consumed by the border, the hover wash and the
       * cursor light. Text never reads it, so no hue can move a contrast
       * ratio. */
      style={{ "--card-hue": `${(rhythm?.hueShift ?? 0) + 277}` } as React.CSSProperties}
      className="project-card @container"
    >
      {/* The light that follows the cursor inside this card. Painted under
          the content, aria-hidden, and inert until the card is hovered or
          holds focus. */}
      <span className="project-card-light" aria-hidden="true" />

      <div className="project-card-body grid gap-x-8 gap-y-6 @[28rem]:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <Heading className="font-heading text-lead font-semibold text-foreground">
              <Link
                href={`/work/${product.slug}`}
                className="card-stretch-link focus-visible:outline-ring -my-2 inline-flex min-h-11 items-center transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
              >
                {product.name}
              </Link>
            </Heading>
            {dateline && (
              <span className="text-muted-foreground inline-flex items-center gap-[var(--space-1-5)] font-mono text-caption">
                <span
                  aria-hidden="true"
                  className={cn(
                    "bg-accent inline-block size-1.5 shrink-0 rounded-full",
                    // Design review (2026-07-30): a continuously-pulsing dot
                    // reads as "happening right now" — right for Warmer's
                    // daily puzzle, wrong for a past-tense "shipped 4mo ago"
                    // fact (even though the value itself is ISR-refreshed).
                    // Reserved for the genuinely present-tense case; every
                    // other dateline gets the hero badge's existing static
                    // dot instead of a new, unpulsed variant.
                    dateline.includes("live today") && "live-dot"
                  )}
                />
                {dateline}
              </span>
            )}
          </div>

          <p className="text-muted-foreground mt-[var(--space-2)] text-sm leading-relaxed">{product.tagline}</p>

          {product.pypi && (
            <div className="mt-[var(--space-4)] flex flex-wrap items-center gap-x-4 gap-y-[var(--space-2)]">
              <code className="border-border/60 bg-background text-foreground w-fit rounded-md border px-[var(--space-3)] py-[var(--space-1-5)] font-mono text-caption">
                {product.pypi.installCommand}
              </code>
              {/* Each figure renders only if its own fetch came back. A
                  package whose registry lookup failed shows the install
                  line alone rather than a zero or a stale version. */}
              {pypiStats?.version !== undefined && (
                <span className="text-muted-foreground font-mono text-caption">
                  v{pypiStats.version}
                  {pypiStats.releaseCount !== undefined && pypiStats.releaseCount > 1
                    ? ` · ${pypiStats.releaseCount} releases`
                    : ""}
                </span>
              )}
              {pypiStats?.lastWeek !== undefined && (
                <span className="text-muted-foreground font-mono text-caption">
                  {pypiStats.lastWeek.toLocaleString()} downloads last week
                </span>
              )}
            </div>
          )}

          {/* What the card shows rather than tells, on hover or focus.
              The stack is real data that was sitting unused in
              content/products.ts, and it is the detail a visitor who is
              already interested wants next.

              The slot is always the same height, so revealing it never
              moves anything: the chips sit inside it translated down and
              hidden, and come up on hover. `visibility` rather than a
              partial opacity, because an axe pass that lands mid-animation
              has to compute contrast against the colour the text really
              ends at, and hidden text is simply not measured.

              Deliberately not aria-hidden. `visibility: hidden` already
              takes it out of the accessibility tree, so it appears to
              assistive tech at exactly the moment it appears on screen,
              which for a keyboard user is when the card takes focus.
              Marking it aria-hidden as well would mean sighted visitors get
              the stack and screen reader users never do. */}
          {product.techChips && product.techChips.length > 0 && (
            <div className="project-card-reveal">
              <ul className="project-card-chips">
                {product.techChips.map((chip) => (
                  <li key={chip}>{chip}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-auto flex flex-wrap gap-x-5 gap-y-[var(--space-2)] pt-5 text-sm">
            <Link
              href={`/work/${product.slug}`}
              className="card-clickable text-accent focus-visible:outline-ring -my-3 inline-flex min-h-11 items-center font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
            >
              Case study →
            </Link>
            {product.liveUrl && (
              <InlineLink
                href={product.liveUrl}
                className="card-clickable -my-3 inline-flex min-h-11 min-w-11 items-center justify-center"
              >
                Live ↗
              </InlineLink>
            )}
            {product.repoUrl && (
              <InlineLink
                href={product.repoUrl}
                className="card-clickable -my-3 inline-flex min-h-11 min-w-11 items-center justify-center"
              >
                Source ↗
              </InlineLink>
            )}
          </div>
        </div>

        {product.figure && product.metric && (
          <div className="@[28rem]:self-center @[28rem]:justify-self-end">
            <EvalFigure figure={product.figure} label={product.metric.label} />
          </div>
        )}

        {!product.figure && product.metric && (
          <p className="text-sm @[28rem]:max-w-[13rem] @[28rem]:self-center @[28rem]:justify-self-end @[28rem]:text-right">
            <span className="font-mono font-medium text-foreground">{product.metric.value}</span>{" "}
            <span className="text-muted-foreground">· {product.metric.label}</span>
          </p>
        )}
      </div>
    </article>
  );
}
