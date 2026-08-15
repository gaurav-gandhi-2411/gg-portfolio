// BL-9 round 4/5 -- recall@1/@3 + warm per-query latency, across FOUR
// search tiers, on an identical hand-labeled eval set
// (evals/project-search/fixtures/*.json):
//   1. MiniLM (Xenova/all-MiniLM-L6-v2, real transformer, ONNX)
//   2. potion-base-8M (`@yarflam/potion-base-8m` npm package, static
//      embedding, third-party)
//   3. static-matrix -- round 5 (BL-9 task A3): this repo's own
//      zero-dependency pruned int8 word-embedding table
//      (content/search/static-embeddings.json,
//      scripts/search/build-static-embeddings.mjs, lib/search/static-embed.ts)
//   4. keyword-only -- round 5 (BL-9 task A4): the always-shipped tier-1
//      substring/token-overlap scorer (lib/search/keyword-score.ts),
//      scored on this eval for the first time. Not a vector-space model,
//      so "rank" here means keywordScore() descending, same as production.
//
// MiniLM: reuses lib/chatbot/embed.mjs (same model/config the shipped
// build-project-embeddings.mjs and embed-client.ts use) and the already-
// committed content/search/project-embeddings.json for project vectors, so
// this eval measures against the EXACT vectors production ranks against.
//
// potion-base-8M: `@yarflam/potion-base-8m` (npm), installed locally with
// `--no-save` for this evaluation only -- see the round-4 report for why
// this specific package was chosen (the official minishlab/potion-base-8M
// weights ported to a zero-dependency Node loader; not officially
// maintained by HuggingFace/minishlab). This script embeds each of the 13
// projects' searchable text itself (no committed vector file for this
// model exists, unlike MiniLM) using the SAME buildSearchableText() the
// production build script uses, so project text is identical between models.
//
// Every fixture's result (hit@1, hit@3, top3, not just misses) is written
// to the report for round 5's A1 statistics (Wilson CI, McNemar) -- round 4
// only recorded misses, which is enough to derive hits by complement but
// not as directly auditable; round 5 makes every one of the 28 explicit.
//
// Run: node evals/project-search/run-recall-eval.mjs
// Requires (optional, for the potion-base-8M tier):
// `npm install @yarflam/potion-base-8m --no-save` first (not a committed
// dependency -- see package.json, this is eval-only).

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { embed as embedMiniLM, cosineSimilarity } from "../../lib/chatbot/embed.mjs";
import { keywordScore } from "../../lib/search/keyword-score.ts";
import { buildSearchableText } from "../../lib/search/searchable-text.ts";
import { embedStatic } from "../../lib/search/static-embed.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURES_DIR = join(ROOT, "evals", "project-search", "fixtures");
const PROJECT_EMBEDDINGS_PATH = join(ROOT, "content", "search", "project-embeddings.json");
const STATIC_EMBEDDINGS_PATH = join(ROOT, "content", "search", "static-embeddings.json");
const PRODUCTS_PATH = join(ROOT, "content", "products.ts");
const TYPES_PATH = join(ROOT, "content", "types.ts");
const REPORT_PATH = join(ROOT, "reports", "BL-9-round5-recall-eval.json");

function loadFixtures() {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(FIXTURES_DIR, f), "utf8")));
}

// Same regex-parse technique as scripts/search/build-project-embeddings.mjs
// -- content/products.ts has a real `@/lib/metrics` runtime import plain
// Node can't resolve, so it's parsed as text rather than imported.
function parseProducts(productsSrc) {
  const slugMatches = [...productsSrc.matchAll(/slug: "([a-z0-9-]+)"/g)];
  const products = [];
  for (let i = 0; i < slugMatches.length; i++) {
    const start = slugMatches[i].index;
    const end = i + 1 < slugMatches.length ? slugMatches[i + 1].index : productsSrc.length;
    const block = productsSrc.slice(start, end);
    const slug = slugMatches[i][1];
    const name = /name: "([^"]+)"/.exec(block)?.[1] ?? slug;
    const tagline = /tagline:\s*\n?\s*"([^"]+)"/.exec(block)?.[1] ?? "";
    const techChipsRaw = /techChips:\s*\[([^\]]*)\]/.exec(block)?.[1] ?? "";
    const techChips = [...techChipsRaw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const categoriesRaw = /categories:\s*\[([^\]]*)\]/.exec(block)?.[1] ?? "";
    const categoryIds = [...categoriesRaw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    products.push({ slug, name, tagline, techChips, categoryIds });
  }
  return products;
}

async function loadProjectTexts() {
  const productsSrc = readFileSync(PRODUCTS_PATH, "utf8");
  const { CATEGORIES } = await import(pathToFileURL(TYPES_PATH).href);
  const labelById = new Map(CATEGORIES.map((c) => [c.id, c.label]));
  const parsed = parseProducts(productsSrc);
  return parsed.map((p) => ({
    slug: p.slug,
    text: buildSearchableText({
      name: p.name,
      tagline: p.tagline,
      techChips: p.techChips,
      categoryLabels: p.categoryIds.map((id) => labelById.get(id) ?? id),
    }),
  }));
}

/**
 * Ranks project slugs by cosine similarity to a query vector.
 * @param {number[]} queryVec
 * @param {{slug: string, vec: number[]}[]} projectVecs
 * @returns {string[]} slugs, best match first
 */
function rankByVector(queryVec, projectVecs) {
  return projectVecs
    .map((p) => ({ slug: p.slug, score: cosineSimilarity(queryVec, p.vec) }))
    .sort((a, b) => b.score - a.score)
    .map((p) => p.slug);
}

/**
 * Round 5 (task A1) — generic evaluator: takes a function that, given one
 * query string, returns (ranked slugs, elapsed ms). Records EVERY
 * fixture's hit@1/hit@3/top3, not just misses, so downstream statistics
 * (Wilson CI, McNemar) have the complete per-query record to work from.
 * @param {{id: string, query: string, expectedSlug: string}[]} fixtures
 * @param {(query: string) => Promise<{ranked: string[], latencyMs: number}>} rankQuery
 */
async function evaluate(fixtures, rankQuery) {
  let hitsAt1 = 0;
  let hitsAt3 = 0;
  const perQueryLatenciesMs = [];
  const perQuery = [];
  const misses = [];

  for (const fx of fixtures) {
    const { ranked, latencyMs } = await rankQuery(fx.query);
    perQueryLatenciesMs.push(latencyMs);

    const pos = ranked.indexOf(fx.expectedSlug); // -1 if absent (shouldn't happen, 13 fixed slugs)
    const hit1 = pos === 0;
    const hit3 = pos >= 0 && pos < 3;
    if (hit1) hitsAt1++;
    if (hit3) hitsAt3++;
    perQuery.push({ id: fx.id, query: fx.query, expected: fx.expectedSlug, hit1, hit3, top3: ranked.slice(0, 3) });
    if (!hit1) {
      misses.push({ id: fx.id, query: fx.query, expected: fx.expectedSlug, top3: ranked.slice(0, 3) });
    }
  }

  const n = fixtures.length;
  return {
    n,
    recallAt1: hitsAt1 / n,
    recallAt3: hitsAt3 / n,
    meanLatencyMs: perQueryLatenciesMs.reduce((a, b) => a + b, 0) / n,
    perQueryLatenciesMs,
    perQuery,
    misses,
  };
}

/** Wraps a vector-embedding function + a fixed set of project vectors into
 * the rankQuery(query) shape evaluate() expects.
 * @param {(text: string) => Promise<number[]>} embedOne
 * @param {{slug: string, vec: number[]}[]} projectVecs
 */
function makeVectorRanker(embedOne, projectVecs) {
  return async (query) => {
    const t0 = performance.now();
    const vec = await embedOne(query);
    const latencyMs = performance.now() - t0;
    return { ranked: rankByVector(vec, projectVecs), latencyMs };
  };
}

/** Round 5 (task A4) — the keyword-only tier as a rankQuery function:
 * scores every project's searchable text with the shipped keywordScore()
 * and sorts descending, exactly matching components/project-search.tsx's
 * tier-1 behavior (with no dense tier active).
 * @param {{slug: string, text: string}[]} projectTexts
 */
function makeKeywordRanker(projectTexts) {
  return async (query) => {
    const t0 = performance.now();
    const ranked = projectTexts
      .map((p) => ({ slug: p.slug, score: keywordScore(query, p.text) }))
      .sort((a, b) => b.score - a.score)
      .map((p) => p.slug);
    const latencyMs = performance.now() - t0;
    return { ranked, latencyMs };
  };
}

/** Round 5 (task A3) — the pruned static-embedding tier as a rankQuery
 * function: embeds the query against content/search/static-embeddings.json
 * via embedStatic(), then ranks the table's own precomputed project
 * vectors (also produced by embedStatic() at build time — see
 * scripts/search/build-static-embeddings.mjs) by cosine similarity. A
 * query with zero in-vocabulary words falls back to the table's project
 * order unchanged (equivalent to "no ranking signal"), mirroring how
 * production's tier-2 leaves the tier-1 ranking alone when the dense tier
 * has nothing to contribute.
 * @param {{dim: number, scale: number, vocab: string[], vectors: number[][], projects: {slug: string, embedding: number[]}[]}} table
 */
function makeStaticRanker(table) {
  const projectVecs = table.projects.map((p) => ({ slug: p.slug, vec: p.embedding }));
  return async (query) => {
    const t0 = performance.now();
    const vec = embedStatic(query, table);
    const ranked = vec === null ? projectVecs.map((p) => p.slug) : rankByVector(vec, projectVecs);
    const latencyMs = performance.now() - t0;
    return { ranked, latencyMs };
  };
}

async function main() {
  const fixtures = loadFixtures();
  console.log(`Loaded ${fixtures.length} eval cases from ${FIXTURES_DIR}`);

  const projectTexts = await loadProjectTexts();
  console.log(`Parsed ${projectTexts.length} projects from content/products.ts`);

  // --- MiniLM: use the already-committed, production project vectors ---
  const minilmData = JSON.parse(readFileSync(PROJECT_EMBEDDINGS_PATH, "utf8"));
  const minilmProjectVecs = minilmData.projects.map((p) => ({ slug: p.slug, vec: p.embedding }));
  console.log(`MiniLM: using committed content/search/project-embeddings.json (model=${minilmData.model})`);

  console.log("Warming MiniLM extractor (first call pays model-load cost, excluded from latency)...");
  await embedMiniLM(["warmup"]);

  console.log("Running MiniLM eval...");
  const minilmResult = await evaluate(
    fixtures,
    makeVectorRanker(async (text) => (await embedMiniLM([text]))[0], minilmProjectVecs)
  );

  // --- potion-base-8M: embed projects fresh (no committed vector file) ---
  let potionResult = null;
  let potionAvailable = true;
  let potionEmbed;
  try {
    ({ embed: potionEmbed } = await import("@yarflam/potion-base-8m"));
  } catch (err) {
    potionAvailable = false;
    console.error(
      "@yarflam/potion-base-8m not installed -- run `npm install @yarflam/potion-base-8m --no-save` first.",
      err
    );
  }

  if (potionAvailable) {
    console.log("Warming potion-base-8M extractor...");
    await potionEmbed(["warmup"]);

    console.log("Embedding all 13 projects with potion-base-8M...");
    const potionProjectVecsList = await potionEmbed(projectTexts.map((p) => p.text));
    const potionProjectVecs = projectTexts.map((p, i) => ({
      slug: p.slug,
      vec: Array.from(potionProjectVecsList[i]),
    }));

    console.log("Running potion-base-8M eval...");
    potionResult = await evaluate(
      fixtures,
      makeVectorRanker(async (text) => Array.from((await potionEmbed([text]))[0]), potionProjectVecs)
    );
  }

  // --- round 5, task A3: this repo's own pruned static-embedding table ---
  const staticTable = JSON.parse(readFileSync(STATIC_EMBEDDINGS_PATH, "utf8"));
  console.log(
    `static-matrix: using committed content/search/static-embeddings.json ` +
      `(${staticTable.vocab.length} words)`
  );
  console.log("Running static-matrix eval...");
  const staticResult = await evaluate(fixtures, makeStaticRanker(staticTable));

  // --- round 5, task A4: the always-shipped keyword-only tier, scored for the first time ---
  console.log("Running keyword-only eval...");
  const keywordResult = await evaluate(fixtures, makeKeywordRanker(projectTexts));

  const report = {
    generatedAt: new Date().toISOString(),
    nCases: fixtures.length,
    minilm: {
      model: minilmData.model,
      recallAt1: minilmResult.recallAt1,
      recallAt3: minilmResult.recallAt3,
      meanLatencyMs: minilmResult.meanLatencyMs,
      perQuery: minilmResult.perQuery,
      misses: minilmResult.misses,
    },
    potionBase8m: potionAvailable
      ? {
          model: "minishlab/potion-base-8M (via @yarflam/potion-base-8m npm package)",
          recallAt1: potionResult.recallAt1,
          recallAt3: potionResult.recallAt3,
          meanLatencyMs: potionResult.meanLatencyMs,
          perQuery: potionResult.perQuery,
          misses: potionResult.misses,
        }
      : { model: "minishlab/potion-base-8M", error: "package not installed for this run" },
    staticMatrix: {
      model: staticTable.model,
      vocabSize: staticTable.vocab.length,
      recallAt1: staticResult.recallAt1,
      recallAt3: staticResult.recallAt3,
      meanLatencyMs: staticResult.meanLatencyMs,
      perQuery: staticResult.perQuery,
      misses: staticResult.misses,
    },
    keywordOnly: {
      model: "lib/search/keyword-score.ts (no model)",
      recallAt1: keywordResult.recallAt1,
      recallAt3: keywordResult.recallAt3,
      meanLatencyMs: keywordResult.meanLatencyMs,
      perQuery: keywordResult.perQuery,
      misses: keywordResult.misses,
    },
  };

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");

  console.log("\n=== RESULTS ===");
  for (const [label, r] of [
    ["MiniLM", minilmResult],
    ...(potionAvailable ? [["potion-base-8M", potionResult]] : []),
    ["static-matrix", staticResult],
    ["keyword-only", keywordResult],
  ]) {
    console.log(
      `${label.padEnd(14)} recall@1=${(r.recallAt1 * 100).toFixed(1)}% ` +
        `recall@3=${(r.recallAt3 * 100).toFixed(1)}% ` +
        `meanLatency=${r.meanLatencyMs.toFixed(2)}ms ` +
        `(misses: ${r.misses.length})`
    );
  }
  console.log(`\nFull report (incl. every per-query result, not just misses): ${REPORT_PATH}`);
}

await main();
