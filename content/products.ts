import { refreshableMetric } from "@/lib/metrics";
import type { Product } from "./types";

/**
 * "Live" = has a public liveUrl or a published PyPI package — matches
 * content/provenance.md's `derived:products-live-count` definition exactly.
 * Repo-only entries (e.g. ShelfSense) still get a card but don't count here.
 * Single source of truth so the hero stat can never silently drift from the
 * actual product list (see components/sections/hero.tsx).
 */
export function liveProductCount(list: Product[]): number {
  return list.filter((p) => Boolean(p.liveUrl) || Boolean(p.pypi)).length;
}

/**
 * Wave 13 — the flagship/secondary tiering is retired; every project gets
 * the same card treatment and a full case study. Order = AI/ML depth,
 * scored on four axes (model & representation work · evaluation rigor ·
 * applied-AI system depth · novel technique), most applied-AI-heavy
 * first — the full scoring table lives in
 * reports/wave13-autonomy-density-2026-07-25.md. Metric values come from
 * content/metrics.json (the machine-refreshable store) via
 * refreshableMetric(); labels/values are never hand-typed here.
 */
export const products: Product[] = [
  {
    slug: "triageiq",
    name: "TriageIQ",
    tagline:
      "Reads a new GitHub issue and tells you which component it belongs to, which already-solved issues look like it, and roughly how long it will take to close.",
    liveUrl: "https://triage-iq-orcin.vercel.app/",
    repoUrl: "https://github.com/gaurav-gandhi-2411/triage-iq",
    categories: ["llm-agents", "retrieval", "forecasting", "evals-research"],
    techChips: ["TF-IDF", "BGE + FAISS", "LightGBM", "Groq"],
    // The kubernetes figure, not vscode's higher 89.8% — the card shows one
    // number and this is the lower of the two, which is the right default for
    // a site whose whole claim is that its numbers are the honest ones.
    metric: refreshableMetric("triageiq:classifier-top3-k8s"),
    figure: {
      kind: "bars",
      rows: [
        { name: "k8s", pct: 87.1 },
        { name: "vscode", pct: 89.8 },
      ],
    },
  },
  {
    slug: "warmer",
    name: "Warmer",
    tagline:
      "A word game you play once a day, where your only clue is how close each guess comes in meaning to the secret word.",
    liveUrl: "https://playwarmer.vercel.app/",
    // Repo (mindmeld) is private — no public repo link until that changes. See provenance.md.
    categories: ["retrieval", "evals-research"],
    techChips: ["Flutter", "sentence-transformers", "Firebase"],
    metric: refreshableMetric("warmer:hinglish-fix"),
    figure: { kind: "dumbbell", from: -0.003, to: 0.813, scaleNote: "0–1 scale" },
  },
  {
    slug: "multimodal-fashion-recommender",
    name: "Multimodal Fashion Recommender",
    tagline:
      "Recommends clothing from a photo of an outfit or a sentence describing one, and finds the same things either way.",
    liveUrl: "https://huggingface.co/spaces/gauravgandhi2411/multimodal-fashion-recommender",
    repoUrl: "https://github.com/gaurav-gandhi-2411/multimodal-fashion-recommender",
    categories: ["vision", "retrieval"],
    techChips: ["CLIP", "SBERT", "InfoNCE", "PyTorch"],
    metric: refreshableMetric("mmfr:recall10"),
  },
  {
    slug: "style-maitri",
    name: "Style Maitri",
    tagline:
      "An AI shopping assistant for Indian weddings that searches eight store catalogues at once and will not invent a price or a size to make the sale.",
    // Backend (asa-stylist-api) runs min-instances=0 with no keep-warm traffic
    // and a measured cold start of 60s+ (see content/warmup.ts) — routed
    // through the warming bridge instead of straight to the frontend.
    liveUrl: "https://gaurav-gandhi.vercel.app/warmup/style-maitri",
    repoUrl: "https://github.com/gaurav-gandhi-2411/agentic-shopping-assistant",
    categories: ["llm-agents", "retrieval", "vision"],
    techChips: ["LangGraph", "FAISS + BM25", "CLIP", "Groq"],
    metric: refreshableMetric("style-maitri:intent-accuracy"),
    figure: { kind: "bar", pct: 93.8, valueText: "93.8% (n=211)" },
    secondaryMetric: refreshableMetric("style-maitri:catalogue-size"),
  },
  {
    slug: "shelfsense",
    name: "ShelfSense",
    tagline:
      "Forecasts retail demand a week out across all 30,490 Walmart product and store lines, so a buyer knows what to order.",
    repoUrl: "https://github.com/gaurav-gandhi-2411/shelfsense-m5",
    categories: ["forecasting", "evals-research"],
    techChips: ["LightGBM", "Dagster", "M5 dataset"],
    metric: refreshableMetric("shelfsense:wrmsse"),
    figure: { kind: "dumbbell", from: 0.8956, to: 0.5693, scaleNote: "WRMSSE, lower is better" },
  },
  {
    slug: "aetherart",
    name: "AetherArt",
    tagline:
      "Turns a prompt or a photo into a Japanese woodblock print, on a LoRA I fine-tuned to hold that style.",
    // GPU-backed (L4), min-instances=0 — a bare min-instances=1 would run
    // ~$759/mo (see content/warmup.ts). Routed through the warming bridge
    // instead of the raw Cloud Run URL; also drops the GCP project number
    // that URL leaks.
    liveUrl: "https://gaurav-gandhi.vercel.app/warmup/aetherart",
    repoUrl: "https://github.com/gaurav-gandhi-2411/AetherArt",
    categories: ["vision", "evals-research"],
    techChips: ["SDXL LoRA", "ControlNet", "Cloud Run"],
    metric: refreshableMetric("aetherart:vram"),
  },
  {
    slug: "agentgauge",
    name: "AgentGauge",
    tagline:
      "Answers whether rewriting an AI agent's tool descriptions actually made it better at its job, with an A/B harness for MCP servers. The research behind my tool-description paper.",
    repoUrl: "https://github.com/gaurav-gandhi-2411/agentgauge",
    categories: ["evals-research", "llm-agents", "tooling"],
    techChips: ["MCP", "Causal measurement", "Python"],
    // Wave 13: the previous "8 scoring dimensions" claim went stale — the
    // repo's own predictive-validity study falsified the v1 8-axis score
    // and the project rebuilt around a statistical harness. Caught by this
    // wave's metrics-manifest verification pass (see provenance.md).
    // The qwen2.5 figure — the SMALLEST of the three per-family effects, not
    // the headline −28.9pp. The card shows one number, and the conservative
    // one is the right default: the claim is "this defect measurably causes
    // failure", and the weakest effect that still excludes zero is the
    // strongest form of that claim.
    metric: refreshableMetric("agentgauge:blocking-causal-qwen2.5"),
    // Wave 17: live on PyPI as of v0.5.2 — confirmed via `pip index versions
    // agentgauge-harness` (2026-07-31), see provenance.md.
    pypi: {
      packageName: "agentgauge-harness",
      installCommand: "pip install agentgauge-harness",
      badgeUrl: "https://img.shields.io/pypi/v/agentgauge-harness.svg",
    },
  },
  {
    slug: "reclaim",
    name: "Reclaim",
    tagline:
      "Cleans up disk space on Windows and shows you exactly what it will remove before it removes anything, so a safe cleanup stays safe.",
    liveUrl: "https://github.com/gaurav-gandhi-2411/reclaim/releases/latest",
    repoUrl: "https://github.com/gaurav-gandhi-2411/reclaim",
    categories: ["tooling", "vision", "retrieval"],
    techChips: ["SafetyValidator", "OpenCLIP", "pHash + MinHash", "LightGBM"],
    metric: refreshableMetric("reclaim:honesty-arc"),
  },
  {
    slug: "reviewiq",
    name: "Samidha Reviews",
    tagline:
      "Turns a pile of customer reviews in English, Hindi and Hinglish into what people actually keep saying, and flags the ones that look fake.",
    // Bare API root 404s (no handler); /docs is the live, browsable Swagger UI.
    liveUrl: "https://api.samidhareviews.xyz/docs",
    repoUrl: "https://github.com/gaurav-gandhi-2411/review-iq",
    categories: ["llm-agents"],
    techChips: ["FastAPI", "Groq", "Tiered routing"],
    metric: refreshableMetric("reviewiq:extraction-eval"),
    figure: { kind: "bar", pct: 83.8, valueText: "83.8% (threshold 83%)" },
  },
  {
    slug: "gold-rate-tracker",
    name: "Gold Rate Tracker",
    tagline:
      "A PWA that tracks 22K gold rates in India and predicts tomorrow's, shipping the plain baseline because the model I trained never beat it.",
    liveUrl: "https://gaurav-gandhi-2411.github.io/gold-rate-tracker/",
    repoUrl: "https://github.com/gaurav-gandhi-2411/gold-rate-tracker",
    categories: ["forecasting", "evals-research"],
    techChips: ["Chronos-Bolt", "GitHub Actions", "PWA"],
    metric: refreshableMetric("gold-rate-tracker:headline"),
  },
  {
    slug: "dealhunter",
    name: "DealHunter",
    tagline:
      "Describe a trip in a sentence and get two genuinely different itineraries, put together by a team of agents, instead of a page of near-identical flights.",
    // Backend (agentic-travel-booking-api-prod) runs min-instances=0 with no
    // keep-warm traffic; measured cold start 19.4s (content/warmup.ts).
    // Routed through the warming bridge instead of straight to the frontend.
    liveUrl: "https://gaurav-gandhi.vercel.app/warmup/dealhunter",
    repoUrl: "https://github.com/gaurav-gandhi-2411/agentic-travel-booking-system",
    categories: ["llm-agents"],
    techChips: ["Multi-agent", "Pareto ranking", "SSE"],
    // No metric badge: the only quantifiable claim this card ever carried
    // (a test count) has no admissible committed source as of 2026-08-08 —
    // see content/case-studies/dealhunter.ts's "Test suite" row.
  },
  {
    slug: "tracegauge",
    name: "tracegauge",
    tagline:
      "Scores a Claude Code session on how efficient it was, and shows you where the tokens went to waste.",
    repoUrl: "https://github.com/gaurav-gandhi-2411/token-efficiency-scorer",
    categories: ["tooling", "evals-research", "llm-agents"],
    techChips: ["Python", "PyPI"],
    pypi: {
      packageName: "tracegauge",
      installCommand: "pip install tracegauge",
      badgeUrl: "https://img.shields.io/pypi/v/tracegauge.svg",
    },
  },
  {
    slug: "adk-tracegauge",
    name: "adk-tracegauge",
    tagline:
      "Fails your build when an agent starts costing more per run, and tells you, every run, the smallest rise it could actually have caught.",
    repoUrl: "https://github.com/gaurav-gandhi-2411/adk-tracegauge",
    categories: ["llm-agents", "evals-research", "tooling"],
    techChips: ["Google ADK", "Bootstrap CI", "PyPI"],
    pypi: {
      packageName: "adk-tracegauge",
      installCommand: "pip install adk-tracegauge",
      badgeUrl: "https://img.shields.io/pypi/v/adk-tracegauge.svg",
    },
  },
  {
    slug: "expense-tracker",
    name: "Expense Tracker",
    tagline:
      "Type what you spent the way you would say it out loud. It files the expense, categorizes it, and predicts where your spending is heading.",
    // Wave 19 (2026-07-31): liveUrl removed. Wave 16 verified this URL live
    // (2026-07-26); it now 404s with DEPLOYMENT_NOT_FOUND — a second,
    // distinct frontend outage since that check. A dead link on the live
    // site is worse than no link; the backend (Cloud Run) is separately
    // confirmed live. See provenance.md's wave-19 addendum.
    repoUrl: "https://github.com/gaurav-gandhi-2411/expense-tracker",
    categories: ["retrieval", "forecasting", "llm-agents"],
    techChips: ["Groq", "Prophet", "IsolationForest"],
    metric: refreshableMetric("expense-tracker:tests"),
  },
];
