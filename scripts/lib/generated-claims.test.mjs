// Tests for scripts/lib/generated-claims.mjs (the freshness verdict for generated case-study claims).
// Run: node --test scripts/lib/generated-claims.test.mjs
// Hermetic: reads a scratch snapshot in a temp dir; no network, committed snapshot untouched.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { claimAccounting } from "./case-study-claims.mjs";

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

describe("generated claims stay out of the numeric accounting (no double count)", () => {
  const rows = [
    { status: "CURRENT" },
    { status: "SKIPPED_PRIVATE_REPO" },
    { status: "NOT_NUMERIC" },
    { status: "SELF_REPORTED" },
    { status: "GENERATED" },
    { status: "GENERATED_OVERDUE" },
    { status: "GENERATED_UNREADABLE" },
  ];
  test("numericTotal counts only CURRENT + SKIPPED_PRIVATE_REPO", () => {
    assert.equal(claimAccounting(rows).numericTotal, 2);
  });
  test("generated statuses are not in the UNCHECKED-private count", () => {
    assert.equal(claimAccounting(rows).skippedPrivate, 1);
  });
});

describe("snapshot import failure is reported as GENERATED_UNREADABLE for that study's ref", () => {
  const snaps = { "aetherart:hf-downloads": "content/generated/hf-downloads.json", "other:x": "x.json" };
  test("only refs belonging to the failed study, with GENERATED_UNREADABLE status", async () => {
    const { unreadableForStudy } = await import("./generated-claims.mjs");
    const r = unreadableForStudy("aetherart", snaps, "boom");
    assert.equal(r.length, 1);
    assert.equal(r[0].sourceRef, "aetherart:hf-downloads");
    assert.equal(r[0].status, "GENERATED_UNREADABLE");
    assert.match(r[0].detail, /boom/);
  });
  test("a study with no generated ref yields nothing", async () => {
    const { unreadableForStudy } = await import("./generated-claims.mjs");
    assert.deepEqual(unreadableForStudy("warmer", snaps, "boom"), []);
  });
});

describe("weekly issue step opens an issue for GENERATED problems", () => {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const wf = readFileSync(join(ROOT, ".github", "workflows", "metrics-refresh.yml"), "utf8");
  const m = wf.match(/grep -qE "([^"]+)" \/tmp\/metric-freshness-summary\.md/);
  test("the workflow's grep pattern is found", () => assert.ok(m, "grep -qE pattern not found"));
  const re = new RegExp(m ? m[1] : "(?!)");
  test("still matches the pre-existing triggers", () => {
    for (const t of ["Possible drift", "Unverifiable this run", "Overdue for re-verification", "Could not check"]) {
      assert.match(`### ${t}`, re);
    }
  });
  test("matches GENERATED_OVERDUE and GENERATED_UNREADABLE lines", () => {
    assert.match("- **GENERATED_OVERDUE** `aetherart:hf-downloads`: x", re);
    assert.match("- **GENERATED_UNREADABLE** `aetherart:hf-downloads`: x", re);
  });
  test("does not fire on a healthy GENERATED line", () => {
    assert.doesNotMatch("### 1 claim(s) GENERATED from a live API (not text-checked)\n- `a`: fetched ok", re);
  });
});
