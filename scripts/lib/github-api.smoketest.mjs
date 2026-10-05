// Forced-error smoke test for scripts/lib/github-api.mjs — run with
// `node scripts/lib/github-api.smoketest.mjs`. No framework, same posture as
// identity-drift-diff.smoketest.mjs. Stubs `globalThis.fetch` (no live network — this repo
// deliberately keeps live-network checks out of ci.yml's required build job).
//
// R3 (owner rule, 2026-09): "no silent failure — every script touching the GitHub API must exit
// non-zero on any API error." This exercises the shared fetch helper identity-drift.mjs,
// refresh-metrics.mjs, and content-pipeline/extractor.mjs all call through.

import assert from "node:assert";
import { githubApiGet, formatApiErrorLines } from "./github-api.mjs";

const realFetch = globalThis.fetch;
async function withStub(impl, run) {
  globalThis.fetch = impl;
  try {
    return await run();
  } finally {
    globalThis.fetch = realFetch;
  }
}

// non-2xx, network error, and malformed body all throw — none are swallowed.
await withStub(
  async () => ({ ok: false, status: 403, json: async () => ({}) }),
  () => assert.rejects(() => githubApiGet("/repos/o/n"), /HTTP 403/)
);
await withStub(
  async () => {
    throw new Error("getaddrinfo ENOTFOUND api.github.com");
  },
  () => assert.rejects(() => githubApiGet("/repos/o/n"), /ENOTFOUND/)
);
await withStub(
  async () => ({ ok: true, status: 200, json: async () => Promise.reject(new SyntaxError("bad json")) }),
  () => assert.rejects(() => githubApiGet("/repos/o/n"), /bad json/)
);

// success returns the parsed body; token → Authorization header; GITHUB_API_BASE is respected.
await withStub(
  async (url, init) => {
    assert.strictEqual(url, "http://127.0.0.1:1/repos/o/n");
    assert.strictEqual(init.headers.Authorization, "Bearer test-token");
    return { ok: true, status: 200, json: async () => ({ archived: true }) };
  },
  async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_API_BASE = "http://127.0.0.1:1";
    try {
      assert.deepStrictEqual(await githubApiGet("/repos/o/n"), { archived: true });
    } finally {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GITHUB_API_BASE;
    }
  }
);

// formatApiErrorLines: one ::error:: line per failure, naming context + message.
const lines = formatApiErrorLines([
  { context: "adk-tracegauge: repo metadata", message: "HTTP 403" },
  { context: "reclaim: repo metadata", message: "HTTP 404" },
]);
assert.strictEqual(lines.length, 2);
assert.ok(lines[0].startsWith("::error::") && lines[0].includes("HTTP 403"));
assert.ok(lines[1].includes("reclaim") && lines[1].includes("HTTP 404"));
assert.deepStrictEqual(formatApiErrorLines([]), []);

console.log("github-api.smoketest.mjs: all assertions passed");
