// BL-9 round 5 (task A3) — build-time, zero-runtime-dependency static
// word-embedding table for /projects search's tier-2 ranking.
//
// This is a build-time-only distillation, in the spirit of model2vec's own
// technique (see minishlab/model2vec's paper/README): run each vocabulary
// WORD through the real MiniLM sentence-embedding pipeline (the same
// lib/chatbot/embed.mjs this repo already ships and runs at build time for
// content/search/project-embeddings.json and the /ask chatbot's index) as
// its own single-word "sentence", and keep the resulting 384-dim pooled,
// normalized vector as that word's static embedding. At QUERY time, no
// transformer forward pass happens at all — a query is tokenized into
// words, each word's precomputed vector is looked up by exact string match,
// and the vectors are mean-pooled + renormalized (see
// lib/search/static-embed.ts, ~30 lines, no dependency beyond this JSON
// asset).
//
// This is NOT the official model2vec/potion-base-8M artifact (that
// pipeline runs a PCA + SIF-weighting distillation over a full model
// vocabulary and ships as a published HuggingFace repo) — it is a much
// smaller, purpose-built distillation over a PRUNED vocabulary scoped to
// exactly what this feature needs: every word that actually appears in
// content/products.ts's 13 project descriptions, plus a bounded list of
// common English/tech words (scripts/search/common-vocab.mjs) so
// query-side phrasing that doesn't exactly match project text still has
// in-vocabulary words to embed. Out-of-vocabulary words are silently
// dropped at query time (see static-embed.ts) — this is the accuracy the
// pruned vocabulary buys, not a bug.
//
// Vocabulary composition (both sources deduplicated together):
//   1. every word (regex \b[a-z0-9]{2,}\b, lowercased) appearing in any of
//      the 13 projects' buildSearchableText() output — guarantees every
//      word that could ever be a "correct answer" signal is in-vocabulary.
//   2. scripts/search/common-vocab.mjs's hand-composed common English/
//      tech/product word list — NOT sourced from the eval queries
//      (evals/project-search/fixtures/*.json) on purpose, so this eval
//      stays a genuine held-out measurement rather than one inflated by
//      vocabulary leakage. See that file's own header.
//
// Quantization: each 384-dim float32 vector (already L2-normalized by
// embed()) is quantized to int8 with ONE shared global scale (the max
// absolute component value observed across the whole matrix) — simplest
// scheme that keeps dequantization to one multiply, no per-row overhead.
// Dequantized error is bounded by scale/127 per component; see
// lib/search/static-embed.ts's re-normalization step, which corrects for
// the small resulting norm drift.
//
// Run: node scripts/search/build-static-embeddings.mjs
// Zero dependencies beyond @huggingface/transformers (via
// lib/chatbot/embed.mjs, build-time only); Node 20+.

import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { embed, EmbeddingUnavailableError } from "../../lib/chatbot/embed.mjs";
import { buildSearchableText } from "../../lib/search/searchable-text.ts";
import { embedStatic } from "../../lib/search/static-embed.ts";
import { COMMON_VOCAB_WORDS } from "./common-vocab.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PRODUCTS_PATH = join(ROOT, "content", "products.ts");
const TYPES_PATH = join(ROOT, "content", "types.ts");
export const OUTPUT_PATH = join(ROOT, "content", "search", "static-embeddings.json");

const WORD_RE = /[a-z0-9]+/g;

/** Same regex-parse technique as build-project-embeddings.mjs / run-recall-eval.mjs
 * — content/products.ts has a real runtime import plain Node can't resolve.
 * @param {string} productsSrc
 */
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

/** @param {string} text @returns {string[]} */
function words(text) {
  return [...text.toLowerCase().matchAll(WORD_RE)].map((m) => m[0]).filter((w) => w.length >= 2);
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

/** @param {{slug: string, text: string}[]} projectTexts */
function buildVocab(projectTexts) {
  const domainWords = new Set();
  for (const { text } of projectTexts) {
    for (const w of words(text)) domainWords.add(w);
  }

  const commonWords = new Set(COMMON_VOCAB_WORDS.map((w) => w.toLowerCase()));

  const vocab = [...new Set([...domainWords, ...commonWords])].sort();
  return { vocab, domainWordCount: domainWords.size, commonWordCount: commonWords.size };
}

/**
 * Quantizes a matrix of unit-norm float vectors to int8 with one shared
 * global scale.
 * @param {number[][]} vectors
 * @returns {{ int8: number[][], scale: number }}
 */
function quantize(vectors) {
  let maxAbs = 0;
  for (const v of vectors) for (const x of v) maxAbs = Math.max(maxAbs, Math.abs(x));
  const scale = maxAbs === 0 ? 1 : maxAbs;
  const int8 = vectors.map((v) => v.map((x) => Math.max(-127, Math.min(127, Math.round((x / scale) * 127)))));
  return { int8, scale };
}

async function main() {
  console.log("Parsing project texts...");
  const projectTexts = await loadProjectTexts();

  console.log("Building vocabulary...");
  const { vocab, domainWordCount, commonWordCount } = buildVocab(projectTexts);
  console.log(
    `Vocabulary: ${vocab.length} unique words (${domainWordCount} from content/products.ts, ` +
      `${commonWordCount} from scripts/search/common-vocab.mjs, overlap accounts for the ` +
      `difference from the raw sum).`
  );

  console.log(`Embedding ${vocab.length} words with MiniLM (one forward pass per word)...`);
  // Batched, not one-at-a-time, so this build step stays fast — embed()
  // accepts an array and returns vectors in the same order.
  const BATCH_SIZE = 64;
  /** @type {number[][]} */
  const vectors = [];
  for (let i = 0; i < vocab.length; i += BATCH_SIZE) {
    const batch = vocab.slice(i, i + BATCH_SIZE);
    const batchVectors = await embed(batch);
    vectors.push(...batchVectors);
    process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, vocab.length)}/${vocab.length}`);
  }
  console.log();

  const dim = vectors[0]?.length ?? 0;
  const { int8, scale } = quantize(vectors);

  // Project ("document") vectors are computed with the SAME pruned table
  // and the SAME mean-pool function queries use at runtime (embedStatic) --
  // one self-consistent embedding space end to end, not a hybrid with the
  // full-model project-embeddings.json vectors. Since every domain word
  // came from these exact project texts, coverage here is ~100% by
  // construction (see the printed OOV-word warnings below for any gap).
  const table = { dim, scale, vocab, vectors: int8 };
  const projectVectors = projectTexts.map(({ slug, text }) => {
    const vec = embedStatic(text, table);
    if (vec === null) {
      console.warn(`WARNING: project "${slug}" produced zero in-vocabulary words -- this should not happen`);
    }
    return { slug, embedding: vec ?? new Array(dim).fill(0) };
  });

  const output = {
    generatedAt: new Date().toISOString(),
    model: "Xenova/all-MiniLM-L6-v2 (word-level distillation, see this file's own build script header)",
    dim,
    scale,
    vocab,
    vectors: int8,
    projects: projectVectors,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output) + "\n");
  const sizeBytes = statSync(OUTPUT_PATH).size;
  console.log(
    `Wrote ${vocab.length} word vectors (dim=${dim}, int8) to ${OUTPUT_PATH} ` +
      `-- ${sizeBytes} bytes (${(sizeBytes / (1024 * 1024)).toFixed(3)} MiB) on disk.`
  );
}

try {
  await main();
} catch (err) {
  if (err instanceof EmbeddingUnavailableError) {
    console.error(
      "\nbuild-static-embeddings: @huggingface/transformers is not installed. The static " +
        "embedding table cannot be rebuilt.\nRefusing to write -- a silently skipped rebuild " +
        "ships a stale table.\n"
    );
    process.exit(1);
  }
  throw err;
}
