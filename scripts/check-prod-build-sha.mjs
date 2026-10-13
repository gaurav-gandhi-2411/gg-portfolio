#!/usr/bin/env node
// Final-gate check: is production serving main's HEAD? Fetches the live page, reads
// <meta name="build-sha"> (app/layout.tsx, lib/build-sha.ts) and compares it with main's SHA.
//
//   node scripts/check-prod-build-sha.mjs [--url <page>] [--expected <40-hex sha>]
//
// --url defaults to $PROD_URL, then https://gaurav-gandhi.vercel.app/.
// --expected defaults to `gh api repos/gaurav-gandhi-2411/gg-portfolio/commits/main --jq .sha`.
// Fails closed: any fetch error, non-200, missing/"dev" tag or mismatch prints FAIL and exits 1.
import { execFileSync } from "node:child_process";

const DEFAULT_URL = "https://gaurav-gandhi.vercel.app/";
const REPO = "gaurav-gandhi-2411/gg-portfolio";
const SHA_RE = /^[0-9a-f]{40}$/;

function fail(msg) {
  console.log(`FAIL: ${msg}`);
  process.exit(1);
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const url = arg("url") ?? process.env.PROD_URL ?? DEFAULT_URL;

let expected = arg("expected");
if (expected === undefined) {
  try {
    expected = execFileSync("gh", ["api", `repos/${REPO}/commits/main`, "--jq", ".sha"], {
      encoding: "utf8",
      timeout: 30_000,
    }).trim();
  } catch (e) {
    fail(`could not resolve main's SHA via gh: ${e.message}`);
  }
}
expected = expected.toLowerCase();
if (!SHA_RE.test(expected)) fail(`expected SHA is not 40 hex characters: "${expected}"`);

let status;
let html;
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { "cache-control": "no-cache" } });
  status = res.status;
  html = await res.text();
} catch (e) {
  fail(`could not fetch ${url}: ${e.message}`);
}
if (status !== 200) fail(`${url} returned HTTP ${status}; expected ${expected}`);

const m = /<meta\s+name="build-sha"\s+content="([^"]*)"/.exec(html);
if (!m) fail(`no build-sha meta tag in ${url}; expected ${expected}`);
const live = m[1].toLowerCase();
if (!SHA_RE.test(live)) fail(`${url} build-sha is "${live}", not a 40-hex SHA; expected ${expected}`);
if (live !== expected) fail(`production serves ${live} but main is ${expected} (${url})`);
console.log(`PASS: production ${live} == main ${expected} (${url})`);
