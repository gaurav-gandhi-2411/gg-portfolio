import type { Product } from "./types";

export const products: Product[] = [
  // ── Flagship ────────────────────────────────────────────────────────────
  {
    slug: "warmer",
    name: "Warmer",
    tagline:
      "Daily semantic word game — guess the secret word and an embedding model tells you how close you are.",
    liveUrl: "https://playwarmer.vercel.app/",
    repoUrl: "https://github.com/gaurav-gandhi-2411/mindmeld",
    tier: "flagship",
    techChips: ["Flutter", "sentence-transformers", "Firebase"],
    metric: {
      label: "Hinglish embedding eval (Spearman correlation)",
      value: "-0.003 → 0.639",
      sourceRef: "warmer:hinglish-fix",
    },
  },
  {
    slug: "style-maitri",
    name: "Style Maitri",
    tagline:
      "AI stylist for Indian weddings & occasions — hybrid retrieval across 8 stores, grounded against hallucinated price/size claims.",
    liveUrl: "https://stylemaitri.vercel.app",
    repoUrl: "https://github.com/gaurav-gandhi-2411/agentic-shopping-assistant",
    tier: "flagship",
    techChips: ["LangGraph", "FAISS + BM25", "CLIP", "Groq"],
    metric: {
      label: "Intent-parsing accuracy",
      value: "93.8% (n=211)",
      sourceRef: "style-maitri:intent-accuracy",
    },
    secondaryMetric: {
      label: "Cross-store catalogue",
      value: "~52K items across 8 stores",
      sourceRef: "style-maitri:catalogue-size",
    },
  },
  {
    slug: "triageiq",
    name: "TriageIQ",
    tagline:
      "4-stage ML issue-triage service — TF-IDF classifier, BGE+FAISS retrieval, LightGBM resolution estimate, Groq LLM synthesis.",
    liveUrl: "https://triage-iq-orcin.vercel.app/",
    repoUrl: "https://github.com/gaurav-gandhi-2411/triage-iq",
    tier: "flagship",
    techChips: ["TF-IDF", "BGE + FAISS", "LightGBM", "Groq"],
    metric: {
      label: "Component classifier top-3 accuracy",
      value: "82.5% (k8s) / 90.4% (vscode)",
      sourceRef: "triageiq:classifier-top3",
    },
  },

  // ── Secondary grid ──────────────────────────────────────────────────────
  {
    slug: "dealhunter",
    name: "DealHunter",
    tagline:
      "Multi-agent flight search — natural-language trip requests to Pareto-ranked itineraries, live via SSE streaming.",
    liveUrl: "https://agentic-travel-booking-system.vercel.app",
    repoUrl: "https://github.com/gaurav-gandhi-2411/agentic-travel-booking-system",
    tier: "secondary",
    metric: {
      label: "Test suite",
      value: "597 tests, ≥87.65% coverage",
      sourceRef: "dealhunter:test-coverage",
    },
  },
  {
    slug: "shelfsense",
    name: "ShelfSense",
    tagline:
      "Dagster-orchestrated LightGBM demand forecasting on the M5 Walmart dataset — 30,490 series, 7 model variants.",
    repoUrl: "https://github.com/gaurav-gandhi-2411/shelfsense-m5",
    tier: "secondary",
    metric: {
      label: "WRMSSE vs. naive baseline",
      value: "36% reduction (0.8956 → 0.5693)",
      sourceRef: "shelfsense:wrmsse",
    },
  },
  {
    slug: "reviewiq",
    name: "ReviewIQ",
    tagline:
      "Structured review intelligence across English, Hindi & Hinglish — tiered LLM routing plus authenticity scoring.",
    liveUrl: "https://review-iq-ajjrytb3na-el.a.run.app",
    repoUrl: "https://github.com/gaurav-gandhi-2411/review-iq",
    tier: "secondary",
    metric: {
      label: "Extraction accuracy (en/hi/hi-en)",
      value: "83.8% overall",
      sourceRef: "reviewiq:extraction-eval",
    },
  },
  {
    slug: "multimodal-fashion-recommender",
    name: "Multimodal Fashion Recommender",
    tagline:
      "Two-tower recommender fusing CLIP image embeddings with SBERT text embeddings via in-batch InfoNCE contrastive loss.",
    liveUrl: "https://huggingface.co/spaces/gauravgandhi2411/multimodal-fashion-recommender",
    repoUrl: "https://github.com/gaurav-gandhi-2411/multimodal-fashion-recommender",
    tier: "secondary",
    metric: {
      label: "Recall@10 lift vs. popularity baseline",
      value: "3.06× (0.0328 vs. 0.0107)",
      sourceRef: "mmfr:recall10",
    },
  },
  {
    slug: "gold-rate-tracker",
    name: "Gold Rate Tracker",
    tagline:
      "Free-tier PWA tracking Indian 22K gold prices — honest naive-baseline forecast plus a directional ML companion.",
    liveUrl: "https://gaurav-gandhi-2411.github.io/gold-rate-tracker/",
    repoUrl: "https://github.com/gaurav-gandhi-2411/gold-rate-tracker",
    tier: "secondary",
    metric: {
      label: "Naive baseline vs. ML model (194-fold backtest)",
      value: "Naive wins — ships the honest baseline, not the model",
      sourceRef: "gold-rate-tracker:headline",
    },
  },
  {
    slug: "aetherart",
    name: "AetherArt",
    tagline:
      "Diffusion image generation — custom rank-8 Ukiyo-e SDXL LoRA composed with Hyper-SD and ControlNet, served on Cloud Run.",
    liveUrl: "https://aetherart-demo-473907703523.us-central1.run.app/",
    repoUrl: "https://github.com/gaurav-gandhi-2411/AetherArt",
    tier: "secondary",
    metric: {
      label: "Full SDXL + LoRA pipeline, 8GB consumer-GPU budget",
      value: "6.2GB peak VRAM",
      sourceRef: "aetherart:vram",
    },
  },
  {
    slug: "tracegauge",
    name: "tracegauge",
    tagline:
      "Three-axis Claude Code session efficiency scorer — token economy, trajectory quality, deterministic waste detection.",
    repoUrl: "https://github.com/gaurav-gandhi-2411/token-efficiency-scorer",
    tier: "secondary",
    pypi: {
      packageName: "tracegauge",
      installCommand: "pip install tracegauge",
      badgeUrl: "https://img.shields.io/pypi/v/tracegauge.svg",
    },
  },
];
