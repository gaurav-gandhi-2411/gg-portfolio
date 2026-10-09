import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * triage-iq @ 877af11: the Kubernetes fabrication count is a blocking CI ratchet
 * (eval/test_quality_regression.py:151-169, eval/test_invariants.py:854-866; both jobs are
 * required checks, ADR-0044/0058/0061). vscode (n=11) is report-only (ADR-0058). The site
 * once called the gate "informational, not blocking". Reads source as text because content/*.ts
 * use the "@/" alias, which node's strip-types runner cannot resolve.
 */
const caseStudy = readFileSync(new URL("../content/case-studies/triageiq.ts", import.meta.url), "utf8");
const provenance = readFileSync(new URL("../content/provenance.md", import.meta.url), "utf8");

test("triageiq case study no longer calls the fabrication gate informational", () => {
  assert.doesNotMatch(caseStudy, /informational, not blocking/i);
  assert.doesNotMatch(caseStudy, /not wired up as a hard CI gate/i);
});

test("triageiq case study states the gate scope: hard on Kubernetes, report-only on vscode", () => {
  assert.match(caseStudy, /hard, blocking CI gate on the Kubernetes/);
  assert.match(caseStudy, /vscode[^.]*report-only/);
});

test("provenance no longer asserts the fabrication gate is not a hard gate", () => {
  assert.doesNotMatch(provenance, /\*\*not currently a hard gate\*\*/);
  assert.match(provenance, /877af11/);
});
