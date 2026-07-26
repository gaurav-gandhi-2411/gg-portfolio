// Wave 16 — USD/token pricing for the reconciliation chatbot's one LLM call
// (Groq's llama-3.3-70b-versatile, same model scripts/content-pipeline/llm.mjs
// already uses for curator/framer — see that file's header for why Groq).
//
// Rates below are Groq's published per-1M-token prices for this model as of
// wave 16 (2026-07-26), taken from https://groq.com/pricing/. Groq has changed
// pricing on this model before — re-check against the live pricing page if
// these numbers look stale (e.g. if a monthly cost report looks off by more
// than a rounding error).
export const GROQ_PRICING_USD_PER_MILLION_TOKENS = {
  "llama-3.3-70b-versatile": {
    input: 0.59,
    output: 0.79,
  },
} as const;

const MODEL_ID = "llama-3.3-70b-versatile";

/**
 * Estimates the USD cost of one chat completion call given token counts,
 * using the constant per-1M-token rates above. Returns 0 for an unrecognized
 * model rather than throwing — cost estimation must never crash the request
 * it's trying to log.
 * @param tokensIn - prompt tokens (`usage.prompt_tokens` from the provider response)
 * @param tokensOut - completion tokens (`usage.completion_tokens`)
 * @returns estimated USD cost for this call
 */
export function estimateCost(tokensIn: number, tokensOut: number): number {
  const rates = GROQ_PRICING_USD_PER_MILLION_TOKENS[MODEL_ID];
  if (!rates) return 0;
  return (tokensIn * rates.input + tokensOut * rates.output) / 1_000_000;
}
