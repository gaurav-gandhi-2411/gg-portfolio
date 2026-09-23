import type { CaseStudy } from "../types";

// Source: gaurav-gandhi-2411/eval-defect-bench's README.md (fetched via
// `gh api repos/gaurav-gandhi-2411/eval-defect-bench/readme --jq .content |
// base64 -d`, 2026-09-23) — the only source read for this case study; see
// content/provenance.md's eval-defect-bench section for line-cited claims.
// No metric badge on the product card: these numbers have no
// `.portfolio/metrics.json` manifest in that repo for the weekly refresh
// script to read (same reasoning as DealHunter's own "no metric badge"
// note), so they're sourced directly in this case study instead of through
// refreshableMetric().
export const evalDefectBench: CaseStudy = {
  slug: "eval-defect-bench",
  verifiedAt: "2026-09-23",
  title: "eval-defect-bench",
  dek: "A held-out benchmark for a class of silent-verdict-degradation bugs, plus 3 detection baselines (AST, local LLM consensus, frontier judge) that all failed a pre-registered viability gate.",
  depth: "short",
  problem: [
    "An agent-evaluation framework can fail silently: a bug in the scoring path doesn't crash, it just quietly returns a plausible-looking verdict that's wrong, the kind of defect nobody notices because nothing about the failure looks like a failure. This benchmark exists to test whether that specific class of bug (\"silent verdict degradation\") is even detectable by tooling that could plausibly run in CI, before anyone builds a detector and assumes it works.",
    "The benchmark itself is the honest part: 30 real, merged bug-fix commits from google/adk-python's own evaluation module, paired with 30 verified-untouched controls, frozen and scored blind.",
  ],
  approach: [
    "Three independent detection approaches were built and run against the frozen 60-record benchmark: a hand-built AST scanner (5 pattern detectors), a local three-model Ollama consensus (llama3.1:8b, gemma2:9b, qwen2.5:7b, majority vote), and a single frontier-model judge scoring an isolated function body blind. Two pass/fail gates were pre-registered before the frontier-judge run: a mechanism-naming gate (EXACT localization at least 40% AND adjudicated false-positive rate at most 20%) and a looser triage gate (balanced accuracy at least 70% AND adjudicated FPR at most 15%).",
    "None of the three detectors passed either gate. That's the headline result, not a footnote, the repository exists to make the negative result, and the benchmark that produced it, reusable by the next attempt instead of something that has to be rediscovered from scratch.",
  ],
  results: [
    {
      label: "Detectors that passed the pre-registered viability gate",
      value: "0 / 3",
      detail:
        "mechanism-naming gate (EXACT localization at least 40% AND adjudicated FPR at most 20%) and triage gate (balanced accuracy at least 70% AND adjudicated FPR at most 15%), both pre-registered before the frontier-judge run. Neither was cleared by any baseline",
      sourceRef: "eval-defect-bench:gate",
    },
    {
      label: "AST scanner (5 hand-built pattern detectors)",
      value: "0% recall on 30 held-out positives, never run against the control set",
      detail:
        "its 75% recall on the 4 examples it was hand-built from is not a valid generalization comparison",
      sourceRef: "eval-defect-bench:ast",
      format: "prose",
    },
    {
      label: "Local LLM consensus (llama3.1:8b + gemma2:9b + qwen2.5:7b, majority vote)",
      value: "53.3% recall, 36.7% adjudicated FPR, 58.3% balanced accuracy, d-prime 0.42",
      sourceRef: "eval-defect-bench:llm-consensus",
      format: "prose",
    },
    {
      label: "Frontier single judge (blind, isolated function body)",
      value: "13.3% recall, 6.7% adjudicated FPR, 53.3% balanced accuracy, d-prime 0.39",
      detail:
        "raw numbers (13.3% recall, 10.0% raw FPR, 51.7% balanced accuracy, d-prime 0.17) independently reproduced by transforming the frontier judge's own answers into scripts/score.py's documented input format and re-running it",
      sourceRef: "eval-defect-bench:frontier-judge",
      format: "prose",
    },
    {
      label: "In-class taxonomy coverage (silent verdict degradation, the benchmark's actual target class)",
      value: "15 / 30 (50%)",
      detail:
        "across 3 primary shapes (silent accumulation loss, value not consulted, boundary strips attached data), each cross-referenced against real external google/adk-python PRs/issues; one of those, keras#23420, is a merged, contested, evidence-defended fix in a major framework, landed 2026-09-15",
      sourceRef: "eval-defect-bench:taxonomy",
    },
  ],
  closing: [
    "If you're evaluating whether an off-the-shelf or lightly-built detector can catch this class of bug before it ships, this is the reusable ruler: a frozen 60-record benchmark, a standalone scoring script, and three honestly-reported failed attempts to save the next one from repeating them.",
  ],
  links: [{ label: "Source on GitHub", href: "https://github.com/gaurav-gandhi-2411/eval-defect-bench" }],
};
