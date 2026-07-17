import type { Product } from "./types";

/**
 * "Live" = has a public liveUrl or a published PyPI package — matches
 * content/provenance.md's `derived:products-live-count` definition exactly.
 * Repo-only entries (e.g. ShelfSense) still get a card but don't count here.
 * Single source of truth so the hero stat can never silently drift from the
 * actual product list (see content/site.ts's heroStats).
 */
export function liveProductCount(list: Product[]): number {
  return list.filter((p) => Boolean(p.liveUrl) || Boolean(p.pypi)).length;
}

/**
 * The home page's showcase five (wave 12): the three flagships plus the
 * two that widen the technical range the most — DealHunter (multi-agent
 * search with the deepest test rig) and ShelfSense (classical-ML
 * forecasting at 30K-series scale). Everything else lives one click away
 * on /projects.
 */
export const showcaseSlugs = [
  "warmer",
  "style-maitri",
  "triageiq",
  "dealhunter",
  "shelfsense",
] as const;

export const products: Product[] = [
  // ── Flagship ────────────────────────────────────────────────────────────
  {
    slug: "warmer",
    name: "Warmer",
    tagline:
      "Daily semantic word game — guess the secret word and an embedding model tells you how close you are.",
    liveUrl: "https://playwarmer.vercel.app/",
    // Repo (mindmeld) is private — no public repo link until that changes. See provenance.md.
    tier: "flagship",
    techChips: ["Flutter", "sentence-transformers", "Firebase"],
    metric: {
      label: "Hinglish embedding eval (Spearman correlation)",
      value: "-0.003 → 0.639",
      sourceRef: "warmer:hinglish-fix",
    },
    // Figure = the metric above, drawn. Same numbers, same claim,
    // sourceRef warmer:hinglish-fix (rule 65b).
    figure: { kind: "dumbbell", from: -0.003, to: 0.639, scaleNote: "0–1 scale" },
    storyLine: {
      text: "Hinglish embeddings scored near-random until I traced it to a script-mismatch bug (the model was trained on Devanagari, not romanized text) and swapped in one trained on Hinglish directly.",
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
    // Figure = the metric above, drawn. Same numbers, same claim,
    // sourceRef style-maitri:intent-accuracy (rule 65b).
    figure: { kind: "bar", pct: 93.8, valueText: "93.8% (n=211)" },
    secondaryMetric: {
      label: "Cross-store catalogue",
      value: "~52K items across 8 stores",
      sourceRef: "style-maitri:catalogue-size",
    },
    storyLine: {
      text: "Built a deterministic garment-type normalizer that resolves inconsistent product titles across 8 store catalogues into one canonical taxonomy — no LLM, rule-based, with a confidence score per item.",
      sourceRef: "style-maitri:garment-normalizer",
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
    // Figure = the metric above, drawn. Same numbers, same claim,
    // sourceRef triageiq:classifier-top3 (rule 65b).
    figure: {
      kind: "bars",
      rows: [
        { name: "k8s", pct: 82.5 },
        { name: "vscode", pct: 90.4 },
      ],
    },
    storyLine: {
      text: "Built a disjointness guard that caught 3 months of silent train/eval contamination in the gold judge set (54/60 cases affected), then ran a full audit that found the LLM synthesis stage fabricating claims 1.9–9.1% of the time — tracked, not yet hard-gated.",
      sourceRef: "triageiq:contamination-adr0018",
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
      "Demand forecasting for retail inventory — Dagster-orchestrated LightGBM models on the M5 Walmart dataset, 30,490 series, 7 model variants.",
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
      "Turns customer reviews into structured insight across English, Hindi & Hinglish — tiered LLM routing plus authenticity scoring.",
    // Bare API root 404s (no handler); /docs is the live, browsable Swagger UI.
    liveUrl: "https://review-iq-ajjrytb3na-el.a.run.app/docs",
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
      "Fashion recommendations from a photo or a description — a two-tower model fusing CLIP image embeddings with SBERT text embeddings via in-batch InfoNCE contrastive loss.",
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
      "AI-generated Ukiyo-e-style art — a custom rank-8 SDXL LoRA composed with Hyper-SD and ControlNet, served on Cloud Run.",
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
    slug: "agentgauge",
    name: "AgentGauge",
    tagline:
      "Scores how well an AI agent can actually use an MCP server — runs a real LLM agent against it across 8 dimensions. The benchmark behind the tool-description paper in Research below.",
    repoUrl: "https://github.com/gaurav-gandhi-2411/agentgauge",
    tier: "secondary",
    // Deliberately descriptive, not a performance claim — the repo's own
    // scope note calls it "a pilot-scale research artifact… not a validated
    // product claim", and the card honors that framing (provenance.md).
    metric: {
      label: "pilot-scale research artifact, honestly scoped",
      value: "8 scoring dimensions, all implemented",
      sourceRef: "agentgauge:scoring-dimensions",
    },
  },
  {
    slug: "expense-tracker",
    name: "Expense Tracker",
    tagline:
      "Multi-user expense tracker with NL entry parsing, embedding-based auto-categorization, anomaly detection, and Prophet forecasting — built production-shaped (real auth, isolation, migrations).",
    // Added wave 12: the wave-10 sweep skipped this repo on its stale
    // top-level README; CURRENT_STATE.md shows a built, tested, multi-user
    // product. Deliberately NO liveUrl: the documented demo deployment was
    // found down on 2026-07-18 (frontend 404, backend 500 — caught by this
    // repo's own lychee CI) — see provenance.md#expense-tracker:state.
    repoUrl: "https://github.com/gaurav-gandhi-2411/expense-tracker",
    tier: "secondary",
    metric: {
      label: "Test suite",
      value: "143/143 passing",
      sourceRef: "expense-tracker:tests",
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
