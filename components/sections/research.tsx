import Link from "next/link";
import { InlineLink } from "@/components/inline-link";
import { Section } from "@/components/section";
import { researchPapers } from "@/content/research";

/**
 * Wave 6: title, the abstract's thesis sentence in the body voice
 * (verbatim excerpt), and a one-line status in plain language.
 *
 * Wave 13 — desktop composition: at lg the paper splits into a two-column
 * spread (title + status + links left, thesis right), filling the
 * 1024–1600px band with the same content instead of stacking it in a
 * narrow strand. Below lg, unchanged (breakpoint moved from xl to lg in the 2026-07-30 UI/UX wave).
 *
 * GG's launch-review round two dropped the RevealGroup wrapper — see
 * components/sections/about.tsx's header for why. Each card is a
 * `.section-card` (app/sections-motion.css) for the pointer tilt, replacing
 * the first pass's hand-written hover/focus-within utility classes.
 *
 * GG's launch-review round three: "same on Research" (whole-card click
 * target, see components/project-card.tsx's own header). The benchmark's
 * case-study link carries `.card-stretch-link`; arXiv/Repo carry
 * `.card-clickable` to keep landing on themselves (app/globals.css has
 * both rules' full reasoning).
 */
export function Research() {
  return (
    <Section id="research" label="Research" width="wide">
      {/*
       * The papers sit in the same card as an Experience entry: same border,
       * same surface, same radius, same padding step. Before this they were
       * bare articles on the page background, so the one section made of
       * long-form claims was also the only one with nothing holding it, and
       * the ragged column gap between a five-line title and a three-line
       * thesis read as a layout that had come apart rather than as two
       * columns. The card gives the gap an edge to be measured against.
       *
       * gap-6 rather than gap-10 for the same reason it is gap-6 in
       * Experience: once each item has a border, the border is doing the
       * separating and the old whitespace is just distance.
       */}
      <div className="flex flex-col gap-[var(--space-6)]">
        {researchPapers.map((paper) => (
          <article
            key={paper.title}
            className="section-card relative border-border/40 bg-card/40 flex flex-col gap-[var(--space-3)] rounded-xl border p-6 md:p-8 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-x-14 lg:gap-y-0"
          >
            <div className="contents lg:flex lg:flex-col lg:gap-[var(--space-3)]">
              <h3 className="font-heading text-title max-w-[30ch] font-semibold text-foreground">
                {paper.title}
              </h3>

              <p className="text-muted-foreground text-sm">
                {paper.status === "preprint-pending"
                  ? "Preprint, pending arXiv. The link lands here the moment an ID is assigned."
                  : "Published and citable."}
              </p>

              {/*
               * gap-y has to clear the -my-3 these links carry for their 44px
               * tap target, exactly as Contact's link row does. Each link's
               * box extends 12px above and below its text, so a 20px row gap
               * leaves 4px of overlap the moment the row wraps, and the tap
               * lands on whichever link is painted last.
               *
               * This did not wrap before the card arrived: p-6 took ~48px out
               * of the row at 375px and pushed the second link onto its own
               * line. The overlap was always latent, the padding just found
               * it. See CHECKS.md instance 17 for the same defect in Contact.
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
    </Section>
  );
}
