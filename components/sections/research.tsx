import { GithubIcon } from "@/components/icons/brand-icons";
import { InlineLink } from "@/components/inline-link";
import { SectionMark } from "@/components/section-mark";
import { researchPapers } from "@/content/research";

/**
 * Deliberate quiet treatment, not a plain paragraph: the abstract reads as a
 * set pull-quote (the same voice as a flagship product's storyLine), and the
 * preprint status is a marginal note beside it rather than a small badge —
 * intentional typography, not "we didn't have time for this one."
 */
export function Research() {
  return (
    <section id="research" className="mx-auto w-full max-w-4xl px-6 py-16 md:py-24">
      <SectionMark index="03" label="Research" />

      <div className="mt-10 flex flex-col gap-8">
        {researchPapers.map((paper) => (
          <article key={paper.title} className="grid grid-cols-12 gap-x-6 gap-y-6">
            <div className="col-span-12 lg:col-span-8">
              <h3 className="font-heading text-title font-semibold">{paper.title}</h3>

              <blockquote className="border-accent relative mt-8 max-w-[52ch] border-l-2 pl-8">
                <span
                  aria-hidden="true"
                  className="font-heading text-accent absolute -top-4 -left-1 text-stat leading-none select-none"
                >
                  &ldquo;
                </span>
                <p className="font-heading text-lg leading-relaxed italic">{paper.abstract}</p>
              </blockquote>

              <div className="mt-6 flex gap-6">
                {paper.arxivUrl && (
                  <InlineLink href={paper.arxivUrl} className="text-sm font-medium">
                    arXiv
                  </InlineLink>
                )}
                <InlineLink
                  href={paper.repoUrl}
                  className="inline-flex items-center gap-1.5 text-sm font-medium"
                >
                  <GithubIcon className="size-3.5" aria-hidden />
                  Repo
                </InlineLink>
              </div>
            </div>

            {/* Margin note: a deliberate editorial annotation, not a badge
                bolted onto the headline. */}
            <aside className="col-span-12 lg:col-span-4">
              <div className="border-border border-l pl-5">
                <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">Status</p>
                <p className="font-heading mt-2 text-lg font-semibold text-foreground">
                  {paper.status === "preprint-pending" ? "Preprint — pending arXiv" : "Live"}
                </p>
                <p className="text-muted-foreground mt-2 max-w-[28ch] text-sm leading-relaxed">
                  {paper.status === "preprint-pending"
                    ? "Submission in progress. This link updates the moment an arXiv ID is assigned — no placeholder, no guessed date."
                    : "Published and citable."}
                </p>
              </div>
            </aside>
          </article>
        ))}
      </div>
    </section>
  );
}
