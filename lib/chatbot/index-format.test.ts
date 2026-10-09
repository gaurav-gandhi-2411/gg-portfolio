import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compareIds,
  partitionForReuse,
  reuseKey,
  serializeIndex,
  sortChunks,
} from "./index-format.mjs";

const MODEL = "test/model";
const chunk = (id: string, text = `text of ${id}`, embedding?: number[]) =>
  embedding ? { id, text, embedding } : { id, text };

test("compareIds is natural-order: p2 before p10, foo#2 before foo#10, base before suffixes", () => {
  const ids = ["a:p10", "a:p2", "a:p1", "foo#10", "foo#2", "foo", "b:row3"];
  assert.deepEqual(
    [...ids].sort(compareIds),
    ["a:p1", "a:p2", "a:p10", "b:row3", "foo", "foo#2", "foo#10"]
  );
});

test("ordering is deterministic: any input permutation serialises to identical bytes", () => {
  const base = ["z:1", "a:10", "a:2", "m", "m#2"].map((id) => chunk(id, id, [0.1, 0.2]));
  const forward = serializeIndex({ model: MODEL, chunks: base });
  const reversed = serializeIndex({ model: MODEL, chunks: [...base].reverse() });
  assert.equal(forward, reversed);
  assert.deepEqual(
    sortChunks(base).map((c) => c.id),
    ["a:2", "a:10", "m", "m#2", "z:1"]
  );
});

test("serialised index is valid JSON with exactly one chunk per line and no volatile fields", () => {
  const chunks = ["b", "a", "c"].map((id) => chunk(id, `t ${id}`, [0.5, -0.25]));
  const out = serializeIndex({ model: MODEL, chunks });
  const parsed = JSON.parse(out);
  assert.deepEqual(Object.keys(parsed), ["model", "chunks"]);
  assert.equal(parsed.chunks.length, 3);
  const lines = out.trimEnd().split("\n");
  assert.equal(lines.length, 3 + 2, "header + one line per chunk + footer");
  assert.ok(lines[2].startsWith(",{"), "later chunks use a leading comma");
});

test("merge-stability: adding a chunk leaves every other chunk's line byte-identical", () => {
  const before = ["a", "c", "e"].map((id) => chunk(id, id, [1]));
  const after = [...before, chunk("d", "new", [2])];
  const l0 = new Set(serializeIndex({ model: MODEL, chunks: before }).split("\n"));
  const added = serializeIndex({ model: MODEL, chunks: after })
    .split("\n")
    .filter((l) => !l0.has(l));
  assert.equal(added.length, 1);
  assert.ok(added[0].includes('"id":"d"'));
});

test("duplicate ids throw (ids are the merge and reuse key)", () => {
  assert.throws(() => sortChunks([chunk("a"), chunk("a")]), /Duplicate chunk id: a/);
});

test("reuse: identical id+text+model reuses the prior embedding", () => {
  const prior = { model: MODEL, chunks: [chunk("a", "same", [9, 9])] };
  const { reused, missing } = partitionForReuse([chunk("a", "same")], prior, MODEL);
  assert.equal(missing.length, 0);
  assert.deepEqual(reused[0].embedding, [9, 9]);
});

test("reuse: changed text, changed id, or new chunk is NOT reused", () => {
  const prior = { model: MODEL, chunks: [chunk("a", "old text", [9, 9])] };
  const { reused, missing } = partitionForReuse(
    [chunk("a", "new text"), chunk("b", "old text"), chunk("c", "fresh")],
    prior,
    MODEL
  );
  assert.equal(reused.length, 0);
  assert.deepEqual(missing.map((c) => c.id), ["a", "b", "c"]);
});

test("reuse: a different model id invalidates every prior embedding", () => {
  const prior = { model: "other/model", chunks: [chunk("a", "same", [9, 9])] };
  const { reused, missing } = partitionForReuse([chunk("a", "same")], prior, MODEL);
  assert.equal(reused.length, 0);
  assert.equal(missing.length, 1);
});

test("reuse: no prior, or prior chunks without embeddings, reuses nothing", () => {
  assert.equal(partitionForReuse([chunk("a")], null, MODEL).missing.length, 1);
  const noEmb = { model: MODEL, chunks: [chunk("a", "text of a")] };
  assert.equal(partitionForReuse([chunk("a")], noEmb, MODEL).missing.length, 1);
});

test("reuseKey separates fields unambiguously (no id/text concatenation collisions)", () => {
  assert.notEqual(
    reuseKey(MODEL, { id: "ab", text: "c" }),
    reuseKey(MODEL, { id: "a", text: "bc" })
  );
});
