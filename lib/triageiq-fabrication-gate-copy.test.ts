import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * triage-iq @ 877af11 (main, 2026-10-09). Two required CI checks bound Kubernetes fabrication:
 * eval/test_quality_regression.py:151-169 (bound = committed reports/eval_baseline.json rate,
 * 0.0 = 0/53 since cd2934f, 2026-10-08) and eval/test_invariants.py:854-866 (grounding ratchet,
 * _GROUNDING_BASELINE ungrounded_count 1 of 53, ADR-0061). vscode (n=11) is report-only
 * (ADR-0058). The site once called the gate "informational", then said "baseline of 1 in 53"
 * as the sole bound (understates the quality gate), and showed "1.9% (k8s) / 9.1% (vscode)"
 * undated. Reads source as text because content/*.ts use the "@/" alias, which node's
 * strip-types runner cannot resolve.
 */
const caseStudy = readFileSync(new URL("../content/case-studies/triageiq.ts", import.meta.url), "utf8");
const provenance = readFileSync(new URL("../content/provenance.md", import.meta.url), "utf8");

test("triageiq case study no longer calls the fabrication gate informational", () => {
  assert.doesNotMatch(caseStudy, /informational, not blocking/i);
  assert.doesNotMatch(caseStudy, /not wired up as a hard CI gate/i);
});

test("triageiq case study states both Kubernetes bounds and vscode report-only", () => {
  assert.match(caseStudy, /hard, blocking CI gate on the Kubernetes/);
  assert.match(caseStudy, /committed baseline, currently 0 of 53/);
  assert.match(caseStudy, /grounding ratchet[^.]*1 of 53/);
  assert.match(caseStudy, /vscode[^.]*report-only/);
});

test("triageiq case study never presents 1 in 53 as the sole Kubernetes bound", () => {
  assert.doesNotMatch(caseStudy, /approved baseline of 1 in 53/);
});

test("triageiq fabrication results row is current and dated, not the undated 1.9%/9.1% pair", () => {
  assert.doesNotMatch(caseStudy, /value: "1\.9% \(k8s\) \/ 9\.1% \(vscode\)"/);
  const row = caseStudy.slice(caseStudy.indexOf('label: "LLM fabrication rate'));
  assert.match(row, /0\.0% \(0\/53\)/);
  assert.match(row, /0\.0% \(0\/11\)/);
  assert.match(row, /877af11/);
  assert.match(row, /2026-10-08/);
});

test("provenance states both bounds and does not claim the README overstates k8s as 1/53", () => {
  assert.doesNotMatch(provenance, /\*\*not currently a hard gate\*\*/);
  assert.doesNotMatch(provenance, /overstates the code for vscode and for k8s/);
  assert.match(provenance, /877af11/);
  assert.match(provenance, /cd2934f/);
});
