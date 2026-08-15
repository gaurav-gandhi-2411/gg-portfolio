// BL-9 round 4 — honest, cache-disabled, throttled cold-start measurement.
//
// The prior round's "605.6ms mean" number (reports/BL-9-model-size.md, Gate
// (ii)) blocked the model network entirely and measured the KEYWORD tier's
// cold start, not the semantic model's. This script measures the real
// thing: a fresh browser context, HTTP cache disabled at the CDP level, a
// throttled connection, real network download of whichever model artifacts
// the target actually needs.
//
// Two targets:
//   --target=app     drives the real /projects search box end-to-end
//                     (focus -> type query -> wait for
//                     data-search-dense-scores-for to match the query,
//                     i.e. the tier-2 MiniLM reranking has actually landed).
//                     Requires `npm run start` already running at BASE_URL.
//   --target=potion   there is no real in-browser integration of
//                     potion-base-8M in this repo (see BL-9 round 4's
//                     report for why) — this fetches the exact two files a
//                     real integration would need (model.safetensors +
//                     tokenizer.json) directly from huggingface.co inside a
//                     real page context, same throttle/cache-disable
//                     methodology, as an honest proxy for the network-bound
//                     portion of a cold start. This is NOT the same kind of
//                     measurement as --target=app (no DOM interaction, no
//                     parse/tokenize/embed step) — see the printed output
//                     and the report for the explicit distinction.
//
// Throttle profile (exact numbers, per task brief): "Slow 4G" ~= 400 Kbps
// down / 400 Kbps up / 400ms RTT. Kbps here is decimal (1 Kbps = 1000
// bits/sec), matching how network throughput is conventionally quoted.
//
// Run: node scripts/search/measure-cold-start.mjs --target=app
//      node scripts/search/measure-cold-start.mjs --target=potion

import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const QUERY = "reduces on-call issue triage time";
const TARGET = (process.argv.find((a) => a.startsWith("--target=")) ?? "--target=app").split(
  "="
)[1];

const SLOW_4G = {
  offline: false,
  latency: 400, // ms RTT
  downloadThroughput: (400 * 1000) / 8, // 400 Kbps -> bytes/sec
  uploadThroughput: (400 * 1000) / 8,
};

/** @param {string} url */
function isModelRequest(url) {
  try {
    const u = new URL(url);
    return /\.onnx(\?|$)/.test(u.pathname) || u.hostname.endsWith("huggingface.co");
  } catch {
    return false;
  }
}

async function measureApp() {
  const browser = await chromium.launch();
  const context = await browser.newContext(); // fresh context = empty HTTP cache by construction
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  // SKIP_THROTTLE=1 is a local debug-only escape hatch (a full throttled run
  // is ~8+ minutes by construction -- see this file's header) for verifying
  // the wait-for-selector logic itself before committing to a real run. The
  // reported numbers in the PR/report are never produced with this set.
  if (!process.env.SKIP_THROTTLE) await cdp.send("Network.emulateNetworkConditions", SLOW_4G);

  /** @type {{url: string, fromDiskCache: boolean, status?: number}[]} */
  const modelResponses = [];
  /** @type {{url: string, fromDiskCache: boolean, status?: number}[]} */
  const allResponses = [];
  cdp.on("Network.responseReceived", (evt) => {
    const url = evt.response.url;
    const rec = { url, fromDiskCache: Boolean(evt.response.fromDiskCache), status: evt.response.status };
    allResponses.push(rec);
    if (isModelRequest(url) || url.includes("resolve-cache") || url.includes("xet-bridge")) {
      modelResponses.push(rec);
    }
  });

  console.log(`[app] loading ${BASE_URL}/projects (throttle applies from here on)...`);
  await page.goto(`${BASE_URL}/projects`, { waitUntil: "load", timeout: 120_000 });

  const input = page.getByRole("combobox", { name: /search projects/i });
  await input.waitFor({ state: "visible" });

  const t0 = Date.now();
  await input.focus();
  await input.fill(QUERY);
  console.log(
    `[app] focused + typed "${QUERY}" at t0 -- waiting for tier-2 (semantic) ranked result...`
  );

  await page.waitForFunction(
    (q) => {
      const el = document.querySelector("[data-search-dense-scores-for]");
      return el?.getAttribute("data-search-dense-scores-for") === q;
    },
    QUERY,
    { timeout: 900_000, polling: 250 }
  );
  const t1 = Date.now();

  const deltaMs = t1 - t0;
  console.log(`\n[app] RESULT: focus -> first semantic-ranked result = ${deltaMs} ms`);
  console.log(
    `[app] model responses captured (${modelResponses.length}), fromDiskCache should be false for all:`
  );
  console.log(JSON.stringify(modelResponses, null, 2));
  if (process.env.DEBUG_ALL_RESPONSES) {
    console.log(`[app] ALL responses (${allResponses.length}):`);
    console.log(JSON.stringify(allResponses, null, 2));
  }
  const anyFromCache = modelResponses.some((r) => r.fromDiskCache);
  console.log(
    anyFromCache
      ? "[app] WARNING: at least one model response was served fromDiskCache -- cache-disable did not hold"
      : "[app] confirmed: zero model responses served fromDiskCache -- this is a genuine cold download"
  );

  await browser.close();
  return { deltaMs, modelResponses };
}

async function measurePotion() {
  const TOKENIZER_URL = "https://huggingface.co/minishlab/potion-base-8M/resolve/main/tokenizer.json";
  const MODEL_URL = "https://huggingface.co/minishlab/potion-base-8M/resolve/main/model.safetensors";

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", SLOW_4G);

  /** @type {{url: string, fromDiskCache: boolean, status?: number}[]} */
  const responses = [];
  cdp.on("Network.responseReceived", (evt) => {
    responses.push({
      url: evt.response.url,
      fromDiskCache: Boolean(evt.response.fromDiskCache),
      status: evt.response.status,
    });
  });

  // A real page origin (not about:blank) so cross-origin fetch() to
  // huggingface.co behaves the way it would for an actual visitor -- the
  // hf.co CDN sets permissive CORS for resolve/main URLs (transformers.js
  // itself depends on this working from arbitrary origins).
  await page.goto(`${BASE_URL}/`, { waitUntil: "load", timeout: 120_000 });

  console.log(
    `[potion] fetching tokenizer.json + model.safetensors directly (proxy for a real ` +
      `browser static-embedding loader's network cost) at t0...`
  );
  const t0 = Date.now();
  const [tokenizerLen, modelLen] = await page.evaluate(
    async ([tokenizerUrl, modelUrl]) => {
      const [tokRes, modelRes] = await Promise.all([
        fetch(tokenizerUrl, { cache: "no-store" }),
        fetch(modelUrl, { cache: "no-store" }),
      ]);
      const [tokBuf, modelBuf] = await Promise.all([tokRes.arrayBuffer(), modelRes.arrayBuffer()]);
      return [tokBuf.byteLength, modelBuf.byteLength];
    },
    [TOKENIZER_URL, MODEL_URL]
  );
  const t1 = Date.now();

  const deltaMs = t1 - t0;
  console.log(
    `\n[potion] RESULT: fetch-start -> both files downloaded = ${deltaMs} ms ` +
      `(tokenizer.json: ${tokenizerLen} bytes, model.safetensors: ${modelLen} bytes)`
  );
  console.log(`[potion] responses captured (${responses.length}):`);
  console.log(JSON.stringify(responses, null, 2));
  const anyFromCache = responses.some((r) => r.fromDiskCache);
  console.log(
    anyFromCache
      ? "[potion] WARNING: at least one response was served fromDiskCache -- cache-disable did not hold"
      : "[potion] confirmed: zero responses served fromDiskCache -- this is a genuine cold download"
  );

  await browser.close();
  return { deltaMs, tokenizerLen, modelLen };
}

if (TARGET === "app") {
  await measureApp();
} else if (TARGET === "potion") {
  await measurePotion();
} else {
  console.error(`Unknown --target=${TARGET}, expected "app" or "potion"`);
  process.exit(1);
}
