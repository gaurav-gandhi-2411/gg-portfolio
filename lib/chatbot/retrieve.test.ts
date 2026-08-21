import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import type { RetrievedChunk } from "./retrieve.ts";

// retrieve.ts reaches content/embed through Next's "@/*" path alias, which
// plain Node does not resolve — same fix as answer.test.ts's own comment.
register(pathToFileURL("evals/chatbot/alias-loader.mjs").href, import.meta.url);

const { getChunkBySourceRef, resolveRequestChunks } = await import("./retrieve.ts");

/**
 * Round three: GG tapped a follow-up chip whose sourceRef had already
 * passed validation on the turn that offered it, and got refused as
 * ungrounded anyway. app/api/chat/route.ts couldn't be tested directly
 * without a live Groq call (no key in this environment), so the pinning
 * decision it makes lives here instead, pure and synchronous, the same
 * reason lib/chatbot/answer.ts's buildAnswer takes pre-retrieved chunks
 * rather than calling retrieve() itself.
 *
 * A real corpus sourceRef, so this exercises the actual index rather than
 * a fixture that could drift from what's really in content/chatbot/index.json.
 */
const REAL_SOURCE_REF = "adk-tracegauge:problem:1";

test("getChunkBySourceRef finds a real corpus chunk directly, not by similarity", () => {
  const chunk = getChunkBySourceRef(REAL_SOURCE_REF);
  assert.ok(chunk, "expected a chunk for a sourceRef known to exist in the corpus");
  assert.equal(chunk?.sourceRef, REAL_SOURCE_REF);
  assert.ok(chunk.text.length > 0);
});

test("getChunkBySourceRef returns undefined for a sourceRef that does not exist", () => {
  // The safety property this rests on: an arbitrary/forged client-supplied
  // sourceRef can never pin content that isn't genuinely in the corpus.
  assert.equal(getChunkBySourceRef("not-a-real-sourceref:made-up:99"), undefined);
});

const fakeRetrieved: RetrievedChunk[] = [
  { text: "unrelated chunk one", sourceRef: "fixture:a", sourceLabel: "A", score: 0.4 },
  { text: "unrelated chunk two", sourceRef: "fixture:b", sourceLabel: "B", score: 0.35 },
];

test("resolveRequestChunks: no followUpSourceRef leaves retrieval untouched, not pinned", () => {
  const result = resolveRequestChunks(fakeRetrieved, undefined);
  assert.deepEqual(result.chunks, fakeRetrieved);
  assert.equal(result.pinned, false);
});

test("resolveRequestChunks: an unknown/forged sourceRef is ignored, same as absent", () => {
  const result = resolveRequestChunks(fakeRetrieved, "not-a-real-sourceref:made-up:99");
  assert.deepEqual(result.chunks, fakeRetrieved);
  assert.equal(result.pinned, false);
});

test("resolveRequestChunks: a real sourceRef NOT already in fresh retrieval gets prepended and pinned", () => {
  // The exact repro shape: the follow-up's own phrasing didn't retrieve
  // the chunk it was promised against, so it isn't in fakeRetrieved at all.
  const result = resolveRequestChunks(fakeRetrieved, REAL_SOURCE_REF);
  assert.equal(result.pinned, true);
  assert.equal(result.chunks.length, fakeRetrieved.length + 1);
  assert.equal(result.chunks[0].sourceRef, REAL_SOURCE_REF);
  // The naturally-retrieved chunks are still present and in their own order.
  assert.deepEqual(result.chunks.slice(1), fakeRetrieved);
});

test("resolveRequestChunks: a real sourceRef already in fresh retrieval is not duplicated", () => {
  const alreadyPresent: RetrievedChunk[] = [
    { text: "the pinned chunk's own text", sourceRef: REAL_SOURCE_REF, sourceLabel: "L", score: 0.9 },
    ...fakeRetrieved,
  ];
  const result = resolveRequestChunks(alreadyPresent, REAL_SOURCE_REF);
  assert.equal(result.pinned, true);
  assert.equal(result.chunks.length, alreadyPresent.length);
  assert.deepEqual(result.chunks, alreadyPresent);
});
