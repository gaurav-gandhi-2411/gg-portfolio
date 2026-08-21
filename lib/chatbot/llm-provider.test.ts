import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

// llm-provider.ts reaches lib/chatbot/pricing through Next's "@/*" path
// alias, which plain Node does not resolve — same fix as answer.test.ts's
// own comment.
register(pathToFileURL("evals/chatbot/alias-loader.mjs").href, import.meta.url);

const { fetchWithRetry, isRetryableStatus } = await import("./llm-provider.ts");

/**
 * Round three (GG's follow-up-chip bug report, re-diagnosed): all 3 real
 * "grounding refused" chip failures traced to production logs showing
 * `[llm-provider] groq returned 429` at ~80ms latency with the CORRECT,
 * relevant, above-threshold retrievedSourceRefs already present — not a
 * retrieval-chunk mismatch, a Groq rate-limit that was never retried. These
 * test fetchWithRetry directly against a mocked global.fetch, since a real
 * 429 needs actually hitting Groq's own rate limit to reproduce live.
 */

function mockFetchSequence(responses: Response[]): { calls: number; restore: () => void } {
  const original = globalThis.fetch;
  let i = 0;
  const state = { calls: 0, restore: () => { globalThis.fetch = original; } };
  globalThis.fetch = (async () => {
    state.calls++;
    const res = responses[Math.min(i, responses.length - 1)];
    i++;
    return res;
  }) as typeof fetch;
  return state;
}

function fakeResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

test("isRetryableStatus: 429 and 5xx are retryable, other 4xx are not", () => {
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(400), false);
  assert.equal(isRetryableStatus(401), false);
  assert.equal(isRetryableStatus(404), false);
});

test("fetchWithRetry: a 429 followed by a 200 succeeds on retry", async () => {
  const state = mockFetchSequence([fakeResponse(429), fakeResponse(200)]);
  try {
    const res = await fetchWithRetry("https://example.test", {}, 2);
    assert.equal(res.status, 200);
    assert.equal(state.calls, 2);
  } finally {
    state.restore();
  }
});

test("fetchWithRetry: exhausts retries and returns the last failing response", async () => {
  const state = mockFetchSequence([fakeResponse(429), fakeResponse(429), fakeResponse(429)]);
  try {
    const res = await fetchWithRetry("https://example.test", {}, 2);
    assert.equal(res.status, 429);
    assert.equal(state.calls, 3); // initial attempt + 2 retries
  } finally {
    state.restore();
  }
});

test("fetchWithRetry: a non-retryable 400 returns immediately, no retry", async () => {
  const state = mockFetchSequence([fakeResponse(400), fakeResponse(200)]);
  try {
    const res = await fetchWithRetry("https://example.test", {}, 2);
    assert.equal(res.status, 400);
    assert.equal(state.calls, 1);
  } finally {
    state.restore();
  }
});

test("fetchWithRetry: respects a numeric Retry-After header instead of guessing", async () => {
  const state = mockFetchSequence([
    fakeResponse(429, { "retry-after": "0" }),
    fakeResponse(200),
  ]);
  try {
    const start = Date.now();
    const res = await fetchWithRetry("https://example.test", {}, 2);
    const elapsed = Date.now() - start;
    assert.equal(res.status, 200);
    // retry-after: 0 should not fall back to the ~300ms+ default backoff.
    assert.ok(elapsed < 200, `expected a near-instant retry, took ${elapsed}ms`);
  } finally {
    state.restore();
  }
});
