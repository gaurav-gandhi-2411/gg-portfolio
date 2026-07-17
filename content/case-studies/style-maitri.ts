import type { CaseStudy } from "../types";

// Sources: agentic-shopping-assistant repo (README.md, src/catalogue/normalizer.py,
// reports/router_comparison.md, reports/model_eval_20260712T091248Z.md,
// reports/soldout_filter_fix_2026-07-12.txt, docs/architecture/adr/0005-flywheel-ranking-blend.md,
// reports/deep_diagnosis_2026-07-12.md) — see provenance.md's Style Maitri section.
export const styleMaitri: CaseStudy = {
  slug: "style-maitri",
  title: "Style Maitri",
  dek: "A white-label AI shopping assistant for Indian fashion brands — and the adversarial audit that caught it lying to a bride.",
  depth: "full",
  problem: [
    "Indian D2C fashion brands want a conversational shopping assistant — something a shopper can chat with the way they'd ask a helpful store clerk — but grounded in their own real catalogue: their actual prices, sizes, and stock, never invented ones. Style Maitri is built white-label so any brand can run it: one Docker container (a packaged, portable copy of the whole app) plus one YAML config file (a small settings file) per brand.",
      "It's been demoed across 8 real Indian fashion catalogues — H&M, Myntra, Flipkart, Snitch, Powerlook, Fashor, Virgio, plus a sample store — roughly 52,500 items in total. The core promise is that it can't hallucinate: it should never quote a price or describe a fabric that isn't actually in the catalogue it's serving.",
  ],
  approach: [
    "A shopper's message enters a LangGraph agent loop (a graph-shaped state machine that lets an LLM take one step at a time — pick a tool, act, decide the next step) with six tools: search, compare, filter, outfit-bundle, clarify, and respond. An LLM router (Groq's llama-3.1-8b-instant) reads the message and classifies intent to pick which tool runs next. Because an LLM's judgment can drift or loop, a plain code-level guard sits underneath it and forces a deterministic next step after search or compare complete — the agent physically cannot wander in circles forever.",
    "Once a tool decides it needs product data, retrieval runs as a hybrid: a dense FAISS embedding search (turns text into vectors and finds nearby meanings) running alongside a BM25 keyword search (classic exact-term matching), and the two ranked lists are merged with Reciprocal Rank Fusion — a simple, well-understood formula for combining two rankings without needing either one to \"win.\"",
    "Before anything is shown to the shopper, every generated response is checked against the items that were actually retrieved and stripped of any claim that isn't backed by real catalogue data. The same Docker image serves every brand; only the YAML config changes, which is what makes the white-label promise real rather than aspirational.",
  ],
  architecture: {
    intro:
      "One conversational loop, backed by a retrieval layer that runs two search strategies at once and a grounding check that runs after generation, not instead of it.",
    stages: [
      {
        label: "Shopper message",
        kind: "input",
        detail: "WebSocket /chat/stream or REST, via a Next.js 15 frontend",
      },
      {
        label: "FastAPI backend",
        detail: "Supabase RS256 JWT auth, Postgres-backed session store",
      },
      {
        label: "LangGraph router",
        detail:
          "Groq llama-3.1-8b-instant classifies intent; a code-level guard forces deterministic transitions after search/compare",
      },
      {
        label: "Tool node",
        detail: "search · compare · filter · outfit-bundle · clarify · respond",
      },
      {
        label: "Hybrid retrieval",
        detail: "fused via Reciprocal Rank Fusion (k=60)",
        parallel: [
          { label: "FAISS dense search", detail: "IndexFlatIP, all-MiniLM-L6-v2, 384-dim" },
          { label: "BM25 keyword search", detail: "BM25Okapi, exact-term matching" },
        ],
      },
      {
        label: "Groq response generation + grounding check",
        detail: "strips any claim not backed by an actually-retrieved item",
      },
      {
        label: "Reply to shopper",
        kind: "output",
        detail: "6-turn Postgres-backed conversation memory carries context forward",
      },
    ],
    note: "Same Docker image serves every brand; only a per-brand YAML config changes. Deploy: Docker → Cloud Run (API), Vercel (frontend).",
  },
  decisions: [
    {
      title: "Fuse two retrieval methods instead of picking one",
      body: "A shopper might type a vague vibe (\"something for a summer wedding\") or an exact keyword (a color, a brand name, a price). Pure embedding search is good at the first and weak at the second; pure keyword search is the opposite. Running FAISS (dense) and BM25 (sparse) in parallel and fusing their rankings gets both kinds of query right instead of trading one off for the other.",
      sourceRef: "style-maitri:hybrid-retrieval",
    },
    {
      title: "A rule-based normalizer, not an LLM, to unify garment names",
      body: "Eight catalogues describe the same kind of item eight different ways — \"kurta\", \"kurti\", \"tunic top\" might all mean the same thing to a shopper. Instead of asking an LLM to guess a mapping every time, a deterministic keyword/rule engine resolves every product title into one canonical taxonomy. It imports nothing from the LLM stack at all, which makes it auditable, free to run, and impossible to get inconsistent answers from on the same input twice.",
      sourceRef: "style-maitri:garment-normalizer",
    },
    {
      title: "An LLM router with a code guard, not a faster classifier cascade",
      body: "An explicit experiment compared three routing designs: a pure LLM router (100% task-pass rate, ~2,100ms median latency, ~$0.10 per 1,000 queries), a pure DistilBERT classifier (75% pass rate, ~31ms, $0), and a cascade of the two (94% pass rate, adjusted). Production kept the pure-LLM router, backstopped by the deterministic code guard that caps how many times the loop can iterate — correctness for the shopper mattered more than the cascade's latency and cost advantage.",
      sourceRef: "style-maitri:router-decision",
    },
    {
      title: "A transparent formula for outfit-ranking boosts, not a black-box model",
      body: "When the assistant suggests an outfit pairing, its coherence score gets boosted by real conversion signals (did shoppers actually like this pairing) through an explicit formula: final_score = coherence × (1 + 0.25 × positive_rate), gated so it only kicks in once at least 10 real signals exist (avoiding the cold-start problem of trusting noise). A brand's team can read that formula and know exactly why a pairing ranked where it did — a learned collaborative-filtering model couldn't offer that.",
      sourceRef: "style-maitri:flywheel-ranking",
    },
  ],
  results: [
    {
      label: "Intent-parsing accuracy (all fields exact)",
      value: "93.8% (n=211)",
      detail: "100% on well-formed queries, 61% on the adversarial subset",
      sourceRef: "style-maitri:intent-accuracy",
    },
    {
      label: "Cross-store catalogue",
      value: "52,494 items across 8 stores",
      sourceRef: "style-maitri:catalogue-size",
    },
    {
      label: "Retrieval precision@5",
      value: "96–99% on occasion/search queries",
      detail: "drops to 67% on adversarial queries (n=92)",
      sourceRef: "style-maitri:retrieval-eval",
    },
    {
      label: "Adversarial live-site audit",
      value: "15 of 32 skeptical-shopper queries judged disappointing",
      detail:
        "6 subagents role-playing wedding shoppers on the live production site found 2 trust-destroying bugs no offline eval had caught",
      sourceRef: "style-maitri:live-audit",
    },
  ],
  story: {
    title: "Trusting gold-set numbers wasn't enough, so 6 agents role-played skeptical shoppers on the live site",
    body: [
      "The offline evals looked healthy: 93.8% intent accuracy, 96–99% retrieval precision on normal queries. But those numbers only measure what the eval set happens to ask. To find out what a real, skeptical shopper would experience, 6 independent agents were sent to drive the actual live production site as wedding shoppers would — 32 messy, realistic queries, judged honestly rather than graded against a rubric written in advance.",
      "15 of the 32 responses were judged disappointing, and two were worse than disappointing: a body-shape styling feature fabricated a confident claim about someone's body from a photo that had no person in it at all, and a bridal search ranked children's clothing above adult items in the results.",
      "The most interesting finding was a consistency bug, not an accuracy bug. When the outfit-board tool can't find matching footwear, its code path correctly tells the shopper \"we don't have footwear that matches.\" But the plain-search path handling the exact same missing-inventory situation invents a plausible-sounding recommendation instead — \"pairs well with delicate ankle-strap sandals\" — when zero footwear items exist anywhere in the result. Two code paths, same underlying case, one honest and one confabulating. No offline metric was ever going to surface that, because the eval set doesn't know to compare one tool's honesty against another's. Only driving the live product like a real, skeptical user found it.",
    ],
    sourceRef: "style-maitri:live-audit",
  },
  links: [
    { label: "Try Style Maitri", href: "https://stylemaitri.vercel.app" },
    {
      label: "Source on GitHub",
      href: "https://github.com/gaurav-gandhi-2411/agentic-shopping-assistant",
    },
  ],
};
