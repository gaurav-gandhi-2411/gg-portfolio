import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import type { RetrievedChunk } from "./retrieve.ts";

// answer.ts reaches content through Next's "@/*" path alias, which plain
// Node does not resolve. The eval harness already solved exactly this with a
// built-in ESM loader hook, so reusing it keeps these tests running against
// the real production module rather than a copy of its logic, which is the
// whole point of testing it. Registered before the dynamic import below,
// because a static import would be hoisted above the registration.
register(pathToFileURL("evals/chatbot/alias-loader.mjs").href, import.meta.url);

const { buildAnswer } = await import("./answer.ts");

/**
 * Follow-up validation.
 *
 * A follow-up chip is a promise that tapping it produces an answer. The
 * model is perfectly capable of proposing a sensible-sounding question about
 * something this site has nothing to say about, and that question would come
 * back as an honest refusal, which teaches a visitor the assistant is
 * guessing. So every follow-up carries the sourceRef it came from and is
 * checked against the chunks actually retrieved for THIS request, exactly as
 * citations are, and anything that does not check out is dropped rather than
 * repaired.
 *
 * These tests exist because the failure they guard is silent: a follow-up
 * that leads nowhere looks identical to one that works, right up until
 * somebody taps it.
 */

const chunks: RetrievedChunk[] = [
  {
    text: "Warmer's Hinglish embedding scored near zero at first.",
    sourceRef: "warmer:problem:1",
    sourceLabel: "Warmer case study — Problem",
    url: "/work/warmer",
    score: 0.9,
  },
  {
    text: "Spearman correlation went from -0.003 to 0.813.",
    sourceRef: "warmer:results:1",
    sourceLabel: "Warmer case study — Results",
    url: "/work/warmer",
    score: 0.8,
  },
];

const withFollowUps = (followUps: unknown) =>
  JSON.stringify({
    answer: "The Hinglish model was retrained.",
    citations: [{ sourceRef: "warmer:problem:1" }],
    followUps,
  });

test("keeps follow-ups whose sourceRef was actually retrieved, and carries the sourceRef through", () => {
  // Round three: the sourceRef used to be discarded after this check, so a
  // tapped chip's follow-up request had no way to prove it. Now it rides
  // along on the response so app/api/chat/route.ts can pin the same chunk
  // for the second, independent request the tap fires.
  const result = buildAnswer(
    withFollowUps([
      { question: "What did the Spearman score reach?", sourceRef: "warmer:results:1" },
    ]),
    chunks
  );
  assert.deepEqual(result.followUps, [
    { question: "What did the Spearman score reach?", sourceRef: "warmer:results:1" },
  ]);
});

test("drops a follow-up citing a chunk that was never retrieved", () => {
  // The exact failure this guards: a plausible question about real-sounding
  // material that this request has no grounding for.
  const result = buildAnswer(
    withFollowUps([
      { question: "How does AetherArt's LoRA training work?", sourceRef: "aetherart:approach:1" },
    ]),
    chunks
  );
  assert.deepEqual(result.followUps, []);
});

test("caps at three even when the model returns more", () => {
  const result = buildAnswer(
    withFollowUps(
      Array.from({ length: 6 }, (_, i) => ({
        question: `Question number ${i}?`,
        sourceRef: "warmer:results:1",
      }))
    ),
    chunks
  );
  assert.equal(result.followUps.length, 3);
});

test("drops duplicates, ignoring case", () => {
  const result = buildAnswer(
    withFollowUps([
      { question: "What did the score reach?", sourceRef: "warmer:results:1" },
      { question: "what did the score REACH?", sourceRef: "warmer:results:1" },
    ]),
    chunks
  );
  assert.deepEqual(result.followUps, [
    { question: "What did the score reach?", sourceRef: "warmer:results:1" },
  ]);
});

test("drops a follow-up too long to read as a chip", () => {
  const result = buildAnswer(
    withFollowUps([{ question: "W".repeat(200) + "?", sourceRef: "warmer:results:1" }]),
    chunks
  );
  assert.deepEqual(result.followUps, []);
});

test("a missing or malformed followUps field is an empty list, never a throw", () => {
  // Older recorded cassettes have no followUps at all, so absence has to be
  // an ordinary outcome rather than a parse failure.
  for (const shape of [undefined, null, "three", 42, [null], [{ question: "no ref?" }], [{}]]) {
    const result = buildAnswer(withFollowUps(shape), chunks);
    assert.deepEqual(result.followUps, [], `shape ${JSON.stringify(shape)} should yield []`);
  }
});

test("a refusal carries no follow-ups", () => {
  // Nothing validated, so there is nowhere honest to point the reader next.
  const result = buildAnswer(
    JSON.stringify({
      answer: "I don't have that.",
      citations: [{ sourceRef: "not:retrieved" }],
      followUps: [{ question: "Try this instead?", sourceRef: "warmer:results:1" }],
    }),
    chunks
  );
  assert.equal(result.refused, true);
  assert.deepEqual(result.followUps, []);
});
