import type { CaseStudy } from "../types";

// Sources: agentgauge repo @ 939abbf (2026-07-25) — README.md (v2 rebuild
// narrative + measured-metrics tables), reports/predictive_validity_study.md,
// reports/v2_2_optimal_allocation.md, reports/v2_4_task1_blast_radius_audit.md,
// docs/paper/paper.md — see provenance.md's AgentGauge wave-13 section.
// Rewritten wave 13: the v1 "8 scoring dimensions" framing went stale when
// the repo's own predictive-validity study falsified the 8-axis score.
export const agentgauge: CaseStudy = {
  slug: "agentgauge",
  title: "AgentGauge",
  dek: "A statistical harness that measures whether a change to an MCP server's tool descriptions actually changed agent task success — rebuilt after a predictive-validity study falsified its own first version, then audited again after catching its own scoring bug.",
  depth: "full",
  problem: [
    "MCP (Model Context Protocol) servers expose tools to AI agents through nothing but text — a name, a short description, a parameter schema. When an agent picks the wrong tool or calls the right one incorrectly, the usual advice is \"improve your tool descriptions.\" But almost nobody measures whether a description change actually moved agent success, so teams polish text on faith.",
    "AgentGauge v1 tried the obvious thing: a Lighthouse-style quality score, with an LLM judge rating every description across 8 dimensions. Then I ran a predictive-validity study on my own metric — and it failed. None of the 8 axes predicted real agent task success by a margin that survived multiple-comparison correction and controlling for description length. A score that doesn't predict the outcome it claims to measure is decoration, so v1 was retired and the project rebuilt around the two things the study showed actually work: a deterministic defect linter, and a statistical harness that measures task-success change directly.",
  ],
  approach: [
    "The primary interface is `agentgauge diff`: you give it two versions of your server's tool descriptions (before and after a change), and it runs a real agent through a pool of gold-constraint tasks against each version, then reports whether task success genuinely improved, regressed, or the experiment wasn't sensitive enough to say — an explicit INSUFFICIENT_SENSITIVITY verdict rather than a confident-sounding guess.",
    "Getting that verdict to be trustworthy was most of the work. Trial-level repeats of the same task turned out to carry almost no independent information (intra-class correlation 0.793), so the harness pairs tasks across arms, clusters errors at the task level, applies variance reduction (CUPED), and allocates one trial per task across many tasks instead of many trials on few tasks. At 100 tasks per arm it can detect an 8.5-percentage-point effect at 80% power — under the 10-point ship target the project set for itself before tuning began.",
    "The linter (`agentgauge lint`) is deliberately the secondary utility, and its severity tiers are earned, not asserted: each rule's effect on task success was measured by injecting that defect and running real agents. The one BLOCKING rule (a type/enum contradiction between description and schema) causes a 13.3–28.9-point drop in task success across three model families. Rules whose measured effect was a clean null are labeled INFO or ADVISORY — demoted in public, with the null published.",
  ],
  architecture: {
    intro:
      "An A/B measurement pipeline: two description sets, one shared task pool, paired agent trials, a cluster-aware estimator, and a pre-report audit gate that can block a result from being called a measurement.",
    stages: [
      {
        label: "Two tool-description sets",
        kind: "input",
        detail: "baseline vs. candidate — the change you want to measure",
      },
      {
        label: "Gold-constraint task pool",
        detail: "253 tasks across 10 real-API domains (GitHub, Stripe, Kubernetes, …)",
      },
      {
        label: "Paired agent trials",
        detail: "1 trial per task, 100 tasks/arm — the allocation the ICC finding dictated",
      },
      {
        label: "Clustered estimator",
        detail: "task-level pairing + CUPED variance reduction, few-cluster corrections",
      },
      {
        label: "Audit gate",
        detail: "leakage / ceiling / degenerate-metric / scoring-consistency checks — fails closed",
      },
      {
        label: "Verdict",
        kind: "output",
        detail: "improved / regressed / INSUFFICIENT_SENSITIVITY, with confidence interval",
      },
    ],
    note: "The research layer alongside the CLI runs under a frozen, pre-registered protocol and produced the tool-description paper (docs/paper/paper.md + LaTeX PDF).",
  },
  decisions: [
    {
      title: "Falsify your own metric before anyone else has to",
      body: "The predictive-validity study that killed v1's 8-axis score was run on purpose, on my own headline feature, before promoting it further. It's the project's founding decision: a metric that can't predict the outcome it claims to measure gets retired, publicly, and the study that killed it ships in the repo.",
      sourceRef: "agentgauge:predictive-validity",
    },
    {
      title: "Reallocate trials to tasks — the statistics dictated the design",
      body: "v2.1 found repeat trials of the same task nearly duplicate each other (ICC 0.793), which made the initial minimum-detectable-effect estimate wildly optimistic. The fix came from the finding itself: spend the same budget on more tasks at one trial each. That single reallocation moved the detectable effect from 18.8 points to 8.5 — under the ship target, with no new compute.",
      sourceRef: "agentgauge:icc-mde",
    },
    {
      title: "Severity tiers track measured causal impact, not plausibility",
      body: "Every lint rule's tier reflects what defect injection actually measured. A rule with perfect precision but zero measured effect on task success sits at INFO, published as a null — because a linter that cries BLOCKING on cosmetic issues teaches people to ignore it.",
      sourceRef: "agentgauge:retiering",
    },
    {
      title: "A standing audit gate wired into the pipeline, not a one-time cleanup",
      body: "After the v2.3 scoring-artifact incident (below), the checks that caught it — task/answer leakage, ceiling effects, degenerate metrics, scoring-reference consistency — became `agentgauge audit`, run automatically before any diff/eval result is reported. A failing check blocks the number from being presented as a measurement.",
      sourceRef: "agentgauge:audit-gate",
    },
  ],
  results: [
    {
      label: "The founding null: v1's 8-axis LLM-judged score vs. real task success",
      value: "No axis survived correction",
      detail: "none of the 8 axes predicted agent task success after multiple-comparison correction and length control — the study that triggered the v2 rebuild",
      sourceRef: "agentgauge:predictive-validity",
    },
    {
      label: "Minimum detectable effect at 100 tasks/arm, 80% power",
      value: "8.5pp — ship target met",
      detail: "target was detecting a 10-point regression; reached via pairing, task-clustering, CUPED, and the ICC-driven trial reallocation",
      sourceRef: "agentgauge:icc-mde",
    },
    {
      label: "Does a BLOCKING description defect actually cause task failure?",
      value: "Yes: −13.3 to −28.9pp",
      detail: "previously assumed, now measured — confidence interval excludes zero in all three model families tested",
      sourceRef: "agentgauge:blocking-causal",
    },
    {
      label: "False-alarm rate under the null",
      value: "<5% in every cluster-count stratum",
      detail: "and the harness abstains (INSUFFICIENT_SENSITIVITY) on 21.6% of null runs rather than over-claiming",
      sourceRef: "agentgauge:false-alarm",
    },
    {
      label: "The obvious alternative, measured: a single-prompt LLM judge",
      value: "97.1% false-alarm rate",
      detail: "a degenerate always-flag baseline — spot-checked to confirm genuine model hallucination, not a scoring bug",
      sourceRef: "agentgauge:judge-baseline",
    },
  ],
  story: {
    title: "Caught its own reported −80-point effect as a scoring bug, corrected it to a clean null, and turned the catch into a standing audit gate",
    body: [
      "v2.2 reported that an ADVISORY-tier defect — renaming a parameter so the description no longer matches the schema — caused a 76.7 to 80.0-percentage-point drop in agent task success. That's an enormous effect, and enormous effects deserve suspicion, so v2.3 audited it before trusting it.",
      "The audit found the checker was looking up the pre-rename parameter name against post-rename arguments — scoring correct agent responses as failures. Corrected, the effect is a clean null in all three models: the agents were mostly coping with the rename fine, and the harness had been failing them on a technicality. v2.4 then audited the blast radius: only this one defect class was ever affected (confirmed from source — the other four injection classes never rename a schema key), and the corpus behind the headline calibration numbers was never touched by the bug.",
      "The lasting fix wasn't the correction, it was the institution: the class of check that caught it became `agentgauge audit`, a standing gate that runs before any result is reported. The incident is documented in the repo's own reports rather than silently patched — the same rule this portfolio runs on.",
    ],
    sourceRef: "agentgauge:v23-scoring-artifact",
  },
  closing: [
    "If you're building any kind of LLM-judge or agent-eval harness, this is the standing lesson: an enormous effect size deserves suspicion before belief, and the audit that catches a scoring bug should become a permanent gate on every future result, not a one-time fix.",
  ],
  links: [{ label: "Source on GitHub", href: "https://github.com/gaurav-gandhi-2411/agentgauge" }],
};
