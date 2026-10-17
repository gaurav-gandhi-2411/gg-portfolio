import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * review-iq's own README ("Devanagari-script Hindi is NOT supported ... retired scope",
 * ADR 0022) and eval/results.json (en + hi-en only; openai/gpt-oss-20b / -120b) are the
 * source of truth. The site once claimed "English, Hindi and Hinglish" and named retired
 * llama models. Reads the source files as text because content/*.ts use the "@/" alias,
 * which node's strip-types test runner cannot resolve.
 */
const caseStudy = readFileSync(new URL("../content/case-studies/reviewiq.ts", import.meta.url), "utf8");
const products = readFileSync(new URL("../content/products.ts", import.meta.url), "utf8");
const reviewiqCard = products.slice(
  products.indexOf('slug: "reviewiq"'),
  products.indexOf("figure:", products.indexOf('slug: "reviewiq"')),
);
const metrics = JSON.parse(readFileSync(new URL("../content/metrics.json", import.meta.url), "utf8"));

const HINDI_SUPPORTED = [
  /English,? (and )?Hindi/i,
  /Hindi,? (and|or) (English|Hinglish)/i,
  /en \/ hi \/ hi-en/,
];

test("review-iq copy never claims Devanagari Hindi support", () => {
  for (const [name, text] of [["case study", caseStudy], ["products card", reviewiqCard]] as const) {
    for (const re of HINDI_SUPPORTED) assert.doesNotMatch(text, re, `${name} matches ${re}`);
  }
  assert.match(caseStudy, /retired scope/);
});

test("review-iq copy names no retired llama models", () => {
  assert.doesNotMatch(caseStudy, /llama/i);
  assert.doesNotMatch(reviewiqCard, /llama/i);
  assert.match(caseStudy, /openai\/gpt-oss-20b/);
  assert.match(caseStudy, /openai\/gpt-oss-120b/);
});

test("review-iq extraction metric does not render the gate as a standalone value", () => {
  assert.doesNotMatch(metrics.metrics["reviewiq:extraction-eval"].value, /threshold/i);
});
