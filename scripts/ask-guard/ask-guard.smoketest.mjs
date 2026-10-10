// Assertion smoke test for scripts/ask-guard/{detect,preview}.mjs. Run directly:
// `node scripts/ask-guard/ask-guard.smoketest.mjs`. No framework (repo has none), wired into
// ci.yml's build job. The detector is the piece that decides whether a REQUIRED check does real
// work or passes vacuously, so the cases below pin both directions plus every fail-closed edge.

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { detect, isGuarded, lockKeyToName, DEFAULT_CONFIG_PATH } from "./detect.mjs";
import { evaluateProbe, pickPreviewDeployment, validatePreviewUrl } from "./preview.mjs";

const patterns = JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, "utf8")).packages;

const lock = (extra = {}) => ({
  packages: {
    "": { name: "x" },
    "node_modules/onnxruntime-node": { version: "1.30.0", integrity: "sha512-A" },
    "node_modules/onnxruntime-common": { version: "1.30.0", integrity: "sha512-B" },
    "node_modules/@huggingface/transformers": { version: "4.3.0", integrity: "sha512-C" },
    "node_modules/clsx": { version: "2.1.1", integrity: "sha512-D" },
    ...extra,
  },
});
const pkg = (deps = {}) => ({
  dependencies: { clsx: "^2.1.1", ...deps },
  optionalDependencies: { "@huggingface/transformers": "^4.3.0" },
});
const run = (b, h) =>
  detect({
    basePkg: b.pkg ?? pkg(),
    baseLock: b.lock ?? lock(),
    headPkg: h.pkg ?? pkg(),
    headLock: h.lock ?? lock(),
    patterns,
  });

// identical -> not applicable
assert.strictEqual(run({}, {}).applicable, false);

// unguarded-only bump (clsx) -> not applicable
assert.strictEqual(
  run({}, {
    lock: lock({ "node_modules/clsx": { version: "2.2.0", integrity: "sha512-Z" } }),
    pkg: pkg({ clsx: "^2.2.0" }),
  }).applicable,
  false
);

// lockfile-only transitive bump of onnxruntime-common (package.json untouched) -> applicable
{
  const r = run({}, { lock: lock({ "node_modules/onnxruntime-common": { version: "1.31.0", integrity: "sha512-B2" } }) });
  assert.strictEqual(r.applicable, true);
  assert.match(r.reasons[0], /onnxruntime-common/);
}

// package.json specifier bump of transformers -> applicable
assert.strictEqual(
  run({}, { pkg: { ...pkg(), optionalDependencies: { "@huggingface/transformers": "^4.4.0" } } }).applicable,
  true
);

// same version, new integrity (re-resolved tarball) -> applicable
assert.strictEqual(
  run({}, { lock: lock({ "node_modules/onnxruntime-node": { version: "1.30.0", integrity: "sha512-OTHER" } }) }).applicable,
  true
);

// nested copy added / guarded dep removed -> applicable
assert.strictEqual(
  run({}, { lock: lock({ "node_modules/foo/node_modules/onnxruntime-node": { version: "1.0.0" } }) }).applicable,
  true
);
{
  const l = lock();
  delete l.packages["node_modules/onnxruntime-node"];
  assert.strictEqual(run({}, { lock: l }).applicable, true);
}

// prefix patterns: scoped @img/sharp-linux-x64 and @protobufjs/* are guarded, lookalikes are not
assert.ok(isGuarded("@img/sharp-linux-x64", patterns));
assert.ok(isGuarded("@protobufjs/utf8", patterns));
assert.ok(!isGuarded("@imgx/foo", patterns));
assert.ok(!isGuarded("onnxruntime-node-extra", patterns));
assert.strictEqual(lockKeyToName("node_modules/a/node_modules/@scope/b"), "@scope/b");
assert.strictEqual(lockKeyToName(""), null);

// fail closed: empty pattern list, malformed lockfile
assert.throws(
  () => detect({ basePkg: pkg(), baseLock: lock(), headPkg: pkg(), headLock: lock(), patterns: [] }),
  /empty/
);
assert.throws(
  () => detect({ basePkg: pkg(), baseLock: {}, headPkg: pkg(), headLock: lock(), patterns }),
  /packages/
);

// the committed config really guards the packages the S1 incident involved
for (const n of ["@huggingface/transformers", "onnxruntime-node", "onnxruntime-web", "onnxruntime-common"]) {
  assert.ok(isGuarded(n, patterns), `${n} must be guarded`);
}

// --- deployment selection ---
const d = (id, env, t) => ({ id, environment: env, created_at: t });
const ok = { state: "success", environment_url: "https://a-b.vercel.app" };
const T1 = "2026-01-01T00:00:00Z";
const T2 = "2026-01-02T00:00:00Z";
assert.strictEqual(pickPreviewDeployment([], {}).kind, "pending");
assert.strictEqual(pickPreviewDeployment([d(1, "Production", T1)], { 1: [ok] }).kind, "pending"); // prod never counts
assert.strictEqual(pickPreviewDeployment([d(1, "Preview", T1)], { 1: [] }).kind, "pending");
assert.strictEqual(pickPreviewDeployment([d(1, "Preview", T1)], { 1: [{ state: "in_progress" }, ok] }).kind, "pending"); // newest status wins
assert.deepStrictEqual(pickPreviewDeployment([d(1, "Preview", T1)], { 1: [ok] }), {
  kind: "success",
  url: "https://a-b.vercel.app",
});
assert.strictEqual(pickPreviewDeployment([d(1, "Preview", T1)], { 1: [{ state: "failure" }] }).kind, "failed");
// newest deployment failed, older succeeded -> resolves to the newest (failed), not the older pass
assert.strictEqual(
  pickPreviewDeployment([d(1, "Preview", T1), d(2, "Preview", T2)], { 1: [ok], 2: [{ state: "error" }] }).kind,
  "failed"
);
assert.strictEqual(pickPreviewDeployment([d(1, "Preview", T1)], { 1: [{ state: "success" }] }).kind, "failed"); // no URL

// --- URL validation ---
assert.strictEqual(validatePreviewUrl("https://x-y.vercel.app/foo"), "https://x-y.vercel.app");
assert.throws(() => validatePreviewUrl("http://x.vercel.app"));
assert.throws(() => validatePreviewUrl("https://evil.example.com"));
assert.throws(() => validatePreviewUrl("not a url"));

// --- probe verdicts: the S1 failure shape (503 embeddings_unavailable) must be red ---
const good = JSON.stringify({ answer: "Lead Data Scientist.", citations: [{ sourceRef: "site:identity" }], refused: false });
assert.strictEqual(evaluateProbe(200, good).ok, true);
const s1 = JSON.stringify({ answer: "x", citations: [], refused: true, refusalReason: "embeddings_unavailable" });
assert.strictEqual(evaluateProbe(503, s1).ok, false);
assert.match(evaluateProbe(503, s1).lines.join("\n"), /embeddings_unavailable/);
assert.strictEqual(evaluateProbe(200, s1).ok, false);
assert.strictEqual(evaluateProbe(0, "fetch failed: timeout").ok, false);
assert.strictEqual(evaluateProbe(200, "<html>").ok, false);
assert.strictEqual(evaluateProbe(200, JSON.stringify({ answer: "  ", citations: [{ a: 1 }], refused: false })).ok, false);
assert.strictEqual(evaluateProbe(200, JSON.stringify({ answer: "hi", citations: [], refused: false })).ok, false);
assert.strictEqual(evaluateProbe(500, good).ok, false); // a 500 with a pretty body is still red

console.log("ask-guard smoketest OK");
