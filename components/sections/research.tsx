import Link from "next/link";
import { InlineLink } from "@/components/inline-link";
import { RevealGroup } from "@/components/reveal-group";
import { Section } from "@/components/section";
import { researchPapers } from "@/content/research";

/**
 * Wave 6: the pull-quote treatment is gone — a ten-line italic serif block
 * was a display voice doing a paragraph's job, and the margin-note aside
 * spoke provenance-internals to visitors. Now: title, the abstract's thesis
 * sentence in the body voice (verbatim excerpt from the abstract), and a
 * one-line status in plain language.
 *
 * Wave 9: RevealGroup (mode="onview") replaces the plain wrapper — the
 * site's new default reveal pattern (GG's integration map, item 2).
 */
export function Research() {
  return (
    <Section id="research" label="Research">
      <RevealGroup mode="onview" className="flex flex-col gap-10">
        {researchPapers.map((paper) => (
          <article key={paper.title} className="flex flex-col gap-3">
            <h3 className="font-heading text-title max-w-[30ch] font-semibold text-foreground">
              {paper.title}
            </h3>

            <p className="text-muted-foreground text-sm">
              {paper.status === "preprint-pending"
                ? "Preprint — pending arXiv; the link lands here the moment an ID is assigned."
                : "Published and citable."}
            </p>

            <p className="text-muted-foreground max-w-measure text-base leading-relaxed">
              {paper.abstractExcerpt ?? paper.abstract}
            </p>

            <p className="flex flex-wrap gap-5 text-sm">
              {paper.arxivUrl && <InlineLink href={paper.arxivUrl}>arXiv ↗</InlineLink>}
              <InlineLink href={paper.repoUrl}>Repo ↗</InlineLink>
              {/* Wave 12: the benchmark behind the paper has its own case study. */}
              <Link
                href="/work/agentgauge"
                className="text-accent focus-visible:outline-ring font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
              >
                Read the benchmark&apos;s case study →
              </Link>
            </p>
          </article>
        ))}
      </RevealGroup>
    </Section>
  );
}
