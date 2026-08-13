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
      "A four-stage ML service that triages GitHub issues — classifies the component, retrieves similar solved issues, estimates resolution time, and drafts a grounded summary.",
    liveUrl: "https://triage-iq-orcin.vercel.app/",
    repoUrl: "https://github.com/gaurav-gandhi-2411/triage-iq",
    categories: ["llm-agents", "retrieval", "forecasting"],
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
      "Daily semantic word game — guess the secret word and an embedding model tells you how close you are.",
    liveUrl: "https://playwarmer.vercel.app/",
    // Repo (mindmeld) is private — no public repo link until that changes. See provenance.md.
    categories: ["retrieval"],
    techChips: ["Flutter", "sentence-transformers", "Firebase"],
    metric: refreshableMetric("warmer:hinglish-fix"),
    figure: { kind: "dumbbell", from: -0.003, to: 0.813, scaleNote: "0–1 scale" },
  },
  {
    slug: "multimodal-fashion-recommender",
    name: "Multimodal Fashion Recommender",
    tagline:
      "Fashion recommendations from a photo or a description — a two-tower model I trained to align CLIP image embeddings with SBERT text embeddings.",
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
      "AI stylist for Indian weddings and occasions — searches 8 store catalogues at once, with guardrails that keep it from inventing prices or sizes.",
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
      "Demand forecasting for retail inventory — LightGBM models across all 30,490 series of the M5 Walmart dataset, orchestrated with Dagster.",
    repoUrl: "https://github.com/gaurav-gandhi-2411/shelfsense-m5",
    categories: ["forecasting"],
    techChips: ["LightGBM", "Dagster", "M5 dataset"],
    metric: refreshableMetric("shelfsense:wrmsse"),
    figure: { kind: "dumbbell", from: 0.8956, to: 0.5693, scaleNote: "WRMSSE — lower is better" },
  },
  {
    slug: "aetherart",
    name: "AetherArt",
    tagline:
      "Ukiyo-e-style AI art — a custom rank-8 SDXL LoRA I trained, composed with Hyper-SD and ControlNet, served on Cloud Run.",
    // GPU-backed (L4), min-instances=0 — a bare min-instances=1 would run
    // ~$759/mo (see content/warmup.ts). Routed through the warming bridge
    // instead of the raw Cloud Run URL; also drops the GCP project number
    // that URL leaks.
    liveUrl: "https://gaurav-gandhi.vercel.app/warmup/aetherart",
    repoUrl: "https://github.com/gaurav-gandhi-2411/AetherArt",
    categories: ["vision"],
    techChips: ["SDXL LoRA", "ControlNet", "Cloud Run"],
    metric: refreshableMetric("aetherart:vram"),
  },
  {
    slug: "agentgauge",
    name: "AgentGauge",
    tagline:
      "Measures whether a change to an MCP server's tool descriptions actually changed agent task success — a statistical A/B harness that rebuilt itself after falsifying its own v1 quality score. The research program behind my tool-description paper.",
    repoUrl: "https://github.com/gaurav-gandhi-2411/agentgauge",
    categories: ["evals-research", "llm-agents"],
    techChips: ["MCP", "Causal measurement", "Python"],
    // Wave 13: the previous "8 scoring dimensions" claim went stale — the
    // repo's own predictive-validity study falsified the v1 8-axis score
    // and the project rebuilt around a statistical harness. Caught by this
    // wave's metrics-manifest verification pass (see provenance.md).
    metric: refreshableMetric("agentgauge:blocking-causal"),
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
      "Rules-first Windows disk-cleanup tool — a deterministic safety gate decides what's safe to remove, and the reclaimable-space estimate got corrected downward four times as real bugs were found, never once upward.",
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
      "Turns customer reviews into structured insight across English, Hindi, and Hinglish — tiered LLM routing plus authenticity scoring.",
    // Bare API root 404s (no handler); /docs is the live, browsable Swagger UI.
    liveUrl: "https://review-iq-ajjrytb3na-el.a.run.app/docs",
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
      "Zero-cost PWA tracking Indian 22K gold prices — it ships the honest baseline forecast, because the ML model couldn't beat it.",
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
      "Multi-agent flight search — describe a trip in plain language and get two genuinely different best itineraries, not a wall of results.",
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
      "Scores Claude Code sessions on efficiency across three axes — token economy, trajectory quality, and deterministic waste detection.",
    repoUrl: "https://github.com/gaurav-gandhi-2411/token-efficiency-scorer",
    categories: ["tooling", "evals-research"],
    techChips: ["Python", "PyPI"],
    pypi: {
      packageName: "tracegauge",
      installCommand: "pip install tracegauge",
      badgeUrl: "https://img.shields.io/pypi/v/tracegauge.svg",
    },
  },
  {
    slug: "expense-tracker",
    name: "Expense Tracker",
    tagline:
      "Multi-user expense tracker that parses entries written in plain language, auto-categorizes them with embeddings, and forecasts spending — built production-shaped, with real auth and migrations.",
    // Wave 19 (2026-07-31): liveUrl removed. Wave 16 verified this URL live
    // (2026-07-26); it now 404s with DEPLOYMENT_NOT_FOUND — a second,
    // distinct frontend outage since that check. A dead link on the live
    // site is worse than no link; the backend (Cloud Run) is separately
    // confirmed live. See provenance.md's wave-19 addendum.
    repoUrl: "https://github.com/gaurav-gandhi-2411/expense-tracker",
    categories: ["retrieval", "forecasting"],
    techChips: ["Groq", "Prophet", "IsolationForest"],
    metric: refreshableMetric("expense-tracker:tests"),
  },
];
