import type { CaseStudy } from "../types";

// Sources: token-efficiency-scorer repo (README.md,
// research/05-architecture-pivot.md, CURRENT_STATE.md, pyproject.toml,
// provenance.md) — see provenance.md's tracegauge section.
export const tracegauge: CaseStudy = {
  slug: "tracegauge",
  title: "tracegauge",
  dek: "A local, three-axis scorer for whether a Claude Code session was token-efficient or wasteful — because \"this agent is efficient\" is usually a vibe, not a measurement.",
  depth: "full",
  problem: [
    "Developers using Claude Code (or similar coding agents) have no real visibility into whether a given session used tokens well or burned through them on repeated failed attempts, redundant reads, or a wandering plan. Efficiency claims about coding agents are almost always anecdotal — \"it felt fast\" or \"it felt wasteful\" — rather than measured against anything.",
    "tracegauge scores a finished session's token economy, trajectory quality (was the sequence of steps purposeful), and deterministic waste, and does it against the developer's own historical baseline rather than an arbitrary universal number — entirely locally, with no data leaving the machine unless the developer explicitly opts in.",
  ],
  approach: [
    "The CLI (`tes`) reads a Claude Code session's JSONL log from `~/.claude/projects`, redacts secrets at the moment of ingestion, and computes three independent axes rather than one combined score. Token economy compares the session's token usage against a p25–p75 band (the middle 50% of past sessions) built from the developer's own history for that same kind of task. Trajectory quality is rated by a local LLM judge running Qwen3-30B via Ollama (with an opt-in API path for judging), scoring whether each step in the session was purposeful. Deterministic waste is caught by two rule-based detectors — repeated-failed-retry and redundant-read — each of which attaches the specific turns that prove the finding, rather than asserting waste without evidence.",
    "There is deliberately no composite score: token economy, trajectory quality, and waste each carry their own caveats about where they're valid and where they're not, and collapsing them into one number would hide exactly the honesty that makes each axis useful on its own.",
    "A background watcher plus a dashboard that only listens on localhost automatically scores sessions as they finish, and the CLI also exposes `score`, `monitor`, `budget`, and `patterns` subcommands directly. Nothing phones home except two explicit, separately-consented opt-ins.",
  ],
  architecture: {
    intro:
      "A local ingestion and feature layer feeds three independently-computed axes — no composite score — into a local store, surfaced through a CLI and a localhost-only dashboard.",
    stages: [
      {
        label: "Claude Code session JSONL",
        kind: "input",
        detail: "~/.claude/projects",
      },
      {
        label: "adapt_session()",
        detail: "secret redaction at ingestion",
      },
      {
        label: "Deterministic feature layer",
        detail: "trace digest, task-type classification",
      },
      {
        label: "Three-axis scoring",
        parallel: [
          { label: "Self-baseline", detail: "p25–p75 band per task type, from own history" },
          { label: "Waste detectors", detail: "repeated-failed-retry, redundant-read → proof turns" },
          { label: "Trajectory judge", detail: "local Qwen3-30B via Ollama — non-Anthropic by design" },
        ],
      },
      {
        label: "3-axis result, no composite → SQLite (WAL)",
      },
      {
        label: "CLI + localhost-only dashboard",
        kind: "output",
        detail: "tes score/monitor/budget/patterns · tes serve on 127.0.0.1 · background watcher",
      },
    ],
  },
  decisions: [
    {
      title: "A reference-based, pointwise judge instead of a pairwise one",
      body: "Published evidence on LLM judges showed pairwise comparison (\"which of these two is better\") flips its verdict 35% of the time under small perturbations, versus 9% for pointwise judging (\"score this one against a fixed reference\") once a reference standard exists. That gap is large enough that it decided the architecture rather than being a footnote.",
      sourceRef: "tracegauge:pointwise-judge",
    },
    {
      title: "The heuristic-primary design was abandoned after it was actually tested",
      body: "Four candidate rule-based waste heuristics were built and checked for inter-annotator agreement — do independent raters applying the same rule agree with each other. Only one of the four cleared the 0.60 bar (it scored κ=0.825); the other three scored 0.15, 0.43, and 0.19. The failing three all needed cross-turn intent inference that no phrase-matching rule can capture, which is what forced the pivot to a hybrid architecture rather than a rewrite of the same rules.",
      sourceRef: "tracegauge:heuristic-pivot",
    },
    {
      title: "The trajectory judge is deliberately a different model family than the agent it judges",
      body: "The agent being measured is Claude; the judge runs on Qwen instead. That's a structural choice, not an accident — a judge from the same family as the thing it's scoring creates an obvious incentive for self-enhancement bias (a model rating its own family's outputs more favorably), so the judge is built to be structurally incapable of that.",
      sourceRef: "tracegauge:judge-independence",
    },
    {
      title: "No composite score, by design",
      body: "Three labeled signals with their own caveats are more honest and more useful than one number that hides which axis is weak. A single score invites treating a session as \"efficient\" or \"wasteful\" overall when in reality one axis might be strong and another might not apply cleanly to that kind of task at all.",
      sourceRef: "tracegauge:no-composite",
    },
    {
      title: "Local-by-default, enforced by construction",
      body: "The dashboard binds to localhost by construction, not by a settings toggle someone could leave misconfigured. Secrets are redacted at ingestion before anything is stored, and every network call the tool can make is a separate, explicit opt-in rather than a bundled default.",
      sourceRef: "tracegauge:local-first",
    },
  ],
  results: [
    {
      label: "Test suite",
      value: "601/601 passing",
      detail: "baselines built from 75 quality-gated sessions across 5 task types",
      sourceRef: "tracegauge:tests",
    },
    {
      label: "Judge validation against a reference LLM",
      value: "84% strict agreement, 96% top-2, Spearman ρ≈0.79",
      detail: "honest caveat: there are no human gold labels behind this — it's LLM-vs-LLM agreement, not ground truth",
      sourceRef: "tracegauge:judge-validation",
    },
    {
      label: "Generalization: 172 developers, 1,053 real sessions",
      value: "repeated-failed-retry rate ~1.4% in the wild vs. 6.6% in the calibration pool",
      detail: "the calibration pool is honestly labeled a high-waste outlier, not a representative population",
      sourceRef: "tracegauge:generalization",
    },
    {
      label: "Distribution",
      value: "live on PyPI, v0.10.0",
      detail: "pip install tracegauge",
      sourceRef: "tracegauge:pypi",
    },
    {
      label: "Two features built and deliberately not shipped live",
      value: "community-corpus feature held dormant; habit-coach feature unshipped",
      detail: "\"a community corpus with zero contributors delivers no user value\"; habit-coach recommendations judged too thin at pre-publish review",
      sourceRef: "tracegauge:held-features",
    },
  ],
  story: {
    title: "The heuristic pivot: when three of four rules fail the same test",
    body: [
      "Four waste-detection heuristics were built, each with a written rubric, and tested the honest way: independent human annotators applied each rule and their agreement was measured with Cohen's kappa (a statistic for inter-rater agreement that corrects for chance). The bar was 0.60. Three of the four heuristics scored 0.15, 0.43, and 0.19 — well below it. One case was especially telling: a capable model applying one of the failing heuristics systematically over-fired it on 23% of turns, which ruled out \"the annotators are just being noisy\" as the explanation. The disagreement was conceptual, not statistical noise.",
      "The postmortem's conclusion was structural rather than incremental: these three concepts need cross-turn intent inference — understanding what a sequence of steps was trying to accomplish — that no phrase-matching rule can capture, no matter how the rubric is worded. As the postmortem put it, any further rubric patch \"reduces to 'the annotator decides per instance' — which is what κ=0.15 already measures.\" Patching the rubric a third time wouldn't have fixed anything; it would have just re-measured the same disagreement.",
      "That finding forced the full pivot away from a heuristic-primary design toward the three-layer hybrid that actually shipped: deterministic features for the things rules genuinely can catch, a reference-based LLM judge for the things that need judgment, and human-gold calibration to keep the judge honest.",
    ],
    sourceRef: "tracegauge:heuristic-pivot",
  },
  links: [
    { label: "Install from PyPI", href: "https://pypi.org/project/tracegauge/" },
    {
      label: "Source on GitHub",
      href: "https://github.com/gaurav-gandhi-2411/token-efficiency-scorer",
    },
  ],
};
