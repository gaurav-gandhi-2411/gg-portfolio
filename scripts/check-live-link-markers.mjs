#!/usr/bin/env node
// Live-link BODY check — asserts what a page says, not merely that it answered.
//
// WHY THIS EXISTS: on 2026-08-13, content/case-studies/reviewiq.ts's "Live API
// docs" link was going to be repointed at https://app.samidhareviews.xyz/docs
// because that URL returns 200 while the old one 503s. It does return 200 — a
// 942-byte Next.js shell titled "Samidha Reviews", with no Swagger UI anywhere
// in it. A status-code check would have called that a fix. The citation would
// have gone from correct-but-dead to live-but-false, which is strictly worse:
// dead links get noticed, wrong ones get believed.
//
// That is the same failure as everything in CHECKS.md, one layer out. lychee
// and check-live-link-latency.mjs both ask questions about the transport --
// "did it answer", "how fast" -- and neither can tell a page apart from a
// soft-200 shell wearing its URL. This script asks the only question that
// distinguishes them: does the response body actually contain the thing the
// portfolio claims is there?
//
// THE SURFACE THIS CHECK REACHES (state it, per CHECKS.md):
//   - every liveUrl in content/products.ts, and nothing else
//   - the response body of a single GET, following redirects
//   - NOT: client-rendered content (a marker painted by JS after hydration will
//     read as missing here -- pick a server-rendered marker), links inside
//     case studies or public/resume.pdf, or anything behind auth
//
// Non-coverage is a loud, distinct status, never silence:
//   OK              marker found
//   MARKER_MISSING  page answered, but does not say what we claim it says
//   HTTP_<code>     page answered with a non-2xx status
//   UNREACHABLE     fetch threw or timed out -- a DENY, never a skip
//   UNDECLARED      a liveUrl exists with no declared marker (the coverage hole)
//   STALE_DECL      a declaration whose URL is no longer in products.ts
//
// Every one of those is a failure. There is deliberately no "warn" tier: a
// marker that cannot be checked is a claim that is not being verified, and this
// file exists because that state used to be invisible.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT_MS = 45_000;

// Generous, and deliberately not retried. Unlike lychee this check is not
// trying to be robust to cold starts -- check-live-link-latency.mjs already
// owns "is it slow". Here a timeout means "could not verify the claim", which
// is a failure regardless of why.

function loadDeclarations() {
  const raw = JSON.parse(readFileSync(path.join(ROOT, "scripts/live-link-markers.json"), "utf8"));
  const map = new Map();
  for (const entry of raw.links) {
    if (!entry.url || !Array.isArray(entry.markers) || entry.markers.length === 0) {
      console.error(`check-live-link-markers: malformed declaration for ${entry.url ?? "(no url)"}`);
      process.exit(1);
    }
    map.set(entry.url, entry);
  }
  return map;
}

function loadProductUrls() {
  const src = readFileSync(path.join(ROOT, "content/products.ts"), "utf8");
  const urls = [...src.matchAll(/liveUrl:\s*"([^"]+)"/g)].map((m) => m[1]);
  // Same fail-closed guard as check-live-link-latency.mjs: if the regex stops
  // matching because products.ts changed shape, that must not read as "no live
  // links to check" -- the silent-pass this whole family of checks exists to
  // prevent.
  if (urls.length === 0) {
    console.error(
      "check-live-link-markers: no liveUrl entries found in content/products.ts — parser broken?",
    );
    process.exit(1);
  }
  return urls;
}

async function checkOne(url, markers) {
  let res;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Some hosts (HF, GitHub) serve a different, thinner body to obvious bots.
      headers: { "user-agent": "gg-portfolio-link-marker-check" },
    });
  } catch (err) {
    return { status: "UNREACHABLE", detail: err?.name === "TimeoutError" ? `no response in ${TIMEOUT_MS}ms` : String(err?.message ?? err) };
  }
  if (!res.ok) return { status: `HTTP_${res.status}`, detail: res.statusText || "" };

  const body = await res.text();
  const missing = markers.filter((m) => !body.includes(m));
  if (missing.length > 0) {
    return {
      status: "MARKER_MISSING",
      detail: `${res.status}, ${body.length}B, absent: ${missing.map((m) => JSON.stringify(m)).join(", ")}`,
    };
  }
  return { status: "OK", detail: `${res.status}, ${body.length}B` };
}

const declarations = loadDeclarations();
const productUrls = loadProductUrls();

const results = [];

// 1. Coverage holes first -- a liveUrl nobody declared a marker for is the
//    state this check most needs to make visible, and it costs no network call.
for (const url of productUrls) {
  if (!declarations.has(url)) {
    results.push({ url, status: "UNDECLARED", detail: "in products.ts, no marker in live-link-markers.json" });
  }
}

// 2. Declarations pointing at URLs that no longer exist -- otherwise a removed
//    product leaves a declaration that passes forever, checking nothing anyone
//    ships.
for (const url of declarations.keys()) {
  if (!productUrls.includes(url)) {
    results.push({ url, status: "STALE_DECL", detail: "declared here, absent from content/products.ts" });
  }
}

// 3. The actual body checks, in parallel.
const checkable = productUrls.filter((u) => declarations.has(u));
const checked = await Promise.all(
  checkable.map(async (url) => ({ url, ...(await checkOne(url, declarations.get(url).markers)) })),
);
results.push(...checked);

const failures = results.filter((r) => r.status !== "OK");

console.log("Live-link body markers\n");
for (const r of results.sort((a, b) => a.status.localeCompare(b.status))) {
  console.log(`  ${r.status.padEnd(15)} ${r.url}`);
  if (r.detail) console.log(`  ${"".padEnd(15)}   ${r.detail}`);
}

console.log(
  `\n${results.length - failures.length}/${results.length} verified` +
    (failures.length ? ` — ${failures.length} failing` : ""),
);

if (failures.length > 0) {
  console.error(
    "\nA failure here means the portfolio claims something a page does not say.\n" +
      "Fix the citation or the page — do NOT weaken the marker to make this pass.",
  );
  process.exit(1);
}
