#!/usr/bin/env node
// scripts/content-pipeline/run.mjs — Wave 15 orchestrator: extractor → curator → framer →
// verifier. Replaces the mechanical "copy whatever the manifest says" behavior for NEWLY
// discovered facts (scripts/refresh-metrics.mjs still handles refreshing values for metric IDs
// already wired into content/metrics.json — that part isn't the "dumb copy-paste" problem this
// pipeline addresses, see docs/content-pipeline-rubric.md).
//
// Cost/quota note (documented, not hidden — see the wave-15 report): GROQ_API_KEY and
// OPENROUTER_API_KEY are the SAME free-tier keys already used by other GG projects for live
// traffic. This run is bounded (MAX_CANDIDATES_PER_RUN below) specifically so a weekly cron here
// never meaningfully competes with those apps' own quota.
//
// Output: this script only WRITES FILES (content/provenance.md gets a new dated section,
// SUMMARY_PATH gets a PR-body-ready markdown summary). It never touches git — the workflow
// (.github/workflows/content-pipeline.yml) handles the commit/PR, same separation of concerns as
// scripts/refresh-metrics.mjs.

import { readFileSync, writeFileSync } from "node:fs";
import { extract, wiredRepos } from "./extractor.mjs";
import { curate } from "./curator.mjs";
import { frame } from "./framer.mjs";
import { verify } from "./verifier.mjs";
import { callLlm } from "./llm.mjs";

const METRICS_PATH = "content/metrics.json";
const PROVENANCE_PATH = "content/provenance.md";
const SUMMARY_PATH = process.env.PIPELINE_SUMMARY_PATH || "content-pipeline-summary.md";
const MAX_CANDIDATES_PER_RUN = Number(process.env.PIPELINE_MAX_CANDIDATES ?? 20);

function caseStudySummaryFor(repo) {
  // Best-effort: find a case-study file whose source comment mentions this repo, so the curator
  // has enough context to judge redundancy (axis 4) without needing a full repo→slug map here.
  try {
    const idx = readFileSync("content/case-studies/index.ts", "utf8");
    const slugMatch = [...idx.matchAll(/from ["']\.\/([\w-]+)["']/g)].map((m) => m[1]);
    for (const slug of slugMatch) {
      const text = readFileSync(`content/case-studies/${slug}.ts`, "utf8");
      if (text.includes(repo.split("/")[1])) {
        const dek = text.match(/dek:\s*"([^"]*)"/)?.[1];
        return dek ?? null;
      }
    }
  } catch {
    // best-effort only — missing context degrades the curator's redundancy check, never crashes
  }
  return null;
}

async function main() {
  const { store, repos } = wiredRepos(METRICS_PATH);
  const proposals = [];
  const notes = [];
  let candidateBudget = MAX_CANDIDATES_PER_RUN;

  for (const repo of repos) {
    if (candidateBudget <= 0) {
      notes.push(`Budget exhausted before reaching ${repo} — will get priority next run.`);
      break;
    }
    const { candidates } = await extract(repo, store);
    const readmeCandidates = candidates.filter((c) => c.kind === "readme").slice(0, candidateBudget);
    if (readmeCandidates.length === 0) continue;

    const summary = caseStudySummaryFor(repo);

    for (const candidate of readmeCandidates) {
      candidateBudget--;
      const curated = await curate(callLlm, repo, candidate, summary);
      if (!curated.curator) {
        notes.push(`${repo}: curator call failed (fail-soft) for "${candidate.text.slice(0, 60)}..." — skipped.`);
        continue;
      }
      if (!curated.curator.passes) continue;

      const framed = await frame(callLlm, repo, curated);
      if (!framed.framer) {
        notes.push(`${repo}: framer call failed (fail-soft) after curator passed — skipped.`);
        continue;
      }

      const verdict = await verify(callLlm, candidate.text, framed.framer.draft);
      if (!verdict || !verdict.approved) {
        notes.push(
          `${repo}: verifier rejected "${framed.framer.draft.slice(0, 60)}..." — ${
            verdict?.reasoning ?? "verifier call failed (fail-soft), treated as not-approved"
          }`
        );
        continue;
      }

      proposals.push({
        repo,
        source: `${candidate.source_file}:${candidate.source_line ?? "?"}`,
        curatorScore: curated.curator.score,
        curatorReasoning: curated.curator.reasoning,
        draft: framed.framer.draft,
        suggestedSourceRefId: framed.framer.suggested_source_ref_id,
        verifierReasoning: verdict.reasoning,
      });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  if (proposals.length > 0) {
    const section = [
      "",
      `## Wave 15 pipeline proposals — ${today} (LLM-consensus, pending human review)`,
      "",
      "Each proposal below passed all three stages (curator score against " +
        "`docs/content-pipeline-rubric.md`, framer draft, verifier cross-check from a different " +
        "model family) but is **not yet reflected in any case study** — this is LLM-consensus " +
        "judgment, not a human-reviewed claim. Fold into the relevant case study by hand if you " +
        "agree; delete this section once actioned or rejected.",
      "",
      ...proposals.map(
        (p) =>
          `- **${p.repo}** (curator ${p.curatorScore}/5 — ${p.curatorReasoning}; verifier: ${p.verifierReasoning})\n` +
          `  Source: \`${p.source}\`\n` +
          `  Draft: "${p.draft}"\n` +
          `  Suggested provenance ID: \`${p.suggestedSourceRefId}\``
      ),
      "",
    ].join("\n");
    const existing = readFileSync(PROVENANCE_PATH, "utf8");
    writeFileSync(PROVENANCE_PATH, existing + section);
  }

  const summaryLines = [
    `# Content pipeline run — ${today}`,
    "",
    `Repos scanned: ${repos.length}. Proposals reaching the PR: **${proposals.length}**.`,
    "",
    proposals.length > 0
      ? "## Proposals (LLM-consensus — see content/provenance.md for the full record)"
      : "No proposals passed all three stages this run.",
    ...proposals.map((p) => `- **${p.repo}**: "${p.draft}" (curator ${p.curatorScore}/5)`),
    "",
    notes.length > 0 ? "## Notes (rejections, fail-soft skips)" : "",
    ...notes.map((n) => `- ${n}`),
  ];
  writeFileSync(SUMMARY_PATH, summaryLines.join("\n"));

  console.log(`Content pipeline: ${proposals.length} proposal(s), ${notes.length} note(s).`);
}

main().catch((err) => {
  console.error("Content pipeline failed:", err);
  process.exit(1);
});
