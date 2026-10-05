// Drift guard: the pre-commit `chatbot-index-fresh` hook's `files:` regex must match every file
// scripts/chatbot/build-index.mjs reads. The regex was hand-written to cover only case studies and
// provenance.md, so edits to products.ts / experience.ts / availability.ts / site.ts /
// lib/case-study-anchors.ts skipped the hook and the stale index only surfaced in CI (which has
// broken main twice). The input set is DERIVED from the builder's source, so a new input added
// there fails this test until the hook regex is widened.
//
// Run: node scripts/chatbot/hook-coverage.smoketest.mjs   (exit 1 on any uncovered input)

import { readFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Extracts the `files:` regex of the hook with the given id from pre-commit YAML text. */
export function hookFilesRegex(yamlText, hookId) {
  const lines = yamlText.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `- id: ${hookId}`);
  if (start === -1) throw new Error(`hook ${hookId} not found`);
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*- id:/.test(lines[i])) break;
    const m = lines[i].match(/^\s*files:\s*(.+?)\s*$/);
    if (m) return new RegExp(m[1]);
  }
  throw new Error(`hook ${hookId} has no files: pattern`);
}

/**
 * Repo-relative paths the builder reads. `join(ROOT, "a", "b.ts")` constants become files; a
 * directory constant (no extension) becomes a sample file inside it; relative imports of
 * ../../lib/* become files. The output index (content/chatbot/) is excluded.
 */
export function builderInputs(builderSrc) {
  const out = new Set();
  for (const m of builderSrc.matchAll(/join\(ROOT,\s*((?:"[^"]+"\s*,?\s*)+)\)/g)) {
    const parts = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    const rel = parts.join("/");
    if (rel.startsWith("content/chatbot/")) continue; // the output, not an input
    out.add(/\.\w+$/.test(rel) ? rel : `${rel}/sample.ts`);
  }
  for (const m of builderSrc.matchAll(/from "\.\.\/\.\.\/(lib\/[^"]+)"/g)) {
    out.add(posix.normalize(m[1]));
  }
  return [...out].sort();
}

const hookRe = hookFilesRegex(
  readFileSync(join(ROOT, ".pre-commit-config.yaml"), "utf8"),
  "chatbot-index-fresh",
);
const inputs = builderInputs(readFileSync(join(ROOT, "scripts/chatbot/build-index.mjs"), "utf8"));

// A derivation that finds nothing would pass vacuously; the known floor guards the parser itself.
const FLOOR = ["content/products.ts", "content/provenance.md", "content/case-studies/sample.ts"];
const missingFloor = FLOOR.filter((f) => !inputs.includes(f));
if (missingFloor.length) {
  console.error(`FAIL: builder input derivation lost known inputs: ${missingFloor.join(", ")}`);
  process.exit(1);
}

const uncovered = inputs.filter((f) => !hookRe.test(f));
console.log(`derived ${inputs.length} builder inputs: ${inputs.join(", ")}`);
if (uncovered.length) {
  console.error(`FAIL: chatbot-index-fresh hook files: ${hookRe} misses: ${uncovered.join(", ")}`);
  process.exit(1);
}
console.log(`ok: hook regex ${hookRe} covers all ${inputs.length} inputs`);
