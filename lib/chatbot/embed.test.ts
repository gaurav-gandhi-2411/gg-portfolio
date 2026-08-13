import assert from "node:assert/strict";
import { test } from "node:test";

import { applyEmbeddingEnv, EmbeddingUnavailableError } from "./embed.mjs";

/**
 * These exist because of what the 2026-08-13 optionalDependency refactor moved.
 *
 * `env.cacheDir` and `env.backends.onnx.wasm.numThreads` used to be set at
 * module scope against a statically-imported `env`. Making
 * @huggingface/transformers optional meant importing it lazily, which meant
 * both settings had to move inside the load path — and a setting that moves is
 * a setting that can be dropped.
 *
 * The single-threaded one is the dangerous half. When it is lost, nothing
 * throws and nothing looks wrong: embeddings are still produced, still the
 * right shape, still roughly the right values. It surfaces only as
 * check-index-fresh.mjs failing intermittently in CI, with float differences in
 * the low-order bits, which reads as flakiness rather than as a missing line.
 * That is a full day of debugging away from its cause, and it already cost one
 * (see PR #32).
 */
test("applyEmbeddingEnv forces single-threaded WASM (determinism, PR #32)", () => {
  const env = { cacheDir: "", backends: { onnx: { wasm: { numThreads: 4 } } } };
  applyEmbeddingEnv(env);
  assert.equal(
    env.backends.onnx.wasm.numThreads,
    1,
    "numThreads must be 1 — multi-threaded reductions make embeddings non-deterministic " +
      "run-to-run, and check-index-fresh.mjs compares them against a committed index"
  );
});

test("applyEmbeddingEnv points cacheDir at a writable temp directory", () => {
  const env = { cacheDir: "", backends: { onnx: { wasm: { numThreads: 4 } } } };
  applyEmbeddingEnv(env);
  assert.ok(env.cacheDir.length > 0, "cacheDir must be set");
  assert.ok(
    !env.cacheDir.includes("node_modules"),
    "cacheDir must not resolve inside node_modules — that path is read-only on " +
      "Vercel's function filesystem and the first model download crashes on mkdir"
  );
});

test("applyEmbeddingEnv returns the same object it configured", () => {
  const env = { cacheDir: "", backends: { onnx: { wasm: { numThreads: 4 } } } };
  assert.equal(applyEmbeddingEnv(env), env);
});

test("EmbeddingUnavailableError is distinguishable from a generic Error", () => {
  // build-index.mjs catches THIS specifically and refuses to write, while
  // letting real faults propagate. If it stopped being distinguishable, a
  // genuine model-load failure would be silently treated as "dependency
  // absent" and vice versa.
  const err = new EmbeddingUnavailableError("nope", { cause: new Error("root") });
  assert.ok(err instanceof EmbeddingUnavailableError);
  assert.ok(err instanceof Error);
  assert.equal(err.name, "EmbeddingUnavailableError");
  assert.equal((err.cause as Error).message, "root");
});
