import type { CaseStudy } from "../types";

// Sources: multimodal-fashion-recommender repo (README.md,
// docs/architecture/adr/0001-multi-brand-scaling.md) — see provenance.md's
// Multimodal Fashion Recommender section.
export const mmfr: CaseStudy = {
  slug: "multimodal-fashion-recommender",
  title: "Multimodal Fashion Recommender",
  dek: "A two-tower model that recommends fashion items from how they look and what they're described as — and the representation-collapse bug that nearly sank it.",
  depth: "full",
  problem: [
    "Fashion e-commerce sites need a good \"you might also like\" — but the catalogue is huge, customers almost never leave ratings, and what makes two items similar depends on both how they look and what they actually are. A plain-text search misses the visual half; a plain-image search misses the descriptive half.",
    "This project targets small and mid-size Indian D2C fashion brands specifically: businesses that want real recommendations without hiring a machine-learning team or standing up their own infrastructure to get them.",
  ],
  approach: [
    "The model is trained on the H&M Kaggle dataset — 1.37 million customers, 105,000 articles, 31 million past purchases — and it's a \"two-tower\" design: one tower turns an item into a single vector of numbers, the other turns a shopper into one, and training pulls a shopper's vector close to the items they actually bought.",
    "The item tower doesn't learn to see or read from scratch. It takes a frozen CLIP model's image embedding (CLIP already knows how to describe what's in a photo) and a frozen SBERT model's text embedding (SBERT already knows what a product description means), concatenates them, and passes the combination through a small neural network down to one 256-number vector. The user tower runs a small Transformer over a shopper's last 20 purchases and pools that into the same 256-number space.",
    "Training uses a contrastive loss (InfoNCE): for each shopper in a batch, their real next purchase should sit closer in that 256-dimensional space than every other item in the batch. At serving time, a FAISS index (a fast nearest-neighbor search library) finds the closest items to a shopper's vector, and a Groq-hosted LLM writes a one-sentence, cached explanation for why each item was picked.",
    "The same pipeline was extended to ingest real Indian brand catalogues — Snitch, Fashor, Powerlook — from CSV, so a brand can get \"more like this\" recommendations from day one, before it has any purchase history of its own on the platform.",
  ],
  architecture: {
    intro:
      "Two towers trained together in one shared 256-dimensional space, served through a per-brand FAISS index behind one shared process.",
    stages: [
      {
        label: "H&M dataset + brand catalogues",
        kind: "input",
        detail: "1.37M customers, 105K articles, 31M transactions; Snitch/Fashor/Powerlook via CSV ingestion",
      },
      {
        label: "Item Tower and User Tower",
        detail: "trained jointly, project into the same 256-dim space",
        parallel: [
          {
            label: "Item Tower",
            detail: "frozen CLIP (512d) + frozen SBERT (384d) → concat → MLP 896→512→256, L2-normalized",
          },
          {
            label: "User Tower",
            detail: "last 20 purchases → 2-layer/4-head Transformer → masked mean-pool → MLP → 256d",
          },
        ],
      },
      {
        label: "InfoNCE contrastive training",
        detail: "in-batch negatives, temperature τ=0.1",
      },
      {
        label: "FAISS IndexFlatIP per brand",
        detail: "one BrandRegistry, one Cloud Run process serves every brand",
      },
      {
        label: "FastAPI endpoints",
        detail: "/v1/{brand}/recommend and /v1/{brand}/item/{id}/similar",
      },
      {
        label: "Groq LLM explainer + HuggingFace Space UI",
        kind: "output",
        detail: "one-sentence \"why this\" explanation, Redis/LRU-cached",
      },
    ],
    note: "H&M's own 2M-row transaction history is deliberately excluded from live serving via a BRANDS_ENABLED flag — see the FAISS scaling decision below.",
  },
  decisions: [
    {
      title: "Frozen CLIP + SBERT fusion, not end-to-end fine-tuning",
      body: "The image and text encoders are frozen and only the fusion MLP on top of them is trained. That means the model transfers to any fashion catalogue — including Indian ethnic wear it never saw during training — without retraining the encoders themselves.",
      sourceRef: "mmfr:frozen-fusion",
    },
    {
      title: "Temperature 0.1, learning rate 3e-4, and a 500-step warmup — after the standard config collapsed",
      body: "The textbook contrastive-learning config (temperature 0.07, learning rate 1e-3, no warmup) caused total representation collapse: every item and user vector converged to the same point in space, loss looked deceptively low, and the model learned nothing. Raising the temperature, lowering the learning rate, and — the single most important fix — adding a 500-step warmup period, resolved it.",
      sourceRef: "mmfr:collapse-fix",
    },
    {
      title: "FAISS, not a managed vector database, for up to 4 brands — a written trade-off, not an oversight",
      body: "For a handful of brands, a plain FAISS index that lives in local process memory needs zero extra infrastructure and behaves identically in development and production. An architecture decision record spells out the math on when that stops being true and lays out a 4-phase migration path (lazy-loading, then a shared FAISS shard server, then Qdrant) for when it does.",
      sourceRef: "mmfr:faiss-adr",
    },
    {
      title: "Evaluated on exactly the 10,556-item pool the production index actually serves",
      body: "Recall is measured against the same active item pool FAISS serves at inference time, not a larger offline-only pool — so the reported number is what a real user would actually experience, not an optimistic upper bound.",
      sourceRef: "mmfr:recall10",
    },
  ],
  results: [
    {
      label: "Recall@10 vs. popularity baseline",
      value: "0.0328 vs. 0.0107 — 3.06× lift",
      detail: "also 2.12× vs. a co-purchase baseline (0.0155) and ahead of text-only SBERT (0.0248); temporal held-out test, 110,390 users",
      sourceRef: "mmfr:recall10",
    },
    {
      label: "NDCG@10 / MRR",
      value: "0.0208 / 0.0172",
      sourceRef: "mmfr:ndcg",
    },
    {
      label: "Serving cost",
      value: "~$0.001–$0.004 per 1,000 recommendations",
      detail: "with a warm explanation cache",
      sourceRef: "mmfr:cost",
    },
    {
      label: "Honest caveat: new-brand personalization",
      value: "illustrative only, not yet validated",
      detail: "for a brand new to the platform, the personalized /recommend endpoint runs on synthetic users because the user tower never saw that brand's real purchase history; only the content-based /similar endpoint is a validated day-one capability",
      sourceRef: "mmfr:brand-caveat",
    },
  ],
  story: {
    title: "The model collapsed to a single point — then a scaling ADR drew the line on how far one process can go",
    body: [
      "Training with the paper-standard contrastive-learning recipe — temperature 0.07, learning rate 1e-3, no warmup — produced a suspiciously clean-looking loss curve and a completely useless model: every item and user embedding had converged to the same point in the 256-dimensional space. Cosine similarity between any two items was effectively 1.0. Nothing had been learned; the loss function had just found the cheapest way to look small.",
      "The fix came from empirical iteration rather than a known formula: raising the temperature to 0.1, dropping the learning rate to 3e-4, and — the change that mattered most — adding a 500-step warmup before the learning rate reached its full value. Warmup gives the towers a chance to spread out into distinct regions of the space before the optimizer starts taking large steps, which is exactly what a cold, aggressive learning rate short-circuits.",
      "Once the model worked, a second question came up: how many brands can one shared FAISS process actually hold? An architecture decision record ran the numbers rather than guessing: three real brand catalogues fit comfortably in roughly 250–400MB, but H&M's own 2-million-row transaction history alone would blow past an 8GiB Cloud Run instance. Rather than ship a serving path that would eventually fall over, H&M is deliberately excluded from live serving behind a BRANDS_ENABLED flag, with a 4-phase migration path — lazy-loading, then a shared shard server, then a real vector database like Qdrant — written down for when the catalogue count grows past what one process can hold.",
    ],
    sourceRef: "mmfr:collapse-fix",
  },
  links: [
    {
      label: "Try it on Hugging Face",
      href: "https://huggingface.co/spaces/gauravgandhi2411/multimodal-fashion-recommender",
    },
    {
      label: "Source on GitHub",
      href: "https://github.com/gaurav-gandhi-2411/multimodal-fashion-recommender",
    },
  ],
};
