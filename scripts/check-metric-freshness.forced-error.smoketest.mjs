// Forced-error smoke test for scripts/check-metric-freshness.mjs itself — run with
// `node scripts/check-metric-freshness.forced-error.smoketest.mjs`. No framework, same posture as
// scripts/identity-drift.forced-error.smoketest.mjs and
// scripts/refresh-metrics.forced-error.smoketest.mjs.
//
// R3 (owner rule, 2026-09): this script used to always exit 0 by design — metric STALENESS
// (drift, overdue verification, etc.) is a soft, report-only signal, and that's still correct.
// But checkShaReachability's repo-metadata/compare calls are the one place this file touches the
// real GitHub REST API, and a failure there was folded into the same soft UNVERIFIABLE bucket as
// everything else — an invalid GITHUB_TOKEN or a rate limit produced a clean exit 0. This asserts
// the fix: an API error (not a staleness finding) now exits non-zero, while a staleness-only run
// still exits 0 and still drives the issue-open/update signal via the summary file.
//
// Stubs `globalThis.fetch` (no live network) and points METRICS_PATH_OVERRIDE/
// FRESHNESS_SUMMARY_PATH at scratch fixtures (env overrides this script already supported, for
// exactly this kind of test — see its own header). CASE_STUDIES_INDEX_PATH/CASE_STUDIES_DIR/
// PROVENANCE_PATH_OVERRIDE default to the real repo's content/ (read-only, harmless) — every
// fetch those checks make also goes through the same stub, off the network.

import assert from "node:assert";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function run(label, { forceApiError }) {
  const scratch = mkdtempSync(join(tmpdir(), "metric-freshness-forced-error-"));
  const metricsPath = join(scratch, "metrics.json");
  const summaryPath = join(scratch, "summary.md");

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

  process.env.METRICS_PATH_OVERRIDE = metricsPath;
  process.env.FRESHNESS_SUMMARY_PATH = summaryPath;

  const realFetch = globalThis.fetch;
  const capturedStderr = [];
  const realConsoleError = console.error;
  console.error = (...args) => capturedStderr.push(args.join(" "));

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("api.github.com")) {
      // The one call class this test controls — checkShaReachability's repo-metadata/compare
      // lookups against our fixture entry. forceApiError=false must make BOTH calls succeed
      // (not just "not 403") — any non-2xx here throws and is tracked as an apiError regardless
      // of status code, so isolating the "no API error" case requires a real success response.
      if (!forceApiError) {
        return u.includes("/compare/")
          ? { ok: true, status: 200, json: async () => ({ status: "identical" }) }
          : { ok: true, status: 200, json: async () => ({ default_branch: "main" }) };
      }
      return { ok: false, status: 403, json: async () => ({}) };
    }
    // Everything else (raw.githubusercontent.com source-file/SVG/claim fetches against the real
    // repo's own content/) reports unreachable too — harmless, already fail-soft by design (same
    // convention as refresh-metrics.forced-error.smoketest.mjs), and keeps this test off the
    // network in both cases.
    return { ok: false, status: 503, json: async () => ({}), text: async () => "" };
  };

  let result;
  try {
    await import(`./check-metric-freshness.mjs?t=${Date.now()}-${label}`);
    result = {
      exitCode: process.exitCode,
      stderr: capturedStderr.slice(),
      summary: readFileSync(summaryPath, "utf8"),
    };
  } finally {
    console.error = realConsoleError;
    globalThis.fetch = realFetch;
    // Reset to the pristine (unset) state, not 0 — the two cases below run in the same process via
    // two dynamic imports, and Case 2 asserts "never touched" (undefined), which a reset to the
    // literal number 0 would mask (the script itself never explicitly sets 0, only ever 1).
    process.exitCode = undefined;
    delete process.env.METRICS_PATH_OVERRIDE;
    delete process.env.FRESHNESS_SUMMARY_PATH;
    rmSync(scratch, { recursive: true, force: true });
  }
  return result;
}

// Case 1: a real GitHub API error (checkShaReachability's repo-metadata call fails) must exit
// non-zero and name the failure — this is the bug this PR fixes.
{
  const r = await run("api-error", { forceApiError: true });
  assert.strictEqual(r.exitCode, 1, "must exit non-zero when a GitHub API call fails");
  assert.ok(
    r.stderr.some((l) => l.startsWith("::error::") && l.includes("HTTP 403")),
    "must emit a GitHub Actions ::error:: annotation naming the failed call"
  );
  assert.ok(
    r.summary.includes("cannot read octocat/fixture-repo"),
    "the human-readable summary must still record the sha-reachability failure (fail-soft output is not lost)"
  );
}

// Case 2: metric STALENESS is still a soft signal. Here checkShaReachability's two
// api.github.com calls both succeed (the fixture's SHA IS reachable), so no apiError is tracked
// — but every raw.githubusercontent.com fetch (source-file/SVG/claim checks against the real
// repo's own content/) still fails, producing genuine UNVERIFIABLE findings elsewhere. That split
// is exactly the point: content-CDN fetch failures are staleness-adjacent signals, never API
// errors, and must never flip the exit code.
{
  const r = await run("staleness-only", { forceApiError: false });
  assert.strictEqual(
    r.exitCode,
    undefined,
    "a run with no GitHub API error must not set a non-zero exit code, even with other UNVERIFIABLE findings"
  );
  assert.strictEqual(r.stderr.length, 0, "no ::error:: annotation when no GitHub API call failed");
  assert.ok(
    r.summary.includes("All 1 cited SHAs are reachable from their default branch."),
    "the summary must still record the (successful) sha-reachability result"
  );
}

console.log("check-metric-freshness.forced-error.smoketest.mjs: all assertions passed");
