export const aboutParagraphs: string[] = [
  // Wave 10: GG read the previous version ("I build and ship AI products
  // end-to-end under my own name… through evaluation to a pre-submission
  // paper") as boastful/overwrought. Rewritten warm, first-person, humble —
  // the closing clause is real (gold-rate-tracker:headline: the naive
  // baseline genuinely beats the model, and the site says so).
  "I like building AI products and seeing them all the way through — from the first experiment to something real people can use. Below is what I've made so far: a daily word game, a fashion styling assistant, an issue-triage service, and the research they led me to. The numbers are honest, including the one where a simple baseline beat my model.",
  // Wave 6: trailing "— including an encoder-decoder transformer…$10M+" clause
  // removed from display — the same claim renders verbatim (with sourceRef) as
  // the Data Scientist bullet directly below this paragraph in Experience.
  "That same rigor is what I bring to my day job: for the past year I've led and mentored a 5-person data-science team inside Uber's AI org (via Indium Software), shipping GenAI document-intelligence, multi-agent RAG copilots, and LLM fine-tuning pipelines into production.",
];

// Curated ~10, not a tag cloud. Sourced from resume "Key Technical Skills" (see provenance.md#resume).
export const skillChips: string[] = [
  "LLM Fine-Tuning (LoRA / QLoRA)",
  "RAG & Hybrid Retrieval",
  "Multi-Agent Systems (LangGraph)",
  "Transformer Architectures",
  "Diffusion Models (SDXL)",
  "Two-Tower / Contrastive Retrieval",
  "Distributed Training (Ray, DeepSpeed)",
  "LLM-as-Judge Evaluation",
  "NL2SQL & Knowledge Graphs",
  "FastAPI & GCP Cloud Run",
];
