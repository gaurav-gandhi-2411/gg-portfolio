// /api/chat trace-completeness gate (run locally: node scripts/check-chat-onnxruntime-trace.mjs
// against a build's .next output; wired into ci.yml's `build` job right after `npm run build`).
//
// WHY THIS EXISTS: @huggingface/transformers 4.3.0 (Dependabot, deployed c6f4d61, 2026-09-23)
// switched to loading onnxruntime-node via `createRequire(import.meta.url)("onnxruntime-node")`
// inside its `src/backends/onnx-node.js` module — a dynamic require Next's static file tracer
// cannot see. That silently dropped onnxruntime-node's own package.json and dist/*.js
// (index.js, backend.js, binding.js, version.js) from `.next/server/app/api/chat/route.js.nft.json`,
// so the deployed function's node_modules/onnxruntime-node lacked everything except the bin/**
// natives next.config.ts already force-includes for a *different*, earlier tracing gap. Every
// /api/chat call 503'd with embeddings_unavailable (lib/chatbot/embed.mjs's EmbeddingUnavailableError)
// before reaching retrieval or the LLM call, for the ~7 hours between that deploy and the fix.
// Compounding it: onnxruntime-node/dist/binding.js requires the CommonJS build of
// onnxruntime-common ("main": "dist/cjs/index.js"), but the only onnxruntime-common files some
// other, statically-analyzable import path in this repo's graph pulled in were the ESM ones
// (dist/esm/**) — so fixing onnxruntime-node alone would not have been sufficient either.
//
// METHOD: don't hardcode the list of required files (that list would silently go stale the next
// time either package's dist/ layout changes) — read what onnxruntime-node's dist/ and
// onnxruntime-common's dist/cjs/ actually ship on THIS install, and assert every one of those
// files' node_modules-relative paths appears somewhere in route.js.nft.json's traced file set.
//
// FAILS CLOSED (rule 98a), every state distinct, no silent pass:
//   - NFT_MISSING: no .next/server/app/api/chat/route.js.nft.json — run "npm run build" first.
//     Never falls back to assuming the trace is fine.
//   - NFT_EMPTY: the nft.json parsed but its `files` array is empty/absent — a malformed or
//     truncated trace, not evidence of a complete one.
//   - PACKAGE_MISSING: node_modules/onnxruntime-node or onnxruntime-common isn't installed — run
//     "npm ci" first. Never infers "not required, so trivially fine."
//   - PACKAGE_DIST_EMPTY / PACKAGE_CJS_MISSING / PACKAGE_CJS_EMPTY: the installed package's own
//     dist output looks corrupt/incomplete — nothing to check against, fails rather than passing
//     vacuously.
//   - TRACE_INCOMPLETE: one or more required files are absent from the nft trace — the actual
//     bug condition this gate exists to catch.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NFT_PATH =
  process.env.CHAT_NFT_PATH_OVERRIDE ?? join(ROOT, ".next", "server", "app", "api", "chat", "route.js.nft.json");

class StateError extends Error {
  constructor(state, detail) {
    super(detail);
    this.state = state;
  }
}

function loadTracedFiles() {
  if (!existsSync(NFT_PATH)) {
    throw new StateError("NFT_MISSING", `${NFT_PATH} does not exist — run "npm run build" first.`);
  }
  const parsed = JSON.parse(readFileSync(NFT_PATH, "utf8"));
  if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
    throw new StateError(
      "NFT_EMPTY",
      `${NFT_PATH} parsed but has no files listed — a malformed or truncated trace, not a complete one.`
    );
  }
  return parsed.files;
}

// Every .js file (excluding .map sourcemaps, matched separately below since
// "*.js.map".endsWith(".js") is false) that onnxruntime-node's own dist/ ships on this install —
// these are exactly what require("onnxruntime-node") (dist/index.js -> backend.js -> binding.js)
// needs to resolve at runtime.
function onnxNodeRequiredFiles() {
  const pkgDir = join(ROOT, "node_modules", "onnxruntime-node");
  if (!existsSync(pkgDir)) {
    throw new StateError(
      "PACKAGE_MISSING",
      `${pkgDir} does not exist — run "npm ci" first (onnxruntime-node ships as a transitive ` +
        "dependency of @huggingface/transformers)."
    );
  }
  const distDir = join(pkgDir, "dist");
  const distFiles = existsSync(distDir) ? readdirSync(distDir).filter((f) => f.endsWith(".js")) : [];
  if (distFiles.length === 0) {
    throw new StateError("PACKAGE_DIST_EMPTY", `${distDir} has no .js files — installed onnxruntime-node looks corrupt.`);
  }
  return [join(pkgDir, "package.json"), ...distFiles.map((f) => join(distDir, f))];
}

// onnxruntime-node/dist/binding.js does a CommonJS require("onnxruntime-common"), which resolves
// via that package's package.json "main" (dist/cjs/index.js) — NOT the dist/esm/ build some other
// import path in this repo's dependency graph pulls in and which Next's tracer finds on its own.
function onnxCommonRequiredFiles() {
  const pkgDir = join(ROOT, "node_modules", "onnxruntime-common");
  if (!existsSync(pkgDir)) {
    throw new StateError("PACKAGE_MISSING", `${pkgDir} does not exist — run "npm ci" first.`);
  }
  const cjsDir = join(pkgDir, "dist", "cjs");
  if (!existsSync(cjsDir)) {
    throw new StateError(
      "PACKAGE_CJS_MISSING",
      `${cjsDir} does not exist — installed onnxruntime-common looks corrupt (expected a CJS build).`
    );
  }
  const cjsFiles = readdirSync(cjsDir).filter((f) => f.endsWith(".js"));
  if (cjsFiles.length === 0) {
    throw new StateError("PACKAGE_CJS_EMPTY", `${cjsDir} has no .js files.`);
  }
  return [join(pkgDir, "package.json"), ...cjsFiles.map((f) => join(cjsDir, f))];
}

// nft.json entries are POSIX-style, relative to the nft.json's own directory (e.g.
// "../../../../../node_modules/onnxruntime-node/dist/index.js"). Compare by the
// "node_modules/..." suffix so this works regardless of nft.json's directory depth or whether a
// path is absolute.
function nodeModulesRelativeSuffix(anyPath) {
  const normalized = anyPath.replace(/\\/g, "/");
  const idx = normalized.indexOf("/node_modules/");
  return idx === -1 ? normalized : normalized.slice(idx + 1);
}

function main() {
  let tracedFiles;
  let required;
  try {
    tracedFiles = loadTracedFiles();
    required = [...onnxNodeRequiredFiles(), ...onnxCommonRequiredFiles()];
  } catch (err) {
    if (err instanceof StateError) {
      console.error(`\nFAIL — ${err.state}: ${err.message}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const tracedSuffixes = new Set(tracedFiles.map(nodeModulesRelativeSuffix));
  const missing = required.filter((abs) => !tracedSuffixes.has(nodeModulesRelativeSuffix(abs)));

  console.log(`scripts/check-chat-onnxruntime-trace.mjs: checked against ${NFT_PATH}`);
  console.log(`Required (from installed packages): ${required.length} file(s).`);

  if (missing.length > 0) {
    console.error(
      `\nFAIL — TRACE_INCOMPLETE: ${missing.length} of ${required.length} onnxruntime-node/onnxruntime-common ` +
        "file(s) required at runtime are missing from the traced output:\n" +
        missing.map((f) => `  - ${nodeModulesRelativeSuffix(f)}`).join("\n") +
        "\n\nThese are require()'d via createRequire(import.meta.url)(...) inside " +
        "@huggingface/transformers' onnx-node.js backend, which Next's static file tracer cannot see. Every " +
        "/api/chat call 503s with embeddings_unavailable when this is the case (incident: 2026-09-23, " +
        '@huggingface/transformers 4.2.0 -> 4.3.0). Add the missing package/path to next.config.ts\'s ' +
        'outputFileTracingIncludes["/api/chat"] entry.'
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\nOK — all ${required.length} onnxruntime-node/onnxruntime-common file(s) required at runtime are present ` +
      "in the traced output."
  );
}

main();
