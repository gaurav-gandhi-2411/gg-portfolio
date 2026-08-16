import type { ExperienceEntry } from "./types";

export const experience: ExperienceEntry[] = [
  {
    // Attribution follows the resume exactly: one employer block, three
    // roles inside it. The resume heads it "Uber Technologies, Uber AI | via
    // Indium Software", which puts the client first and the vendor second,
    // the opposite of how this used to read.
    company: "Uber Technologies, Uber AI",
    companyDetail: "via Indium Software",
    dateRange: "Jun 2024 – Present",
    location: "Bengaluru, India",
    techChips: [
      "LoRA / QLoRA",
      "Qwen",
      "ViT",
      "Hybrid RAG",
      "NL2SQL",
      "Ray Train",
      "DeepSpeed ZeRO-3",
      "BERT",
    ],
    subRoles: [
      {
        title: "Lead Data Scientist",
        dateRange: "Aug 2026 – Present",
        bullets: [
          {
            text: "Lead a 5-person data-science team across GenAI document-intelligence and conversational-AI workstreams, setting the modeling roadmap, evaluation strategy, and technical review standards; hired two of the team's data scientists through end-to-end interviews and onboarded both onto live production systems.",
            sourceRef: "resume:indium-senior-lead",
            featured: true,
          },
          {
            text: "Coordinate the document-verification platform that gates earner onboarding in every Uber region, working with engineering, legal, annotation, regression, and regional leadership teams on model updates and threshold rollouts.",
            sourceRef: "resume:uber-lead-platform",
            featured: true,
          },
        ],
      },
      {
        title: "Senior Data Scientist",
        dateRange: "May 2025 – Aug 2026",
        bullets: [
          {
            text: "Automated roughly 70% of earner document verification (thousands of documents daily) by designing a dual-threshold policy on a Vision Transformer: recall-calibrated auto-approval and precision-calibrated auto-rejection thresholds, tuned per document type and rejection reason (55 types, 9 reasons), so only the uncertain band reaches human review.",
            sourceRef: "resume:indium-senior-vit",
            featured: true,
          },
          {
            text: "Raised field-level extraction accuracy above 97% by building a parameter-efficient fine-tuning framework for Qwen (LoRA/QLoRA) with a layer-freezing strategy, instruction-tuning data design, and an automated field-accuracy evaluation harness; mentored partner teams on prompt and evaluator design.",
            sourceRef: "resume:indium-senior-finetune",
            featured: true,
          },
          {
            text: "Delivered $10M+ in annual cost savings by displacing manual document review: owned the multi-task training objective and extraction head of an encoder-decoder Transformer pretrained on 50M+ documents across 144 A100 GPUs (PyTorch, Ray Train, DeepSpeed ZeRO-3), shipped to production at 95%+ field accuracy.",
            sourceRef: "resume:indium-ds-docunderstanding",
            featured: true,
          },
        ],
      },
      {
        title: "Data Scientist",
        dateRange: "Jun 2024 – May 2025",
        bullets: [
          {
            text: "Cut analytics turnaround from hours to seconds by shipping a multi-agent copilot that combines hybrid RAG (dense + sparse retrieval), NL2SQL, and a schema knowledge graph, adopted by program managers across all business units.",
            sourceRef: "resume:indium-senior-copilot",
            featured: true,
          },
          {
            text: "Drove a sustained 27% lift in user engagement, validated through A/B tests across releases, by replacing static collaborative filtering with a BERT-based session-aware sequence model that captures evolving user intent.",
            sourceRef: "resume:indium-ds-recommender",
            featured: true,
          },
        ],
      },
    ],
  },
  {
    company: "FedEx Express",
    companyDetail: "Consumer Logistics & Supply Chain",
    dateRange: "Aug 2022 – Jun 2024",
    location: "Bengaluru, India (Remote)",
    techChips: ["Bayesian Change-Point Detection", "SARIMA", "Box-Jenkins Tuning"],
    subRoles: [
      {
        title: "Decision Scientist",
        dateRange: "Aug 2022 – Jun 2024",
        bullets: [
          {
            text: "Recovered lost enterprise shipping volume, surfaced via Average-Daily-Volume decline, by deploying an ensemble of Bayesian change-point detection, probabilistic clustering, and profitability scoring, shaping regional supply strategy cross-functionally.",
            sourceRef: "resume:fedex-anomaly",
            featured: true,
          },
          {
            text: "Reduced operational inefficiencies ~20% by upgrading ARIMA pipelines to SARIMA with Box-Jenkins tuning, Fourier seasonality, and automated anomaly filtering, feeding sales and staffing plans.",
            sourceRef: "resume:fedex-forecasting",
          },
        ],
      },
    ],
  },
  {
    company: "Tata Consultancy Services (TCS)",
    dateRange: "Jul 2021 – Jul 2022",
    location: "Bengaluru, India (Remote)",
    techChips: ["GCP", "ETL"],
    subRoles: [
      {
        title: "Data Engineer",
        dateRange: "Jul 2021 – Jul 2022",
        bullets: [
          {
            text: "Ensured reliable, scalable downstream analytics for a high-volume booking/transaction client by designing end-to-end GCP ETL pipelines plus dashboards for campaign targeting, segmentation, and trend monitoring.",
            sourceRef: "resume:tcs-pipelines",
            featured: true,
          },
        ],
      },
    ],
  },
];
