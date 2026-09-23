// Forced-error smoke test for scripts/content-pipeline/extractor.mjs's extract() — run directly
// with `node scripts/content-pipeline/extractor.smoketest.mjs`. No framework, same posture as
// scripts/lib/identity-drift-diff.smoketest.mjs.
//
// R3 (owner rule, 2026-09): "no silent failure — every script touching the GitHub API must exit
// non-zero on any API error." extract()'s commit-SHA lookup (api.github.com) used to swallow a
// failure into `commitSha: undefined` with no record anywhere. This forces that call to fail
// (stubbed `fetch`, no live network) and asserts it's recorded into the exported `apiErrors`
// array instead — run.mjs reads that array after every repo has been processed and exits
// non-zero if it's non-empty (see run.mjs's own comment at that check).

import assert from "node:assert";
import { extract, apiErrors } from "./extractor.mjs";

const realFetch = globalThis.fetch;

// --- commit-SHA lookup failing is recorded in apiErrors, not silently swallowed ------------
{
  apiErrors.length = 0; // module-level array — reset between test blocks
  globalThis.fetch = async (url) => {
    if (String(url).includes("/README.md")) {
      return { ok: true, status: 200, text: async () => "# demo\n\nAccuracy: 91.2 percent\n" };
    }
    // the commit-SHA lookup (api.github.com/repos/.../commits)
    return { ok: false, status: 403, json: async () => ({}) };
  };
  try {
    const metricsStore = { metrics: {} };
    const result = await extract("owner/repo", metricsStore);

    // Fail-soft per repo still holds: candidates are still returned, using the README that DID
    // fetch successfully, and no exception is thrown up to the caller.
    assert.ok(result.candidates.length > 0, "readme candidates must still be extracted");
    assert.strictEqual(
      result.candidates[0].commit_sha,
      undefined,
      "commit_sha stays undefined when the lookup failed — a candidate is never invented one"
    );

    // But the failure IS recorded, not silently dropped (the R3 fix).
    assert.strictEqual(apiErrors.length, 1);
    assert.ok(apiErrors[0].context.includes("owner/repo"));
    assert.ok(apiErrors[0].message.includes("403"));
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- success case: no apiErrors entry, commit_sha populated normally -----------------------
{
  apiErrors.length = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/README.md")) {
      return { ok: true, status: 200, text: async () => "# demo\n\nAccuracy: 91.2 percent\n" };
    }
    return { ok: true, status: 200, json: async () => [{ sha: "abc123" }] };
  };
  try {
    const metricsStore = { metrics: {} };
    const result = await extract("owner/repo", metricsStore);
    assert.strictEqual(apiErrors.length, 0, "a successful lookup must not be recorded as a failure");
    assert.strictEqual(result.candidates[0].commit_sha, "abc123");
  } finally {
    globalThis.fetch = realFetch;
    apiErrors.length = 0;
  }
}

console.log("extractor.smoketest.mjs: all assertions passed");
