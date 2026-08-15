// BL-9 round 4 -- recall@1/@3 + warm per-query latency, MiniLM vs a
// model2vec/potion-base-8M static-embedding alternative, on an identical
// hand-labeled eval set (evals/project-search/fixtures/*.json).
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
// Run: node evals/project-search/run-recall-eval.mjs
// Requires: `npm install @yarflam/potion-base-8m --no-save` first (not a
// committed dependency -- see package.json, this is eval-only).

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { embed as embedMiniLM, cosineSimilarity } from "../../lib/chatbot/embed.mjs";
import { buildSearchableText } from "../../lib/search/searchable-text.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURES_DIR = join(ROOT, "evals", "project-search", "fixtures");
const PROJECT_EMBEDDINGS_PATH = join(ROOT, "content", "search", "project-embeddings.json");
const PRODUCTS_PATH = join(ROOT, "content", "products.ts");
const TYPES_PATH = join(ROOT, "content", "types.ts");
const REPORT_PATH = join(ROOT, "reports", "BL-9-round4-recall-eval.json");

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
function rank(queryVec, projectVecs) {
  return projectVecs
    .map((p) => ({ slug: p.slug, score: cosineSimilarity(queryVec, p.vec) }))
    .sort((a, b) => b.score - a.score)
    .map((p) => p.slug);
}

/**
 * @param {{id: string, query: string, expectedSlug: string}[]} fixtures
 * @param {(text: string) => Promise<number[]>} embedOne
 * @param {{slug: string, vec: number[]}[]} projectVecs
 */
async function evaluate(fixtures, embedOne, projectVecs) {
  let hitsAt1 = 0;
  let hitsAt3 = 0;
  const perQueryLatenciesMs = [];
  const misses = [];

  for (const fx of fixtures) {
    const t0 = performance.now();
    const vec = await embedOne(fx.query);
    perQueryLatenciesMs.push(performance.now() - t0);

    const ranked = rank(vec, projectVecs);
    const pos = ranked.indexOf(fx.expectedSlug); // -1 if absent (shouldn't happen, 13 fixed slugs)
    if (pos === 0) hitsAt1++;
    if (pos >= 0 && pos < 3) hitsAt3++;
    if (pos !== 0) {
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
    misses,
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
    async (text) => (await embedMiniLM([text]))[0],
    minilmProjectVecs
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
      async (text) => Array.from((await potionEmbed([text]))[0]),
      potionProjectVecs
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    nCases: fixtures.length,
    minilm: {
      model: minilmData.model,
      recallAt1: minilmResult.recallAt1,
      recallAt3: minilmResult.recallAt3,
      meanLatencyMs: minilmResult.meanLatencyMs,
      misses: minilmResult.misses,
    },
    potionBase8m: potionAvailable
      ? {
          model: "minishlab/potion-base-8M (via @yarflam/potion-base-8m npm package)",
          recallAt1: potionResult.recallAt1,
          recallAt3: potionResult.recallAt3,
          meanLatencyMs: potionResult.meanLatencyMs,
          misses: potionResult.misses,
        }
      : { model: "minishlab/potion-base-8M", error: "package not installed for this run" },
  };

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");

  console.log("\n=== RESULTS ===");
  console.log(
    `MiniLM        recall@1=${(minilmResult.recallAt1 * 100).toFixed(1)}% ` +
      `recall@3=${(minilmResult.recallAt3 * 100).toFixed(1)}% ` +
      `meanLatency=${minilmResult.meanLatencyMs.toFixed(2)}ms ` +
      `(${minilmResult.n - minilmResult.misses.length}/${minilmResult.n} at rank 1... ` +
      `misses: ${minilmResult.misses.length})`
  );
  if (potionAvailable) {
    console.log(
      `potion-base-8M recall@1=${(potionResult.recallAt1 * 100).toFixed(1)}% ` +
        `recall@3=${(potionResult.recallAt3 * 100).toFixed(1)}% ` +
        `meanLatency=${potionResult.meanLatencyMs.toFixed(2)}ms ` +
        `(misses: ${potionResult.misses.length})`
    );
  }
  console.log(`\nFull report (incl. per-query misses): ${REPORT_PATH}`);
}

await main();
