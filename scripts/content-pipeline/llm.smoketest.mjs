// Forced-error smoke test for scripts/content-pipeline/llm.mjs's callLlm() — run directly with
// `node scripts/content-pipeline/llm.smoketest.mjs`. No framework, same posture as
// scripts/content-pipeline/extractor.smoketest.mjs.
//
// R3 (owner rule, 2026-09): "no silent failure — every script touching an external API must exit
// non-zero on any API error." callLlm() used to swallow every failure (missing key, any non-2xx,
// network error) into a bare `null` with only a console.warn — see llm.mjs's header comment for
// why that made a systemic failure (a dead model, a bad key) indistinguishable from "the curator
// rejected this one candidate." This test stubs `globalThis.fetch` (no live network) and asserts
// the exported `apiErrors` array — the thing run.mjs actually checks to set a non-zero exit code —
// is populated in exactly the cases R3 requires, and left alone in the cases that stay fail-soft by
// design (a malformed/empty response body).
//
// This is the fix/content-pipeline-llm-fail-loud-b2 slice, stacked on b1: adds bounded
// retry-with-backoff for 429 specifically, layered onto b1's fail-loud-on-everything-else
// baseline (404/401/400/network/missing-key coverage lives in b1's own smoketest and is unchanged
// here — this file only replaces b1's single "429 is never retried" case with 429-then-success,
// 429-exhausted, and the two MAX_RETRY_AFTER_MS cap cases below (within the cap → retried; above
// it → failed loud immediately, added after a live GREEN proof honoured a real 589s Retry-After
// on a genuine Groq tokens-per-day exhaustion — see llm.mjs's header comment).
//
// `sleepFn` (llm.mjs's test-only seam) is stubbed to a no-op below so the 429-retry coverage
// doesn't actually wait out a real exponential backoff.

import assert from "node:assert";
import { callLlm, apiErrors } from "./llm.mjs";

const realFetch = globalThis.fetch;
process.env.GROQ_API_KEY = "test-key-not-real";
const noopSleep = async () => {};

function jsonResponse(body) {
  return { ok: true, status: 200, headers: new Headers(), json: async () => body };
}

const OK_BODY = { choices: [{ message: { content: JSON.stringify({ passes: true }) } }] };

// --- 429 then success: retried, no apiErrors entry, real result returned -------------------
{
  apiErrors.length = 0;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) {
      return { ok: false, status: 429, headers: new Headers(), text: async () => "" };
    }
    return jsonResponse(OK_BODY);
  };
  try {
    const result = await callLlm("curator", "sys", "user", { sleepFn: noopSleep });
    assert.strictEqual(calls, 2, "must retry exactly once after a single 429");
    assert.deepStrictEqual(result, { passes: true });
    assert.strictEqual(apiErrors.length, 0, "a retry that succeeds must not be recorded as a failure");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- 429 exhausted: retried MAX_429_RETRIES times, then recorded + null returned -----------
{
  apiErrors.length = 0;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: false, status: 429, headers: new Headers(), text: async () => "" };
  };
  try {
    const result = await callLlm("verifier", "sys", "user", { sleepFn: noopSleep });
    assert.strictEqual(result, null, "exhausted retries must fail soft for the caller (per-candidate skip)");
    assert.strictEqual(apiErrors.length, 1, "exhausted retries must be recorded exactly once");
    assert.ok(apiErrors[0].message.includes("429"), "recorded message must name the HTTP status");
    assert.ok(apiErrors[0].message.toLowerCase().includes("exhaust"), "must say retries were exhausted");
    assert.ok(apiErrors[0].context.includes("verifier"), "recorded context must name the stage");
    assert.ok(calls > 1, "must have actually retried before giving up");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- Retry-After within the cap: honoured as-is, sleeps and retries ------------------------
{
  apiErrors.length = 0;
  let calls = 0;
  const sleepCalls = [];
  const spySleep = async (ms) => sleepCalls.push(ms);
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) {
      return {
        ok: false,
        status: 429,
        headers: new Headers({ "retry-after": "30" }), // 30s, under the 60s MAX_RETRY_AFTER_MS cap
        text: async () => "",
      };
    }
    return jsonResponse(OK_BODY);
  };
  try {
    const result = await callLlm("curator", "sys", "user", { sleepFn: spySleep });
    assert.strictEqual(calls, 2, "a Retry-After within the cap must still retry");
    assert.deepStrictEqual(result, { passes: true });
    assert.strictEqual(apiErrors.length, 0, "a retry that succeeds must not be recorded as a failure");
    assert.deepStrictEqual(sleepCalls, [30_000], "must sleep for exactly the Retry-After value, in ms");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- Retry-After above the cap: not worth waiting for (e.g. a daily-quota exhaustion) — no
// sleep, immediately recorded as an API error naming the requested wait and the stage/model ------
{
  apiErrors.length = 0;
  let calls = 0;
  const sleepCalls = [];
  const spySleep = async (ms) => sleepCalls.push(ms);
  globalThis.fetch = async () => {
    calls++;
    return {
      ok: false,
      status: 429,
      headers: new Headers({ "retry-after": "589" }), // 589s, over the 60s MAX_RETRY_AFTER_MS cap
      text: async () => "",
    };
  };
  try {
    const result = await callLlm("verifier", "sys", "user", { sleepFn: spySleep });
    assert.strictEqual(result, null);
    assert.strictEqual(calls, 1, "a Retry-After over the cap must not be retried at all");
    assert.deepStrictEqual(sleepCalls, [], "must never sleep when the cap is exceeded");
    assert.strictEqual(apiErrors.length, 1);
    assert.ok(apiErrors[0].message.includes("589"), "recorded message must include the requested wait");
    assert.ok(apiErrors[0].message.includes("60"), "recorded message must include the cap");
    assert.ok(apiErrors[0].context.includes("verifier"), "recorded context must name the stage");
    assert.ok(apiErrors[0].context.includes("qwen"), "recorded context must name the model");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- 404 (dead model id): immediately recorded + null returned -----------------------------
{
  apiErrors.length = 0;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: false, status: 404, headers: new Headers(), text: async () => "" };
  };
  try {
    const result = await callLlm("verifier", "sys", "user");
    assert.strictEqual(result, null);
    assert.strictEqual(calls, 1);
    assert.strictEqual(apiErrors.length, 1);
    assert.ok(apiErrors[0].message.includes("404"), "recorded message must name the HTTP status");
    assert.ok(apiErrors[0].context.includes("verifier"), "recorded context must name the stage");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- 401 (bad key): immediately recorded + null returned -----------------------------------
{
  apiErrors.length = 0;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: false, status: 401, headers: new Headers(), text: async () => "" };
  };
  try {
    const result = await callLlm("curator", "sys", "user");
    assert.strictEqual(result, null);
    assert.strictEqual(calls, 1, "an auth error must never be retried");
    assert.strictEqual(apiErrors.length, 1);
    assert.ok(apiErrors[0].message.includes("401"), "recorded message must name the HTTP status");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- 400 (bad request, e.g. a payload the model rejects): body echoed in the message, so a
// future "context length exceeded"-style failure is diagnosable from the log alone ------------
{
  apiErrors.length = 0;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return {
      ok: false,
      status: 400,
      headers: new Headers(),
      text: async () => '{"error":{"message":"model does not support this request"}}',
    };
  };
  try {
    const result = await callLlm("verifier", "sys", "user");
    assert.strictEqual(result, null);
    assert.strictEqual(calls, 1);
    assert.strictEqual(apiErrors.length, 1);
    assert.ok(apiErrors[0].message.includes("400"), "recorded message must name the HTTP status");
    assert.ok(
      apiErrors[0].message.includes("model does not support this request"),
      "recorded message must include the response body for diagnosis"
    );
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- error body unreadable: must not throw, just omits the extra detail --------------------
{
  apiErrors.length = 0;
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    headers: new Headers(),
    text: async () => {
      throw new Error("body already consumed");
    },
  });
  try {
    const result = await callLlm("curator", "sys", "user");
    assert.strictEqual(result, null);
    assert.strictEqual(apiErrors.length, 1);
    assert.strictEqual(apiErrors[0].message, "HTTP 500", "an unreadable body must not throw or add junk");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- network error: immediately recorded + null returned -----------------------------------
{
  apiErrors.length = 0;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("getaddrinfo ENOTFOUND api.groq.com");
  };
  try {
    const result = await callLlm("framer", "sys", "user");
    assert.strictEqual(result, null);
    assert.strictEqual(calls, 1, "a network error must never be retried");
    assert.strictEqual(apiErrors.length, 1);
    assert.ok(apiErrors[0].message.includes("network error"));
    assert.ok(apiErrors[0].context.includes("framer"), "recorded context must name the stage");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- missing GROQ_API_KEY: recorded as an API error (R3), not a quiet skip -----------------
{
  apiErrors.length = 0;
  const realKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  globalThis.fetch = async () => {
    throw new Error("must not be called when the key is missing");
  };
  try {
    const result = await callLlm("curator", "sys", "user");
    assert.strictEqual(result, null);
    assert.strictEqual(apiErrors.length, 1, "a missing key must now be recorded (R3), not silently skipped");
    assert.ok(apiErrors[0].message.includes("GROQ_API_KEY"));
  } finally {
    globalThis.fetch = realFetch;
    process.env.GROQ_API_KEY = realKey;
  }
}

// --- malformed/empty response body: stays fail-soft, NOT an apiErrors entry ----------------
// A 2xx with no parseable content is a response-shape problem, not an API failure — see llm.mjs's
// callLlm() doc comment. Must not be conflated with the R3 cases above.
{
  apiErrors.length = 0;
  globalThis.fetch = async () => jsonResponse({ choices: [] });
  try {
    const result = await callLlm("curator", "sys", "user");
    assert.strictEqual(result, null);
    assert.strictEqual(apiErrors.length, 0, "an empty/malformed 2xx body must not count as an API error");
  } finally {
    globalThis.fetch = realFetch;
  }
}

apiErrors.length = 0; // leave the shared module state clean for anything run after this in-process
console.log("llm.smoketest.mjs: all assertions passed");
