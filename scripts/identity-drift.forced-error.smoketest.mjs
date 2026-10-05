// Forced-error smoke test for scripts/identity-drift.mjs itself — run with
// `node scripts/identity-drift.forced-error.smoketest.mjs`. No framework, same posture as
// scripts/lib/identity-drift-diff.smoketest.mjs.
//
// R3 (owner rule, 2026-09): identity-drift.mjs used to catch every per-product fetch error into a
// free-form note and always exit 0 — even with GITHUB_TOKEN=invalid. Stubs `globalThis.fetch` (no
// live network) and points PRODUCTS_PATH/IDENTITY_STATE_PATH at scratch fixtures (env overrides
// added alongside this fix so a test never touches this repo's real content/ files), then
// dynamically imports the real script and asserts its actual exit code and stderr output.

import assert from "node:assert";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scratch = mkdtempSync(join(tmpdir(), "identity-drift-forced-error-"));
const productsPath = join(scratch, "products.ts");
const identityStatePath = join(scratch, "identity-state.json");
const summaryPath = join(scratch, "summary.md");
const renamesPath = join(scratch, "renames.json");

writeFileSync(
  productsPath,
  `export const products: Product[] = [
  {
    slug: "fixture-product",
    name: "Fixture Product",
    repoUrl: "https://github.com/octocat/Hello-World",
  },
];
`
);

process.env.PRODUCTS_PATH = productsPath;
process.env.IDENTITY_STATE_PATH = identityStatePath;
process.env.DRIFT_SUMMARY_PATH = summaryPath;
process.env.DRIFT_RENAMES_PATH = renamesPath;

const realFetch = globalThis.fetch;
const capturedStderr = [];
const realConsoleError = console.error;
console.error = (...args) => capturedStderr.push(args.join(" "));

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("raw.githubusercontent.com")) {
    return { ok: true, status: 200, text: async () => "# Fixture Product\n" };
  }
  if (u.includes("api.github.com")) {
    // The one call this test forces to fail — a real repo-metadata lookup.
    return { ok: false, status: 403, json: async () => ({}) };
  }
  throw new Error(`unexpected fetch in forced-error test: ${u}`);
};

try {
  await import(`./identity-drift.mjs?t=${Date.now()}`);

  assert.strictEqual(process.exitCode, 1, "must exit non-zero when a GitHub API call fails");
  assert.ok(
    capturedStderr.some((l) => l.startsWith("::error::") && l.includes("HTTP 403")),
    "must emit a GitHub Actions ::error:: annotation naming the failed call"
  );
  assert.ok(
    readFileSync(summaryPath, "utf8").includes("repo metadata fetch failed"),
    "the human-readable summary must still record the failure (fail-soft output is not lost)"
  );
} finally {
  console.error = realConsoleError;
  globalThis.fetch = realFetch;
  process.exitCode = 0; // this test process itself succeeded — don't inherit the script's exit code
  delete process.env.PRODUCTS_PATH;
  delete process.env.IDENTITY_STATE_PATH;
  delete process.env.DRIFT_SUMMARY_PATH;
  delete process.env.DRIFT_RENAMES_PATH;
  rmSync(scratch, { recursive: true, force: true });
}

console.log("identity-drift.forced-error.smoketest.mjs: all assertions passed");
