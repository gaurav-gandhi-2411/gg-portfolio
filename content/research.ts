import type { ResearchPaper } from "./types";

export const researchPapers: ResearchPaper[] = [
  {
    title:
      "Tool-Description Quality Is Not One Axis: A Regime Analysis of Where It Helps and Where It Backfires",
    abstract:
      "Tool-description quality is widely treated as a broadly-applicable lever for agent tool-use, but it is not a single better/worse axis: the precision that helps an agent disambiguate within a family of confusable tools is orthogonal to, or actively harmful for, context-rich selection and for tool retrieval. We test this with a single frozen evaluation protocol — one classifier, one judge, one generator family, pre-registered thresholds — across a synthetic confusable-catalog experiment, two real production MCP-server mirrors (GitHub, AWS IAM), a synthetic internal-proxy catalog, and a pre-registered pilot of ten public Python MCP servers.",
    repoUrl: "https://github.com/gaurav-gandhi-2411/agentgauge",
    status: "preprint-pending",
    sourceRef: "agentgauge:paper-md",
  },
];
