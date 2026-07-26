// Wave 16 — structurally-typed LLM provider adapter for the reconciliation
// chatbot's runtime API route. Ports the fail-soft raw-fetch pattern already
// proven in scripts/content-pipeline/llm.mjs (Groq's OpenAI-compatible
// endpoint, JSON mode, same model) to TypeScript, behind an `LlmProvider`
// interface rather than a class hierarchy — this repo's multi-provider
// principle wants adapters swappable by construction (structural typing),
// even though only one ships today.

import { estimateCost } from "@/lib/chatbot/pricing";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

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

/**
 * Groq chat-completion adapter. Fail-soft: returns `null` on a missing API
 * key, a non-OK response, a missing content field, or any network/parse
 * error — never throws. Mirrors scripts/content-pipeline/llm.mjs's
 * callLlm() fail-soft contract so a single bad call can never crash a
 * request; the route handler falls back to an honest refusal on `null`.
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
      const res = await fetch(GROQ_URL, {
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
        console.warn(`[llm-provider] groq returned ${res.status}`);
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
