import type { Metadata } from "next";
import { AskPanel } from "@/components/chatbot/ask-panel";
import { TransitionLink } from "@/components/transition-link";
import {
  chatbotEvalSummary,
  EVAL_PLACEHOLDER_VALUE,
  type ChatbotEvalMetric,
} from "@/content/chatbot-eval-summary";

export const metadata: Metadata = {
  title: "Ask about my work — Gaurav Gandhi",
  description:
    "A retrieval-grounded chatbot over Gaurav Gandhi's real AI/ML case studies — ask about a project, its architecture, or his background, and it will honestly decline anything it can't ground.",
};

/**
 * Wave 16 — the flagship RAG chatbot demo, a dedicated page rather than a
 * floating widget (GG's explicit framing: this is meant to be looked at,
 * not tucked in a corner). AskPanel does all the interaction; this file is
 * the page shell, the honest-scope intro copy, and the published eval
 * numbers, which read from content/chatbot-eval-summary.ts so wiring in
 * real results (once evals/chatbot/run-eval.mjs exists and has run) is a
 * one-file edit, not a restructure.
 */

const METRIC_LABELS: Record<keyof typeof chatbotEvalSummary, string> = {
  retrievalRecallAt5: "Retrieval recall@5",
  groundednessRate: "Groundedness rate",
  refusalPrecision: "Refusal precision",
  falseRefusalRate: "False refusal rate",
};

function formatMetric(metric: ChatbotEvalMetric): string {
  if (metric.value === EVAL_PLACEHOLDER_VALUE) return "Pending";
  return `${(metric.value * 100).toFixed(0)}%`;
}

export default function AskPage() {
  const metrics = Object.entries(chatbotEvalSummary) as [
    keyof typeof chatbotEvalSummary,
    ChatbotEvalMetric,
  ][];
  const evalPending = metrics.every(([, m]) => m.value === EVAL_PLACEHOLDER_VALUE);

  return (
    <main
      id="main"
      className="mx-auto w-full max-w-3xl flex-1 px-6 pt-12 pb-20 md:pt-16 xl:max-w-5xl"
    >
      <div className="flex flex-col items-center text-center">
        <h1 className="font-heading text-heading font-semibold tracking-tight text-foreground">
          Ask about my work
        </h1>
        <p className="text-muted-foreground mt-5 max-w-measure text-base leading-relaxed">
          A retrieval-grounded chatbot over my actual case studies, architecture write-ups, and
          background — not a general-purpose assistant. It only answers from what it retrieves
          here, and it will honestly say so and decline rather than guess when the question is
          out of scope or the corpus doesn&apos;t support an answer.
        </p>
      </div>

      <div className="mt-10 md:mt-12">
        <AskPanel />
      </div>

      <div className="border-border/60 mt-12 rounded-xl border p-5">
        <h2 className="text-foreground text-sm font-semibold">Eval results</h2>
        {evalPending ? (
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Eval results pending — this chatbot has an eval harness in progress
            (evals/chatbot/); published numbers will replace this block once it has run.
          </p>
        ) : (
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {metrics.map(([key, metric]) => (
              <div key={key} className="flex flex-col gap-1">
                <dt className="text-muted-foreground text-xs">{METRIC_LABELS[key]}</dt>
                <dd className="flex flex-col gap-1">
                  <span className="font-mono text-lead font-semibold text-foreground">
                    {formatMetric(metric)}
                  </span>
                  <span className="text-muted-foreground font-mono text-xs">n={metric.n}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <p className="mt-12 text-center">
        <TransitionLink
          href="/"
          className="text-accent focus-visible:outline-ring text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          ← Back to home
        </TransitionLink>
      </p>
    </main>
  );
}
