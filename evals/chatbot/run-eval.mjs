#!/usr/bin/env node
// Wave 16 — eval harness for the RAG chatbot (app/api/chat/route.ts).
//
// Two modes:
//   Default (cassette-replay): for every fixture in evals/chatbot/fixtures/,
//   runs REAL retrieval (lib/chatbot/retrieve.ts — a local ONNX call, free,
//   no API key needed) and, if the retrieval gate doesn't already refuse,
//   looks for a matching recorded cassette at
//   evals/chatbot/cassettes/<fixture-id>.json. No cassette → the fixture is
//   marked "skipped: no cassette recorded", never silently passed or failed.
//   Zero live API calls in this mode — CI-safe with no GROQ_API_KEY.
//
//   --live: for fixtures with no cassette (or every fixture, if --force is
//   also passed), actually calls groqProvider.complete(...) — requires
//   GROQ_API_KEY — records the raw response as a new cassette, and computes
//   real metrics from it. Not exercised by this repo's CI; run by hand once
//   a key is available.
//
// Every fixture calls through the SAME functions app/api/chat/route.ts calls
// (lib/chatbot/retrieve.ts's retrieve(), lib/chatbot/answer.ts's buildAnswer())
// — imported directly via evals/chatbot/alias-loader.mjs (a Node ESM loader
// hook resolving this repo's `@/*` alias outside Next's own bundler; see that
// file's header for why). This eval can never silently drift from what the
// route actually does, because it IS the route's logic, not a parallel copy.
//
// Zero new dependencies: global fetch, Node's built-in module.register()
// hook API — same "no deps" convention as scripts/content-pipeline/*.mjs.
//
// Run: node evals/chatbot/run-eval.mjs [--live] [--force]

import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const FIXTURES_DIR = join(HERE, "fixtures");
const MANIFEST_PATH = join(HERE, "fixtures.manifest.json");
const CASSETTES_DIR = join(HERE, "cassettes");

/** Paths in errors read better relative to the repo root than as absolutes. */
const relativeToRoot = (p) => p.slice(ROOT.length + 1).replace(/\\/g, "/");
const REPORTS_DIR = join(ROOT, "reports");

const args = process.argv.slice(2);
const LIVE = args.includes("--live");
const FORCE = args.includes("--force");

// "Answer"-expected categories — the ones the retrieval-recall,
// groundedness, and false-refusal metrics are computed over. Categories
// outside this list ("unanswerable", "adversarial") feed refusal-precision
// instead — see computeSummary() below.
const ANSWER_CATEGORIES = new Set(["project-factual", "background", "availability"]);
const REFUSE_CATEGORIES = new Set(["unanswerable", "adversarial"]);

register(pathToFileURL(join(HERE, "alias-loader.mjs")).href, import.meta.url);

/**
 * @typedef {{
 *   id: string, question: string, category: string,
 *   expectedSourceRefs: string[], expectedBehavior: "answer"|"refuse", notes: string
 * }} Fixture
 */

/**
 * @returns {Fixture[]} every *.json fixture file, sorted by id for a stable report order.
 *
 * The `.endsWith(".json")` filter is the whole scope of this eval, which means
 * renaming one fixture to `.json.bak` quietly removes a question from the set.
 * Every rate here is a proportion, so removing a case the system gets wrong
 * raises the number and the gate applauds. The manifest is the second,
 * independently-maintained copy of what the set is supposed to be: disk and
 * manifest have to agree or nothing runs, so shrinking the eval takes a
 * deliberate edit that shows up in the diff.
 */
function loadFixtures() {
  const fixtures = readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(FIXTURES_DIR, f), "utf8")))
    .sort((a, b) => a.id.localeCompare(b.id));

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const expected = new Set(manifest.expectedFixtureIds);
  const found = new Set(fixtures.map((f) => f.id));
  const missing = [...expected].filter((id) => !found.has(id)).sort();
  const unlisted = [...found].filter((id) => !expected.has(id)).sort();

  if (missing.length > 0 || unlisted.length > 0) {
    const lines = [
      `Fixture set does not match ${relativeToRoot(MANIFEST_PATH)}.`,
      `  manifest expects ${expected.size}, found ${found.size} in ${relativeToRoot(FIXTURES_DIR)}/`,
    ];
    if (missing.length > 0) {
      lines.push(`  MISSING (in manifest, not on disk): ${missing.join(", ")}`);
      lines.push("    A missing fixture is a question the eval stopped asking. Every metric here");
      lines.push("    is a rate, so dropping a case the system fails raises the score.");
    }
    if (unlisted.length > 0) lines.push(`  UNLISTED (on disk, not in manifest): ${unlisted.join(", ")}`);
    lines.push("  Fix the fixture, or add/remove the id in the manifest if the change is intended.");
    throw new Error(lines.join("\n"));
  }

  return fixtures;
}

function cassettePathFor(id) {
  return join(CASSETTES_DIR, `${id}.json`);
}

/** Loads a recorded cassette for a fixture, or null if none exists yet. */
function loadCassette(id) {
  const path = cassettePathFor(id);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeCassette(id, groqResponse, tokensIn, tokensOut) {
  if (!existsSync(CASSETTES_DIR)) mkdirSync(CASSETTES_DIR, { recursive: true });
  writeFileSync(
    cassettePathFor(id),
    JSON.stringify({ groqResponse, tokensIn, tokensOut }, null, 2) + "\n"
  );
}

/**
 * Runs one fixture end-to-end: real retrieval always, then either the
 * retrieval-gate refusal (no LLM needed), a cassette-replayed answer, a
 * freshly-recorded live answer (`--live`), or a "skipped" verdict if
 * generation was needed but no cassette exists and `--live` wasn't passed.
 * @param {Fixture} fixture
 * @param {{ retrieve: Function, RETRIEVAL_THRESHOLD: number, buildAnswer: Function,
 *   buildSystemPrompt: Function, buildUserPrompt: Function, refusalAnswer: Function,
 *   groqProvider?: { complete: Function } }} lib
 */
async function runFixture(fixture, lib) {
  const { chunks, maxScore } = await lib.retrieve(fixture.question);
  const gateRefused = chunks.length === 0 || maxScore < lib.RETRIEVAL_THRESHOLD;

  if (gateRefused) {
    return { fixture, chunks, maxScore, final: lib.refusalAnswer(), source: "retrieval-gate" };
  }

  const existingCassette = loadCassette(fixture.id);
  const shouldCallLive = LIVE && (!existingCassette || FORCE);

  if (shouldCallLive) {
    if (!lib.groqProvider) {
      throw new Error("internal: --live requested but groqProvider wasn't loaded");
    }
    const systemPrompt = lib.buildSystemPrompt();
    const userPrompt = lib.buildUserPrompt(fixture.question, chunks);
    const completion = await lib.groqProvider.complete(systemPrompt, userPrompt);
    if (!completion) {
      // Fail-soft, same contract as route.ts: a failed Groq call downgrades
      // to the honest refusal rather than crashing the run. Not cassetted —
      // a transient failure shouldn't get baked in as a permanent recording.
      return { fixture, chunks, maxScore, final: lib.refusalAnswer(), source: "live-call-failed" };
    }
    writeCassette(fixture.id, completion.content, completion.tokensIn, completion.tokensOut);
    const final = lib.buildAnswer(completion.content, chunks);
    return { fixture, chunks, maxScore, final, source: "live" };
  }

  if (existingCassette) {
    const final = lib.buildAnswer(existingCassette.groqResponse, chunks);
    return { fixture, chunks, maxScore, final, source: "cassette" };
  }

  return { fixture, chunks, maxScore, final: null, source: "skipped" };
}

/** @returns {"answer"|"refuse"|"skipped"} the fixture's observed behavior. */
function actualBehavior(result) {
  if (result.final === null) return "skipped";
  return result.final.refused ? "refuse" : "answer";
}

/**
 * Computes the 4 headline metrics, each only over fixtures that weren't
 * skipped (no cassette recorded yet) — a skipped fixture contributes to
 * neither the numerator nor the denominator of any metric, so `n` always
 * reflects fixtures this run actually evaluated end-to-end.
 */
function computeSummary(results) {
  const evaluated = results.filter((r) => actualBehavior(r) !== "skipped");
  const answerFixtures = evaluated.filter((r) => ANSWER_CATEGORIES.has(r.fixture.category));
  const refuseFixtures = evaluated.filter((r) => REFUSE_CATEGORIES.has(r.fixture.category));

  const recallHits = answerFixtures.filter((r) => {
    const retrievedRefs = new Set(r.chunks.map((c) => c.sourceRef));
    return r.fixture.expectedSourceRefs.some((ref) => retrievedRefs.has(ref));
  });

  const groundedHits = answerFixtures.filter((r) => {
    const retrievedRefs = new Set(r.chunks.map((c) => c.sourceRef));
    return (
      r.final.citations.length > 0 &&
      r.final.citations.every((c) => retrievedRefs.has(c.sourceRef))
    );
  });

  const correctRefusals = refuseFixtures.filter((r) => r.final.refused === true);
  const falseRefusals = answerFixtures.filter((r) => r.final.refused === true);

  const rate = (num, den) => (den === 0 ? null : num / den);

  return {
    retrievalRecallAt5: { value: rate(recallHits.length, answerFixtures.length), n: answerFixtures.length },
    groundednessRate: { value: rate(groundedHits.length, answerFixtures.length), n: answerFixtures.length },
    refusalPrecision: { value: rate(correctRefusals.length, refuseFixtures.length), n: refuseFixtures.length },
    falseRefusalRate: { value: rate(falseRefusals.length, answerFixtures.length), n: answerFixtures.length },
  };
}

function formatMetric(metric) {
  if (metric.value === null) return `n/a (n=0)`;
  return `${(metric.value * 100).toFixed(1)}% (n=${metric.n})`;
}

function writeReports(results, summary, today) {
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });

  const rows = results.map((r) => {
    const expected = r.fixture.expectedBehavior;
    const actual = actualBehavior(r);
    const pass = actual === "skipped" ? "skipped" : actual === expected ? "pass" : "fail";
    return { id: r.fixture.id, category: r.fixture.category, expected, actual, pass, source: r.source };
  });

  const mdLines = [
    `# Wave 16 chatbot eval — ${today}`,
    "",
    `Mode: ${LIVE ? `--live${FORCE ? " --force" : ""}` : "cassette-replay (default, no live API calls)"}.`,
    "",
    "## Summary",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| Retrieval recall@5 | ${formatMetric(summary.retrievalRecallAt5)} |`,
    `| Citation-groundedness rate | ${formatMetric(summary.groundednessRate)} |`,
    `| Refusal precision | ${formatMetric(summary.refusalPrecision)} |`,
    `| False-refusal rate | ${formatMetric(summary.falseRefusalRate)} |`,
    "",
    "n/a (n=0) means every fixture that metric would draw from is still " +
      '"skipped: no cassette recorded" — expected until `--live` records real ' +
      "cassettes (see TODO in .github/workflows/eval.yml).",
    "",
    "## Per-fixture results",
    "",
    "| id | category | expected | actual | pass/fail | source |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (r) => `| ${r.id} | ${r.category} | ${r.expected} | ${r.actual} | ${r.pass} | ${r.source} |`
    ),
    "",
  ];
  writeFileSync(join(REPORTS_DIR, `wave16-chatbot-eval-${today}.md`), mdLines.join("\n"));

  const json = {
    date: today,
    mode: LIVE ? (FORCE ? "live-force" : "live") : "cassette-replay",
    summary,
    results: rows,
  };
  writeFileSync(
    join(REPORTS_DIR, `wave16-chatbot-eval-${today}.json`),
    JSON.stringify(json, null, 2) + "\n"
  );

  return rows;
}

async function main() {
  const retrieveMod = await import(pathToFileURL(join(ROOT, "lib/chatbot/retrieve.ts")).href);
  const answerMod = await import(pathToFileURL(join(ROOT, "lib/chatbot/answer.ts")).href);
  let groqProvider;
  if (LIVE) {
    const llmProviderMod = await import(pathToFileURL(join(ROOT, "lib/chatbot/llm-provider.ts")).href);
    groqProvider = llmProviderMod.groqProvider;
    if (!process.env.GROQ_API_KEY) {
      console.warn(
        "[run-eval] --live passed but GROQ_API_KEY is not set — every fixture needing a " +
          "live call will fail soft (groqProvider.complete returns null, same as route.ts)."
      );
    }
  }

  const lib = {
    retrieve: retrieveMod.retrieve,
    RETRIEVAL_THRESHOLD: retrieveMod.RETRIEVAL_THRESHOLD,
    buildAnswer: answerMod.buildAnswer,
    buildSystemPrompt: answerMod.buildSystemPrompt,
    buildUserPrompt: answerMod.buildUserPrompt,
    refusalAnswer: answerMod.refusalAnswer,
    groqProvider,
  };

  const fixtures = loadFixtures();
  console.log(`Loaded ${fixtures.length} fixtures. Running retrieval for each...`);

  const results = [];
  for (const fixture of fixtures) {
    const result = await runFixture(fixture, lib);
    results.push(result);
    console.log(`  ${fixture.id}: ${actualBehavior(result)} (${result.source})`);
  }

  const summary = computeSummary(results);
  const today = new Date().toISOString().slice(0, 10);
  writeReports(results, summary, today);

  const skippedCount = results.filter((r) => actualBehavior(r) === "skipped").length;
  console.log("");
  console.log(`Done. ${results.length} fixtures, ${skippedCount} skipped (no cassette).`);
  console.log(`Retrieval recall@5:        ${formatMetric(summary.retrievalRecallAt5)}`);
  console.log(`Citation-groundedness:     ${formatMetric(summary.groundednessRate)}`);
  console.log(`Refusal precision:         ${formatMetric(summary.refusalPrecision)}`);
  console.log(`False-refusal rate:        ${formatMetric(summary.falseRefusalRate)}`);
  console.log(`Report: reports/wave16-chatbot-eval-${today}.md (+.json)`);
}

main().catch((err) => {
  console.error("Eval run failed:", err);
  process.exit(1);
});
