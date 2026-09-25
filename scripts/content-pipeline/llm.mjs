// scripts/content-pipeline/llm.mjs — Wave 15: the first LLM-API integration this repo's
// automation has ever had. One provider (Groq — free-tier, the same key already used elsewhere
// in GG's project ecosystem, see the wave-15 report's shared-quota note), two model FAMILIES:
// Meta's Llama for curator/framer, Alibaba's Qwen for the verifier — deliberately different so
// the verifier's independence isn't self-referential (same reasoning DealHunter and tracegauge
// already apply to their own judge/verifier stages, see content/case-studies). An OpenRouter
// path was tried first for the verifier specifically to get a different PROVIDER, not just a
// different family, but the available key (reused from another project) turned out to be dead
// ("User not found") — rather than provision a new account for this, Groq's own Qwen model gives
// the same cross-family independence property this pipeline actually needs, with zero new
// credentials.
//
// fix/content-pipeline-model-discovery (2026-09): the original pin here, `qwen/qwen3.6-27b`, was
// retired/renamed by Groq with no announcement this repo tracked and started 404ing on every
// verifier call. Swapped to `qwen/qwen3.8-27b`, the only Qwen model Groq's live
// `GET /openai/v1/models` actually lists as of this fix — confirmed via the list_models dispatch
// input added in the prior commit (run
// https://github.com/gaurav-gandhi-2411/gg-portfolio/actions/runs/36058065170 — full list:
// allam-2-7b, canopylabs/orpheus-arabic-saudi, canopylabs/orpheus-v1-english,
// meta-llama/llama-prompt-guard-2-22m, meta-llama/llama-prompt-guard-2-86m,
// openai/gpt-oss-120b, openai/gpt-oss-20b, openai/gpt-oss-safeguard-20b, qwen/qwen3.8-27b,
// whisper-large-v3, whisper-large-v3-turbo — all reported active=true, none flagged preview).
//
// R3 (owner rule, 2026-09): "no silent failure — every script touching an external API must exit
// non-zero on any API error." This is fix/content-pipeline-llm-fail-loud-b1 — the first of two
// stacked PRs (b1: fail-loud on every non-2xx/auth/network/missing-key error; b2, stacked on this
// branch: adds bounded 429-retry-with-backoff on top). callLlm() used to swallow every failure
// into a bare `null`, which run.mjs's callers treat as "this one candidate didn't pass" — a
// systemic failure (a dead model, a bad key, Groq being down) was indistinguishable from "the
// curator rejected this line." That's the same shape as extractor.mjs's pre-R3 commit-SHA lookup:
// fail-soft per-candidate is correct (one bad draft must never kill the run), but a systemic
// failure must still surface. Fixed the same way extractor.mjs/github-api.mjs already do it: real
// errors are recorded into the exported `apiErrors` array; run.mjs checks it after every repo is
// processed and sets a non-zero exit code — the per-candidate null-return behavior callers rely on
// is unchanged.
//
// Missing GROQ_API_KEY is now an apiErrors entry too, not a quiet skip: metrics-refresh.yml's
// content-pipeline job always sets this env var from a repo secret (never conditionally), so an
// empty/missing key here means the secret is unset or the workflow is misconfigured — not "no LLM
// available this run."
//
// This PR (b1) does NOT retry anything — every non-2xx status, including 429, fails loud on the
// first attempt. The 429-specific bounded-retry-with-backoff carve-out is b2's entire scope,
// stacked on top of this branch.
//
// Zero dependencies, same convention as scripts/refresh-metrics.mjs — global fetch only.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Errors recorded here, one per failed callLlm() invocation, checked by run.mjs after every repo
 * has been processed (formatApiErrorLines from lib/github-api.mjs renders them). A per-candidate
 * `null` return is unchanged for callers — only the array's length affects the process exit code. */
export const apiErrors = [];

export const MODELS = {
  // Groq retired llama-3.3-70b-versatile on 2026-08-16. Both stages moved to
  // Groq's own named replacement for it. The verifier stays on a different
  // model family below, which is the property that mattered here and is
  // unaffected by the swap.
  curator: { model: "openai/gpt-oss-120b" },
  framer: { model: "openai/gpt-oss-120b" },
  // Different model family than curator/framer (OpenAI OSS) — Qwen (Alibaba), for genuine
  // independence on the verifier's re-check, not a second vote from the same family. See this
  // file's header comment for why this is qwen/qwen3.8-27b and not qwen/qwen3.6-27b.
  verifier: { model: "qwen/qwen3.8-27b" },
};

// Best-effort: a bare HTTP status alone doesn't say WHY a request failed (e.g. Groq's 400 for a
// bad request body vs. a 400 for a context-length overflow read completely differently) — rule
// 104, errors are part of the API. Never throws; an unreadable body just yields no suffix. Bounded
// to 300 chars so one verbose error page can't blow out the workflow log.
async function errorBodySuffix(res) {
  try {
    const body = await res.text();
    return body ? ` — ${body.slice(0, 300)}` : "";
  } catch {
    return "";
  }
}

// R1 live-proof knob only (fix/content-pipeline-llm-fail-loud-b1): metrics-refresh.yml's
// verifier_model_override input, when set, swaps the verifier stage's model id at call time —
// used to force a real 404 (RED) without hand-editing MODELS. Never set on the scheduled run.
function modelFor(stage) {
  if (stage === "verifier" && process.env.VERIFIER_MODEL_OVERRIDE) {
    return process.env.VERIFIER_MODEL_OVERRIDE;
  }
  return MODELS[stage].model;
}

/**
 * Calls a chat completion endpoint and parses the response as JSON (the prompt always instructs
 * "respond with JSON only"). Returns null for a single bad candidate the same way it always has
 * (missing key, any non-2xx, network failure, or an unparseable response) — a single bad call must
 * never fail the whole pipeline run, same fail-soft discipline as lib/live-data.ts. But except for
 * an unparseable/empty response body (a response-shape problem, not an API failure), every one of
 * those cases is now also recorded into `apiErrors` — see this file's header comment for why a
 * systemic failure must surface even though the per-call return value doesn't change.
 */
export async function callLlm(stage, systemPrompt, userPrompt) {
  const model = modelFor(stage);
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    apiErrors.push({ context: `llm ${stage} (${model})`, message: "missing GROQ_API_KEY" });
    console.error(`[llm] ${stage}: no GROQ_API_KEY — recorded as an API error (R3), not skipped`);
    return null;
  }

  let res;
  try {
    res = await fetch(GROQ_URL, {
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
  } catch (err) {
    apiErrors.push({ context: `llm ${stage} (${model})`, message: `network error — ${err.message}` });
    console.error(`[llm] ${stage}: network error calling groq (${model}) — ${err.message}`);
    return null;
  }

  if (!res.ok) {
    // No retry on any status here, including 429 — see this file's header comment. b2 (stacked on
    // this branch) adds a bounded-retry-with-backoff carve-out specifically for 429.
    const detail = await errorBodySuffix(res);
    apiErrors.push({ context: `llm ${stage} (${model})`, message: `HTTP ${res.status}${detail}` });
    console.error(`[llm] ${stage}: groq returned HTTP ${res.status} for ${model}${detail}`);
    return null;
  }

  try {
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null; // response-shape problem, not an API failure — see doc comment above
    return JSON.parse(content);
  } catch (err) {
    console.warn(`[llm] ${stage}: could not parse groq (${model}) response — ${err.message}`);
    return null;
  }
}
