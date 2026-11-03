import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import type { RetrievedChunk } from "./retrieve.ts";

// Same loader answer.test.ts uses, so buildAnswer runs as production code.
register(pathToFileURL("evals/chatbot/alias-loader.mjs").href, import.meta.url);

const { buildCitationTagStripper } = await import("./strip-citation-tags.ts");
const { buildAnswer } = await import("./answer.ts");

const strip = buildCitationTagStripper([
  "warmer:hinglish-fix",
  "warmer:hinglish-fix#2",
  "gold-rate-tracker:headline",
  "gold-rate-tracker:headline#3",
  "provenance:warmer:p3",
  "agentgauge:blocking-causal-llama3.1",
]);

test("strips each ref shape: bare, backticked, bracketed, parenthesized, #N, multi-colon", () => {
  const cases: [string, string][] = [
    ["It was fixed by warmer:hinglish-fix in training.", "It was fixed by in training."],
    ["It was fixed by `warmer:hinglish-fix` in training.", "It was fixed by in training."],
    ["It was fixed in training [warmer:hinglish-fix].", "It was fixed in training."],
    ["It was fixed in training (warmer:hinglish-fix).", "It was fixed in training."],
    ["See gold-rate-tracker:headline#3 for the baseline.", "See for the baseline."],
    ["See `gold-rate-tracker:headline#3`.", "See."],
    ["Numbers come from provenance:warmer:p3 directly.", "Numbers come from directly."],
    ["Compared in agentgauge:blocking-causal-llama3.1.", "Compared in."],
    ["Both [ warmer:hinglish-fix ] and (`provenance:warmer:p3`) agree.", "Both and agree."],
  ];
  for (const [input, expected] of cases) assert.equal(strip(input), expected, input);
});

test("leaves non-ref colon text untouched", () => {
  const untouched = [
    "The meeting is at 10:30 IST, ratio 3:1.",
    "Note: warmer results are on the case study page.",
    "See https://example.com/work/warmer:hinglish-fix-notes for details.",
    "A longer unknown ref warmer:hinglish-fix-extra is not a known ref.",
    "path/warmer:hinglish-fix stays.",
    "Plain text with   odd  spacing\nand lines stays byte-identical.",
  ];
  for (const text of untouched) assert.equal(strip(text), text, text);
});

test("is idempotent", () => {
  const once = strip("Fixed with the `warmer:hinglish-fix`, which (provenance:warmer:p3) shows.");
  assert.equal(strip(once), once);
});

test("emphasis-wrapped refs are removed with their markers", () => {
  const cases: [string, string][] = [
    ["Fixed by **warmer:hinglish-fix** today.", "Fixed by today."],
    ["Fixed by __warmer:hinglish-fix__ today.", "Fixed by today."],
    ["Fixed by *warmer:hinglish-fix* today.", "Fixed by today."],
    ["Fixed by **`warmer:hinglish-fix`** today.", "Fixed by today."],
    ["Fixed by _provenance:warmer:p3_ today.", "Fixed by today."],
  ];
  for (const [input, expected] of cases) assert.equal(strip(input), expected, input);
});

test("a parenthetical left empty is removed with the space before it", () => {
  const cases: [string, string][] = [
    ["It was fixed (see warmer:hinglish-fix) in training.", "It was fixed in training."],
    ["It was fixed (see `warmer:hinglish-fix`).", "It was fixed."],
    ["It was fixed (cf. warmer:hinglish-fix) here.", "It was fixed here."],
    ["It was fixed (source: warmer:hinglish-fix) here.", "It was fixed here."],
    ["It was fixed (warmer:hinglish-fix) here.", "It was fixed here."],
  ];
  for (const [input, expected] of cases) assert.equal(strip(input), expected, input);
});

test("authored empty-looking markup is untouched when no ref was removed", () => {
  const text = "Call f() and see () or **bold** and (see the docs).";
  assert.equal(strip(text), text);
});

test("empty known set is a no-op", () => {
  assert.equal(buildCitationTagStripper([])("a `x:y` b"), "a `x:y` b");
});

const chunks: RetrievedChunk[] = [
  {
    text: "Hinglish fix.",
    sourceRef: "warmer:hinglish-fix",
    sourceLabel: "Warmer case study: Hinglish fix",
    url: "/work/warmer",
    score: 0.9,
  },
];

test("buildAnswer strips tags from prose and keeps the structured citations", () => {
  const result = buildAnswer(
    JSON.stringify({
      answer: "It was fixed with the `warmer:hinglish-fix`, which retrained the model.",
      citations: [{ sourceRef: "warmer:hinglish-fix" }],
    }),
    chunks
  );
  assert.equal(result.answer, "It was fixed with the, which retrained the model.");
  assert.deepEqual(result.citations, [
    {
      sourceRef: "warmer:hinglish-fix",
      label: "Warmer case study: Hinglish fix",
      url: "/work/warmer",
    },
  ]);
  assert.equal(result.refused, false);
});

test("the real project-warmer-hinglish recording is stripped", () => {
  const cassette = JSON.parse(
    readFileSync("evals/chatbot/cassettes/project-warmer-hinglish.json", "utf8")
  ) as { groqResponse: string };
  const raw = (JSON.parse(cassette.groqResponse) as { answer: string }).answer;
  assert.ok(raw.includes("warmer:hinglish-fix"), "fixture should still contain the raw tag");
  const refs = (JSON.parse(cassette.groqResponse) as { citations: { sourceRef: string }[] })
    .citations;
  const result = buildAnswer(
    cassette.groqResponse,
    refs.map((c) => ({
      text: "",
      sourceRef: c.sourceRef,
      sourceLabel: c.sourceRef,
      score: 1,
    }))
  );
  assert.equal(result.refused, false);
  assert.ok(!result.answer.includes("warmer:hinglish-fix"), result.answer);
  assert.ok(result.citations.length > 0);
});

const withChips = (followUps: unknown) =>
  buildAnswer(
    JSON.stringify({
      answer: "It was retrained.",
      citations: [{ sourceRef: "warmer:hinglish-fix" }],
      followUps,
    }),
    chunks
  );

test("follow-up chips are stripped of raw refs", () => {
  const result = withChips([
    { question: "What did `warmer:hinglish-fix` change in training?", sourceRef: "warmer:hinglish-fix" },
    { question: "How was the fix (see warmer:hinglish-fix) evaluated?", sourceRef: "warmer:hinglish-fix" },
  ]);
  assert.deepEqual(
    result.followUps.map((f) => f.question),
    ["What did change in training?", "How was the fix evaluated?"]
  );
  assert.ok(result.followUps.every((f) => f.sourceRef === "warmer:hinglish-fix"));
});

test("a chip reduced to a fragment or nothing is dropped; short untouched chips stay", () => {
  const result = withChips([
    { question: "`warmer:hinglish-fix`", sourceRef: "warmer:hinglish-fix" },
    { question: "More on warmer:hinglish-fix?", sourceRef: "warmer:hinglish-fix" },
    { question: "Why Hinglish?", sourceRef: "warmer:hinglish-fix" },
  ]);
  assert.deepEqual(
    result.followUps.map((f) => f.question),
    ["Why Hinglish?"]
  );
});
