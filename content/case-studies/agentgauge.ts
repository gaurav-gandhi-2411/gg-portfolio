import type { CaseStudy } from "../types";

// Sources: agentgauge repo @ ab62677 (2026-07-31, v0.5.2) — reports/predictive_validity_study.md,
// reports/v2_1_estimator_rebuild.md, reports/v2_5_task3_mde_completion.md,
// reports/v2_variance_structure.md, reports/v0_5_wave1_report.md, reports/v2_product_readiness.md,
// reports/v0_4_0_effect_size_reconciliation.md, reports/v2_3_task1_advisory_audit.md,
// reports/v0_5_mde_discrepancy.md, reports/v0_5_probe_power_fix.md,
// docs/paper2/provenance.md (34-claim ledger + supersession chains) — see provenance.md's
// AgentGauge wave-17 section.
// Rewritten wave 17: wave 13's rewrite reflected the repo @ 939abbf (2026-07-25); the estimator
// and attribution work that followed (v0.5.x) is a second falsification-and-pivot the page hadn't
// caught up to — the MDE moved from 8.5pp to 0.0537 (5.37pp), and a second feature (regression
// attribution) was built, measured, and killed by the same pre-registered-decision-rule discipline
// as the original v1 score.
export const agentgauge: CaseStudy = {
  slug: "agentgauge",
  verifiedAt: "2026-07-31", // wave 19 -- last re-checked against source this session
  title: "AgentGauge",
  dek: "A statistical harness that measures whether a change to an MCP server's tool descriptions actually moved real agent task success, built after three separately pre-registered hypotheses were tested and killed by their own decision rules, including the project's own founding commercial thesis.",
  depth: "full",
  problem: [
    "MCP (Model Context Protocol) servers expose tools to AI agents through nothing but text, a name, a short description, a parameter schema. When an agent picks the wrong tool or calls the right one incorrectly, the usual advice is \"improve your tool descriptions.\" Almost nobody measures whether a description change actually moves agent success, so teams polish text on faith.",
    "AgentGauge v1 tried the obvious product: a Lighthouse-style quality score, an LLM judge rating every description across 8 dimensions, meant to ship as a CI gate. Before promoting it further, a predictive-validity study was run on it, with a decision rule (CONFIRM / PIVOT / FALSIFY) written down before any data was collected. It failed by that rule: controlling for description length, the composite score's correlation with real task success drops to partial ρ=0.262 (p=0.089, not significant even uncorrected). A free len() heuristic is statistically indistinguishable from eight LLM-judged axes. The score was retired, publicly, and the project rebuilt around the one thing the study showed actually works: a statistical harness that measures task-success change directly, with a stated detection floor.",
  ],
  approach: [
    "The primary interface is agentgauge diff: give it two versions of your server's tool descriptions, and it runs a real agent through a pool of 253 gold-constraint tasks against each version, then reports whether task success genuinely improved, regressed, or the experiment wasn't sensitive enough to say, an explicit INSUFFICIENT_SENSITIVITY verdict rather than a confident-sounding guess.",
    "Getting that verdict trustworthy was most of the work, and it happened in two rounds. Repeated trials of the same task turned out to carry almost no independent information (intraclass correlation 0.793, repeats mostly duplicate each other), so the harness pairs tasks across arms with common random numbers, clusters errors at the task level, and applies CUPED variance reduction. Reallocating the same compute from many trials on few tasks to one trial across the full 253-task corpus took the minimum detectable effect from 0.433 (an uncorrected trial-level baseline) to 0.0537, see the curve below for what each change contributed.",
    "The linter (agentgauge lint) is deliberately the secondary utility, and its severity tiers are earned, not asserted: each rule's effect on task success was measured by injecting that defect and running real agents. Of 6 lint rules tested, exactly 1, a type/enum contradiction between description and schema, shows a confidence interval excluding zero (−13.3 to −28.9 percentage points across three model families). The other 5 are demoted to INFO/ADVISORY on a measured null, not a guess.",
    "A third feature, automated regression *attribution* (which of N changed tools caused a measured regression), was built and benchmarked the same way, and killed the same way. Localization accuracy only clears its own 70% ship bar with enough probe tasks that the probing itself costs more than just re-running the full 253-task evaluation. It ships in v0.5.2, disabled, behind an --experimental flag.",
  ],
  architecture: {
    intro:
      "An A/B measurement pipeline: two description sets, one shared task pool, paired agent trials, a cluster-aware estimator, and a pre-report audit gate that can block a result from being called a measurement.",
    stages: [
      {
        label: "Two tool-description sets",
        kind: "input",
        detail: "baseline vs. candidate, the change you want to measure",
      },
      {
        label: "Gold-constraint task pool",
        detail: "253 tasks across 10 real-API domains (GitHub, Stripe, Kubernetes, …)",
      },
      {
        label: "Paired agent trials",
        detail: "1 trial per task, common random numbers, across the full corpus",
      },
      {
        label: "Clustered estimator",
        detail: "task-level pairing + CUPED variance reduction, few-cluster corrections",
      },
      {
        label: "Audit gate",
        detail: "leakage / ceiling / degenerate-metric / probe-variance checks, fails closed",
      },
      {
        label: "Verdict",
        kind: "output",
        detail: "improved / regressed / INSUFFICIENT_SENSITIVITY, with confidence interval",
      },
    ],
    note: "The research layer alongside the CLI runs under a frozen, pre-registered protocol and produced two papers: docs/paper/paper.md (tool-description quality) and docs/paper2/main.tex (the measurement methodology below).",
  },
  decisions: [
    {
      title: "Falsify your own metric before anyone else has to",
      body: "The predictive-validity study that killed v1's 8-axis score was run on purpose, on the project's own headline feature, before promoting it further. It's the founding decision: a metric that can't beat a free length heuristic once you control for length gets retired, publicly, and the study that killed it ships in the repo.",
      sourceRef: "agentgauge:predictive-validity",
    },
    {
      title: "A second pre-registered hypothesis, falsified the same way",
      body: "The leading explanation for why LLM-rewritten descriptions score higher while real success stayed flat or dropped, that the rewrite \"homogenizes\" descriptions, reducing discriminability, was itself pre-registered with four falsifiers before testing. The two central ones triggered outright: measured inter-tool similarity decreased, not increased, in 6 of 7 pairs, and the correlation between similarity change and outcome pointed the opposite sign from the hypothesis's prediction; the other two triggered partially. Verdict: falsified as stated, the mechanism, not just the metric.",
      sourceRef: "agentgauge:homogenization-falsified",
    },
    {
      title: "Reallocate trials to tasks, the statistics dictated the design",
      body: "ICC 0.793 meant repeated trials of the same task were nearly duplicating each other, which made the first detectable-effect estimate wildly optimistic. The fix came from the finding itself: spend the same budget on more tasks at one trial each, then keep scaling the task pool. That reallocation, plus pairing and CUPED, moved the detectable effect from 43.3 to 5.37 percentage points, no new compute, just spending the existing budget where the variance actually was.",
      sourceRef: "agentgauge:mde-curve",
    },
    {
      title: "A third pre-registered bar, and a third kill: attribution wasn't shipped",
      body: "Regression attribution, pointing at which of N changed tools caused a measured regression, instead of re-testing everything, was built and benchmarked against a 70% top-1 accuracy ship bar. It clears that bar only at effect sizes above the harness's own detection floor; in the below-floor band where attribution would actually be useful, it manages 58.33%. Worse, the accuracy it does reach requires enough probe tasks that the probing costs 1.01x to 20.24x a full re-evaluation, the accuracy a localizer needs is exactly the task volume a localizer exists to avoid paying for. Shipped disabled behind an --experimental flag, with the cost numbers printed in its own help text.",
      sourceRef: "agentgauge:attribution-kill",
    },
    {
      title: "Severity tiers track what defect injection actually did, not what sounds bad",
      body: "Every lint rule's tier reflects what defect injection actually measured. A rule with perfect precision but zero measured effect on task success sits at INFO, published as a null, a linter that cries BLOCKING on cosmetic issues teaches people to ignore it.",
      sourceRef: "agentgauge:retiering",
    },
    {
      title: "A standing audit gate wired into the pipeline, not a one-time cleanup",
      body: "After catching its own reported −80pp effect as a scoring bug, and later its own reported 100% attribution accuracy as a probe-noise miscalibration, the checks that caught both became agentgauge audit, run automatically before any diff/eval/attribute result is reported. A failing check blocks the number from being presented as a measurement.",
      sourceRef: "agentgauge:audit-gate",
    },
  ],
  diagram: {
    title: "The detection floor, across three estimator changes",
    unit: "MDE, percentage points",
    points: [
      { label: "Naive, trial-level (n=20)", value: 43.3 },
      { label: "+ Paired design + CUPED (n=20)", value: 18.8 },
      { label: "+ Reallocated to 253 tasks", value: 5.37 },
    ],
    caption:
      "Minimum detectable effect at 80% power, n=20 unless noted. Step 1→2: pairing tasks across arms with common random numbers, plus CUPED variance reduction, on the same 20-task allocation. Step 2→3: the ICC finding (repeated trials carry almost no independent information) dictated reallocating the same measurement budget from trials-per-task to the full 253-task corpus, one trial each, with task-clustered bootstrap confidence intervals.",
    sourceRef: "agentgauge:mde-curve",
  },
  results: [
    {
      label: "The founding null: does an 8-axis LLM-judged score predict real task success?",
      value: "No, falsified by its own pre-registered rule",
      detail: "partial ρ=0.262, p=0.089 (not significant, uncorrected) once description length is controlled for, no axis beats a free len() heuristic after correction",
      sourceRef: "agentgauge:predictive-validity",
      format: "prose",
    },
    {
      label: "Minimum detectable effect, full 253-task corpus, 80% power",
      value: "0.0537",
      detail: "5.37 percentage points, down from an uncorrected trial-level baseline of 0.433 (43.3pp)",
      sourceRef: "agentgauge:mde-curve",
    },
    {
      label: "False-alarm rate under the null",
      value: "0.59%",
      detail: "13 of 2,200 null comparisons, paired + CUPED estimator",
      sourceRef: "agentgauge:mde-curve",
    },
    {
      label: "The obvious alternative, tested: a single-prompt LLM judge",
      value: "97.1% false-alarm at 100% recall",
      detail: "a degenerate always-flag detector, on a 174-tool stratified sample",
      sourceRef: "agentgauge:judge-baseline",
    },
    {
      // Split into one row per model family on 2026-08-13. The single row it
      // replaces showed "−13.3 to −28.9pp" against one sourceRef, but that
      // range spans three separate table rows in the source, so no reader
      // following the citation could reach the line behind any one number.
      //
      // The range is also easy to misread. Pairing it with "CI excludes zero"
      // invited reading it as a confidence interval; it is the observed
      // SPREAD of point estimates across three families. Each family has its
      // own CI, and each of those excludes zero — a different, stronger
      // claim, now stated separately from the spread.
      label: "Does a BLOCKING description defect actually cause task failure? (qwen2.5:7b)",
      value: "−13.3pp",
      detail:
        "the smallest of three per-family effects; the spread across families runs to −28.9pp, and each family's own CI excludes zero, the only 1 of 6 lint rules with a measured causal effect",
      sourceRef: "agentgauge:blocking-causal-qwen2.5",
    },
    {
      label: "Same defect, gemma2:9b",
      value: "−25.2pp",
      detail: "same audit, same rebuilt instance; CI excludes zero",
      sourceRef: "agentgauge:blocking-causal-gemma2",
    },
    {
      label: "Same defect, llama3.1:8b",
      value: "−28.9pp",
      detail: "the largest of the three per-family effects; CI excludes zero",
      sourceRef: "agentgauge:blocking-causal-llama3.1",
    },
    {
      label: "Cassette-replay determinism",
      value: "100%",
      detail: "across all 6 model-provider adapters, seed 42, zero live network calls",
      sourceRef: "agentgauge:replay-determinism",
    },
    {
      label: "Regression attribution: cheaper than re-testing everything?",
      value: "No, killed by its own 70% ship bar",
      detail: "58.33% top-1 at the below-detection-floor band; shipped disabled behind --experimental",
      sourceRef: "agentgauge:attribution-kill",
      format: "prose",
    },
    {
      label: "Measurement artifacts found during this project",
      value: "10",
      detail: "each now an automated detector — including the two below, catalogued in the methods paper as its core contribution",
      sourceRef: "agentgauge:artifact-taxonomy",
    },
  ],
  story: {
    title: "Two of its own inflated numbers, caught before they shipped",
    body: [
      "v2.2 reported that an ADVISORY-tier defect, renaming a parameter so the description no longer matches the schema, caused a 76.7 to 80.0-percentage-point drop in agent task success. That's an enormous effect, and enormous effects deserve suspicion before belief, so v2.3 audited it. The checker was looking up the pre-rename parameter name against post-rename arguments, scoring correct agent responses as failures. Corrected, the effect is a clean null for gemma2:9b (+0.0pp) and a confidence interval that includes zero for the other two models (llama3.1:8b −13.3pp, qwen2.5:7b +6.7pp): the agents were mostly coping with the rename fine, and the harness had been failing them on a technicality. A blast-radius audit then confirmed the bug was scoped to this one defect class alone, and that the 5,535-trial calibration corpus behind every other headline number was never touched by it.",
      {
        text: "A second, structurally similar catch happened during the attribution work. greedy_bisection, a strategy for localizing which changed tool caused a regression, was first reported at 100% top-1 accuracy across every tested effect size and candidate-set size, a suspiciously clean number for a hard detection problem. An audit of the synthetic probe-noise model used to simulate measurement uncertainty found it had omitted the between-task variance component entirely, inflating detection power by 3 to 7 times relative to a properly calibrated reference. Corrected, accuracy at the effect sizes where attribution would actually matter, below the harness's own detection floor, is 58.33% top-1, and the finding flips: accuracy *degrades* with candidate-set size (93%→80%→73%→47% as the number of changed tools grows 4→10→20→40), not improves, as the original, uncorrected number had suggested.",
        // This paragraph's own finding (the corrected attribution accuracy)
        // is what agentgauge:attribution-kill actually cites — the story's
        // default sourceRef only covers the first catch (the ADVISORY
        // scoring-artifact audit), which never mentions 58.33%.
        sourceRef: "agentgauge:attribution-kill",
      },
      "Both catches came from the same discipline: an enormous or suspiciously clean effect gets audited before it's trusted, not published on faith. That discipline is now a standing gate, agentgauge audit, that runs automatically before any diff, eval, or attribution result can be reported, and both incidents are documented in the repo's own reports rather than silently patched, per the same rule this portfolio runs on.",
    ],
    sourceRef: "agentgauge:v23-scoring-artifact",
  },
  closing: [
    "The buyer this is built for: a platform team running many internal MCP servers, where agent reliability is production-critical and \"we changed the docs, it feels fine\" isn't a real answer. The value claim is a stated detection floor with a stated false-alarm rate, deterministically reproducible, not a quality score, because the quality score didn't survive its own test.",
    "The most commercially credible thing on this page is what didn't ship: an 8-axis LLM-judged quality score that turned out to be indistinguishable from counting characters, and a regression-attribution feature that is real, benchmarked, and uneconomical against just re-running the full evaluation. Both are documented here instead of quietly dropped, because a falsification that survives its own pre-registered rule is a result, not a setback, and shipping the harness that can produce that result, honestly, is the actual product.",
  ],
  links: [
    { label: "Install from PyPI", href: "https://pypi.org/project/agentgauge-harness/" },
    { label: "Source on GitHub", href: "https://github.com/gaurav-gandhi-2411/agentgauge" },
  ],
};
