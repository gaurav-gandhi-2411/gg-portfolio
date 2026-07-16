import { GithubIcon } from "@/components/icons/brand-icons";
import type { ResearchPaper } from "@/content/types";

export function ResearchPanel({ papers }: { papers: ResearchPaper[] }) {
  return (
    <div className="flex flex-col gap-4">
      {papers.map((paper) => (
        <div
          key={paper.title}
          className="flex flex-col gap-3 rounded-md border border-border bg-background p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-mono text-base font-bold text-foreground">{paper.title}</h3>
            <span className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              [{paper.status === "preprint-pending" ? "preprint · pending arxiv" : "live"}]
            </span>
          </div>
          <p className="font-mono text-xs leading-relaxed text-muted-foreground">
            {paper.abstract}
          </p>
          <div className="flex gap-4 pt-1">
            {paper.arxivUrl && (
              <a
                href={paper.arxivUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs font-medium text-accent hover:underline"
              >
                arxiv →
              </a>
            )}
            <a
              href={paper.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs font-medium text-accent hover:underline"
            >
              <GithubIcon className="size-3.5" />
              repo →
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
