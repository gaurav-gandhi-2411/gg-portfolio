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
  outputFileTracingIncludes: {
    "/api/chat": ["./node_modules/onnxruntime-node/bin/**/*"],
  },
};

export default withBundleAnalyzer(nextConfig);
