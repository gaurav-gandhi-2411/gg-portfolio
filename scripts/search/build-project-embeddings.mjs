// BL-9 round 4/5 — build-time embedder that originally fed the /projects
// search feature's client-side MiniLM semantic-reranking tier. Embeds each
// of content/products.ts's projects with the shared lib/chatbot/embed.mjs
// module (same Node/local-ONNX path scripts/chatbot/build-index.mjs
// already uses) and writes the result to
// content/search/project-embeddings.json.
//
// ROUND 5 STATUS CHANGE: that client-side MiniLM tier was removed from
// production (see components/project-search.tsx's header for the full
// decision — a 570-second real cold start on Slow-4G is a kill, and the
// recall gain over keyword-only ranking was not statistically
// distinguishable at n=28 anyway). content/search/project-embeddings.json
// is NO LONGER a production build artifact and NOTHING in the shipped app
// reads it. It is kept, uncommitted-to-freshness (no CI gate, no
// pre-commit hook enforces it matches content/products.ts anymore — see
// git history for their removal), purely so
// evals/project-search/run-recall-eval.mjs's MiniLM comparison tier stays
// reproducible for any future round that wants to re-run this comparison.
// If this file goes stale relative to content/products.ts, it affects only
// that eval's numbers, not production.
//
// Run: node scripts/search/build-project-embeddings.mjs
//
// content/products.ts has a real runtime import (`@/lib/metrics`) that
// plain Node can't resolve without a bundler, so — same as
// scripts/chatbot/build-index.mjs's chunksForProducts — it's parsed as text
// via regex rather than imported. content/types.ts has no unresolvable
// runtime imports, so it's imported directly by file URL for the
// CATEGORIES id->label lookup lib/search/searchable-text.ts needs.
//
// Zero dependencies beyond @huggingface/transformers (via
// lib/chatbot/embed.mjs); Node 20+.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { embed, EMBEDDING_MODEL_ID, EmbeddingUnavailableError } from "../../lib/chatbot/embed.mjs";
import { buildSearchableText } from "../../lib/search/searchable-text.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PRODUCTS_PATH = join(ROOT, "content", "products.ts");
const TYPES_PATH = join(ROOT, "content", "types.ts");
export const OUTPUT_PATH = join(ROOT, "content", "search", "project-embeddings.json");

/**
 * Regex-parses content/products.ts into per-project records — same
 * block-splitting technique as build-index.mjs's chunksForProducts (split
 * on each `slug: "..."` match), extended to also capture `categories`.
 * @param {string} productsSrc - raw text of content/products.ts
 * @returns {{ slug: string, name: string, tagline: string, techChips: string[], categoryIds: string[] }[]}
 */
export function parseProducts(productsSrc) {
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

async function main() {
  const productsSrc = readFileSync(PRODUCTS_PATH, "utf8");
  const { CATEGORIES } = await import(pathToFileURL(TYPES_PATH).href);
  const labelById = new Map(CATEGORIES.map((c) => [c.id, c.label]));

  const parsed = parseProducts(productsSrc);
  if (parsed.length === 0) {
    throw new Error(
      "parsed zero products from content/products.ts — the slug-splitting regex is out of " +
        "sync with the file's current shape; fix the parser before trusting its output"
    );
  }

  const records = parsed.map((p) => ({
    slug: p.slug,
    text: buildSearchableText({
      name: p.name,
      tagline: p.tagline,
      techChips: p.techChips,
      categoryLabels: p.categoryIds.map((id) => labelById.get(id) ?? id),
    }),
  }));

  console.log(`Embedding ${records.length} project(s)...`);
  const vectors = await embed(records.map((r) => r.text));
  const dim = vectors[0]?.length ?? 0;

  const output = {
    generatedAt: new Date().toISOString(),
    model: EMBEDDING_MODEL_ID,
    dim,
    projects: records.map((r, i) => ({ slug: r.slug, embedding: vectors[i] })),
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output) + "\n");
  console.log(`Wrote ${records.length} project embeddings (dim=${dim}) to ${OUTPUT_PATH}`);
}

// Same fail-closed contract as build-index.mjs: refuse to write rather than
// silently skip when the embedding dependency is absent (a skipped write
// that exits 0 ships a stale artifact while reporting success).
try {
  await main();
} catch (err) {
  if (err instanceof EmbeddingUnavailableError) {
    console.error(
      "\nbuild-project-embeddings: @huggingface/transformers is not installed. The project " +
        "search index cannot be rebuilt.\n" +
        "If this ran in CI, install optional dependencies (npm ci without --omit=optional).\n" +
        "Refusing to write — a silently skipped rebuild ships a stale index.\n"
    );
    process.exit(1);
  }
  throw err;
}
