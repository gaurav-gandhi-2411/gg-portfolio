import { GithubIcon } from "@/components/icons/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CursorGlow } from "@/components/cursor-glow";
import { researchPapers } from "@/content/research";

export function Research() {
  return (
    <section id="research" className="mx-auto w-full max-w-4xl px-6 py-16">
      <h2 className="font-heading text-sm font-semibold tracking-widest text-accent uppercase">
        Research
      </h2>
      <div className="mt-6 flex flex-col gap-4">
        {researchPapers.map((paper) => (
          <CursorGlow key={paper.title}>
            <Card className="flex flex-col gap-3 p-6 transition-shadow duration-300 hover:ring-accent/40 hover:shadow-[0_8px_28px_-16px_color-mix(in_oklab,var(--accent)_45%,transparent)]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-heading text-lg font-semibold text-foreground">
                  {paper.title}
                </h3>
                {paper.status === "preprint-pending" ? (
                  <Badge variant="secondary" className="shrink-0">
                    Preprint — pending arXiv
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="shrink-0 bg-status-open-bg text-status-open"
                  >
                    Live
                  </Badge>
                )}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{paper.abstract}</p>
              <div className="flex gap-3 pt-1">
                {paper.arxivUrl && (
                  <a
                    href={paper.arxivUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    arXiv
                  </a>
                )}
                <a
                  href={paper.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                >
                  <GithubIcon className="size-3.5" />
                  Repo
                </a>
              </div>
            </Card>
          </CursorGlow>
        ))}
      </div>
    </section>
  );
}
