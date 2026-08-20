// scripts/content-pipeline/llm.mjs — Wave 15: the first LLM-API integration this repo's
// automation has ever had. One provider (Groq — free-tier, the same key already used elsewhere
// in GG's project ecosystem, see the wave-15 report's shared-quota note), two model FAMILIES:
// Meta's Llama for curator/framer, Alibaba's Qwen for the verifier — deliberately different so
// the verifier's independence isn't self-referential (same reasoning DealHunter and tracegauge
// already apply to their own judge/verifier stages, see content/case-studies). An OpenRouter
// path was tried first for the verifier specifically to get a different PROVIDER, not just a
// different family, but the available key (reused from another project) turned out to be dead
// ("User not found") — rather than provision a new account for this, Groq's own Qwen model
// (`qwen/qwen3.6-27b`, confirmed available via `GET /openai/v1/models`) gives the same
// cross-family independence property this pipeline actually needs, with zero new credentials.
//
// Zero dependencies, same convention as scripts/refresh-metrics.mjs — global fetch only.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export const MODELS = {
  // Groq retired llama-3.3-70b-versatile on 2026-08-16. Both stages moved to
  // Groq's own named replacement for it. The verifier stays on a different
  // model family below, which is the property that mattered here and is
  // unaffected by the swap.
  curator: { model: "openai/gpt-oss-120b" },
  framer: { model: "openai/gpt-oss-120b" },
  // Different model family than curator/framer (Meta Llama) — Qwen (Alibaba), for genuine
  // independence on the verifier's re-check, not a second vote from the same family.
  verifier: { model: "qwen/qwen3.6-27b" },
};

/**
 * Calls a chat completion endpoint and parses the response as JSON (the prompt always
 * instructs "respond with JSON only"). Fails soft: returns null on any error (missing key,
 * network failure, non-JSON response) rather than throwing — a single bad call must never
 * fail the whole pipeline run, same fail-soft discipline as lib/live-data.ts.
 */
export async function callLlm(stage, systemPrompt, userPrompt) {
  const { model } = MODELS[stage];
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn(`[llm] ${stage}: no GROQ_API_KEY — skipping (fail-soft)`);
    return null;
  }
  const url = GROQ_URL;
  const provider = "groq";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.warn(`[llm] ${stage}: ${provider} returned ${res.status}`);
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch (err) {
    console.warn(`[llm] ${stage}: call failed — ${err.message}`);
    return null;
  }
}
