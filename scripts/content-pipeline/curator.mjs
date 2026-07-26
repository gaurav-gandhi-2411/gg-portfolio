// scripts/content-pipeline/curator.mjs — Wave 15, stage 2: scores each "readme" candidate (see
// extractor.mjs) against docs/content-pipeline-rubric.md. "known" candidates (already-tracked
// metrics.json entries) skip straight through — they're already vetted by wave 13's manifest
// convention; the curator's job is judging the NEW discoveries README-scanning surfaces.

import { readFileSync } from "node:fs";

const RUBRIC = readFileSync(
  new URL("../../docs/content-pipeline-rubric.md", import.meta.url),
  "utf8"
);

const SYSTEM_PROMPT = `You are the curator stage of an automated content-curation pipeline for a
software engineer's portfolio site. You score candidate facts pulled from a repo's README against
a written rubric. You are conservative — most README lines are noise (setup instructions, badges,
license text) and should be rejected. Respond with JSON only: {"passes": boolean, "score": 1-5,
"reasoning": "one sentence"}.

RUBRIC:
${RUBRIC}`;

export async function curate(callLlm, repo, candidate, existingCaseStudySummary) {
  const userPrompt = `Repo: ${repo}
Candidate fact (from README.md line ${candidate.source_line}): "${candidate.text}"

Current case-study copy for this project (for redundancy checking):
${existingCaseStudySummary || "(no existing case study found for this repo)"}

Score this candidate against the rubric.`;

  const result = await callLlm("curator", SYSTEM_PROMPT, userPrompt);
  if (!result) return { ...candidate, curator: null };
  return { ...candidate, curator: result };
}
