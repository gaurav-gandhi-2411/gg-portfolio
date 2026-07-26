// Wave 16 — the /ask page's published eval-numbers block reads from this one
// const so wiring in real results later is a small, obvious edit here, not a
// structural change to app/ask/page.tsx. Every field is `{ value, n }`: `n`
// is the eval set size the value was measured over (rule 65b — a metric
// without provenance doesn't exist).
//
// TODO(wave16): replace with real eval/chatbot results once
// evals/chatbot/run-eval.mjs has run. Until then every value stays at the
// PLACEHOLDER sentinel below so the page can render an honest "pending"
// state instead of a fabricated number.

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
  retrievalRecallAt5: { value: EVAL_PLACEHOLDER_VALUE, n: 0 },
  groundednessRate: { value: EVAL_PLACEHOLDER_VALUE, n: 0 },
  refusalPrecision: { value: EVAL_PLACEHOLDER_VALUE, n: 0 },
  falseRefusalRate: { value: EVAL_PLACEHOLDER_VALUE, n: 0 },
};
