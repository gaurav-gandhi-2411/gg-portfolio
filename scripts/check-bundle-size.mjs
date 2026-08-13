// Eager JS bundle-size gate (run locally against `npm run start`: node
// scripts/check-bundle-size.mjs; wired into ci.yml's `e2e` job).
//
// WHY THIS EXISTS: the 2026-07-12 wave-2 measurement enumerated the
// homepage's shipped `<script>` chunks by hand and reported a "Total:
// 161.3 KiB" that was wrong — the enumeration simply forgot one script tag
// (`0cz1d0mv5g_q7.js`, 39,627 bytes gzip: a core-js polyfill chunk Next.js/
// Turbopack bakes into every build regardless of application code). The
// true total was 204,762 bytes; the mistake stood as the operative budget
// for a full day before reports/wave3-budget-reratification-2026-07-13.md
// corrected it to a 220,160-byte (215 KiB) ceiling against a 207,862-byte
// baseline. That was a human-enumeration bug, not a tooling bug — nothing
// re-checked the hand-built list against anything.
//
// METHOD: fetch the route's real served HTML from a running production
// server, parse every `<script src>` and `<link rel="preload" as="script">`
// tag it actually contains, and curl each one's live gzip size — this
// mirrors exactly how wave2/wave3 measured by hand (every script the
// browser actually downloads for this route), so the total stays
// comparable to the 207,862-byte history. Cross-checked independently
// against `.next/build-manifest.json`'s `rootMainFiles` + `polyfillFiles`
// fields (Next's own authoritative "loaded on every route" list — stable
// field names, unlike content-hashed filenames this script never
// hardcodes): every manifest-listed chunk must actually appear in the live
// HTML, and the polyfill chunk's own measured weight is asserted
// separately (see POLYFILL_MISSING below) so a future version of the
// 2026-07-12 mistake — a total that quietly drops the polyfill — fails
// loudly by name instead of only maybe tripping the ceiling check.
//
// Deliberately NOT globbing `.next/static/chunks/*.js`: that would sweep in
// every chunk this BUILD ever produced, including ones for other routes
// and truly lazy/dynamic imports (heat-toy, triageiq-classify-panel, ...)
// this route never loads — a number no longer comparable to the 207,862
// history, which was always "what this one page's initial load actually
// ships," not "everything in the build output." Parsing the live-served
// HTML for THIS route naturally excludes those without needing a hardcoded
// exclude-list.
//
// FAILS CLOSED (rule 98a), every state distinct, no silent pass:
//   - BUILD_MANIFEST_MISSING: no `.next/build-manifest.json` — run
//     `npm run build` first. Never falls back to guessing a file list.
//   - SERVER_UNAVAILABLE: nothing answering at BASE_URL_OVERRIDE — run
//     `npm run start` first.
//   - CURL_UNAVAILABLE: no `curl` on PATH — this script shells out to a
//     real `curl -H "Accept-Encoding: gzip"` per chunk (not Node's fetch,
//     which auto-decompresses and hides the actual wire size) rather than
//     reimplementing gzip-size measurement.
//   - CHUNK_FETCH_FAILED: an individual chunk's curl didn't return a
//     numeric byte count — aborts entirely rather than silently summing
//     over fewer chunks than were actually found in the HTML.
//   - MANIFEST_HTML_MISMATCH: a chunk `.next/build-manifest.json` lists as
//     part of the eager shell never shows up in the live page's own
//     served HTML — the manifest and reality disagree, exactly the class
//     of bug (a stale/wrong artifact) that would otherwise silently
//     under-count.
//   - POLYFILL_MISSING: the manifest's `polyfillFiles` chunk(s), measured
//     within the real total, weigh implausibly little (or the field is
//     empty) — reproducing this condition without failing is *exactly*
//     the 2026-07-12 bug shape (a total that quietly omits the ~39.6 KiB
//     polyfill), so it's asserted explicitly rather than left to show up
//     only as "the ceiling check happened to still pass this time."
//
// Ceiling is a hard, CI-blocking gate (unlike scripts/lighthouse.mjs,
// which is local-only and non-blocking — see that script's own header and
// .github/workflows/ci.yml's comment on this step for why the two gates
// split that way): this measurement is deterministic byte-counting against
// a real server, not a noisy simulated-throttling score, so it can afford
// to block a PR.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.BASE_URL_OVERRIDE ?? "http://localhost:3000";
const ROUTE = process.env.ROUTE_OVERRIDE ?? "/";
const BUILD_MANIFEST_PATH = process.env.BUILD_MANIFEST_PATH_OVERRIDE ?? join(ROOT, ".next", "build-manifest.json");

// Ceiling: reports/wave3-budget-reratification-2026-07-13.md. 215 KiB =
// 220,160 bytes exactly. Overridable only for deliberately testing the FAIL
// path itself (same X_OVERRIDE convention as scripts/check-metric-freshness
// .mjs) — never to wave through a real over-budget PR; production CI never
// sets this.
const CEILING_BYTES = Number(process.env.CEILING_BYTES_OVERRIDE ?? 220_160);
// Baseline: reports/bundle-budget-reratification-2026-08-12.md. This
// script's own first real measurement came in 15,302 bytes under the prior
// (207,862-byte, wave3) baseline — adjudicated item-by-item before this
// gate merged (not silently adopted): the polyfill chunk matched
// byte-for-byte, and the shrink traced to a Next.js 16.2.10->16.3.0 /
// React 19.2.4->19.2.8 / shadcn 4.13.0->4.16.2 dependency bump (PR #64,
// merged the day before this baseline). Informational only — the ceiling
// above is the actual gate.
const BASELINE_BYTES = 192_560;

// A plausibility floor for the polyfill chunk's OWN measured weight —
// historically 39,627 bytes gzip (reports/wave2-perf-budgets-2026-07-12.md's
// erratum). Wide enough to tolerate a genuine future Next.js/Turbopack
// version bump changing the polyfill's exact contents, tight enough that
// "0 bytes" or "a few hundred bytes" (the shape the 2026-07-12 bug actually
// took) still fails loudly instead of quietly passing.
const POLYFILL_PLAUSIBLE_MIN_BYTES = 5_000;

class StateError extends Error {
  constructor(state, detail) {
    super(detail);
    this.state = state;
  }
}

function devNull() {
  return platform() === "win32" ? "NUL" : "/dev/null";
}

function assertCurlAvailable() {
  try {
    execFileSync("curl", ["--version"], { stdio: "ignore" });
  } catch {
    throw new StateError("CURL_UNAVAILABLE", 'no "curl" found on PATH — this script shells out to real curl, it does not reimplement gzip-size measurement');
  }
}

// Real wire bytes for a gzip-negotiated response — deliberately curl, not
// Node's fetch(): undici's fetch transparently decompresses a gzip
// response body, which would measure the UNCOMPRESSED size and silently
// misrepresent what a real browser actually downloads.
function curlGzipSize(url) {
  let out;
  try {
    out = execFileSync("curl", ["-s", "-o", devNull(), "-w", "%{size_download}", "-H", "Accept-Encoding: gzip", url], {
      encoding: "utf8",
    });
  } catch (err) {
    throw new StateError("CHUNK_FETCH_FAILED", `curl failed for ${url}: ${err.message}`);
  }
  const bytes = Number(out.trim());
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new StateError("CHUNK_FETCH_FAILED", `curl returned a non-numeric/zero size for ${url}: "${out.trim()}"`);
  }
  return bytes;
}

function loadManifest() {
  if (!existsSync(BUILD_MANIFEST_PATH)) {
    throw new StateError(
      "BUILD_MANIFEST_MISSING",
      `${BUILD_MANIFEST_PATH} does not exist — run "npm run build" first (this gate reads Next's own manifest, never a hand-maintained file list)`
    );
  }
  const manifest = JSON.parse(readFileSync(BUILD_MANIFEST_PATH, "utf8"));
  const rootMainFiles = manifest.rootMainFiles ?? [];
  const polyfillFiles = manifest.polyfillFiles ?? [];
  if (polyfillFiles.length === 0) {
    throw new StateError(
      "POLYFILL_MISSING",
      "build-manifest.json's polyfillFiles is empty — this repo's Next.js/Turbopack build has always produced a " +
        "core-js polyfill chunk regardless of application code, so an empty field means the manifest itself is " +
        "unreliable this run. Not a size-over-budget failure — a structural one; do not proceed to compute a total."
    );
  }
  return { rootMainFiles, polyfillFiles };
}

// Every `<script src>` and preload-as-script `<link>` the route's live HTML
// actually contains — this IS the "eager JS" set for this specific route,
// matching how wave2/wave3 measured by hand. Font/stylesheet preloads
// (`as="font"`, `rel="stylesheet"`) are excluded by construction: neither
// regex matches them.
async function fetchServedChunkPaths(baseUrl, route) {
  let html;
  try {
    const res = await fetch(new URL(route, baseUrl).href);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    throw new StateError("SERVER_UNAVAILABLE", `nothing answering at ${baseUrl}${route} (${err.message}) — run "npm run start" first`);
  }
  const paths = new Set();
  const scriptRe = /<script[^>]*\ssrc="([^"]+)"/g;
  const preloadRe = /<link[^>]*\srel="preload"[^>]*\sas="script"[^>]*\shref="([^"]+)"|<link[^>]*\shref="([^"]+)"[^>]*\sas="script"/g;
  for (const m of html.matchAll(scriptRe)) paths.add(m[1]);
  for (const m of html.matchAll(preloadRe)) paths.add(m[1] ?? m[2]);
  // Manifest paths are repo-relative to `.next/` ("static/chunks/x.js");
  // served URLs are "/_next/static/chunks/x.js" — strip the "/_next/"
  // prefix so both sides compare as the same string.
  const relative = [...paths].filter((p) => p.startsWith("/_next/")).map((p) => p.slice("/_next/".length));
  return new Set(relative);
}

async function main() {
  console.log(`scripts/check-bundle-size.mjs: route=${ROUTE} base=${BASE_URL}`);

  let manifest;
  try {
    assertCurlAvailable();
    manifest = loadManifest();
  } catch (err) {
    console.error(`\nFAIL — ${err.state}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const manifestEagerChunks = [...manifest.rootMainFiles, ...manifest.polyfillFiles];

  let servedChunks;
  try {
    servedChunks = await fetchServedChunkPaths(BASE_URL, ROUTE);
  } catch (err) {
    console.error(`\nFAIL — ${err.state}: ${err.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${ROUTE} served ${servedChunks.size} script/preload chunk(s) — this is the set being summed`);

  // Cross-check: every chunk the manifest calls "loaded on every route"
  // must actually appear in what THIS route served — a manifest/reality
  // mismatch here means the manifest can't be trusted for the polyfill
  // identification below either.
  const missingFromHtml = manifestEagerChunks.filter((c) => !servedChunks.has(c));
  if (missingFromHtml.length > 0) {
    console.error(
      `\nFAIL — MANIFEST_HTML_MISMATCH: build-manifest.json lists ${missingFromHtml.length} eager chunk(s) not ` +
        `found in ${ROUTE}'s actual served <script>/<link preload> tags: ${missingFromHtml.join(", ")} — the ` +
        "manifest and the live server disagree about what ships; investigate before trusting either total."
    );
    process.exitCode = 1;
    return;
  }

  const polyfillSet = new Set(manifest.polyfillFiles);
  let total = 0;
  let polyfillTotal = 0;
  const breakdown = [];
  try {
    for (const chunk of servedChunks) {
      const bytes = curlGzipSize(new URL(`/_next/${chunk}`, BASE_URL).href);
      total += bytes;
      if (polyfillSet.has(chunk)) polyfillTotal += bytes;
      breakdown.push({ chunk, bytes, isPolyfill: polyfillSet.has(chunk), isRoot: manifest.rootMainFiles.includes(chunk) });
    }
  } catch (err) {
    console.error(`\nFAIL — ${err.state}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  // The explicit, named assertion this script's header promises: a total
  // that omits (or near-zeroes) the polyfill chunk's real weight
  // reproduces the exact 2026-07-12 bug shape, independent of whether the
  // final total happens to still clear the ceiling.
  if (polyfillTotal < POLYFILL_PLAUSIBLE_MIN_BYTES) {
    console.error(
      `\nFAIL — POLYFILL_MISSING: polyfill chunk(s) totaled only ${polyfillTotal} bytes gzip within this route's ` +
        `${total}-byte total, well under the ${POLYFILL_PLAUSIBLE_MIN_BYTES}-byte plausibility floor (historical ` +
        "reference: 39,627 bytes) — this is the same shape as the 2026-07-12 wave-2 bug: a total that silently " +
        "omits the core-js polyfill's real weight."
    );
    process.exitCode = 1;
    return;
  }

  breakdown.sort((a, b) => b.bytes - a.bytes);
  console.log("\nChunk breakdown (gzip, live curl):");
  for (const b of breakdown) {
    const tag = b.isPolyfill ? "polyfill" : b.isRoot ? "root" : "route";
    console.log(`  [${tag.padEnd(8)}] ${String(b.bytes).padStart(7)} bytes  ${b.chunk}`);
  }

  const deltaFromBaseline = total - BASELINE_BYTES;
  const headroom = CEILING_BYTES - total;
  console.log(`\nTotal: ${total} bytes gzip (baseline ${BASELINE_BYTES}, delta ${deltaFromBaseline >= 0 ? "+" : ""}${deltaFromBaseline})`);
  console.log(`Ceiling: ${CEILING_BYTES} bytes (215 KiB) — headroom ${headroom} bytes`);

  if (total > CEILING_BYTES) {
    console.error(
      `\nFAIL — ${total} bytes exceeds the ${CEILING_BYTES}-byte (215 KiB) ceiling by ${total - CEILING_BYTES} ` +
        "bytes. Per reports/wave3-budget-reratification-2026-07-13.md's own escalation rule: dynamic-import the " +
        "new cost or cut it — do not re-ratify this ceiling a third time."
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\nOK — ${total} bytes is within the ${CEILING_BYTES}-byte ceiling.`);
}

await main();
