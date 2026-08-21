import type { Metadata } from "next";
import Link from "next/link";
import { AskPanel } from "@/components/chatbot/ask-panel";
import { products } from "@/content/products";

export const metadata: Metadata = {
  title: "Ask about my work · Gaurav Gandhi",
  // F3 — trimmed under the ~155-160 char SERP budget (was 188 chars);
  // same claim, shorter clause structure, nothing new invented.
  description:
    "A retrieval-grounded chatbot over my real AI/ML case studies. Ask about a project or my background, and it will honestly decline what it can't ground.",
  alternates: { canonical: "/ask" },
};

/**
 * Wave 16 — the flagship RAG chatbot demo, a dedicated page rather than a
 * floating widget (GG's explicit framing: this is meant to be looked at,
 * not tucked in a corner). AskPanel does all the interaction; this file is
 * the page shell and the honest-scope intro copy.
 *
 * The published eval-numbers block (retrieval recall@5, groundedness,
 * refusal precision/false-refusal-rate) is gone as of GG's launch review —
 * it doesn't belong in front of a visitor. The real, measured numbers it
 * showed are not lost: they're recorded properly in
 * reports/wave16-chatbot-eval-2026-07-26.md/.json with the full per-fixture
 * cassette breakdown, which is where eval provenance belongs (rule 65b),
 * not a metrics dashboard on the page a candidate is trying to talk to.
 */

export default function AskPage() {
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-3xl flex-1 px-6 pt-12 pb-20 md:pt-16 lg:max-w-5xl"
    >
      <div className="flex flex-col items-center text-center">
        <h1 className="font-heading text-heading font-semibold tracking-tight text-foreground">
          Ask about my work
        </h1>
        <p className="text-muted-foreground mt-5 max-w-measure text-base leading-relaxed">
          A retrieval-grounded chatbot over my actual case studies, architecture write-ups, and
          background, not a general-purpose assistant.
        </p>
      </div>

      {/*
        What it can answer, said before anyone types.

        The panel already declines honestly when a question is out of scope,
        but a refusal is a poor way to learn what a thing is for: the reader
        pays a full round trip to find out, and the sentence they get back is
        the same one they would get if the corpus simply lacked the answer.
        Saying it up front costs nothing and turns the first question from a
        guess into a choice.

        The project count is derived from content/products.ts rather than
        typed, because a number in a sentence about what the assistant knows
        is exactly the kind that goes stale the next time a project lands and
        nothing anywhere would notice.
      */}
      <div className="border-border/60 mx-auto mt-10 max-w-measure rounded-xl border p-5">
        <h2 className="text-foreground text-sm font-semibold">What it can answer</h2>
        <ul className="text-muted-foreground mt-3 flex flex-col gap-[var(--space-2)] text-sm leading-relaxed">
          <li>
            All {products.length} project case studies: what each one does, how it works, the
            decisions behind it, and the results, including the ones that went badly.
          </li>
          <li>Where I have worked, what I built there, and what I am looking for now.</li>
          <li>
            The provenance behind any number on this site: which repo, which file, which commit.
          </li>
        </ul>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          It answers from those pages and nothing else, and every answer links back to the
          section it came from, so you can check it. Ask it something outside that and it will
          say so rather than guess.
        </p>
      </div>

      <div className="mt-10 md:mt-12">
        <AskPanel />
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
