import assert from "node:assert/strict";
import { test } from "node:test";

import { embedStatic, tokenizeWords, type StaticEmbeddingTable } from "./static-embed.ts";

test("tokenizeWords lowercases and splits on non-alphanumeric characters", () => {
  assert.deepEqual(tokenizeWords("Triage, for GitHub-Issues!"), ["triage", "for", "github", "issues"]);
});

test("tokenizeWords on an empty string returns no words", () => {
  assert.deepEqual(tokenizeWords(""), []);
});

// A tiny 2-dim table (real tables are 384-dim) so expected vectors are easy
// to hand-verify. "cat" and "dog" are unit vectors at right angles; "cats"
// is intentionally absent to exercise the out-of-vocabulary path.
const TABLE: StaticEmbeddingTable = {
  dim: 2,
  scale: 1,
  vocab: ["cat", "dog"],
  vectors: [
    [127, 0],
    [0, 127],
  ],
};

test("embedStatic returns a single vocab word's own (dequantized, normalized) vector", () => {
  const vec = embedStatic("cat", TABLE);
  assert.ok(vec !== null);
  assert.ok(Math.abs(vec[0] - 1) < 1e-6);
  assert.ok(Math.abs(vec[1] - 0) < 1e-6);
});

test("embedStatic mean-pools multiple in-vocabulary words and renormalizes", () => {
  const vec = embedStatic("cat dog", TABLE);
  assert.ok(vec !== null);
  // Mean of [1,0] and [0,1] is [0.5,0.5]; normalized that's [1/sqrt2, 1/sqrt2].
  const expected = 1 / Math.sqrt(2);
  assert.ok(Math.abs(vec[0] - expected) < 1e-6);
  assert.ok(Math.abs(vec[1] - expected) < 1e-6);
});

test("embedStatic drops out-of-vocabulary words silently and still embeds the rest", () => {
  const vec = embedStatic("cats cat zzzznotaword", TABLE);
  assert.ok(vec !== null);
  assert.ok(Math.abs(vec[0] - 1) < 1e-6);
  assert.ok(Math.abs(vec[1] - 0) < 1e-6);
});

test("embedStatic returns null when zero words are in-vocabulary", () => {
  assert.equal(embedStatic("quantum spreadsheet nonsense", TABLE), null);
});

test("embedStatic returns null for an empty query", () => {
  assert.equal(embedStatic("", TABLE), null);
});
