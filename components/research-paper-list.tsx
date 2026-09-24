import Link from "next/link";
import { InlineLink } from "@/components/inline-link";
import type { ResearchPaper } from "@/content/types";

/**
 * The paper card grid, lifted out of components/sections/research.tsx
 * (wave refresh-2026-09) so /research (the uncapped, SEO-indexed page) and
 * the homepage Research section render the identical markup instead of two
 * copies drifting apart — same pattern as ProjectCard's `headingLevel`
 * prop for the home-section-vs-standalone-page split.
 */
export function ResearchPaperList({
  papers,
  headingLevel = "h3",
}: {
  papers: ResearchPaper[];
  /** h3 under the home section's h2; h2 on /research, whose h1 is the page title (heading order, axe). */
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {papers.map((paper) => (
        <article
          key={paper.title}
          className="section-card relative border-border/40 bg-card/40 flex flex-col gap-[var(--space-3)] rounded-xl border p-6 md:p-8 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-x-14 lg:gap-y-0"
        >
          <div className="contents lg:flex lg:flex-col lg:gap-[var(--space-3)]">
            <Heading className="font-heading text-title max-w-[30ch] font-semibold text-foreground">
              {paper.title}
            </Heading>

            <p className="text-muted-foreground text-sm">
              {paper.status === "working-paper"
                ? "Working paper (draft, not yet submitted)"
                : "Published and citable."}
            </p>

            {/*
             * gap-y has to clear the -my-3 these links carry for their 44px
             * tap target, exactly as Contact's link row does. Each link's
             * box extends 12px above and below its text, so a 20px row gap
             * leaves 4px of overlap the moment the row wraps, and the tap
             * lands on whichever link is painted last.
             */}
            <p className="order-last flex flex-wrap gap-x-[var(--space-5)] gap-y-[var(--space-8)] text-sm lg:order-none lg:mt-auto">
              {paper.arxivUrl && (
                <InlineLink
                  href={paper.arxivUrl}
                  className="card-clickable -my-3 inline-flex min-h-11 items-center"
                >
                  arXiv ↗
                </InlineLink>
              )}
              <InlineLink href={paper.repoUrl} className="card-clickable -my-3 inline-flex min-h-11 items-center">
                Repo ↗
              </InlineLink>
              {/* Wave 12: the benchmark behind the paper has its own case study. */}
              <Link
                href="/work/agentgauge"
                className="card-stretch-link text-accent focus-visible:outline-ring -my-3 inline-flex min-h-11 items-center font-medium transition-colors duration-[var(--dur-base)] ease-[var(--ease-out-soft)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
              >
                Read the benchmark&apos;s case study →
              </Link>
            </p>
          </div>

          <p className="text-muted-foreground max-w-measure text-base leading-relaxed">
            {paper.abstractExcerpt ?? paper.abstract}
          </p>
        </article>
      ))}
    </div>
  );
}
