// Run: node --test scripts/check-prod-build-sha.test.mjs
// Stated before the implementation: the checker exits 0 only when the live page's build-sha meta
// equals the expected SHA, and exits 1 (loudly, with both values shown) on mismatch, a missing
// tag, a non-200, or an unreachable server. It must never pass on an unverifiable state.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./check-prod-build-sha.mjs", import.meta.url));
const A = "a".repeat(40);
const B = "b".repeat(40);

function withServer(handler, fn) {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", async () => {
      try {
        resolve(await fn(`http://127.0.0.1:${server.address().port}/`));
      } catch (e) {
        reject(e);
      } finally {
        server.close();
      }
    });
  });
}

// async spawn is required: spawnSync would block the event loop the stub server runs on.
function run(args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [SCRIPT, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out }));
  });
}

const page = (sha) => (_req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(`<html><head><meta name="build-sha" content="${sha}"></head><body></body></html>`);
};

test("PASS when the live SHA equals the expected SHA", async () => {
  await withServer(page(A), async (url) => {
    const r = await run(["--url", url, "--expected", A]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /PASS/);
    assert.ok(r.out.includes(A));
  });
});

test("FAIL (exit 1) on mismatch, printing both SHAs", async () => {
  await withServer(page(A), async (url) => {
    const r = await run(["--url", url, "--expected", B]);
    assert.equal(r.code, 1);
    assert.match(r.out, /FAIL/);
    assert.ok(r.out.includes(A) && r.out.includes(B));
  });
});

test("FAIL when the tag is missing", async () => {
  await withServer(
    (_q, res) => res.end("<html><head></head></html>"),
    async (url) => {
      const r = await run(["--url", url, "--expected", A]);
      assert.equal(r.code, 1);
      assert.match(r.out, /FAIL.*no build-sha/i);
    },
  );
});

test("FAIL on a non-200 response even if the body carries the tag", async () => {
  await withServer(
    (_q, res) => {
      res.writeHead(500);
      res.end(`<meta name="build-sha" content="${A}">`);
    },
    async (url) => {
      const r = await run(["--url", url, "--expected", A]);
      assert.equal(r.code, 1);
    },
  );
});

test("FAIL when the tag is the 'dev' fallback", async () => {
  await withServer(page("dev"), async (url) => {
    const r = await run(["--url", url, "--expected", A]);
    assert.equal(r.code, 1);
  });
});

test("FAIL on fetch error (nothing listening)", async () => {
  const r = await run(["--url", "http://127.0.0.1:9/", "--expected", A]);
  assert.equal(r.code, 1);
  assert.match(r.out, /FAIL/);
});

test("FAIL when --expected is not a 40-hex SHA", async () => {
  const r = await run(["--url", "http://127.0.0.1:9/", "--expected", "main"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /expected/i);
});
