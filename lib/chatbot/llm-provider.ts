// Wave 16 — structurally-typed LLM provider adapter for the reconciliation
// chatbot's runtime API route. Ports the fail-soft raw-fetch pattern already
// proven in scripts/content-pipeline/llm.mjs (Groq's OpenAI-compatible
// endpoint, JSON mode, same model) to TypeScript, behind an `LlmProvider`
// interface rather than a class hierarchy — this repo's multi-provider
// principle wants adapters swappable by construction (structural typing),
// even though only one ships today.

import { estimateCost } from "@/lib/chatbot/pricing";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
/**
 * Groq retired llama-3.3-70b-versatile on 2026-08-16 (its own deprecations
 * table's shutdown date, and it is gone from the production models list).
 * Every completion call failed from then on, and because this adapter fails
 * soft, production /ask refused every question for two days while the canary
 * went red every six hours saying only "refused".
 *
 * openai/gpt-oss-120b is Groq's own named replacement for this exact model.
 *
 * The lesson worth keeping is not the swap. A pinned model id is a dependency
 * with an expiry date that nothing in this repo watches, and the next one will
 * expire too. What changed structurally is that a failure here is now
 * reported as `provider_unavailable` rather than as a refusal indistinguishable
 * from an off-topic question, so the canary names the cause the first time
 * instead of the third day.
 */
const GROQ_MODEL = "openai/gpt-oss-120b";

export interface ChatCompletionResult {
  /** Raw JSON-mode string from the model (caller parses it). */
  content: string;
  tokensIn: number;
  tokensOut: number;
  usdCost: number;
  model: string;
  provider: string;
  latencyMs: number;
}

export interface LlmProvider {
  complete(systemPrompt: string, userPrompt: string): Promise<ChatCompletionResult | null>;
}

interface GroqChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

// Bounds retry time so 2 retries + their backoff still land well inside
// route.ts's maxDuration=30 budget alongside retrieval/embedding — observed
// single-call latency is 1-4s (production logs), so 3 attempts worst case
// is still under 15s.
const MAX_RETRIES = 2;
const MAX_BACKOFF_MS = 5000;

/** True for a transient provider failure worth retrying — rate limit or a
 * server-side hiccup, never a client-error (bad key, malformed request)
 * that retrying cannot fix. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Diagnosed against production logs, not assumed (round three, GG's
 * follow-up-chip bug report): all 3 "grounding refused" chip failures
 * traced to `[llm-provider] groq returned 429` at ~80ms latency — Groq's
 * own per-key rate limit, tripped by a burst of chip taps in quick
 * succession, not a retrieval-chunk mismatch (retrievedSourceRefs in the
 * same log lines show the correct, relevant, above-threshold chunks every
 * time). The identical questions, asked again moments later, answered
 * cleanly. A single 429 was never retried — one failed call fell straight
 * through to a permanent-looking refusal indistinguishable from an honest
 * "not grounded" to the visitor. Respects Groq's own `Retry-After` header
 * when present (the accurate wait, not a guess); falls back to jittered
 * exponential backoff otherwise. Never retries a non-transient status
 * (401/400/etc) — those will not succeed on repetition.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries: number = MAX_RETRIES
): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    if (res.ok || !isRetryableStatus(res.status)) return res;
    lastResponse = res;
    if (attempt < maxRetries) {
      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
      const backoffMs = Number.isFinite(retryAfterMs)
        ? retryAfterMs
        : 300 * 2 ** attempt + Math.random() * 200;
      console.warn(
        `[llm-provider] groq returned ${res.status}, retrying in ${Math.round(backoffMs)}ms (attempt ${attempt + 1}/${maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, Math.min(backoffMs, MAX_BACKOFF_MS)));
    }
  }
  return lastResponse as Response;
}

/**
 * Groq chat-completion adapter. Fail-soft: returns `null` on a missing API
 * key, a non-OK response (after retries), a missing content field, or any
 * network/parse error — never throws. Mirrors scripts/content-pipeline/
 * llm.mjs's callLlm() fail-soft contract so a single bad call can never
 * crash a request; the route handler falls back to an honest refusal on
 * `null`.
 */
export const groqProvider: LlmProvider = {
  async complete(
    systemPrompt: string,
    userPrompt: string
  ): Promise<ChatCompletionResult | null> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn("[llm-provider] groq: no GROQ_API_KEY — skipping (fail-soft)");
      return null;
    }

    const startedAt = Date.now();
    try {
      const res = await fetchWithRetry(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      });
      const latencyMs = Date.now() - startedAt;
      if (!res.ok) {
        console.warn(`[llm-provider] groq returned ${res.status} after retries`);
        return null;
      }
      const data = (await res.json()) as GroqChatCompletionResponse;
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return null;

      const tokensIn = data.usage?.prompt_tokens ?? 0;
      const tokensOut = data.usage?.completion_tokens ?? 0;
      return {
        content,
        tokensIn,
        tokensOut,
        usdCost: estimateCost(tokensIn, tokensOut),
        model: GROQ_MODEL,
        provider: "groq",
        latencyMs,
      };
    } catch (err) {
      console.warn(`[llm-provider] groq call failed — ${(err as Error).message}`);
      return null;
    }
  },
};
