// scripts/lib/github-api.mjs — shared helper for scripts that call the real api.github.com REST
// API (NOT raw.githubusercontent.com, an unauthenticated content CDN with different failure
// semantics, handled separately/inline by each caller that uses it).
//
// Owner rule R3 (2026-09): "no silent failure — every script touching the GitHub API must exit
// non-zero on any API error." Before this module, each script's own ad hoc fetch either swallowed
// a failed api.github.com call into a free-form note with no exit-code effect (identity-drift.mjs,
// content-pipeline/extractor.mjs), or tracked the failure but never exited non-zero
// (refresh-metrics.mjs). Centralizing the fetch here makes "what counts as an error" (non-2xx,
// network error, malformed body — all three throw, see below) and "how it's reported"
// (formatApiErrorLines) consistent across every caller, and unit-testable with a stubbed `fetch`
// instead of live network — see github-api.smoketest.mjs. Extracted rather than duplicated
// per-script because this task is what *introduces* the apiErrors/exit-code convention; there was
// no stable pre-existing implementation being disturbed by centralizing it.
//
// GITHUB_API_BASE is overridable (default https://api.github.com) so a forced-error test can
// point requests at a host that can never answer, without live network or a fetch stub.

const DEFAULT_TIMEOUT_MS = 20_000;

export function githubApiBase() {
  return process.env.GITHUB_API_BASE ?? "https://api.github.com";
}

export function githubToken() {
  return process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null;
}

/**
 * GETs a path off the GitHub REST API (e.g. "/repos/owner/name") and returns parsed JSON. Throws
 * on any non-2xx status, network error, or unparseable body — callers are expected to catch,
 * record the failure (context + err.message), and set `process.exitCode = 1` before the process
 * exits if any such record exists (R3). Never swallows a failure itself.
 */
export async function githubApiGet(path, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { Accept: "application/vnd.github+json" };
    const token = githubToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${githubApiBase()}${path}`, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Renders `apiErrors` (`[{ context, message }]`) as one `::error::` GitHub Actions annotation
 * line per failure, so every failed call is individually named rather than collapsed into a
 * count (rule 98a: a control that fails closed names the specific gap, not just "something
 * failed").
 */
export function formatApiErrorLines(apiErrors) {
  return apiErrors.map((e) => `::error::GitHub API call failed — ${e.context}: ${e.message}`);
}
