import type { ExperienceEntry } from "./types";

export const experience: ExperienceEntry[] = [
  {
    company: "Indium Software",
    companyDetail: "Client: Uber Technologies — Uber AI",
    dateRange: "Jun 2024 – Present",
    location: "Bengaluru, India",
    techChips: [
      "LoRA / QLoRA",
      "ViT",
      "Hybrid RAG",
      "NL2SQL",
      "LangChain",
      "Ray Train",
      "DeepSpeed ZeRO-3",
      "BERT",
    ],
    subRoles: [
      {
        title: "Senior Data Scientist",
        dateRange: "May 2025 – Present",
        bullets: [
          {
            text: "Lead and mentor a 5-person data-science team across GenAI document-intelligence and conversational-AI workstreams — owning modeling roadmap, evaluation strategy, and technical review.",
            sourceRef: "resume:indium-senior-lead",
            featured: true,
          },
          {
            text: "Raised document-extraction field-level accuracy to 97%+ by building a parameter-efficient fine-tuning framework (Llama 3.1, GPT-Neo) with layer-freezing, instruction-tuning data design, and an automated field-accuracy eval harness.",
            sourceRef: "resume:indium-senior-finetune",
            featured: true,
          },
          {
            text: "Removed the manual-review bottleneck in earner document verification by training a Vision Transformer that scores each upload against 9 rejection reasons over 55 document types, auto-approving below a calibrated per-(type, reason) human-recall threshold.",
            sourceRef: "resume:indium-senior-vit",
          },
          {
            text: "Cut analytics turnaround from hours to seconds for non-technical teams with a production multi-agent copilot combining Hybrid RAG (dense + sparse), NL2SQL, a schema knowledge graph, and LangChain tool orchestration — live across business units.",
            sourceRef: "resume:indium-senior-copilot",
            featured: true,
          },
        ],
      },
      {
        title: "Data Scientist",
        dateRange: "Jun 2024 – May 2025",
        bullets: [
          {
            text: "Owned the multi-task training objective and extraction head for an encoder–decoder Transformer pretrained on 50M+ documents across 144 A100 GPUs (PyTorch, Ray Train, DeepSpeed ZeRO-3) — shipped to production at 95%+ field accuracy, displacing manual review for $10M+ in annual cost savings.",
            sourceRef: "resume:indium-ds-docunderstanding",
            featured: true,
          },
          {
            text: "Drove a sustained 27% lift in user engagement by replacing static collaborative filtering with a BERT-based session-aware sequence model capturing evolving user intent, validated via A/B tests across releases.",
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
            text: "Recovered lost enterprise shipping volume — surfaced via Average-Daily-Volume decline — by deploying an ensemble of Bayesian change-point detection, probabilistic clustering, and profitability scoring, shaping regional supply strategy cross-functionally.",
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
