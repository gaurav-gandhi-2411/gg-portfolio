// BL-9 — build-time embedder for the /projects search feature's tier-2
// (semantic) ranking. Embeds each of content/products.ts's projects with
// the shared lib/chatbot/embed.mjs module (same Node/local-ONNX path
// scripts/chatbot/build-index.mjs already uses — same model, same vector
// space as this repo's other build-time embedding artifact) and writes the
// result to content/search/project-embeddings.json.
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
// Deliberately NOT wired into `npm run build`: matching
// scripts/chatbot/build-index.mjs's own convention, this is an author-time
// artifact, committed to the repo and verified fresh by a dedicated CI step
// (scripts/search/check-project-embeddings-fresh.mjs) plus a pre-commit
// hook — never re-run live during a production build.
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
