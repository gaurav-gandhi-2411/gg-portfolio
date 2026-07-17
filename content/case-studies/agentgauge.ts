import type { CaseStudy } from "../types";

// Sources: agentgauge repo (README.md, docs/research/frozen_protocol.md,
// docs/paper/paper.md) — see provenance.md's AgentGauge section.
export const agentgauge: CaseStudy = {
  slug: "agentgauge",
  title: "AgentGauge",
  dek: "Lighthouse, but for MCP interfaces — a pilot-scale research artifact (synthetic fixtures, two real-server mirrors, a 10-server pilot) for scoring whether an AI agent can actually use a given tool server, not a validated product claim.",
  depth: "full",
  problem: [
    "MCP (Model Context Protocol) servers expose tools to AI agents through nothing but text descriptions — a name, a short blurb, a parameter schema. Agents frequently pick the wrong tool or call the right one incorrectly, and it's often not because the server's code is broken; it's because the interface handed to the agent is ambiguous, underspecified, or looks like three other tools. AgentGauge scores how well an agent can actually use a given MCP server, the way a Lighthouse report scores a web page, so a server author can find agent-usability problems before shipping.",
    "It's also the benchmark behind a first-author research paper on tool-description quality — but the repo is explicit about its own limits: this is a pilot-scale research artifact, built on synthetic fixtures, two real-server mirrors, and a 10-server pilot sample. It is not a validated product claim, and the results below are reported with that scope attached rather than rounded up.",
  ],
  approach: [
    "Running `agentgauge scan <target>` connects to an MCP server over stdio (a subprocess) or HTTP/SSE, introspects every tool it exposes, and runs two kinds of analysis in parallel: static analysis checks schema completeness (are parameters typed, required fields marked, examples present), while an LLM-as-judge rates description quality — is it clear what this tool does and when to use it, versus a neighboring tool that sounds similar.",
    "AgentGauge then generates realistic tasks for the server and runs a real agent through N trials, measuring tool-selection accuracy (did it pick the right tool) and call correctness (did it fill in the arguments correctly). The test-agent LLM is pluggable behind a Provider protocol (a defined interface any model can implement), and every test in the repository runs against a deterministic MockProvider — a stand-in that returns fixed, scripted responses instead of calling a real model — so the test suite costs nothing and needs no network access.",
    "Underneath the CLI sits a research program: every experiment behind the paper runs under one frozen, pre-registered protocol — one fixed judge model, one fixed task generator, thresholds decided before the results were seen, and independence enforced between the model that judges, the model that generates tasks, and the model that acts as the agent.",
  ],
  architecture: {
    intro:
      "A scan pipeline that runs static and LLM-based analysis in parallel, then hands off to a live agent trial — with a separate, protocol-frozen research layer alongside it for the paper's experiments.",
    stages: [
      { label: "MCP server under test", kind: "input", detail: "stdio subprocess or HTTP/SSE" },
      { label: "CLI", detail: "scan / try / fix / ci" },
      { label: "MCP client introspection", detail: "enumerates every tool the server exposes" },
      {
        label: "Analysis",
        parallel: [
          { label: "Static analysis", detail: "schema completeness" },
          { label: "LLM-as-judge", detail: "description quality, discoverability" },
          { label: "Agent runner", detail: "N trials → tool-selection accuracy, call correctness" },
        ],
      },
      {
        label: "Weighted report + fix list",
        kind: "output",
        detail: "Rich text or JSON, prioritized by impact",
      },
    ],
    note: "Research layer alongside the CLI: a frozen protocol config feeds fixed experiment scripts over hash-verified fixtures, producing the paper (docs/paper/paper.md + LaTeX PDF).",
  },
  decisions: [
    {
      title: "Frozen, pre-registered evaluation protocol",
      body: "Every paper experiment runs under one judge model (llama3.1:8b, fixed seed 42), a task generator that's always a different model family from the judge, and thresholds decided before any results existed. Null results are reported first-class rather than filtered out. That structure exists specifically to prevent tuning the pipeline until it finds a positive result and calling that the finding.",
      sourceRef: "agentgauge:frozen-protocol",
    },
    {
      title: "A Provider protocol with a deterministic MockProvider as the CI default",
      body: "The agent that gets tested is model-agnostic behind a Provider interface, but the test suite never calls a real model — it runs against a MockProvider that returns fixed, scripted outputs. That keeps CI free of network calls, API cost, and credentials, while still exercising the full scan pipeline.",
      sourceRef: "agentgauge:mock-provider",
    },
    {
      title: "Regime-bounded framing instead of a blanket \"improve your descriptions\" claim",
      body: "The paper's own evidence shows the effect of better tool descriptions is real but narrow, and in some cases actively harmful when applied outside the conditions where it helps. Rather than ship a general \"better descriptions always help\" claim, the practical takeaway is a two-condition test: does the agent actually fail on this tool set, and does an oracle (best-case) description recover that failure? Only then is a description rewrite likely to pay off.",
      sourceRef: "agentgauge:regime-framing",
    },
    {
      title: "Human-reviewed draft PRs for anything touching the judge, scorer, or rubric",
      body: "Nothing in the research program auto-merges a change to the judge model, the scoring logic, or the rubric — every such change goes through a human-reviewed draft PR. That protects an artifact whose headline findings are largely nulls: it would be easy, and wrong, to let an automated change quietly nudge the numbers toward a more flattering story.",
      sourceRef: "agentgauge:governance",
    },
  ],
  results: [
    {
      label: "Scoring dimensions implemented",
      value: "8 of 8, 87% test coverage across 41 tests",
      sourceRef: "agentgauge:scoring-dimensions",
    },
    {
      label: "Synthetic catalog: oracle vs. empty tool descriptions",
      value: "+34.5pp tool-selection accuracy (62.9% → 97.4%, p<0.0001)",
      detail: "holds on a stronger agent too (Llama-3.3-70B: +40.8pp, 59.2% → 100.0%) — explicitly not apples-to-apples across harnesses",
      sourceRef: "agentgauge:t18",
    },
    {
      label: "The honest headline: real-world prevalence",
      value: "0 of 9 real public MCP servers showed the in-regime effect",
      detail: "pre-registered N=10 pilot on real public Python MCP servers with a testable confusable tool family — the dramatic synthetic-catalog effect mostly didn't appear in the wild",
      sourceRef: "agentgauge:prevalence-null",
    },
    {
      label: "Localizer precision, reported honestly as a failure",
      value: "recall 1.00, precision 0.167",
      detail: "under two independent framings — the tool that finds *which* description is the problem is not yet precise enough to trust unsupervised",
      sourceRef: "agentgauge:localizer",
    },
  ],
  story: {
    title: "The seed bug that reversed two findings",
    body: [
      "An early experiment run accidentally passed one fixed random seed to all 5 nominal trials for a server, instead of varying it per trial — which meant the run sampled effectively zero real variance across trials. That run reported two servers as showing the in-regime effect, with gains of +50 and +25 percentage points.",
      "Fixing the seeding and re-running the same experiment reversed both findings. Neither server actually showed the effect once real trial-to-trial variance was restored.",
      "The paper reports the episode directly rather than quietly fixing the numbers and moving on, and then makes the harder point explicit: this particular mechanism — a surprising, too-good result triggering a recheck — catches false positives, but it has no equivalent for false negatives. A bug that silently suppresses a real signal produces a null result that looks statistically identical to a correctly-measured null. That's stated as an explicit epistemic bound of the whole research program, not a solved problem.",
    ],
    sourceRef: "agentgauge:seed-bug",
  },
  links: [{ label: "Source on GitHub", href: "https://github.com/gaurav-gandhi-2411/agentgauge" }],
};
