// Wave 16 eval harness — a minimal Node ESM loader hook so
// evals/chatbot/run-eval.mjs can import lib/chatbot/retrieve.ts DIRECTLY
// (the real, production retrieval code — not a reimplementation of it) even
// though that file uses Next.js's `@/*` path alias and a bare `.json`
// import, neither of which plain Node resolves on its own:
//
//   1. `@/*` → this repo's root. Next's bundler resolves this via
//      tsconfig.json's `paths`; outside Next there's no bundler in the loop,
//      so this hook does the same rewrite by hand.
//   2. `import rawIndex from "@/content/chatbot/index.json"` has no
//      `with { type: "json" }` import attribute (Next/TypeScript's
//      `resolveJsonModule` doesn't require one at the source level, since
//      Next's own bundler handles it) — plain Node's default loader refuses
//      to import JSON without one, so `load()` below reads and returns the
//      file itself with `format: "json"`, deliberately bypassing that
//      attribute check (empirically verified: returning `format` from
//      `resolve()` alone still hits Node's attribute-validation path in
//      `load`; only intercepting `load()` and supplying the source directly
//      skips it).
//
// No new dependency: this is Node's built-in `module.register()` customization
// hook (stable since Node 20.6), not a bundler or third-party loader package.
// retrieve.ts's TypeScript itself needs no stripping help from this file —
// Node 23.6+ strips erasable TS syntax natively (same as
// scripts/chatbot/build-index.mjs already relies on for content/*.ts).

import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import { readFileSync, existsSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Extensionless `@/` specifiers (e.g. `@/content/site`, the TypeScript-idiom
// Next's bundler resolves via tsconfig — this repo's source never spells out
// `.ts`) need the same extension search a bundler would do; plain Node's
// file:// resolution has no such fallback.
const CANDIDATE_EXTENSIONS = [".ts", ".mts", ".mjs", ".js", ".json"];

function resolveAliasTarget(specifierPath) {
  const target = join(ROOT, specifierPath);
  if (extname(target) !== "") return target;
  for (const ext of CANDIDATE_EXTENSIONS) {
    if (existsSync(target + ext)) return target + ext;
  }
  return target; // let Node produce its own "module not found" error
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = resolveAliasTarget(specifier.slice(2));
    return nextResolve(pathToFileURL(target).href, context);
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    const source = readFileSync(fileURLToPath(url), "utf8");
    return { format: "json", source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
