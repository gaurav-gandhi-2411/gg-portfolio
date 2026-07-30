import type { NextConfig } from "next";

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

export default nextConfig;
