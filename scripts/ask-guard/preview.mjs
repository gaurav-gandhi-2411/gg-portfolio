// Preview lookup + live /api/chat probe for the /ask live-preview guard (ask-live-guard.yml).
// Pure decision functions are exported for ask-guard.smoketest.mjs; the CLI does the I/O:
//
//   GITHUB_TOKEN=.. REPO=owner/name SHA=.. node scripts/ask-guard/preview.mjs wait-preview
//   node scripts/ask-guard/preview.mjs probe <preview-origin>
//
// Everything here FAILS CLOSED (rule 98a): a timeout, an ambiguous deployment, a non-https/non-
// vercel.app URL, a non-200, a non-JSON body, a refusal, an empty answer or zero citations all
// exit non-zero. "Could not verify" is never a pass.

import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { computeVerdict } from "../chatbot/canary-verdict.mjs";

// Same question as chat-canary.yml: genuinely answerable, so a refusal is a real failure.
export const PROBE_QUESTION = "What is Gaurav's current role and background?";

/**
 * Pick the preview deployment to probe from the GitHub Deployments API for one SHA.
 * @param {Array<{id:number,environment:string,created_at:string}>} deployments
 * @param {Record<string, Array<{state:string,environment_url?:string,target_url?:string}>>} statusesById
 *   statuses per deployment id, newest first (the API's order)
 * @returns {{kind:"success",url:string}|{kind:"pending",detail:string}|{kind:"failed",detail:string}}
 */
export function pickPreviewDeployment(deployments, statusesById) {
  const previews = deployments
    .filter((d) => /^preview/i.test(d.environment ?? ""))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (previews.length === 0) return { kind: "pending", detail: "no Preview deployment exists for this SHA yet" };
  // Newest deployment wins even if an older one for the same SHA succeeded: ambiguity must not
  // resolve to the more favourable record.
  const newest = previews[0];
  const latest = (statusesById[newest.id] ?? [])[0];
  if (!latest) return { kind: "pending", detail: `deployment ${newest.id} has no status yet` };
  if (latest.state === "success") {
    const url = latest.environment_url || latest.target_url;
    return url ? { kind: "success", url } : { kind: "failed", detail: `deployment ${newest.id} succeeded but has no URL` };
  }
  if (latest.state === "failure" || latest.state === "error") {
    return { kind: "failed", detail: `deployment ${newest.id} state=${latest.state}` };
  }
  return { kind: "pending", detail: `deployment ${newest.id} state=${latest.state}` };
}

/** Accept only an https *.vercel.app origin; returns the origin or throws. */
export function validatePreviewUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`preview URL is not a URL: ${raw}`);
  }
  if (u.protocol !== "https:" || !u.hostname.endsWith(".vercel.app")) {
    throw new Error(`refusing to probe non-https / non-vercel.app URL: ${raw}`);
  }
  return u.origin;
}

/**
 * @param {number} status HTTP status (0 for network failure/timeout)
 * @param {string} body raw response body
 * @returns {{ok:boolean, lines:string[]}}
 */
export function evaluateProbe(status, body) {
  const v = computeVerdict(body);
  if (status !== 200) return { ok: false, lines: [`non-200 status: ${status}`, ...v.stderr] };
  if (!v.ok) return { ok: false, lines: v.stderr };
  const parsed = JSON.parse(body);
  if (typeof parsed.answer !== "string" || parsed.answer.trim() === "") {
    return { ok: false, lines: ["200 but `answer` is empty or not a string"] };
  }
  return { ok: true, lines: v.stdout };
}

async function waitForPreview() {
  const { GITHUB_TOKEN, REPO, SHA } = process.env;
  if (!GITHUB_TOKEN || !REPO || !SHA) throw new Error("GITHUB_TOKEN, REPO and SHA are required");
  const timeoutMs = Number(process.env.WAIT_TIMEOUT_MS ?? 15 * 60 * 1000);
  const intervalMs = Number(process.env.WAIT_INTERVAL_MS ?? 20 * 1000);
  const api = async (path) => {
    const res = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`GitHub API ${path} -> HTTP ${res.status}`);
    return res.json();
  };
  const deadline = Date.now() + timeoutMs;
  let last = "";
  for (;;) {
    const deployments = await api(`deployments?sha=${SHA}&per_page=100`);
    const statusesById = {};
    for (const d of deployments) {
      if (/^preview/i.test(d.environment ?? "")) {
        statusesById[d.id] = await api(`deployments/${d.id}/statuses?per_page=10`);
      }
    }
    const pick = pickPreviewDeployment(deployments, statusesById);
    if (pick.kind === "success") {
      const origin = validatePreviewUrl(pick.url);
      console.log(`preview ready: ${origin}`);
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `preview_url=${origin}\n`);
      return;
    }
    if (pick.kind === "failed") throw new Error(`PREVIEW_FAILED: ${pick.detail}`);
    if (pick.detail !== last) console.log(`waiting: ${pick.detail}`);
    last = pick.detail;
    if (Date.now() + intervalMs > deadline) {
      throw new Error(
        `PREVIEW_TIMEOUT: no successful Preview deployment for ${SHA} within ${timeoutMs / 1000}s (${last}); failing closed`
      );
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function probe(origin) {
  const url = `${validatePreviewUrl(origin)}/api/chat`;
  const attempts = 2; // a cold function may time out once; a real break fails both
  for (let i = 1; i <= attempts; i++) {
    let status = 0;
    let body = "";
    let headers = [];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: PROBE_QUESTION }),
        signal: AbortSignal.timeout(60_000),
      });
      status = res.status;
      body = await res.text();
      headers = ["x-vercel-id", "x-vercel-mitigated", "server", "content-type"]
        .map((h) => [h, res.headers.get(h)])
        .filter(([, v]) => v)
        .map(([h, v]) => `${h}: ${v}`);
    } catch (err) {
      body = `fetch failed: ${err.message}`;
    }
    console.log(`attempt ${i}/${attempts}: POST ${url} -> ${status}`);
    // Body dump bounded to 2 KB, like chat-canary.yml, so a failure is diagnosable from the log.
    if (headers.length) console.log(`response headers (selected):\n${headers.join("\n")}`);
    console.log(`response body (first 2 KB):\n${body.slice(0, 2048)}`);
    const result = evaluateProbe(status, body);
    for (const l of result.lines) console.log(result.ok ? l : `::error::${l}`);
    if (result.ok) return;
  }
  throw new Error("LIVE_ASK_FAILED: /api/chat on the PR preview did not return a well-formed answer");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, arg] = process.argv.slice(2);
  const run =
    cmd === "wait-preview"
      ? waitForPreview()
      : cmd === "probe"
        ? probe(arg)
        : Promise.reject(new Error(`unknown command: ${cmd}`));
  run.catch((err) => {
    console.error(`::error::${err.message}`);
    process.exit(1);
  });
}
