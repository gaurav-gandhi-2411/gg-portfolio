// Forced-error smoke test for scripts/refresh-metrics.mjs itself — run with
// `node scripts/refresh-metrics.forced-error.smoketest.mjs`. No framework, same posture as
// scripts/identity-drift.forced-error.smoketest.mjs.
//
// R3 (owner rule, 2026-09): refresh-metrics.mjs already tracked a failed repo-inventory check via
// `newRepoCheckFailed` (issue #122) but never turned it into a non-zero exit. Stubs
// `globalThis.fetch` (no live network — content/products.ts's real live-link/Hugging Face fetches
// are also routed through the same stub, harmlessly, since PRODUCTS_PATH has no override) and
// points METRICS_PATH/SUMMARY_PATH/NEW_REPOS_PATH at scratch fixtures, then dynamically imports
// the real script and asserts its actual exit code and stderr output.

import assert from "node:assert";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scratch = mkdtempSync(join(tmpdir(), "refresh-metrics-forced-error-"));
const metricsPath = join(scratch, "metrics.json");
const summaryPath = join(scratch, "summary.md");
const newReposPath = join(scratch, "new-repos.json");

writeFileSync(
  metricsPath,
  JSON.stringify(
    {
      version: 1,
      updated_at: "2020-01-01",
      metrics: {
        "fixture:metric": {
          label: "Fixture metric",
          value: "1",
          repo: "octocat/fixture-repo",
          source_file: "README.md",
          source_line: 1,
          commit_sha: "abc123",
          measured_at: "2020-01-01",
        },
      },
    },
    null,
    2
  )
);

process.env.METRICS_PATH = metricsPath;
process.env.SUMMARY_PATH = summaryPath;
process.env.NEW_REPOS_PATH = newReposPath;

const realFetch = globalThis.fetch;
const capturedStderr = [];
const realConsoleError = console.error;
console.error = (...args) => capturedStderr.push(args.join(" "));

globalThis.fetch = async (url) => {
  const u = String(url);
  // The one call this test forces to fail — the repo-inventory check. Everything else (the
  // fixture's own manifest, Hugging Face, real products.ts's live-link checks) reports
  // unreachable too — harmless, already fail-soft by design, and keeps this test off the network.
  if (u.includes("api.github.com")) return { ok: false, status: 403, json: async () => ({}) };
  return { ok: false, status: 503, json: async () => ({}), text: async () => "" };
};

try {
  await import(`./refresh-metrics.mjs?t=${Date.now()}`);

  assert.strictEqual(process.exitCode, 1, "must exit non-zero when the repo-inventory call fails");
  assert.ok(
    capturedStderr.some((l) => l.startsWith("::error::") && l.includes("HTTP 403")),
    "must emit a GitHub Actions ::error:: annotation naming the failed call"
  );
  assert.strictEqual(
    readFileSync(newReposPath, "utf8").trim(),
    "null",
    "new-repos.json must be JSON null (never []) when the check itself failed — issue #122"
  );
  assert.ok(
    readFileSync(summaryPath, "utf8").includes("COULD NOT VERIFY"),
    "the human-readable summary must still record the failure (fail-soft output is not lost)"
  );
} finally {
  console.error = realConsoleError;
  globalThis.fetch = realFetch;
  process.exitCode = 0; // this test process itself succeeded — don't inherit the script's exit code
  delete process.env.METRICS_PATH;
  delete process.env.SUMMARY_PATH;
  delete process.env.NEW_REPOS_PATH;
  rmSync(scratch, { recursive: true, force: true });
}

console.log("refresh-metrics.forced-error.smoketest.mjs: all assertions passed");
