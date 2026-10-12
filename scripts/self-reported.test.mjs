// Tests for Warmer verifiability labelling. Run: node --test scripts/self-reported.test.mjs
//
// Contract (written first):
//  - A claim is `selfReported` ONLY if its sole source is the private mindmeld repo. Everything
//    whose number also appears in a PUBLIC artifact (mindmeld-payloads reports, the public HF model
//    card / benchmark card) is NOT labelled.
//  - The freshness checker keeps self-reported claims out of the numeric denominator and the
//    UNCHECKED-private count.
//  - The label is legible: >= 4.5:1 in both colour schemes (WCAG AA for small text), no alpha.
//  Hermetic: local files and stubbed fetches only.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, test } from "node:test";

import {
  SELF_REPORTED_LABEL,
  classifySelfReported,
  claimAccounting,
  collectCaseStudyClaims,
} from "./lib/case-study-claims.mjs";

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
    const by = Object.fromEntries(collectCaseStudyClaims(study).map((c) => [c.sourceRef, c.selfReported === true]));
    assert.deepEqual(by, { "x:a": true, "x:b": false, "x:c": true, "x:d": true });
  });
});

describe("classifySelfReported + page label", () => {
  test("flagged claim is SELF_REPORTED; unflagged falls through", () => {
    assert.equal(classifySelfReported({ selfReported: true }).status, "SELF_REPORTED");
    assert.equal(classifySelfReported({}), null);
    assert.equal(classifySelfReported({ selfReported: false }), null);
  });
  test("page label and checker label are one string", async () => {
    const { SELF_REPORTED_LABEL: pageLabel } = await import(pathToFileURL(join(ROOT, "lib", "self-reported.ts")).href);
    assert.equal(pageLabel, SELF_REPORTED_LABEL);
    assert.equal(pageLabel, "self-reported (private repo)");
  });
});

describe("Warmer content flags exactly the private-only claims", () => {
  test("results + decisions flagged", () => {
    const flagged = [...warmer.results, ...warmer.decisions]
      .filter((x) => x.selfReported)
      .map((x) => `${x.sourceRef} | ${x.label ?? x.title}`)
      .sort();
    assert.deepEqual(
      flagged,
      [
        "warmer:lora-reframe | When fine-tuning failed twice, change the method, not the data",
        "warmer:perf-budget | Web perf (tracked budget)",
        "warmer:tests | Test suite",
        "warmer:wasm-decision | Compile Dart to WebAssembly, decided by measurement",
      ].sort()
    );
  });
  test("the cross-language row and the story are public-backed, so NOT labelled", () => {
    const cross = warmer.results.find((r) => r.value === "5.1% → 78.0%");
    assert.ok(cross, "row exists");
    assert.ok(!cross.selfReported);
    assert.ok(!warmer.story.selfReported);
  });
});

describe("claimAccounting: self-reported claims leave the denominator and the UNCHECKED count", () => {
  test("counts", () => {
    const results = [
      { status: "CURRENT" },
      { status: "SELF_REPORTED" },
      { status: "SELF_REPORTED" },
      { status: "SKIPPED_PRIVATE_REPO" },
      { status: "NOT_NUMERIC" },
    ];
    assert.deepEqual(claimAccounting(results), { selfReported: 2, skippedPrivate: 1, numericTotal: 2 });
  });
});

describe("label contrast (WCAG AA small text, both schemes, no alpha)", () => {
  const css = readFileSync(join(ROOT, "app", "globals.css"), "utf8");
  const split = css.indexOf("@media (prefers-color-scheme: light) {");
  assert.ok(split > 0, "light override block found");
  const tok = (segment, name) => {
    const m = segment.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(m, `${name} found`);
    return m[1];
  };
  const lin = (c) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = (hex) => 0.2126 * lin(hex.slice(1, 3)) + 0.7152 * lin(hex.slice(3, 5)) + 0.0722 * lin(hex.slice(5, 7));
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  for (const [name, seg] of Object.entries({ dark: css.slice(0, split), light: css.slice(split) })) {
    test(`${name}: solid --muted-foreground (--text-lo) on every nearby surface >= 4.5:1`, () => {
      const fg = tok(seg, "--text-lo");
      for (const bgName of ["--graphite-950", "--graphite-900"]) {
        const r = ratio(fg, tok(seg, bgName));
        assert.ok(r >= 4.5, `${name} ${fg} on ${bgName}: ${r.toFixed(2)}`);
      }
    });
  }
  test("neither the self-reported tag nor the popover footer applies alpha to the muted colour", () => {
    for (const f of ["components/case-study-page.tsx", "components/metric-provenance.tsx"]) {
      const src = readFileSync(join(ROOT, f), "utf8");
      assert.ok(!/text-muted-foreground\/\d+[^"]*text-\[11px\]/.test(src), `${f} uses text-muted-foreground/NN on 11px text`);
    }
  });
});
