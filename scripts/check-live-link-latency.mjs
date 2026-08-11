#!/usr/bin/env node
// Live-link latency gate — checks time-to-first-byte, not just status code.
//
// WHY THIS EXISTS: .lychee.toml's own comment says it best — "Cloud Run demos
// (e.g. AetherArt) cold-start after idle... generous timeout/retries above
// absorb that instead of flagging it as broken every run." That's exactly
// the gap: a link check that retries past a cold start treats a 20-90s stall
// as a pass, because it only ever asks "did it eventually return 200" — the
// thing a real visitor feels (how long they stared at a spinner) was never
// measured. Found 2026-08-11 auditing Style Maitri's backend (asa-stylist-api),
// whose cold start turned out to be 60s+ — undetected by link-check.yml for
// as long as the card had a raw Cloud Run/Vercel-frontend link, because it
// only ever checked the status code.
//
// This script measures wall-clock time to first byte for every liveUrl in
// content/products.ts and fails if any exceeds its budget. The fix for a
// genuinely slow backend is content/warmup.ts's bridge page (a static page
// that always responds fast, and explicitly asks the visitor to wait rather
// than silently stalling) — so this gate gets to use ONE tight budget for
// every liveUrl instead of a patchwork of per-service exceptions.
//
// Run: node scripts/check-live-link-latency.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_PATH = path.join(ROOT, "content", "products.ts");

// Generous enough that normal network jitter never flags a false positive,
// tight enough that a silent multi-second stall (the actual failure class
// this exists to catch) still fails loudly. /warmup/* pages and every
// remaining direct liveUrl (Vercel frontends already kept warm, HF Spaces,
// GitHub Pages, PyPI) all comfortably clear this in normal operation.
const BUDGET_MS = 5000;
const FETCH_TIMEOUT_MS = 15000;

async function measure(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      // Cache-busting: a CDN-cached fast response would hide a slow origin,
      // which is exactly the case (a cold backend) this gate exists to catch.
      headers: { "Cache-Control": "no-cache" },
    });
    const ttfbMs = performance.now() - start;
    return { url, ok: res.ok, status: res.status, ttfbMs };
  } catch (err) {
    const ttfbMs = performance.now() - start;
    return {
      url,
      ok: false,
      status: err.name === "AbortError" ? "timeout" : err.message,
      ttfbMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

const productsSrc = readFileSync(PRODUCTS_PATH, "utf8");
const liveUrls = [...productsSrc.matchAll(/liveUrl:\s*"([^"]+)"/g)].map((m) => m[1]);

if (liveUrls.length === 0) {
  console.error("check-live-link-latency: no liveUrl entries found in content/products.ts — parser broken?");
  process.exit(1);
}

console.log(`check-live-link-latency: checking ${liveUrls.length} liveUrl(s), budget ${BUDGET_MS}ms\n`);

const results = await Promise.all(liveUrls.map(measure));

const overBudget = [];
for (const r of results) {
  const ms = Math.round(r.ttfbMs);
  const verdict = !r.ok ? "FAIL (status)" : ms > BUDGET_MS ? "FAIL (slow)" : "ok";
  console.log(`  [${verdict.padEnd(13)}] ${ms.toString().padStart(6)}ms  status=${r.status}  ${r.url}`);
  if (!r.ok || ms > BUDGET_MS) overBudget.push({ ...r, ms });
}

if (overBudget.length > 0) {
  console.error(
    `\nFAIL — ${overBudget.length} liveUrl(s) failed on status or exceeded the ${BUDGET_MS}ms budget:\n`
  );
  for (const r of overBudget) {
    console.error(`  - ${r.url} (${r.ms}ms, status=${r.status})`);
  }
  console.error(
    "\nIf this is a genuinely slow backend (a Cloud Run service that scales to zero), " +
      "point liveUrl at a /warmup/<service> bridge page instead of the raw URL — " +
      "see content/warmup.ts. Don't raise BUDGET_MS to make a slow link pass."
  );
  process.exit(1);
}

console.log(`\nOK — all ${liveUrls.length} liveUrl(s) responded within ${BUDGET_MS}ms.`);
