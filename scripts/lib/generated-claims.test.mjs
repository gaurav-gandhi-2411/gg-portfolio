// Tests for scripts/lib/generated-claims.mjs (the freshness verdict for generated case-study claims).
// Run: node --test scripts/lib/generated-claims.test.mjs
// Hermetic: reads a scratch snapshot in a temp dir; no network, committed snapshot untouched.

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

describe("freshness checker treats the row as GENERATED, not text-presence", () => {
  const snapDir = mkdtempSync(join(tmpdir(), "hf-gen-claim-"));
  const rel = "snap.json";
  writeFileSync(
    join(snapDir, rel),
    JSON.stringify({
      fetchedAt: "2026-10-10",
      models: [{ downloads: 38 }, { downloads: 23 }, { downloads: 0 }],
    })
  );
  const day = Date.parse("2026-10-10T12:00:00Z");
  const shown = "38 · 23 · 0 ukiyo-e SDXL";

  test("fresh snapshot matching the displayed figures is GENERATED", async () => {
    const { checkGeneratedClaim } = await import("./generated-claims.mjs");
    assert.equal(checkGeneratedClaim(snapDir, rel, shown, 14, day).status, "GENERATED");
  });
  test("old literals on the page (124 / 14 / 0) are NOT current: unreadable/mismatch", async () => {
    const { checkGeneratedClaim } = await import("./generated-claims.mjs");
    const r = checkGeneratedClaim(snapDir, rel, "124 · 14 · 0", 14, day);
    assert.equal(r.status, "GENERATED_UNREADABLE");
  });
  test("snapshot older than the overdue window is GENERATED_OVERDUE", async () => {
    const { checkGeneratedClaim } = await import("./generated-claims.mjs");
    const r = checkGeneratedClaim(snapDir, rel, shown, 14, day + 15 * 86_400_000);
    assert.equal(r.status, "GENERATED_OVERDUE");
  });
  test("missing snapshot fails closed", async () => {
    const { checkGeneratedClaim } = await import("./generated-claims.mjs");
    assert.equal(checkGeneratedClaim(snapDir, "nope.json", shown, 14, day).status, "GENERATED_UNREADABLE");
  });
});
