// Wave 16 — the /ask page's published eval-numbers block reads from this one
// const so wiring in real results later is a small, obvious edit here, not a
// structural change to app/ask/page.tsx. Every field is `{ value, n }`: `n`
// is the eval set size the value was measured over (rule 65b — a metric
// without provenance doesn't exist).
//
// Real numbers below, from the `--live` baseline run recorded 2026-07-26
// (see reports/wave16-chatbot-eval-2026-07-26.md/.json and
// evals/chatbot/cassettes/*.json for the full per-fixture breakdown and raw
// Groq responses that produced these numbers). The first live run surfaced a
// genuine refusal-precision failure (unanswerable-years-experience: the model
// computed "at least 3 years" of Python experience from a differently-scoped
// "5 years in data science & ML" stat instead of refusing) — fixed with an
// explicit system-prompt rule against deriving/computing numbers the context
// doesn't state as that exact fact (lib/chatbot/answer.ts buildSystemPrompt),
// then re-measured live to confirm the fix, not just re-worded the story.

/** Sentinel `value` meaning "not yet measured" — never a real metric. */
export const EVAL_PLACEHOLDER_VALUE = -1;

export interface ChatbotEvalMetric {
  /** 0–1 fraction, or `EVAL_PLACEHOLDER_VALUE` if not yet measured. */
  value: number;
  /** Eval-set size the value was measured over; 0 while pending. */
  n: number;
}

export interface ChatbotEvalSummary {
  retrievalRecallAt5: ChatbotEvalMetric;
  groundednessRate: ChatbotEvalMetric;
  refusalPrecision: ChatbotEvalMetric;
  falseRefusalRate: ChatbotEvalMetric;
}

export const chatbotEvalSummary: ChatbotEvalSummary = {
  retrievalRecallAt5: { value: 1.0, n: 20 },
  groundednessRate: { value: 1.0, n: 20 },
  refusalPrecision: { value: 1.0, n: 10 },
  falseRefusalRate: { value: 0.0, n: 20 },
};
