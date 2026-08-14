import { InlineLink } from "@/components/inline-link";
import { RevealGroup } from "@/components/reveal-group";
import { Section } from "@/components/section";
import { TransitionLink } from "@/components/transition-link";
import { researchPapers } from "@/content/research";

/**
 * Wave 6: title, the abstract's thesis sentence in the body voice
 * (verbatim excerpt), and a one-line status in plain language.
 *
 * Wave 13 — desktop composition: at lg the paper splits into a two-column
 * spread (title + status + links left, thesis right), filling the
 * 1024–1600px band with the same content instead of stacking it in a
 * narrow strand. Below lg, unchanged (breakpoint moved from xl to lg in the 2026-07-30 UI/UX wave).
 */
export function Research() {
  return (
    <Section id="research" label="Research" width="wide">
      <RevealGroup mode="onview" className="flex flex-col gap-10">
        {researchPapers.map((paper) => (
          <article
            key={paper.title}
            className="flex flex-col gap-[var(--space-3)] lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-x-14 lg:gap-y-0"
          >
            <div className="contents lg:flex lg:flex-col lg:gap-[var(--space-3)]">
              <h3 className="font-heading text-title max-w-[30ch] font-semibold text-foreground">
                {paper.title}
              </h3>

              <p className="text-muted-foreground text-sm">
                {paper.status === "preprint-pending"
                  ? "Preprint — pending arXiv; the link lands here the moment an ID is assigned."
                  : "Published and citable."}
              </p>

              <p className="order-last flex flex-wrap gap-[var(--space-5)] text-sm lg:order-none lg:mt-auto">
                {paper.arxivUrl && <InlineLink href={paper.arxivUrl}>arXiv ↗</InlineLink>}
                <InlineLink href={paper.repoUrl}>Repo ↗</InlineLink>
                {/* Wave 12: the benchmark behind the paper has its own case study. */}
                <TransitionLink
                  href="/work/agentgauge"
                  className="text-accent focus-visible:outline-ring font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                  Read the benchmark&apos;s case study →
                </TransitionLink>
              </p>
            </div>

            <p className="text-muted-foreground max-w-measure text-base leading-relaxed">
              {paper.abstractExcerpt ?? paper.abstract}
            </p>
          </article>
        ))}
      </RevealGroup>
    </Section>
  );
}
