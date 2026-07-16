import { InlineLink } from "@/components/inline-link";
import { Section } from "@/components/section";
import { researchPapers } from "@/content/research";

/**
 * Wave 6: the pull-quote treatment is gone — a ten-line italic serif block
 * was a display voice doing a paragraph's job, and the margin-note aside
 * spoke provenance-internals to visitors. Now: title, the abstract's thesis
 * sentence in the body voice (verbatim excerpt from the abstract), and a
 * one-line status in plain language.
 */
export function Research() {
  return (
    <Section id="research" label="Research">
      <div className="flex flex-col gap-10">
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

            <p className="flex gap-5 text-sm">
              {paper.arxivUrl && <InlineLink href={paper.arxivUrl}>arXiv ↗</InlineLink>}
              <InlineLink href={paper.repoUrl}>Repo ↗</InlineLink>
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}
