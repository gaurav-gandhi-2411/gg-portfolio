import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  // Opt-in only (`ANALYZE=true npm run build`) — never runs on a normal
  // build/CI run. audit/BACKLOG.md's BL-4: there was previously no way to
  // put a real KB number on any route's First Load JS, which blocked every
  // 3D/bundle-budget judgment (see reports/bundle-baseline-*.md) from being
  // more than a guess.
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // /api/chat (lib/chatbot/embed.mjs) runs @huggingface/transformers, which on
  // Node.js dlopens onnxruntime-node's native binding via a template-literal
  // `require` path (`../bin/napi-v6/${process.platform}/${process.arch}/...`).
  // That's invisible to static file-tracing, and the binding then dlopens
  // libonnxruntime.so.1 as a sibling file — also invisible, since it's not a
  // JS require at all. Both were silently dropped from the deployed function
  // bundle, so every /api/chat call crashed with "libonnxruntime.so.1: cannot
  // open shared object file" before it ever reached retrieval or the LLM call.
  // Force-including the whole bin tree covers every platform Vercel might
  // build/run on (currently linux/x64) without hardcoding an architecture.
  //
  // @huggingface/transformers 4.3.0 (npm_and_yarn/minor-and-patch-fce0690aba,
  // deployed c6f4d61, 2026-09-23) introduced a second, worse gap on top of the
  // bin/ one above: transformers.node.mjs now loads onnxruntime-node itself
  // via `createRequire(import.meta.url)("onnxruntime-node")` instead of a
  // static import. A dynamic `createRequire(...)(...)` call is invisible to
  // Next's file tracer the same way the template-literal bin/ path is, so
  // onnxruntime-node's own package.json and dist/*.js (index.js, backend.js,
  // binding.js) were silently dropped from the deployed function bundle —
  // every /api/chat call 503'd with embeddings_unavailable before reaching
  // retrieval or the LLM call. Compounding it: onnxruntime-node/dist/binding.js
  // requires the *CommonJS* build of onnxruntime-common (package.json "main":
  // "dist/cjs/index.js"), but the only onnxruntime-common files the tracer
  // found via other, statically-analyzable import paths were the ESM ones
  // (dist/esm/**) — so even adding onnxruntime-node's own files back isn't
  // sufficient without also force-including onnxruntime-common's CJS build.
  outputFileTracingIncludes: {
    "/api/chat": [
      "./node_modules/onnxruntime-node/bin/**/*",
      "./node_modules/onnxruntime-node/package.json",
      "./node_modules/onnxruntime-node/dist/**/*",
      "./node_modules/onnxruntime-common/package.json",
      "./node_modules/onnxruntime-common/dist/**/*",
    ],
  },
};

export default withBundleAnalyzer(nextConfig);
