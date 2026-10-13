import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveBuildSha } from "./build-sha.ts";

/**
 * Stated before reading the implementation: the build SHA is Vercel's VERCEL_GIT_COMMIT_SHA when
 * set; otherwise `git rev-parse HEAD` when git works; otherwise the literal "dev". It never
 * throws (a missing git binary must not fail a build) and never returns anything that is not a
 * 40-hex SHA or "dev".
 */
const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);

test("VERCEL_GIT_COMMIT_SHA wins and git is not consulted", () => {
  const got = resolveBuildSha({ VERCEL_GIT_COMMIT_SHA: SHA }, () => {
    throw new Error("git must not run");
  });
  assert.equal(got, SHA);
});

test("unset env falls back to git rev-parse", () => {
  assert.equal(resolveBuildSha({}, () => `${OTHER}\n`), OTHER);
});

test("neither available gives 'dev' without throwing", () => {
  assert.equal(
    resolveBuildSha({}, () => {
      throw new Error("git: not found");
    }),
    "dev",
  );
});

test("malformed env value or git output is rejected, not emitted", () => {
  assert.equal(resolveBuildSha({ VERCEL_GIT_COMMIT_SHA: "nope" }, () => "also nope"), "dev");
  assert.equal(resolveBuildSha({ VERCEL_GIT_COMMIT_SHA: "" }, () => OTHER), OTHER);
});

test("uppercase SHA is normalised to lowercase", () => {
  assert.equal(resolveBuildSha({ VERCEL_GIT_COMMIT_SHA: SHA.toUpperCase() }, () => ""), SHA);
});
