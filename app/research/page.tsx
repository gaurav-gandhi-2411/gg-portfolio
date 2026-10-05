import type { Metadata } from "next";
import Link from "next/link";
import { ResearchPaperList } from "@/components/research-paper-list";
import { researchPapers } from "@/content/research";

export const metadata: Metadata = {
  title: "Research · Gaurav Gandhi",
  description:
    "Working papers on agent tool-use evaluation: tool-description quality and the statistics behind agent benchmarks.",
  alternates: { canonical: "/research" },
};

/**
 * refresh-2026-09, Phase C — the homepage Research section only ever shows
 * two cards, so it never needed its own deep-link destination before now.
 * This is that destination: a stable, SEO-indexed page reusing the same
 * data (content/research.ts) and card markup (components/research-paper-
 * list.tsx) as the home section, same pattern as /projects reusing
 * ProjectGrid. The home section's position on the page is unchanged by
 * this page's existence.
 */
export default function ResearchPage() {
  return (
    <main
      id="main"
      className="ambient-plane mx-auto w-full max-w-3xl flex-1 px-6 pt-12 pb-20 md:pt-16 lg:max-w-5xl"
    >
      <div className="flex flex-col items-center text-center">
        <h1 className="font-heading text-heading font-semibold tracking-tight text-foreground">
          Research
        </h1>
        <p className="text-muted-foreground mt-5 max-w-measure text-base leading-relaxed">
          Working papers on agent tool-use evaluation, written alongside AgentGauge, the harness
          behind them.
        </p>
      </div>

      <div className="mt-10">
        <ResearchPaperList papers={researchPapers} headingLevel="h2" />
      </div>

      <p className="mt-12 text-center">
        <Link
          href="/"
          className="text-accent focus-visible:outline-ring -my-2.5 inline-flex min-h-11 items-center text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
