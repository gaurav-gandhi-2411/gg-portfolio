// Wave 16 — build-time corpus indexer for the reconciliation chatbot.
//
// Chunks content/*.ts + content/provenance.md into small, structurally-bounded
// records (headings/array-items/paragraphs, never fixed token windows), embeds
// each chunk with the shared lib/chatbot/embed.mjs module (local ONNX model,
// same vector space the runtime API route will query against), and writes the
// result to content/chatbot/index.json.
//
// Run: node scripts/chatbot/build-index.mjs
//
// content/case-studies/*.ts and content/experience.ts, content/availability.ts,
// content/site.ts have no non-erasable TypeScript and no unresolvable runtime
// imports (only `import type` from local files), so Node's built-in TypeScript
// type-stripping (stable since Node 23.6, no flag needed on Node 24+) can
// import them directly. content/products.ts *does* have a real runtime import
// via the "@/lib/metrics" path alias, which plain Node can't resolve without a
// bundler — so it's parsed as text instead (same technique
// scripts/refresh-metrics.mjs already uses on this exact file for `liveUrl`).
//
// Zero dependencies beyond @huggingface/transformers (via lib/chatbot/embed.mjs);
// Node 20+.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  embed,
  EMBEDDING_MODEL_ID,
  EmbeddingUnavailableError,
} from "../../lib/chatbot/embed.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CASE_STUDIES_DIR = join(ROOT, "content", "case-studies");
const CASE_STUDIES_INDEX_PATH = join(CASE_STUDIES_DIR, "index.ts");
const PRODUCTS_PATH = join(ROOT, "content", "products.ts");
const PROVENANCE_PATH = join(ROOT, "content", "provenance.md");
const EXPERIENCE_PATH = join(ROOT, "content", "experience.ts");
const AVAILABILITY_PATH = join(ROOT, "content", "availability.ts");
const SITE_PATH = join(ROOT, "content", "site.ts");
const OUTPUT_PATH = join(ROOT, "content", "chatbot", "index.json");

const BATCH_SIZE = 24;

// ── 1. Case studies ──────────────────────────────────────────────────────

/** Discovers case-study filenames from index.ts's own import statements
 * (`import { X } from "./Y";`), rather than hardcoding the list — stays in
 * sync automatically as projects are added. Skips the `import type` line. */
function discoverCaseStudyModules() {
  const indexSrc = readFileSync(CASE_STUDIES_INDEX_PATH, "utf8");
  return [...indexSrc.matchAll(/import \{ (\w+) \} from "\.\/([\w-]+)";/g)].map(
    ([, exportName, fileName]) => ({ exportName, fileName })
  );
}

async function loadCaseStudies() {
  const modules = discoverCaseStudyModules();
  const caseStudies = [];
  for (const { exportName, fileName } of modules) {
    const fileUrl = pathToFileURL(join(CASE_STUDIES_DIR, `${fileName}.ts`)).href;
    const mod = await import(fileUrl);
    caseStudies.push(mod[exportName]);
  }
  return caseStudies;
}

/** One chunk per problem/approach paragraph, decision, result, the story (as a
 * whole), and closing paragraph — the structural units the CaseStudy type
 * already defines, not fixed-size windows. */
function chunksForCaseStudy(cs) {
  const chunks = [];
  const url = `/work/${cs.slug}`;

  cs.problem.forEach((para, i) => {
    chunks.push({
      text: `${cs.title}: ${para}`,
      sourceRef: `${cs.slug}:problem:${i + 1}`,
      sourceLabel: `${cs.title} case study — Problem`,
      url,
    });
  });

  cs.approach.forEach((para, i) => {
    chunks.push({
      text: `${cs.title}: ${para}`,
      sourceRef: `${cs.slug}:approach:${i + 1}`,
      sourceLabel: `${cs.title} case study — Approach`,
      url,
    });
  });

  for (const d of cs.decisions ?? []) {
    chunks.push({
      text: `${cs.title} — ${d.title}. ${d.body}`,
      sourceRef: d.sourceRef,
      sourceLabel: `${cs.title} case study — Decision: ${d.title}`,
      url,
    });
  }

  for (const r of cs.results ?? []) {
    chunks.push({
      text: `${cs.title} — ${r.label}: ${r.value}.${r.detail ? ` ${r.detail}` : ""}`,
      sourceRef: r.sourceRef,
      sourceLabel: `${cs.title} case study — Results: ${r.label}`,
      url,
    });
  }

  if (cs.story) {
    chunks.push({
      text: `${cs.title} — ${cs.story.title}. ${cs.story.body.join(" ")}`,
      sourceRef: cs.story.sourceRef,
      sourceLabel: `${cs.title} case study — Story`,
      url,
    });
  }

  // closing has no sourceRef on the type (it synthesizes already-sourced
  // claims, not a new one) — synthesize `<slug>:closing`, per the wave-16 brief.
  (cs.closing ?? []).forEach((para, i, arr) => {
    chunks.push({
      text: `${cs.title} — what this means if you need something similar: ${para}`,
      sourceRef: arr.length === 1 ? `${cs.slug}:closing` : `${cs.slug}:closing:${i + 1}`,
      sourceLabel: `${cs.title} case study — Takeaway`,
      url,
    });
  });

  return chunks;
}

// ── 2. provenance.md ─────────────────────────────────────────────────────

function slugifyHeading(heading) {
  return heading
    .toLowerCase()
    .replace(/[`*]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

const SEPARATOR_ROW = /^\|[\s:|-]+\|$/;

/**
 * Chunks provenance.md per markdown table row and per prose paragraph/bullet.
 * Headings recur per product across dated passes (the file is a running log,
 * not one contiguous block per product), so every row/paragraph is tagged
 * with whatever heading is currently in scope rather than assuming a single
 * section owns a product. Table rows carrying a literal backtick-quoted ID
 * cite that ID as sourceRef (the true provenance ledger key); rows/paragraphs
 * without one get a synthesized `provenance:<heading-slug>:...` ref.
 *
 * No dedicated provenance page exists on the site (it's a citation ledger,
 * not a navigable route), so these chunks intentionally carry no `url`.
 */
function chunksForProvenance(text) {
  const chunks = [];
  // \r?\n, not a bare \n split — the file is CRLF, and a stray trailing \r
  // breaks every `$`-anchored regex below (JS's `.` doesn't match \r).
  const lines = text.split(/\r?\n/);
  let heading = "Content Provenance Manifest";
  let headingSlug = slugifyHeading(heading);
  const paraCounts = new Map();
  const rowCounts = new Map();
  let paraBuf = [];

  function flushParagraph() {
    if (paraBuf.length === 0) return;
    const paraText = paraBuf.join(" ").replace(/\s+/g, " ").trim();
    paraBuf = [];
    if (paraText.length < 40) return; // skip stray fragments/short notes
    const n = (paraCounts.get(headingSlug) ?? 0) + 1;
    paraCounts.set(headingSlug, n);
    chunks.push({
      text: `${heading}: ${paraText}`,
      sourceRef: `provenance:${headingSlug}:p${n}`,
      sourceLabel: `Provenance ledger — ${heading}`,
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = /^#{1,3}\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      heading = headingMatch[1].trim();
      headingSlug = slugifyHeading(heading);
      continue;
    }
    if (line.trim().startsWith("|")) {
      flushParagraph();
      // Header row: the row immediately preceding a `|---|---|` separator.
      if (SEPARATOR_ROW.test(lines[i + 1]?.trim() ?? "")) continue;
      if (SEPARATOR_ROW.test(line.trim())) continue;
      const cells = line
        .trim()
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      // Some rows have fewer cells than their table's own header declares —
      // a row's Change/Source content occasionally runs together into one
      // cell with no separating pipe. Match on cells[0] looking like a
      // backtick-quoted ID regardless of exact column count, rather than
      // requiring a fixed 3-column shape.
      const idMatch = cells.length >= 2 ? /^`([\w.:-]+)`$/.exec(cells[0]) : null;
      if (idMatch) {
        chunks.push({
          text: `${heading} — ${cells.slice(1).join(" — ")}`,
          sourceRef: idMatch[1],
          sourceLabel: `Provenance ledger — ${heading}`,
        });
      } else {
        const n = (rowCounts.get(headingSlug) ?? 0) + 1;
        rowCounts.set(headingSlug, n);
        chunks.push({
          text: `${heading} — ${cells.join(" — ")}`,
          sourceRef: `provenance:${headingSlug}:row${n}`,
          sourceLabel: `Provenance ledger — ${heading}`,
        });
      }
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      continue;
    }
    // A new top-level bullet starts its own chunk rather than merging into
    // whatever paragraph came before it.
    if (/^-\s+/.test(line) && paraBuf.length > 0) flushParagraph();
    paraBuf.push(line.trim());
  }
  flushParagraph();
  return chunks;
}

// ── 3. products.ts (regex-parsed — see module header for why) ───────────

/** One chunk per product's tagline + tech chips, for lightweight
 * product-overview coverage alongside the deeper case-study chunks. */
function chunksForProducts(productsSrc, caseStudySlugs) {
  const chunks = [];
  const slugMatches = [...productsSrc.matchAll(/slug: "([a-z0-9-]+)"/g)];
  for (let i = 0; i < slugMatches.length; i++) {
    const start = slugMatches[i].index;
    const end = i + 1 < slugMatches.length ? slugMatches[i + 1].index : productsSrc.length;
    const block = productsSrc.slice(start, end);
    const slug = slugMatches[i][1];
    const name = /name: "([^"]+)"/.exec(block)?.[1] ?? slug;
    const tagline = /tagline:\s*\n?\s*"([^"]+)"/.exec(block)?.[1] ?? "";
    const techChipsRaw = /techChips:\s*\[([^\]]*)\]/.exec(block)?.[1] ?? "";
    const techChips = [...techChipsRaw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const hasCaseStudy = caseStudySlugs.has(slug);
    chunks.push({
      text: `${name}: ${tagline}${techChips.length ? ` Built with: ${techChips.join(", ")}.` : ""}`,
      sourceRef: `${slug}:tagline`,
      sourceLabel: `Product overview — ${name}`,
      url: hasCaseStudy ? `/work/${slug}` : undefined,
    });
  }
  return chunks;
}

// ── 4. experience.ts ─────────────────────────────────────────────────────

function chunksForExperience(experience) {
  const chunks = [];
  for (const entry of experience) {
    const roles = entry.subRoles ?? [{ title: undefined, bullets: entry.bullets ?? [] }];
    for (const role of roles) {
      for (const bullet of role.bullets) {
        chunks.push({
          text: role.title
            ? `${entry.company} — ${role.title}: ${bullet.text}`
            : `${entry.company}: ${bullet.text}`,
          sourceRef: bullet.sourceRef,
          sourceLabel: role.title
            ? `Experience — ${entry.company} — ${role.title}`
            : `Experience — ${entry.company}`,
          url: "/#experience",
        });
      }
    }
  }
  return chunks;
}

// ── 5. availability.ts ───────────────────────────────────────────────────

function chunksForAvailability(availability) {
  return [
    {
      text: availability.summary,
      sourceRef: "availability:summary",
      sourceLabel: "Availability — role search",
      url: "/#contact",
    },
  ];
}

// ── 6. site.ts ────────────────────────────────────────────────────────────

/** Role/location/tagline/status/public-profile-links — genuinely useful
 * identity facts for answering "who is GG" questions. Deliberately excludes
 * `site.email`: a raw email address isn't something the bot should recite. */
function chunksForSite(site) {
  const profiles = [
    `GitHub ${site.githubUrl}`,
    `LinkedIn ${site.linkedinUrl}`,
    site.huggingfaceUrl ? `Hugging Face ${site.huggingfaceUrl}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return [
    {
      text: `${site.name} is a ${site.role} based in ${site.location}. ${site.tagline} Current status: ${site.status}. Profiles: ${profiles}.`,
      sourceRef: "site:identity",
      sourceLabel: "Site identity — Gaurav Gandhi",
      url: "/",
    },
  ];
}

// ── Assemble, embed, write ───────────────────────────────────────────────

async function main() {
  const caseStudies = await loadCaseStudies();
  const caseStudySlugs = new Set(caseStudies.map((cs) => cs.slug));
  const { experience } = await import(pathToFileURL(EXPERIENCE_PATH).href);
  const { availability } = await import(pathToFileURL(AVAILABILITY_PATH).href);
  const { site } = await import(pathToFileURL(SITE_PATH).href);
  const productsSrc = readFileSync(PRODUCTS_PATH, "utf8");
  const provenanceSrc = readFileSync(PROVENANCE_PATH, "utf8");

  const rawChunks = [
    ...caseStudies.flatMap(chunksForCaseStudy),
    ...chunksForProvenance(provenanceSrc),
    ...chunksForProducts(productsSrc, caseStudySlugs),
    ...chunksForExperience(experience),
    ...chunksForAvailability(availability),
    ...chunksForSite(site),
  ];

  // Ids must be unique even though provenance.md's sourceRefs can legitimately
  // repeat (the same claim ID is cited across multiple dated passes).
  const idCounts = new Map();
  const chunks = rawChunks.map((c) => {
    const n = (idCounts.get(c.sourceRef) ?? 0) + 1;
    idCounts.set(c.sourceRef, n);
    const id = n === 1 ? c.sourceRef : `${c.sourceRef}#${n}`;
    return { id, ...c };
  });

  console.log(`Chunked ${chunks.length} records. Embedding in batches of ${BATCH_SIZE}...`);
  const withEmbeddings = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const vectors = await embed(batch.map((c) => c.text));
    batch.forEach((c, j) => withEmbeddings.push({ ...c, embedding: vectors[j] }));
    console.log(`  embedded ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length}`);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    model: EMBEDDING_MODEL_ID,
    chunkCount: withEmbeddings.length,
    chunks: withEmbeddings,
  };
  writeFileSync(OUTPUT_PATH, JSON.stringify(output) + "\n");
  console.log(`Wrote ${withEmbeddings.length} chunks to ${OUTPUT_PATH}`);
}

// Fail LOUDLY and write NOTHING when the embedding dependency is absent.
//
// @huggingface/transformers is an optionalDependency (2026-08-13), so "not
// installed" is now a reachable state rather than an impossible one. The
// dangerous version of this script is the helpful one: catch the error, warn,
// leave the existing index in place, exit 0. That ships a STALE index while
// reporting success — and a stale index has broken main twice.
//
// So: EmbeddingUnavailableError is caught only to explain itself, then exits
// non-zero. Everything else propagates untouched — a model-load failure or an
// inference bug is a real fault and must not be dressed up as a missing
// dependency.
try {
  await main();
} catch (err) {
  if (err instanceof EmbeddingUnavailableError) {
    console.error(
      "\nbuild-index: @huggingface/transformers is not installed. The index cannot be " +
        "rebuilt.\n" +
        "If this ran in CI, install optional dependencies (npm ci without " +
        "--omit=optional).\n" +
        "Refusing to write — a silently skipped rebuild ships a stale index.\n"
    );
    process.exit(1);
  }
  throw err;
}
