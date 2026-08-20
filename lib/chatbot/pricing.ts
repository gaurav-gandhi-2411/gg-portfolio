// Wave 16 — USD/token pricing for the reconciliation chatbot's one LLM call.
//
// Rates are Groq's published per-1M-token prices, from
// https://console.groq.com/docs/models. Groq has changed pricing before, and
// has now retired a model out from under this table, so re-check the live
// page if a monthly cost report looks off by more than a rounding error.
//
// The retired entry is kept rather than deleted. estimateCost() is called on
// every answered request, and a table that only knows the current model
// silently returns 0 for anything else, which is the difference between "this
// call was free" and "we stopped costing this call" written the same way.
// Keeping the old rate means a cassette or a log line recorded against the
// old model still prices correctly.
export const GROQ_PRICING_USD_PER_MILLION_TOKENS = {
  // Current. Groq's named replacement for the retired model below.
  "openai/gpt-oss-120b": {
    input: 0.15,
    output: 0.6,
  },
  // Retired by Groq on 2026-08-16. Kept for pricing historical records.
  "llama-3.3-70b-versatile": {
    input: 0.59,
    output: 0.79,
  },
} as const;

const MODEL_ID = "openai/gpt-oss-120b";

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

/** The model id every caller should report, so no log line hand-types one. */
export const CHAT_MODEL_ID = MODEL_ID;
