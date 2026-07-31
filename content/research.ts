import type { ResearchPaper } from "./types";

/** Mirrors products.ts's liveProductCount — one source of truth for the hero stat. */
export function researchPaperCount(list: ResearchPaper[]): number {
  return list.length;
}

export const researchPapers: ResearchPaper[] = [
  {
    title:
      "Tool-Description Quality Is Not One Axis: A Regime Analysis of Where It Helps and Where It Backfires",
    abstract:
      "Tool-description quality is widely treated as a broadly-applicable lever for agent tool-use, but it is not a single better/worse axis: the precision that helps an agent disambiguate within a family of confusable tools is orthogonal to, or actively harmful for, context-rich selection and for tool retrieval. We test this with a single frozen evaluation protocol — one classifier, one judge, one generator family, pre-registered thresholds — across a synthetic confusable-catalog experiment, two real production MCP-server mirrors (GitHub, AWS IAM), a synthetic internal-proxy catalog, and a pre-registered pilot of ten public Python MCP servers.",
    // Verbatim first sentence of the abstract above (wave 6: displayed in place
    // of the full block — same words, subset, provenance unchanged).
    abstractExcerpt:
      "Tool-description quality is widely treated as a broadly-applicable lever for agent tool-use, but it is not a single better/worse axis: the precision that helps an agent disambiguate within a family of confusable tools is orthogonal to, or actively harmful for, context-rich selection and for tool retrieval.",
    repoUrl: "https://github.com/gaurav-gandhi-2411/agentgauge",
    status: "preprint-pending",
    sourceRef: "agentgauge:paper-md",
  },
  {
    title:
      "Powering Agent Evaluations: Variance Structure, Measurement Artifacts, and Minimum Detectable Effects in Tool-Use Benchmarks",
    abstract:
      "Agent evaluations are routinely reported without a power analysis, without a stated detection floor, and without screening for measurement artifacts. This paper measures the variance structure of agent task outcomes on a 253-task, 3-model tool-use corpus (intraclass correlation 0.793 within tool-set/task; 56.1% of outcome variance is between-task), shows the direct consequence for experimental design (repeated trials on the same task carry little independent information), and gives a paired, common-random-numbers, task-clustered-bootstrap, CUPED, sequential-testing estimator that reaches a minimum detectable effect of 0.0537 at n=253 tasks (from an uncorrected-baseline MDE of 0.433 at n=20). We catalogue ten measurement-artifact classes discovered during this project, each with an automated detector shipped in `agentgauge audit`, including two cases where an artifact produced a false positive the authors initially believed: a −76.7 to −80.0 percentage-point causal effect that a scoring bug corrected to a near-null, and a 100% top-1 localization-accuracy claim that a probe-noise miscalibration corrected to 58.33%.",
    abstractExcerpt:
      "Agent evaluations are routinely reported without a power analysis, without a stated detection floor, and without screening for measurement artifacts.",
    repoUrl: "https://github.com/gaurav-gandhi-2411/agentgauge",
    status: "preprint-pending",
    sourceRef: "agentgauge:paper2",
  },
];
