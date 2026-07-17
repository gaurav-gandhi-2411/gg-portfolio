// Wave 10 rewrote this file's voice warm/first-person/humble after GG read
// the previous version as boastful. Wave 12 (multi-page): the approved
// paragraph's first sentence became the hero h1's headline; the About Me
// section GG asked for lives here as aboutParagraphs; sentences 2–3 still
// open the Work section as workLede.

/**
 * Wave 12 — About Me (GG's ask: short, first-person, human, professional).
 * Facts: career timeline and team-lead scope from the canonical resume
 * (resume:indium-senior-lead, resume:fedex-anomaly, resume:tcs-pipelines);
 * live-product count is derived on the page next to this copy; the two
 * honest-numbers examples are real published results
 * (gold-rate-tracker:headline, triageiq:retrieval — see provenance.md).
 */
export const aboutParagraphs: string[] = [
  "I'm Gaurav — a data scientist in Bengaluru. Over the past five years I've gone from building ETL pipelines at TCS, to forecasting and anomaly detection at FedEx, to my current role inside Uber's AI org (via Indium Software), where I lead a five-person data-science team shipping GenAI document intelligence into production.",
  "Outside work, I build my own AI products — a daily word game, a fashion stylist, an issue-triage service, and more. Each one exists because I wanted to see an idea all the way through: not a model in a notebook, but something deployed, evaluated, and used by real people.",
  "The through-line is honest measurement. Every project ships with an evaluation harness, and the numbers I publish include the unflattering ones — the naive baseline that beat my forecasting model, the retrieval score that stayed weak after three attempted fixes. I'd rather show a real 83% than claim a vague \"high accuracy.\"",
];

/** Work lede — sentences 2–3 of the same approved paragraph. The closing
 * clause is real (gold-rate-tracker:headline: the naive baseline genuinely
 * beats the model, and the site says so). */
export const workLede =
  "What I've made so far: a daily word game, a fashion styling assistant, an issue-triage service, and the research they led me to. The numbers are honest, including the one where a simple baseline beat my model.";

// Wave 12: the wave-6 dayJobParagraph is retired — its facts (5-person
// team, Uber's AI org via Indium, GenAI doc-intelligence) now live in
// aboutParagraphs[0]; Experience opens straight into the company cards.

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
