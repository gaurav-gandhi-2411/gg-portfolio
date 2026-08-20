import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import type { RetrievedChunk } from "./retrieve.ts";

register(pathToFileURL("evals/chatbot/alias-loader.mjs").href, import.meta.url);

const { buildAnswer, refusalAnswer, serverErrorAnswer, unavailableAnswer, REFUSAL_MESSAGE } =
  await import("./answer.ts");

/**
 * Refusal reasons.
 *
 * Written from the sentence the field exists to make true, before reading
 * the implementation: **two refusals that need different responses must not
 * be indistinguishable to anything outside the server's own log viewer.**
 *
 * The incident: Groq retired the pinned model on 2026-08-16, every
 * completion call failed, the provider failed soft to null exactly as
 * designed, and the route turned that null into the same bytes it returns
 * when a visitor asks about the weather. The canary went red every six hours
 * for two days and could only report "refused", which is also true on a
 * healthy day. Nothing in the response distinguished a dead vendor from an
 * off-topic question.
 *
 * So the assertions are about distinguishability, not about specific
 * strings: every refusal path must carry a reason, and no two paths that
 * need different runbooks may carry the same one. A test that only checked
 * "provider_unavailable" is spelled correctly would pass just as happily if
 * every other path were relabelled to match it, which is the bug.
 */

const chunks: RetrievedChunk[] = [
  {
    text: "Warmer's Hinglish embedding scored near zero at first.",
    sourceRef: "warmer:problem:1",
    sourceLabel: "Warmer case study, Problem",
    url: "/work/warmer",
    score: 0.9,
  },
];

test("every refusal path reports a reason", () => {
  for (const [name, answer] of [
    ["retrieval gate", refusalAnswer("no_grounding")],
    ["provider down", refusalAnswer("provider_unavailable")],
    ["server error", serverErrorAnswer()],
    ["embeddings absent", unavailableAnswer()],
    ["nothing validated", buildAnswer(JSON.stringify({ answer: "x", citations: [] }), chunks)],
  ] as const) {
    assert.equal(answer.refused, true, `${name} should be a refusal`);
    assert.ok(answer.refusalReason, `${name} must carry a refusalReason`);
  }
});

test("paths needing different responses carry different reasons", () => {
  const gate = refusalAnswer("no_grounding").refusalReason;
  const provider = refusalAnswer("provider_unavailable").refusalReason;
  const ungrounded = buildAnswer(
    JSON.stringify({ answer: "x", citations: [] }),
    chunks
  ).refusalReason;
  const broke = serverErrorAnswer().refusalReason;
  const noEmbeddings = unavailableAnswer().refusalReason;

  const all = [gate, provider, ungrounded, broke, noEmbeddings];
  assert.equal(new Set(all).size, all.length, "each refusal path needs its own reason");
});

test("a citation that does not validate is a different reason from an empty corpus hit", () => {
  // The two used to be one call to refusalAnswer(). This is the pair most
  // likely to be collapsed again by someone tidying up, because both mean
  // "no citations came back" if you only look at the returned object.
  const ungrounded = buildAnswer(
    JSON.stringify({ answer: "x", citations: [{ sourceRef: "not:retrieved" }] }),
    chunks
  );
  assert.equal(ungrounded.refused, true);
  assert.notEqual(ungrounded.refusalReason, refusalAnswer("no_grounding").refusalReason);
});

test("the reader sees the same sentence whatever the reason", () => {
  // The reason is for the canary, not for the page. A visitor cannot act on
  // "the vendor retired a model" any differently than on "ask something
  // else", and naming a vendor in the UI would be noise at best.
  assert.equal(refusalAnswer("no_grounding").answer, REFUSAL_MESSAGE);
  assert.equal(refusalAnswer("provider_unavailable").answer, REFUSAL_MESSAGE);
  assert.equal(
    buildAnswer(JSON.stringify({ answer: "x", citations: [] }), chunks).answer,
    REFUSAL_MESSAGE
  );
});

test("no reader-facing message carries an em dash", () => {
  // scripts/check-no-em-dash.mjs scans components, app and content. lib is
  // outside its reach, and every one of these strings renders. Three of them
  // carried one, including the refusal a visitor is most likely to see.
  for (const answer of [
    refusalAnswer("no_grounding"),
    serverErrorAnswer(),
    unavailableAnswer(),
  ]) {
    assert.ok(!answer.answer.includes("—"), `em dash in: ${answer.answer}`);
  }
});
