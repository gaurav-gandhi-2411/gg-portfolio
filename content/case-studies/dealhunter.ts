import type { CaseStudy } from "../types";

// Sources: agentic-travel-booking-system repo (README.md, docs/architecture/adr/0005,
// 0006, 0016, 0023, 0024-production-frontend-alignment.md, AUDIT_REPORT.md,
// CURRENT_STATE.md, spec.md, apps/api/docs/evals/baselines/README.md) — see
// provenance.md's DealHunter section.
export const dealhunter: CaseStudy = {
  slug: "dealhunter",
  title: "DealHunter",
  dek: "A flight-search agent that turns a plain-English trip request into two honestly-explained trade-offs, and the two-week silent outage that taught it to watch itself.",
  depth: "full",
  problem: [
    "Flight search sites usually dump a wall of prices sorted one way, and leave you to manually weigh cost against convenience — is the cheaper flight worth a 6am departure and a layover? DealHunter answers that question directly: you type a request like \"Delhi to Dubai in June,\" and instead of forty rows to compare, it hands back a small, explained set of trade-offs.",
    "It's also a cost case study in its own right: the whole agentic search pipeline — language understanding, search, and ranking — runs on free-tier LLM infrastructure, which forces every design decision to account for what happens when a provider's free quota runs out mid-request.",
  ],
  approach: [
    "A search starts as a POST request carrying a free-text trip description. A PlannerAgent — an LLM call — reads it and extracts a structured \"travel intent\" (origin, destination, date range, traveler count, preferences) from what was plain prose.",
    "From there, a deterministic (non-LLM, rule-based) WindowSearcher explores candidate date windows within a hard budget on how many provider calls it's allowed to make, querying flight and hotel adapters — either the live Aviasales API or a synthetic provider used for testing and cost control.",
    "An OptimizerAgent — another LLM call — takes the resulting candidates and computes a 2D Pareto frontier: a small set of options where none dominates the others (one is cheaper, one is more comfortable, and neither is simply worse than the other on both axes). It returns exactly two \"archetypes\" with a plain-language explanation of the trade-off, streamed to the browser as they're ready. If you ask a follow-up question, a ConversationManagerAgent re-scores the already-cached candidates instead of re-running the whole search.",
  ],
  architecture: {
    intro:
      "A planning agent turns language into structure, a deterministic budgeted searcher does the expensive exploring, and a second agent compresses the results into two honest choices.",
    stages: [
      { label: "Trip request", kind: "input", detail: "free-text, e.g. \"Delhi to Dubai in June\"" },
      {
        label: "Cloud Run (FastAPI)",
        detail: "request-ID, auth, LLM-routing-profile middleware",
      },
      {
        label: "PlannerAgent",
        detail: "LLM — extracts a structured travel intent from free text",
      },
      {
        label: "WindowSearcher",
        detail: "deterministic, call-budgeted — explores date windows, no LLM",
      },
      {
        label: "Provider search",
        parallel: [
          { label: "FlightHunterAgent", detail: "Aviasales API or synthetic provider" },
          { label: "HotelHunterAgent", detail: "Aviasales API or synthetic provider" },
        ],
      },
      {
        label: "OptimizerAgent",
        detail: "LLM — Pareto frontier → exactly 2 explained archetypes",
      },
      {
        label: "SSE stream to browser",
        kind: "output",
        detail: "results appear as they're ready; follow-ups re-score cached candidates",
      },
    ],
    note: "Cross-cutting: multi-provider LLM routing (Anthropic Haiku, Groq, OpenRouter, NVIDIA NIM, Ollama), an Upstash Redis cache with a 30-minute TTL, and Langfuse/structlog/Prometheus/Sentry observability.",
  },
  decisions: [
    {
      title: "A deterministic searcher, not another LLM agent, does the exploring",
      body: "The WindowSearcher that walks candidate date windows is plain rule-based code, not an LLM call. That makes it fully testable and lets it enforce a hard budget on provider API calls — a guarantee an LLM agent, which can't be relied on to count precisely, can't give.",
      sourceRef: "dealhunter:window-searcher",
    },
    {
      title: "Exactly two Pareto archetypes, not a ranked list",
      body: "Rather than ranking every candidate, the OptimizerAgent computes a Pareto frontier (the set of options where none is strictly better than another on every axis) and reports exactly two: one weighted toward value, one toward experience. That's a mathematical guarantee the two options are genuinely different trade-offs, not near-duplicates — and it's small enough to honestly explain in plain language.",
      sourceRef: "dealhunter:pareto-archetypes",
    },
    {
      title: "LLM-judge evals: one judge, cross-family, median of three",
      body: "To score whether the OptimizerAgent's explanations are actually coherent, the eval harness uses a single LLM judge from a different model family than the agent being judged, and takes the median of three judge calls per case — reducing both self-preference bias and single-call noise.",
      sourceRef: "dealhunter:llm-judge",
    },
    {
      title: "A fallback chain across five LLM providers, built after outages, not in anticipation of them",
      body: "The multi-provider routing (Anthropic, Groq, OpenRouter, NVIDIA NIM, Ollama) exists because Groq's free-tier daily quota was repeatedly exhausted in production, not as a theoretical resilience exercise. The fallback chain was added after the outages, which is the more honest order.",
      sourceRef: "dealhunter:multi-provider",
    },
  ],
  results: [
    {
      label: "Test suite",
      value: "597 tests, ≥87.65% coverage",
      detail: "579 passed, 3 skipped, 15 blocked by the Docker test environment (pre-existing)",
      sourceRef: "dealhunter:test-coverage",
    },
    {
      label: "Planner baseline — correct archetype selection",
      value: "31/31 (100%)",
      sourceRef: "dealhunter:planner-baseline",
    },
    {
      label: "Optimizer baseline — completion and judged coherence",
      value: "demo-haiku: 24/24, coherence 5.0/5 · demo-llama: 21/24, coherence 4.881",
      detail: "the llama run's lower completion count is free-tier quota exhaustion, not a quality failure",
      sourceRef: "dealhunter:optimizer-baseline",
    },
    {
      label: "Early self-audit score",
      value: "6/10 on prototype-to-production readiness",
      detail: "the honest starting point the project then spent several phases closing",
      sourceRef: "dealhunter:audit",
    },
  ],
  story: {
    title: "Production was silently broken for two weeks — and two unrelated bugs were hiding behind each other",
    body: [
      "The Cloud Run backend was frozen at a stale image tag, missing three phases of work that had merged since. That alone would have been visible eventually, but it was compounded by a second, independent bug on the Vercel frontend: some required environment variables were set to an empty string rather than left unset.",
      "The frontend's fallback logic used the nullish-coalescing operator (`??`), which only kicks in for `null` or `undefined` — not for an empty string, which JavaScript treats as a perfectly valid, present value. So the app quietly sent requests with blank fields instead of falling back to a default or failing loudly, and every real search since launch had failed silently before it ever reached the backend.",
      "The fix was process, not just code: a two-gate canary/soak deploy sequence (a new deploy first serves a small slice of traffic and has to stay healthy before it gets the rest) plus a staleness cron job that alerts if the running image tag falls behind main. The lesson generalizes past this one bug — a fallback operator is not a substitute for validating that a value is actually meaningful, not just technically present.",
    ],
    sourceRef: "dealhunter:silent-outage",
  },
  links: [
    { label: "Try DealHunter", href: "https://agentic-travel-booking-system.vercel.app" },
    {
      label: "Source on GitHub",
      href: "https://github.com/gaurav-gandhi-2411/agentic-travel-booking-system",
    },
  ],
};
