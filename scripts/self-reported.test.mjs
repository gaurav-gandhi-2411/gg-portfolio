// Tests for the "self-reported (private repo)" mechanism on the Warmer case study.
// Run: node --test scripts/self-reported.test.mjs
//
// Contract (written before the implementation):
//  - A result/decision/story can carry `selfReported: true`; the freshness checker must then report
//    it as SELF_REPORTED (its own section), NOT as UNCHECKED-private / drift / unverifiable.
//  - Only claims that truly cannot be verified are flagged. Warmer's hinglish-fix headline,
//    hinglish-baseline and embedding-separation are backed by the PUBLIC mindmeld-payloads repo
//    (content/metrics.json) and must NOT be labelled; the public-benchmark row cites the public
//    Hugging Face model card and must NOT be labelled either.
//  - Hermetic: reads local content files only.

import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, test } from "node:test";

import { SELF_REPORTED_LABEL, collectCaseStudyClaims, classifySelfReported } from "./lib/case-study-claims.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { warmer } = await import(pathToFileURL(join(ROOT, "content", "case-studies", "warmer.ts")).href);

describe("collectCaseStudyClaims carries selfReported through", () => {
  const study = {
    results: [
      { sourceRef: "x:a", label: "A", value: "1", selfReported: true },
      { sourceRef: "x:b", label: "B", value: "2" },
    ],
    decisions: [{ sourceRef: "x:c", title: "C", body: "3", selfReported: true }],
    story: { sourceRef: "x:d", title: "D", body: ["4"], selfReported: true },
  };
  test("result, decision and story", () => {
    const claims = collectCaseStudyClaims(study);
    const by = Object.fromEntries(claims.map((c) => [c.sourceRef, c.selfReported === true]));
    assert.deepEqual(by, { "x:a": true, "x:b": false, "x:c": true, "x:d": true });
  });
});

describe("page label and checker label are one string", () => {
  test("lib/self-reported.ts === scripts/lib/case-study-claims.mjs", async () => {
    const { SELF_REPORTED_LABEL: pageLabel } = await import(
      pathToFileURL(join(ROOT, "lib", "self-reported.ts")).href
    );
    assert.equal(pageLabel, SELF_REPORTED_LABEL);
    assert.equal(pageLabel, "self-reported (private repo)");
  });
});

describe("classifySelfReported", () => {
  test("flagged claim is SELF_REPORTED and says why it is not drift-checked", () => {
    const r = classifySelfReported({ selfReported: true });
    assert.equal(r.status, "SELF_REPORTED");
    assert.match(r.detail, /private/);
  });
  test("unflagged claim returns null (falls through to the normal checks)", () => {
    assert.equal(classifySelfReported({}), null);
    assert.equal(classifySelfReported({ selfReported: false }), null);
  });
});

describe("Warmer content flags exactly the unverifiable claims", () => {
  const label = (x) => x.label ?? x.title;
  const flagged = [...warmer.results, ...warmer.decisions]
    .filter((x) => x.selfReported)
    .map((x) => x.sourceRef + " | " + label(x));

  test("results + decisions flagged", () => {
    assert.deepEqual(flagged.sort(), [
      "warmer:lora-reframe | When fine-tuning failed twice, change the method, not the data",
      "warmer:hinglish-fix | Cross-language consistency (translation pairs landing in the right band)",
      "warmer:perf-budget | Web perf (tracked budget)",
      "warmer:tests | Test suite",
      "warmer:wasm-decision | Compile Dart to WebAssembly, decided by measurement",
    ].sort());
  });
  test("public-backed claims are NOT labelled", () => {
    const publicRows = warmer.results.filter((r) =>
      ["warmer:hinglish-baseline", "warmer:embedding-separation", "warmer:hinglish-public-benchmark"].includes(
        r.sourceRef
      )
    );
    assert.equal(publicRows.length, 3);
    for (const r of publicRows) assert.ok(!r.selfReported, r.sourceRef);
    const headline = warmer.results.find((r) => r.value === "0.813");
    assert.ok(headline && !headline.selfReported);
  });
  test("story is flagged (its sourceRef is the private PLAN.md claim)", () => {
    assert.equal(warmer.story.selfReported, true);
  });
});
