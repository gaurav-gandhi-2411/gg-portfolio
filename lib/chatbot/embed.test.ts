import assert from "node:assert/strict";
import { test } from "node:test";

import { readFileSync } from "node:fs";

import {
  applyEmbeddingEnv,
  EMBEDDING_MODEL_ID,
  EMBEDDING_MODEL_REVISION,
  EMBEDDING_MODEL_VERSION,
  EMBEDDING_PIPELINE_OPTIONS,
  EmbeddingUnavailableError,
} from "./embed.mjs";
import { partitionForReuse, reuseKey } from "./index-format.mjs";

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

/**
 * IMPROVEMENTS A3. An unpinned model id resolves to Hugging Face "main", so an
 * upstream re-upload would change query vectors with no diff in this repo.
 */
test("the pipeline is loaded with a full 40-hex commit sha, not a branch name", () => {
  assert.match(EMBEDDING_MODEL_REVISION, /^[0-9a-f]{40}$/);
  assert.equal(EMBEDDING_PIPELINE_OPTIONS.revision, EMBEDDING_MODEL_REVISION);
});

test("the model version (index header + reuse key input) carries the revision", () => {
  assert.equal(EMBEDDING_MODEL_VERSION, `${EMBEDDING_MODEL_ID}@${EMBEDDING_MODEL_REVISION}`);
});

test("changing the pinned revision changes the reuse key and invalidates reuse", () => {
  const c = { id: "a", text: "same text" };
  const other = `${EMBEDDING_MODEL_ID}@${"0".repeat(40)}`;
  assert.notEqual(reuseKey(EMBEDDING_MODEL_VERSION, c), reuseKey(other, c));
  const prior = { model: other, chunks: [{ ...c, embedding: [1, 2] }] };
  const { reused, missing } = partitionForReuse([c], prior, EMBEDDING_MODEL_VERSION);
  assert.equal(reused.length, 0);
  assert.equal(missing.length, 1);
});

test("the committed index header records the pinned revision", () => {
  const head = readFileSync(new URL("../../content/chatbot/index.json", import.meta.url), "utf8")
    .split("\n", 1)[0];
  assert.equal(JSON.parse(head + "]}").model, EMBEDDING_MODEL_VERSION);
});
