// BL-9 round 5 (task A2) -- verifies, empirically, WHY potion-base-8M's
// real cold-start proxy (612,342 ms, measured this round) came out slower
// than MiniLM's real cold-start (570,121 ms, round 4) despite potion's true
// download being smaller (29.5 MiB vs MiniLM's 45.1 MiB). Round 4 left this
// as an unverified inference ("Chrome's CDP network throttling appears to
// apply per connection/origin... not independently verified"). This script
// tests that inference directly instead of repeating it.
//
// Method: fetch a controlled number of bytes (via HTTP Range requests
// against two real, already-known large files this repo's model network
// touches) under the identical Slow-4G/cache-disabled CDP setup, two ways:
//   (a) SERIAL-EQUIVALENT: 2 MB from ONE origin (Xet CDN model file) --
//       this is potion-base-8M's shape (one large-payload origin).
//   (b) PARALLEL-CANDIDATE: 1 MB from Xet CDN + 1 MB from jsdelivr
//       (onnxruntime-web's WASM host) concurrently -- this is MiniLM's
//       shape (two large-payload origins fetched with Promise.all, same
//       as this repo's real code path).
// Both move the same TOTAL 2 MB under the same 50,000 B/s throttle. If
// Chrome enforces one shared page-wide throttled pipe (matching how a real
// cellular/ISP throttle works), both should take ~40s. If Chrome throttles
// per-connection/origin (an emulator-specific artifact), (b) should finish
// in ~half the time of (a), close to ~20s -- because the two origins each
// get their own ~50,000 B/s lane instead of splitting one.
//
// Run: node scripts/search/verify-throttle-mechanism.mjs

import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const RANGE_BYTES = 1_000_000; // 1 MB per fetch

const SLOW_4G = {
  offline: false,
  latency: 400,
  downloadThroughput: (400 * 1000) / 8,
  uploadThroughput: (400 * 1000) / 8,
};

// Real, large files this repo's own model network already touches (see
// reports/BL-9-round4-*.md) -- reused below inside the page.evaluate()
// bodies rather than as top-level constants (an earlier draft of this
// script defined URL constants and a Range-based helper here that turned
// out to be dead once the capReader() approach replaced Range requests --
// see that function's own comment for why Range wasn't trustworthy).

async function measure(label, fn) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", SLOW_4G);
  await page.goto(`${BASE_URL}/`, { waitUntil: "load", timeout: 120_000 });

  const t0 = Date.now();
  const result = await page.evaluate(fn, RANGE_BYTES);
  const deltaMs = Date.now() - t0;
  console.log(`[${label}] ${deltaMs} ms -- bytes: ${JSON.stringify(result)}`);
  await browser.close();
  return deltaMs;
}

async function main() {
  console.log(
    `Fetching ${RANGE_BYTES} bytes twice under Slow-4G (50,000 B/s), two ways. ` +
      `Naive serial prediction for 2x${RANGE_BYTES} bytes on ONE shared pipe: ` +
      `${((2 * RANGE_BYTES) / 50_000).toFixed(1)}s. Naive prediction if origins get independent lanes: ` +
      `${(RANGE_BYTES / 50_000).toFixed(1)}s.\n`
  );

  // Reads a response's stream and stops (cancelling the reader) once
  // `limit` bytes have been received, regardless of whether the server
  // honored the Range header -- this is what actually caught the first
  // version of this test's bug: cdn.jsdelivr.net silently ignores Range
  // and returns the full 3.9 MB .wasm file, which meant "1 MB from
  // jsdelivr" was really pulling almost 4x the intended bytes and
  // invalidated the comparison. Capping client-side by actual bytes
  // received is honest regardless of server Range support.
  const capReaderFn = /* injected into page.evaluate below as a string */ `
    async function capReader(res, limit) {
      const reader = res.body.getReader();
      let total = 0;
      while (total < limit) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
      }
      await reader.cancel().catch(() => {});
      return total;
    }
  `;

  const serialSameOriginMs = await measure(
    "(a) 2x1MB from ONE origin (Xet CDN), sequential -- potion's shape",
    new Function(
      "bytes",
      `${capReaderFn}
       return (async () => {
         const url = "https://huggingface.co/minishlab/potion-base-8M/resolve/main/model.safetensors";
         const a = await fetch(url, { cache: "no-store" });
         const lenA = await capReader(a, bytes);
         const b = await fetch(url, { headers: { Range: "bytes=" + bytes + "-" + (2 * bytes - 1) }, cache: "no-store" });
         const lenB = await capReader(b, bytes);
         return [lenA, lenB];
       })();`
    )
  );

  const parallelTwoOriginMs = await measure(
    "(b) 1MB from Xet CDN + 1MB from jsdelivr, CONCURRENT -- MiniLM's shape",
    new Function(
      "bytes",
      `${capReaderFn}
       return (async () => {
         const [a, b] = await Promise.all([
           fetch("https://huggingface.co/minishlab/potion-base-8M/resolve/main/model.safetensors", { cache: "no-store" }),
           fetch("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/ort-wasm-simd-threaded.asyncify.wasm", { cache: "no-store" }),
         ]);
         const [lenA, lenB] = await Promise.all([capReader(a, bytes), capReader(b, bytes)]);
         return [lenA, lenB];
       })();`
    )
  );

  console.log(`\n=== RESULT ===`);
  console.log(`(a) same-origin serial:      ${serialSameOriginMs} ms`);
  console.log(`(b) two-origin concurrent:   ${parallelTwoOriginMs} ms`);
  const ratio = serialSameOriginMs / parallelTwoOriginMs;
  console.log(`ratio (a)/(b): ${ratio.toFixed(2)}x`);
  console.log(
    ratio > 1.5
      ? "CONFIRMED: two-origin concurrent fetches complete meaningfully faster than the same total " +
          "bytes serialized on one origin -- Chrome's CDP throttle emulation grants each origin its own " +
          "effective lane rather than sharing one page-wide pipe. This is the mechanism, not an inference."
      : "NOT CONFIRMED at this sample size -- the two-origin path did not show a meaningful speedup; " +
          "the round-4 per-origin-throttling explanation is not supported by this direct test."
  );
}

await main();
