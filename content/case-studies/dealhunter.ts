import type { CaseStudy } from "../types";

// Sources: agentic-travel-booking-system repo (README.md, docs/architecture/adr/0005,
// 0006, 0016, 0023, 0024-production-frontend-alignment.md,
// CURRENT_STATE.md, spec.md, apps/api/docs/evals/baselines/README.md) — see
// provenance.md's DealHunter section. Test count refreshed wave 19 (2026-07-31,
// pytest --collect-only) — CURRENT_STATE.md's 597 is a frozen 2026-06-09 snapshot.
export const dealhunter: CaseStudy = {
  slug: "dealhunter",
  verifiedAt: "2026-10-10", // issue #123 -- re-checked against source 2026-10-10 (date bump only; no numbers or wording changed)
  title: "DealHunter",
  dek: "A flight-search agent that turns a plain-English trip request into two honestly-explained trade-offs, hardened by finding and closing a two-week silent production outage caused by two unrelated bugs hiding behind each other.",
  depth: "full",
  problem: [
    "Flight search sites usually dump a wall of prices sorted one way, and leave you to manually weigh cost against convenience, is the cheaper flight worth a 6am departure and a layover? DealHunter answers that question directly: you type a request like \"Delhi to Dubai in June,\" and instead of a long list of rows to compare, it hands back a small, explained set of trade-offs.",
    "It's also a cost case study in its own right: the whole agentic search pipeline, language understanding, search, and ranking, runs on free-tier LLM infrastructure, which forces every design decision to account for what happens when a provider's free quota runs out mid-request.",
  ],
  approach: [
    "A search starts as a POST request carrying a free-text trip description. A PlannerAgent, an LLM call, reads it and extracts a structured \"travel intent\" (origin, destination, date range, traveler count, preferences) from what was plain prose.",
    "From there, deterministic, rule-based (non-LLM) window generation explores candidate date windows, capped by a hard budget on how many provider calls it's allowed to make, querying flight adapters, either the live Aviasales API or a synthetic provider used for testing and cost control.",
    "An OptimizerAgent takes the resulting candidates and computes a 2D Pareto frontier in plain code: a small set of options where none dominates the others (one is cheaper, one is more comfortable, and neither is simply worse than the other on both axes). It returns exactly two \"archetypes\" and uses an LLM call to write a plain-language explanation of the trade-off, streamed to the browser as they're ready. If you ask a follow-up question, a ConversationManagerAgent classifies it: a refinement re-scores the already-cached candidates without a new search, while a changed trip re-runs the flight search.",
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
        detail: "LLM, extracts a structured travel intent from free text",
      },
      {
        label: "Window generation",
        detail: "deterministic, call-budgeted, explores date windows, no LLM",
      },
      { label: "FlightHunterAgent", detail: "Aviasales API or synthetic provider" },
      {
        label: "OptimizerAgent",
        detail: "deterministic Pareto frontier → 2 archetypes, LLM-explained",
      },
      {
        label: "SSE stream to browser",
        kind: "output",
        detail: "results appear as they're ready; refinements re-score cached candidates",
      },
    ],
    note: "Cross-cutting: multi-provider LLM routing (Anthropic Haiku, Groq, OpenRouter, NVIDIA NIM, Ollama), an Upstash Redis cache with a 30-minute TTL, and Langfuse/structlog/Sentry observability.",
  },
  decisions: [
    {
      title: "A deterministic searcher, not another LLM agent, does the exploring",
      body: "The window generation that walks candidate date windows is plain rule-based code, not an LLM call. That makes it fully testable and lets it enforce a hard budget on provider API calls, a guarantee an LLM agent, which can't be relied on to count precisely, can't give.",
      sourceRef: "dealhunter:window-searcher",
    },
    {
      title: "Exactly two Pareto archetypes, not a ranked list",
      body: "Rather than ranking every candidate, the OptimizerAgent computes a Pareto frontier (the set of options where none is strictly better than another on every axis) and reports exactly two: one weighted toward value, one toward experience. Two options are small enough to honestly explain in plain language.",
      sourceRef: "dealhunter:pareto-archetypes",
    },
    {
      title: "LLM-judge evals: one judge, median of three",
      body: "To score whether the OptimizerAgent's explanations are actually coherent, the eval harness uses a single LLM judge and takes the median of three judge calls per case, reducing single-call noise. The 2026-05-17 baselines used a cross-family judge, Qwen3-32B judging Haiku and Llama, to reduce self-preference bias. Since Groq's 2026-08-16 deprecations the default judge and the production model share a family, flagged as unresolved in the upstream routing config.",
      sourceRef: "dealhunter:llm-judge",
    },
    {
      title: "A two-hop production fallback chain (Groq → OpenRouter), built after outages, not in anticipation of them",
      body: "The live-traffic fallback chain is two hops: Groq's openai/gpt-oss-120b (Groq deprecated llama-3.3-70b-versatile on 2026-08-16; the upstream config switched on 2026-08-22), falling back to OpenRouter's free Gemma tier if Groq's quota is exhausted. Six provider adapters exist in the codebase in total, Anthropic and NVIDIA NIM for eval use, Ollama for local dev, vLLM for self-hosting, but only the Groq→OpenRouter pair carries production requests; NIM was tried as a fourth demo profile and dropped. The fallback chain itself was added after Groq's free-tier daily quota repeatedly blocked eval runs and demo prep, and would hard-fail live searches with a 429, not as a theoretical resilience exercise, the more honest order.",
      sourceRef: "dealhunter:multi-provider",
    },
  ],
  results: [
    {
      label: "Test suite",
      value: "Deterministic replay suite, per-run cost accounting",
      detail: "no committed, current whole-repo test count exists to cite, the live count has moved with no matching committed artifact at the new figure, so this page states what's actually verifiable instead of a number",
      sourceRef: "dealhunter:ci-gates",
      format: "prose",
    },
    {
      label: "Archetype selection baseline (deterministic, no LLM)",
      value: "31/31 (100%)",
      sourceRef: "dealhunter:planner-baseline",
    },
    {
      label: "Optimizer baseline, completion and judged coherence",
      value: "demo-haiku: 24/24, coherence 5.0/5 · demo-llama: 21/24, coherence 4.881",
      detail: "the llama run's lower completion count is free-tier quota exhaustion, not a quality failure",
      sourceRef: "dealhunter:optimizer-baseline",
      format: "prose",
    },
  ],
  story: {
    title: "Found two unrelated bugs hiding behind each other after two weeks of silent production failure",
    body: [
      "The Cloud Run backend was frozen at a stale image tag, missing three phases of work that had merged since. That alone would have been visible eventually, but it was compounded by a second, independent bug on the Vercel frontend: some required environment variables were set to an empty string rather than left unset.",
      "The frontend's fallback logic used the nullish-coalescing operator, written as two question marks, which only kicks in for null or undefined, not for an empty string, which JavaScript treats as a perfectly valid, present value. So every call was made against a blank base URL and died with a URL parse error, instead of falling back to a default or failing loudly, and every real search since launch had failed silently before it ever reached the backend.",
      "The fix was process, not just code: a two-gate canary/soak deploy sequence (a new deploy first serves a small slice of traffic and has to stay healthy before it gets the rest) plus a staleness cron job that alerts if the running image tag falls behind main. The lesson generalizes past this one bug, a fallback operator is not a substitute for validating that a value is actually meaningful, not just technically present.",
    ],
    sourceRef: "dealhunter:silent-outage",
  },
  closing: [
    "If you're running an agentic pipeline on free-tier or multi-provider LLM infrastructure, this is the failure mode worth guarding against: two independent bugs can silently compound, and a fallback operator is not the same as validating that a value is actually meaningful, a canary/soak deploy and a staleness check catch what a single build-passing check won't.",
  ],
  links: [
    { label: "Try DealHunter", href: "https://gaurav-gandhi.vercel.app/warmup/dealhunter" },
    {
      label: "Source on GitHub",
      href: "https://github.com/gaurav-gandhi-2411/agentic-travel-booking-system",
    },
  ],
};
