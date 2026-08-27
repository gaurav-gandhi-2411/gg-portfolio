#!/usr/bin/env node
// Does eval.yml's path filter actually cover everything the chatbot index is
// built from?
//
// WHY THIS EXISTS. eval.yml gates chatbot answer quality, and it triggered on
// app/api/chat/**, lib/chatbot/** and evals/chatbot/** only. But the index the
// chatbot retrieves from is built from content/: case studies, products,
// provenance, experience, availability, site. So a copy change altered what the
// chatbot could retrieve and ran no eval at all. The filter was narrower than
// its subject, which made the exemption wider than anyone intended: every
// content change was exempt from the quality gate that exists for it.
//
// Adding content/** fixes today. It does not stop the next drift, because the
// filter is a static list in a YAML file and the sources are a growing list in a
// build script, and nothing compared them. This is the comparison.
//
// SHAPE, borrowed from check-metric-freshness.mjs, which the exemption audit
// found to be this repo's counter-example: derive the exemption from a property
// recomputed every run rather than from a decision recorded once, and print
// every bucket against a denominator so coverage loss shows as a number moving
// rather than as silence. A source added to build-index.mjs and not to the
// filter fails here, by name, the first time it runs.
//
// Zero dependencies. Run: node scripts/check-eval-trigger-covers-index-sources.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD_INDEX = join(ROOT, "scripts", "chatbot", "build-index.mjs");
const WORKFLOW = join(ROOT, ".github", "workflows", "eval.yml");

/**
 * Every repo-relative path build-index.mjs reads, derived from its own
 * `join(ROOT, ...)` declarations rather than from a list kept here.
 *
 * Deliberately not an import of the module: importing it would run it, which
 * loads an ONNX model and rebuilds embeddings. Reading its source is the cheap
 * way to ask what it reads, and the pattern it declares paths with is stable
 * enough to parse. A declaration this cannot parse is reported, not skipped,
 * because an unparseable source is indistinguishable from an uncovered one.
 */
function indexSources() {
  const src = readFileSync(BUILD_INDEX, "utf8");
  const sources = new Set();
  const unparsed = [];

  // const X_PATH = join(ROOT, "content", "products.ts");
  // const CASE_STUDIES_DIR = join(ROOT, "content", "case-studies");
  const declRe = /const\s+([A-Z0-9_]+)\s*=\s*join\(\s*ROOT\s*,([^)]*)\)/g;
  for (const m of src.matchAll(declRe)) {
    const name = m[1];
    const segments = [...m[2].matchAll(/"([^"]+)"/g)].map((s) => s[1]);
    if (segments.length === 0) {
      unparsed.push(`${name}: join(ROOT, ...) with no literal segments`);
      continue;
    }
    // The output is written, not read, so it is not an input to gate on.
    if (name === "OUTPUT_PATH") continue;
    sources.add(segments.join("/"));
  }

  // Paths built from a discovered filename rather than declared whole, e.g. the
  // case-study modules. The directory they live in is already captured above,
  // and a directory covers its children, so nothing extra is needed; recorded
  // here so a future reader does not think it was missed.
  return { sources: [...sources].sort(), unparsed };
}

/** Every glob in every `paths:` list in the workflow, across all triggers. */
function workflowFilters() {
  const src = readFileSync(WORKFLOW, "utf8").replace(/\r\n/g, "\n");
  const filters = new Set();
  let inPaths = false;
  let pathsIndent = 0;
  for (const line of src.split("\n")) {
    const trimmed = line.trim();
    if (/^paths:\s*$/.test(trimmed)) {
      inPaths = true;
      pathsIndent = line.length - line.trimStart().length;
      continue;
    }
    if (!inPaths) continue;
    const item = trimmed.match(/^-\s*"?([^"#]+?)"?\s*$/);
    const indent = line.length - line.trimStart().length;
    if (item && indent > pathsIndent) {
      filters.add(item[1]);
      continue;
    }
    if (trimmed !== "" && indent <= pathsIndent) inPaths = false;
  }
  return [...filters].sort();
}

/** Does any glob cover this path? Prefix semantics, which is all `**` needs. */
function coveredBy(source, filters) {
  return filters.find((f) => {
    const prefix = f.replace(/\*\*$/, "").replace(/\/$/, "");
    return source === f || source === prefix || source.startsWith(prefix + "/");
  });
}

const { sources, unparsed } = indexSources();
const filters = workflowFilters();

console.log("eval.yml path filter vs the chatbot index's own sources\n");
console.log(`  filters declared in the workflow: ${filters.length}`);
for (const f of filters) console.log(`    ${f}`);
console.log(`\n  sources build-index.mjs reads: ${sources.length}`);

const uncovered = [];
for (const s of sources) {
  const by = coveredBy(s, filters);
  console.log(`    ${by ? "covered  " : "UNCOVERED"} ${s}${by ? `  (by ${by})` : ""}`);
  if (!by) uncovered.push(s);
}

const covered = sources.length - uncovered.length;
console.log(`\n--> ${covered}/${sources.length} index sources covered by the eval trigger.`);

if (unparsed.length > 0) {
  console.error(
    `\nFAIL — ${unparsed.length} path declaration(s) in build-index.mjs could not be parsed, ` +
      "so whether the trigger covers them is unknown:\n" +
      unparsed.map((u) => `  ${u}`).join("\n") +
      "\nAn unparseable source is treated as uncovered on purpose: this check must not report " +
      "full coverage of a set it could not read."
  );
  process.exit(1);
}

if (uncovered.length > 0) {
  console.error(
    `\nFAIL — ${uncovered.length} source(s) feed the chatbot index but fire no eval:\n` +
      uncovered.map((u) => `  ${u}`).join("\n") +
      "\n\nA change to any of them alters what the chatbot can retrieve while the gate that " +
      "exists for exactly that stays silent. Add the path to eval.yml's paths: lists (both " +
      "triggers), or stop reading it in build-index.mjs."
  );
  process.exit(1);
}

console.log("\nOK — every source the chatbot index is built from fires the eval.");
