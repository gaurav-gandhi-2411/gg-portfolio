// Tests for scripts/refresh-hf-downloads.mjs, the freshness verdict, and the AetherArt row.
// Run: node --test scripts/refresh-hf-downloads.test.mjs
// Hermetic: the script runs as a subprocess against a local stub HTTP server (HF_API_URL) and a
// scratch snapshot path (HF_SNAPSHOT_PATH); no live Hugging Face call, committed snapshot untouched.
// Contract (written first): success writes fetchedAt + the three models' counts; ANY HTTP/shape
// error exits non-zero with a loud stderr and leaves the old snapshot byte-identical; the page row
// says "last 30 days ... as of <fetchedAt>" so a committed-snapshot fallback is always dated.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, describe, test } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts", "refresh-hf-downloads.mjs");
const SNAPSHOT_PATH = join(ROOT, "content", "generated", "hf-downloads.json");

const GOOD = [
  { id: "gauravgandhi2411/aetherart-ukiyo-sdxl", downloads: 38 },
  { id: "gauravgandhi2411/aetherart-ukiyo-sd21", downloads: 22 },
  { id: "gauravgandhi2411/aetherart-pattachitra-sdxl", downloads: 0 },
  { id: "gauravgandhi2411/hinglish-relatedness-sbert", downloads: 459 }, // unrelated model: ignored
];
const OLD_SNAPSHOT = '{"sentinel":"previous committed snapshot"}\n';

let server;
let base;
let respond = { status: 200, body: JSON.stringify(GOOD) };
let lastAuth;
const scratch = mkdtempSync(join(tmpdir(), "hf-downloads-test-"));

before(async () => {
  server = createServer((req, res) => {
    lastAuth = req.headers.authorization;
    res.statusCode = respond.status;
    res.setHeader("content-type", "application/json");
    res.end(respond.body);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/api/models`;
});
after(() => server.close());

let n = 0;
// Async spawn: the stub server lives in this process, so a synchronous spawn would deadlock it.
function run(extraEnv = {}) {
  const out = join(scratch, `snap-${n++}.json`);
  writeFileSync(out, OLD_SNAPSHOT);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT], {
      env: {
        PATH: process.env.PATH,
        HF_API_URL: base,
        HF_SNAPSHOT_PATH: out,
        HF_FETCH_DATE: "2026-10-10",
        ...extraEnv,
      },
    });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) =>
      resolve({ status, stderr, out, after: readFileSync(out, "utf8") })
    );
  });
}

describe("refresh-hf-downloads success", () => {
  test("writes the three expected models in fixed order with fetchedAt and source", async () => {
    respond = { status: 200, body: JSON.stringify(GOOD) };
    const r = await run();
    assert.equal(r.status, 0, r.stderr);
    const snap = JSON.parse(r.after);
    assert.equal(snap.fetchedAt, "2026-10-10");
    assert.match(snap.source, /^https:\/\/huggingface\.co\/api\/models\?author=gauravgandhi2411/);
    assert.deepEqual(
      snap.models.map((m) => [m.id, m.downloads]),
      [
        ["aetherart-ukiyo-sdxl", 38],
        ["aetherart-ukiyo-sd21", 22],
        ["aetherart-pattachitra-sdxl", 0],
      ]
    );
  });

  test("sends an Authorization header only when HF_TOKEN is set", async () => {
    respond = { status: 200, body: JSON.stringify(GOOD) };
    lastAuth = undefined;
    await run();
    assert.equal(lastAuth, undefined);
    await run({ HF_TOKEN: "hf_dummy" });
    assert.equal(lastAuth, "Bearer hf_dummy");
  });
});

describe("refresh-hf-downloads R3: fails loud, never overwrites or keeps stale silently", () => {
  const bad = {
    "HTTP 401 (auth)": { status: 401, body: '{"error":"Invalid credentials"}' },
    "HTTP 403": { status: 403, body: "{}" },
    "HTTP 429 (rate limit)": { status: 429, body: "{}" },
    "HTTP 500": { status: 500, body: "oops" },
    "non-JSON body": { status: 200, body: "<html>nope</html>" },
    "not an array": { status: 200, body: '{"error":"x"}' },
    "expected model missing": { status: 200, body: JSON.stringify(GOOD.slice(0, 2)) },
    "downloads not a number": {
      status: 200,
      body: JSON.stringify([{ ...GOOD[0], downloads: "38" }, GOOD[1], GOOD[2]]),
    },
    "downloads negative": {
      status: 200,
      body: JSON.stringify([{ ...GOOD[0], downloads: -1 }, GOOD[1], GOOD[2]]),
    },
    "downloads missing": {
      status: 200,
      body: JSON.stringify([{ id: GOOD[0].id }, GOOD[1], GOOD[2]]),
    },
  };
  for (const [name, resp] of Object.entries(bad)) {
    test(name, async () => {
      respond = resp;
      const r = await run();
      assert.notEqual(r.status, 0, "must exit non-zero");
      assert.match(r.stderr, /::error::/);
      assert.match(r.stderr, /hf-downloads/);
      assert.equal(r.after, OLD_SNAPSHOT, "snapshot must be untouched on failure");
    });
  }

  test("unreachable API (connection refused) exits non-zero", async () => {
    const r = await run({ HF_API_URL: "http://127.0.0.1:1/api/models" });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /::error::/);
    assert.equal(r.after, OLD_SNAPSHOT);
  });
});

describe("AetherArt page row renders the committed snapshot with an as-of label", () => {
  test("label says last 30 days + as of <fetchedAt>; value is the snapshot counts in order", async () => {
    const snap = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
    const { aetherart } = await import(
      pathToFileURL(join(ROOT, "content", "case-studies", "aetherart.ts")).href
    );
    const row = aetherart.results.find((r) => r.sourceRef === "aetherart:hf-downloads");
    assert.ok(row, "row exists");
    assert.match(snap.fetchedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(row.label.includes("last 30 days"), row.label);
    assert.ok(row.label.includes(`as of ${snap.fetchedAt}`), row.label);
    assert.equal(row.value, snap.models.map((m) => m.downloads).join(" · "));
    assert.deepEqual(
      snap.models.map((m) => m.id),
      ["aetherart-ukiyo-sdxl", "aetherart-ukiyo-sd21", "aetherart-pattachitra-sdxl"]
    );
  });
});

describe("freshness checker treats the row as GENERATED, not text-presence", () => {
  const snapDir = mkdtempSync(join(tmpdir(), "hf-gen-claim-"));
  const rel = "snap.json";
  writeFileSync(
    join(snapDir, rel),
    JSON.stringify({
      fetchedAt: "2026-10-10",
      models: [{ downloads: 38 }, { downloads: 23 }, { downloads: 0 }],
    })
  );
  const day = Date.parse("2026-10-10T12:00:00Z");
  const shown = "38 · 23 · 0 ukiyo-e SDXL";

  test("fresh snapshot matching the displayed figures is GENERATED", async () => {
    const { checkGeneratedClaim } = await import("./lib/generated-claims.mjs");
    assert.equal(checkGeneratedClaim(snapDir, rel, shown, 14, day).status, "GENERATED");
  });
  test("old literals on the page (124 / 14 / 0) are NOT current: unreadable/mismatch", async () => {
    const { checkGeneratedClaim } = await import("./lib/generated-claims.mjs");
    const r = checkGeneratedClaim(snapDir, rel, "124 · 14 · 0", 14, day);
    assert.equal(r.status, "GENERATED_UNREADABLE");
  });
  test("snapshot older than the overdue window is GENERATED_OVERDUE", async () => {
    const { checkGeneratedClaim } = await import("./lib/generated-claims.mjs");
    const r = checkGeneratedClaim(snapDir, rel, shown, 14, day + 15 * 86_400_000);
    assert.equal(r.status, "GENERATED_OVERDUE");
  });
  test("missing snapshot fails closed", async () => {
    const { checkGeneratedClaim } = await import("./lib/generated-claims.mjs");
    assert.equal(checkGeneratedClaim(snapDir, "nope.json", shown, 14, day).status, "GENERATED_UNREADABLE");
  });
});
