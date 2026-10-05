// scripts/content-pipeline/extractor.mjs — Wave 15, stage 1: pulls candidate facts from each
// wired source repo. Deterministic, no LLM — every candidate carries file:line@SHA provenance
// (or, for a whole-manifest entry, the manifest's own recorded provenance), never an inference.
//
// Two candidate sources per repo:
//   - "known": every entry already in content/metrics.json for that repo (already-sourced,
//     already-refreshed by scripts/refresh-metrics.mjs — passed through so the curator can catch
//     a value change worth reframing, not just brand-new facts).
//   - "readme": lines in the repo's README.md carrying a number the site doesn't already cite —
//     these are the "stop copy-pasting, curate intelligently" discoveries the wave-15 brief asks
//     for. A bounded regex sweep, not an LLM call (that judgment belongs to the curator stage).

import { readFileSync } from "node:fs";
import { githubApiGet } from "../lib/github-api.mjs";

const METRIC_PATTERN =
  /\b\d[\d,.]*\s?(%|x|×|percent|percentage points?|pp)\b|\b\d+\/\d+\b|\bp<\s?0?\.\d+/i;
const MAX_README_CANDIDATES_PER_REPO = 5;

// R3: api.github.com (the commit-SHA lookup below) failures land here, distinct from the
// README fetch's own silent `null`-on-failure return — raw.githubusercontent.com is an
// unauthenticated content CDN, not the REST API R3 is about, and a missing README is already
// handled (that repo just contributes zero readme candidates). run.mjs checks this array after
// every repo has been processed and exits non-zero if it's non-empty.
export const apiErrors = []; // { context, message }

async function fetchText(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function knownMetricsForRepo(metricsStore, repo) {
  return Object.entries(metricsStore.metrics)
    .filter(([, m]) => m.repo === repo)
    .map(([id, m]) => ({ kind: "known", id, ...m }));
}

function readmeCandidates(readmeText, existingValues) {
  if (!readmeText) return [];
  const lines = readmeText.split("\n");
  const candidates = [];
  for (let i = 0; i < lines.length && candidates.length < MAX_README_CANDIDATES_PER_REPO; i++) {
    const line = lines[i].trim();
    if (!line || !METRIC_PATTERN.test(line)) continue;
    // Skip a line that's just restating a value already tracked for this repo — the curator's
    // "isn't redundant" axis handles subtler duplication, this is a cheap first pass.
    if (existingValues.some((v) => line.includes(v))) continue;
    candidates.push({ kind: "readme", text: line, source_file: "README.md", source_line: i + 1 });
  }
  return candidates;
}

export async function extract(repo, metricsStore, { ref = "HEAD" } = {}) {
  const known = knownMetricsForRepo(metricsStore, repo);
  const readme = await fetchText(`https://raw.githubusercontent.com/${repo}/${ref}/README.md`);
  let commitSha;
  try {
    const commits = await githubApiGet(`/repos/${repo}/commits?per_page=1`);
    commitSha = commits?.[0]?.sha;
  } catch (err) {
    apiErrors.push({ context: `${repo}: commit SHA lookup`, message: err.message });
  }

  const existingValues = known.map((m) => m.value);
  const readmeFound = readmeCandidates(readme, existingValues).map((c) => ({
    ...c,
    commit_sha: commitSha,
  }));

  return { repo, candidates: [...known, ...readmeFound] };
}

/** Distinct repos already wired into content/metrics.json — the extraction scope for this run. */
export function wiredRepos(metricsPath) {
  const store = JSON.parse(readFileSync(metricsPath, "utf8"));
  const repos = new Set(Object.values(store.metrics).map((m) => m.repo));
  return { store, repos: [...repos] };
}
