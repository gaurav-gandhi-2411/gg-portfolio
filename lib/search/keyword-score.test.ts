import assert from "node:assert/strict";
import { test } from "node:test";

import { keywordScore, tokenizeQuery } from "./keyword-score.ts";

test("tokenizeQuery lowercases, splits, and drops stopwords/single chars", () => {
  assert.deepEqual(tokenizeQuery("Triage for GitHub issues, a fast way"), [
    "triage",
    "github",
    "issues",
    "fast",
    "way",
  ]);
});

test("tokenizeQuery on an empty string returns no tokens", () => {
  assert.deepEqual(tokenizeQuery(""), []);
});

test("keywordScore matches on a whole-phrase substring", () => {
  const text = "TriageIQ. Triages GitHub issues. TF-IDF. LLM & Agents";
  const score = keywordScore("github issues", text);
  assert.ok(score > 0.6, `expected phrase-match bonus, got ${score}`);
});

test("keywordScore matches on partial token overlap even without the exact phrase", () => {
  const text = "TriageIQ. Triages GitHub issues and estimates resolution time.";
  const score = keywordScore("github triage time zzz", text);
  // 3 of 4 tokens present ("zzz" absent), no whole-phrase match.
  assert.ok(score > 0 && score < 0.6, `expected partial-only score, got ${score}`);
});

test("keywordScore returns 0 for a query with no matching tokens", () => {
  const text = "TriageIQ. Triages GitHub issues.";
  assert.equal(keywordScore("quantum spreadsheet nonsense", text), 0);
});

test("keywordScore returns 0 for an empty query", () => {
  assert.equal(keywordScore("", "TriageIQ. Triages GitHub issues."), 0);
});

test("keywordScore returns 0 for empty searchable text", () => {
  assert.equal(keywordScore("triage", ""), 0);
});

test("keywordScore is case-insensitive", () => {
  const text = "AetherArt: Ukiyo-e-style AI art.";
  assert.ok(keywordScore("UKIYO-E", text) > 0);
});
