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
// non-zero on any API error." This is fix/content-pipeline-llm-fail-loud-b2, stacked on
// fix/content-pipeline-llm-fail-loud-b1 — b1 made callLlm() fail loud (record into the exported
// `apiErrors` array + let run.mjs exit non-zero) on every non-2xx/auth/network/missing-key error,
// where it previously swallowed everything into a bare `null`. This PR (b2) adds the one carve-out
// b1 deliberately left out: Groq's 429 (rate limit) is transient and worth a bounded retry with
// backoff before treating it as a hard failure — every OTHER non-2xx (401/403/404/5xx) and every
// network error still fails loud on the first attempt, unchanged from b1.
//
// Missing GROQ_API_KEY is an apiErrors entry too, not a quiet skip: metrics-refresh.yml's
// content-pipeline job always sets this env var from a repo secret (never conditionally), so an
// empty/missing key here means the secret is unset or the workflow is misconfigured — not "no LLM
// available this run."
//
// Zero dependencies, same convention as scripts/refresh-metrics.mjs — global fetch only.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Bounded retry for 429 (rate limit) only — every other non-2xx (401/403/404/5xx) and every
// network error is NOT retried; those are either not transient (a dead model id, a bad key) or
// not worth the extra Groq-quota spend guessing at, so they fail loud on the first attempt (b1's
// behavior, unchanged here).
const MAX_429_RETRIES = 5;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
// A live GREEN proof run (fix/content-pipeline-llm-fail-loud-b2, run 36083037346) hit a real Groq
// tokens-per-day exhaustion and honoured a server-provided Retry-After of 589s on a single retry —
// technically correct, but waiting minutes for a DAILY quota to clear can never succeed within a
// bounded number of attempts and just stalls the job. Any Retry-After above this cap is not worth
// sleeping for; it's failed loud immediately instead (see the 429 branch in callLlm below).
const MAX_RETRY_AFTER_MS = 60_000;

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Parses a `Retry-After` header value (seconds) into milliseconds. Returns null when the header is
// absent or unparseable — callers treat that the same as "no explicit hint, use our own backoff."
function parseRetryAfterMs(retryAfterHeader) {
  if (!retryAfterHeader) return null;
  const seconds = Number(retryAfterHeader);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds * 1000;
}

// Full jitter (AWS backoff literature): a uniformly random delay between 0 and the exponential
// cap, not the cap itself — spreads retries out instead of every failed caller retrying in
// lockstep. `explicitDelayMs` (a Retry-After value already checked against MAX_RETRY_AFTER_MS by
// the caller) is honoured as-is when present; callers never pass one that exceeds the cap.
function backoffDelayMs(attempt, explicitDelayMs) {
  if (explicitDelayMs !== null) return explicitDelayMs;
  const cap = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  return Math.random() * cap;
}

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
 * (missing key, exhausted retries, any non-2xx, network failure, or an unparseable response) — a
 * single bad call must never fail the whole pipeline run, same fail-soft discipline as
 * lib/live-data.ts. But except for an unparseable/empty response body (a response-shape problem,
 * not an API failure), every one of those cases is now also recorded into `apiErrors` — see this
 * file's header comment for why a systemic failure must surface even though the per-call return
 * value doesn't change.
 *
 * `sleepFn` is a test-only seam (default: the real `sleep` above) — llm.smoketest.mjs injects a
 * no-op so 429-retry coverage doesn't actually wait out a real exponential backoff; no production
 * caller passes it, so real runs always use the real timer.
 */
export async function callLlm(stage, systemPrompt, userPrompt, { sleepFn = sleep } = {}) {
  const model = modelFor(stage);
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    apiErrors.push({ context: `llm ${stage} (${model})`, message: "missing GROQ_API_KEY" });
    console.error(`[llm] ${stage}: no GROQ_API_KEY — recorded as an API error (R3), not skipped`);
    return null;
  }

  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
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
      // Network error — not retried (see this file's header comment on retry scope).
      apiErrors.push({ context: `llm ${stage} (${model})`, message: `network error — ${err.message}` });
      console.error(`[llm] ${stage}: network error calling groq (${model}) — ${err.message}`);
      return null;
    }

    if (res.status === 429) {
      const explicitDelayMs = parseRetryAfterMs(res.headers.get("retry-after"));
      if (explicitDelayMs !== null && explicitDelayMs > MAX_RETRY_AFTER_MS) {
        // A Retry-After this long (e.g. a tokens-per-day exhaustion) can't be waited out within a
        // bounded number of attempts — sleeping for it only stalls the job. Fail loud immediately
        // instead of retrying, same as any other case this file records into apiErrors.
        apiErrors.push({
          context: `llm ${stage} (${model})`,
          message:
            `HTTP 429 — Retry-After ${Math.round(explicitDelayMs / 1000)}s exceeds the ` +
            `${MAX_RETRY_AFTER_MS / 1000}s cap, not waiting${await errorBodySuffix(res)}`,
        });
        console.error(
          `[llm] ${stage}: groq (${model}) 429 with Retry-After ${Math.round(explicitDelayMs / 1000)}s ` +
            `exceeds the ${MAX_RETRY_AFTER_MS / 1000}s cap — failing loud instead of waiting`
        );
        return null;
      }
      if (attempt < MAX_429_RETRIES) {
        const delay = backoffDelayMs(attempt, explicitDelayMs);
        console.warn(
          `[llm] ${stage}: 429 from groq (${model}), retrying in ${Math.round(delay)}ms ` +
            `(attempt ${attempt + 1}/${MAX_429_RETRIES})`
        );
        await sleepFn(delay);
        continue;
      }
      apiErrors.push({
        context: `llm ${stage} (${model})`,
        message: `HTTP 429 — exhausted ${MAX_429_RETRIES} retries${await errorBodySuffix(res)}`,
      });
      console.error(`[llm] ${stage}: groq (${model}) still 429 after ${MAX_429_RETRIES} retries`);
      return null;
    }

    if (!res.ok) {
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
  return null; // unreachable — the loop above always returns before falling off the end
}
