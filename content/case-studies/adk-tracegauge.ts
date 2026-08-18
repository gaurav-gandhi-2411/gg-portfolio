import type { CaseStudy } from "../types";

// Sources: adk-tracegauge repo (README.md, pyproject.toml,
// .github/workflows/ci.yml, docs/audit/Q1_WITHIN_CASE_CV.md,
// docs/audit/Q1A_RECONCILIATION.md, docs/audit/AC1_SKEW_SENSITIVITY.md) at
// commit 4c62769, plus the live PyPI JSON API for the published version and
// release count. See provenance.md's adk-tracegauge section.
//
// No version number is written down on this page, on purpose. The first
// draft carried "v0.4.1, eight releases", read live off the PyPI JSON API at
// 09:10 UTC. 0.5.0 published at 09:16 UTC, six minutes later, and the draft
// was stale before it was committed. tracegauge's own page had the same
// defect already, sitting at v0.10.0 while the registry served 0.12.0. So the
// version and the release count live only on the card, which fetches them at
// ISR time from the registry; a released package ships too often for a
// hand-written version to survive, and a number nobody can refresh is worse
// than no number.
export const adkTracegauge: CaseStudy = {
  slug: "adk-tracegauge",
  verifiedAt: "2026-08-18",
  title: "adk-tracegauge",
  dek: "A build gate for agents built on Google's Agent Development Kit: it fails the build when an agent starts costing more per run, and prints, every single run, the smallest rise it could actually have caught.",
  depth: "full",
  problem: [
    "An agent that costs a fraction of a cent per run is cheap right up until a prompt change quietly triples it. Nobody notices, because nothing in a normal test suite has an opinion about dollars. The bill arrives a month later and there is no way to point at the change that caused it.",
    "The obvious fix, a threshold on average cost, fails in a specific and expensive way. Agent costs bounce around from one run to the next, so a plain threshold either sits high enough to miss real increases or low enough to fire on ordinary noise. A gate that cries wolf gets switched off, and a gate that sleeps through the real thing was never a gate.",
    "adk-tracegauge is the version that survives contact with that noise. It records a cost distribution from a real eval run, compares a later run against it, and fails only when the increase is bigger than the run-to-run wobble and bigger than a size you said you cared about. Anyone can install it and point it at their own agent.",
  ],
  approach: [
    "Two commands do the work. adk-tracegauge snapshot runs your existing eval suite with a small plugin attached, capturing what every single invocation actually cost in dollars, and writes it to a file. adk-tracegauge check takes a baseline file and a current file and decides whether cost went up for real.",
    "The decision is a percentile bootstrap on the difference in mean cost: resample both runs ten thousand times, build a confidence interval around the difference, and only call it a regression when that interval excludes zero and the increase also clears a floor you configured, either a flat dollar amount or a percentage. Both conditions have to hold, because an increase can be reliably real and still be too small to care about.",
    "The gate then exits with a code a build system can act on: zero for pass, one for a regression, three for not enough data to say either way. That third one matters more than it looks. Refusing to answer is a different outcome from passing, and collapsing the two is how a cost gate ends up certifying a build it never actually examined.",
    "There is a second, smaller path for people already living inside adk eval: the package registers a real cost metric there too, so an eval run prints a dollar figure and a pass or fail per invocation. It is for watching costs while you iterate, not for gating a build, because ADK's own eval command returns success to the shell whether the metrics passed or failed.",
  ],
  architecture: {
    intro:
      "A plugin captures real per-invocation cost during an eval run you already have. Everything downstream works on that recorded distribution, so the gate never needs to call a model itself.",
    stages: [
      {
        label: "Your existing ADK eval run",
        kind: "input",
        detail: "AgentEvaluator or your own Runner harness",
      },
      {
        label: "TraceGaugeUsagePlugin",
        detail: "captures token usage per invocation, including delegated sub-agents",
      },
      {
        label: "In-house cost engine",
        detail: "vendor price table to dollars; unpriced or unresolved reports NOT_EVALUATED",
      },
      {
        label: "snapshot file",
        detail: "one cost record per invocation, plus per-agent split",
      },
      {
        label: "check: baseline vs current",
        parallel: [
          { label: "Paired when cases match", detail: "cancels case-to-case cost differences" },
          { label: "Two-sample otherwise", detail: "full distributions, never a mix of the two" },
          { label: "Achieved power", detail: "smallest rise this run could reliably catch" },
        ],
      },
      {
        label: "Exit code your CI can gate on",
        kind: "output",
        detail: "0 pass · 1 regression · 3 insufficient data",
      },
    ],
    note: "The mode and the key it paired on are printed on every run, never silently assumed.",
  },
  decisions: [
    {
      title: "Every run prints the smallest rise it could actually have caught",
      body: "A cost gate that only says pass or fail is telling you something it does not know. Whether it can see a 5% increase depends entirely on how much your own costs bounce around and how many cases you ran. So every check prints its own achievable floor for this run, computed from this run's spread and sample size, and warns you outright when the floor you configured sits below the floor the test can reach. That warning is the gate saying it cannot reliably catch what you asked it to catch, in your numbers, on your data.",
      sourceRef: "adk-tracegauge:achieved-power",
    },
    {
      title: "A published power figure was withdrawn rather than defended",
      body: "An earlier version of this package's own documentation carried a single headline number: 99.22% detection at thirty cases. An audit found that figure rested on one unexamined assumption about how much cost varies between runs, and that an equally plausible assumption put the same cell near 5%. Swapping one assumed number for another would have been no better, so the single figure came out and two labelled grids went in, one for each shape the noise can take, with a plain one-sentence test for working out which one describes your own eval set.",
      sourceRef: "adk-tracegauge:power-retraction",
    },
    {
      title: "The honest answer on a real workload is 28%, and it ships in the README",
      body: "Rather than leave the grids as theory, the same thirty-six-case eval set was run twice against a local model to get a real number for how much the same case's cost wobbles between runs. It came out at 0.157, which lands on the grid at roughly 28% power to catch a true 10% cost increase at the default minimum of thirty cases. That is nowhere near the 80% bar the project sets for calling anything reliable, and it is published in the README as the realistic case rather than buried. Large increases are still caught comfortably; small ones at small eval sets are a real blind spot, named as one.",
      sourceRef: "adk-tracegauge:real-cv",
    },
    {
      title: "A cost that could not be worked out reports NOT_EVALUATED, never a pass",
      body: "If usage was never captured, the model could not be resolved, or a token category has no price, the invocation reports that it could not be evaluated instead of quietly scoring zero and passing. Local models are the sharp case: Ollama's paid cloud product and a model running on your own machine arrive through the identical prefix, and nothing in the response distinguishes them, so a local-looking call reports NOT_EVALUATED with the exact remedy named until you explicitly assert that yours is the free one.",
      sourceRef: "adk-tracegauge:not-evaluated",
    },
    {
      title: "The dependency on its sibling package was removed once an audit priced it",
      body: "This started as a thin layer over tracegauge, my own session-scoring tool, reusing its cost engine. An audit of what was actually imported found about fifty-five lines of arithmetic and two internal data classes, and nothing at all from the parts that make tracegauge worth using. Carrying a whole package for fifty-five lines is a dependency that will eventually break a build for no benefit, so the arithmetic moved in-house and the dependency came out entirely.",
      sourceRef: "adk-tracegauge:dependency-drop",
    },
  ],
  results: [
    {
      label: "Time from a fresh install to a real verdict",
      value: "78.2s",
      detail: "a bundled demo agent with a cost regression injected, no API key and no network call",
      sourceRef: "adk-tracegauge:quickstart",
    },
    {
      label: "Distribution",
      value: "installable from PyPI",
      detail: "pip install adk-tracegauge; the project card carries the version and release count the registry is serving right now",
      sourceRef: "adk-tracegauge:pypi",
    },
    {
      label: "Power to catch a true 10% cost rise, on a real eval set",
      value: "28.45% at thirty cases, 32.25% at thirty-six",
      detail: "the honest number, well under the 80% bar; the package prints its own equivalent on every run",
      sourceRef: "adk-tracegauge:real-cv",
    },
    {
      label: "Power to catch a 25% rise, same eval set",
      value: "92.25% at thirty cases, 96.35% at thirty-six",
      detail: "big increases are caught comfortably; the weakness is small ones at small sample sizes",
      sourceRef: "adk-tracegauge:real-cv",
    },
    {
      label: "Supported Python versions, each on its own CI leg",
      value: "3.10 through 3.14",
      detail: "run against both google-adk releases the version range admits",
      sourceRef: "adk-tracegauge:python-matrix",
    },
  ],
  story: {
    title:
      "The headline number was mine, it was wrong, and replacing it with a better single number would have been the same mistake again",
    body: [
      "The package shipped with a claim I liked: 99.22% power to detect a 10% cost regression at thirty cases. It came from a real simulation, not from thin air. It ran thousands of trials. The arithmetic was fine.",
      "What it was not was universal. Detection power for this kind of test depends almost entirely on one thing the simulation had to assume: how much per-invocation cost varies. The generator behind that number assumed a low, fixed amount of wobble. An audit tried a different assumption, equally plausible and equally unmeasured, and the same cell came out near 5% instead of 99%. Two orders of magnitude apart, from a choice nobody had thought of as a choice.",
      "The tempting fix was to pick the better assumption and republish. That would have reproduced the original error exactly, one assumption swapped for another, with the same false air of settledness. Instead the single number came out and was replaced by power as a function of the variable that actually determines it, in two grids, because the noise itself has two genuinely different shapes: a fixed dollar amount per case, which fits an eval set of near-identical prompts, and noise that scales with each case's own cost, which fits an eval set spanning short questions and long generation.",
      {
        text: "Then came the part that made the retraction worth the trouble. A real eval set of thirty-six cases was run twice against a local model, giving a real figure for how much the same case's cost moves between runs: 0.157. On the grid that is about 28% power at thirty cases and 32% at thirty-six. Not 99%, and not the audit's 5% either, but firmly in the range where the gate cannot reliably see a 10% increase on an eval set of a realistic size.",
        sourceRef: "adk-tracegauge:real-cv",
      },
      "That number is now in the README, in the section a prospective user reads before installing. It would have been easy to leave the old figure up. Nothing external would have caught it, because the simulation behind it was real and the arithmetic was right. The thing that was wrong was the silence about what the number depended on, and silence is not something a test suite can fail.",
      "The lasting fix is not either grid. It is the line the gate now prints on every run: the smallest increase it could reliably catch, computed from your own data's spread and your own sample size, which needs no assumption about noise shape because it is derived from the noise you actually have.",
    ],
    sourceRef: "adk-tracegauge:power-retraction",
  },
  closing: [
    "If you run an agent in CI and have no idea what it costs per invocation, the cheapest useful step is to start recording the distribution now, before you need it. A baseline you did not take is the one thing you cannot go back and get.",
    "And if you already have a threshold on average cost, work out what size of increase it can actually catch given how much your costs vary. That number is usually much larger than the number people think they are guarding.",
  ],
  links: [
    { label: "Install from PyPI", href: "https://pypi.org/project/adk-tracegauge/" },
    {
      label: "Source on GitHub",
      href: "https://github.com/gaurav-gandhi-2411/adk-tracegauge",
    },
    {
      label: "Google's Agent Development Kit",
      href: "https://github.com/google/adk-python",
    },
  ],
};
