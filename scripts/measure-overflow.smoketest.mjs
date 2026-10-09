// Exit-code contract for scripts/measure-overflow.mjs: it must exit 0 only when every measured
// route fits, and non-zero on overflow or on a navigation/measurement error. It used to exit 0
// regardless. Drives the real script (real Chromium) against a throwaway local server, so it needs
// Playwright's browser installed (the CI e2e job has it; locally `npx playwright install chromium`).
//
// Run: node scripts/measure-overflow.smoketest.mjs

import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "measure-overflow.mjs");
const FITS = "<!doctype html><body><p>fits</p></body>";
// A 2000px-wide block forces documentElement.scrollWidth past clientWidth at 375/768/1440.
const OVERFLOWS = '<!doctype html><body><div style="width:2000px;height:10px">wide</div></body>';

/** Serves /sitemap.xml for `paths`; "/boom" resets the socket so navigation errors. */
function startServer(paths) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.url === "/sitemap.xml") {
        const base = `http://127.0.0.1:${server.address().port}`;
        res.setHeader("content-type", "application/xml");
        res.end(`<urlset>${paths.map((p) => `<url><loc>${base}${p}</loc></url>`).join("")}</urlset>`);
      } else if (req.url === "/boom") {
        req.socket.destroy();
      } else {
        res.setHeader("content-type", "text/html");
        res.end(req.url === "/over" ? OVERFLOWS : FITS);
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

/** Runs the script against a server serving `paths`; returns its exit status. */
async function exitCodeFor(paths) {
  const server = await startServer(paths);
  const reports = mkdtempSync(join(tmpdir(), "overflow-smoke-"));
  try {
    const child = spawn(process.execPath, [SCRIPT], {
      env: {
        ...process.env,
        BASE_URL: `http://127.0.0.1:${server.address().port}`,
        REPORTS_DIR_OVERRIDE: reports,
      },
      stdio: "ignore",
    });
    return await new Promise((resolve) => child.on("close", resolve));
  } finally {
    server.close();
  }
}

assert.strictEqual(await exitCodeFor(["/ok"]), 0, "clean page must exit 0");
assert.strictEqual(await exitCodeFor(["/ok", "/over"]), 1, "overflowing page must exit 1");
assert.strictEqual(await exitCodeFor(["/ok", "/boom"]), 1, "navigation error must exit 1");
console.log("measure-overflow.smoketest.mjs: all assertions passed");
