import type { CaseStudy } from "../types";

// Sources: review-iq repo (README.md, ARCHITECTURE.md, PROMPTS.md, spec.md,
// eval/README.md, eval/report.md, docs/compliance.md,
// review-iq-closeout-roadmap.md) — see provenance.md's ReviewIQ section.
export const reviewiq: CaseStudy = {
  slug: "reviewiq",
  title: "ReviewIQ",
  dek: "Turns customer-review text in English, Hindi, and Hinglish into structured sentiment, urgency, and authenticity signals — and the bug where a safety complaint got scored as low-priority because it was written politely.",
  depth: "full",
  problem: [
    "Indian D2C (direct-to-consumer) sellers get customer reviews in English, Hindi, and Hinglish (romanized, code-mixed Hindi-English — \"yeh product bahut accha hai\" written in Latin letters), and reading all of them manually to catch the urgent or safety-related ones, or the likely-fake ones, doesn't scale. Most review-analysis tools don't natively handle Hinglish at all.",
    "ReviewIQ turns unstructured review text into structured data: sentiment, pros/cons, an urgency flag, and an authenticity score — so a seller can triage what actually needs attention instead of reading everything.",
  ],
  approach: [
    "A review first passes through a sanitizer that strips personally identifiable information, then a language detector classifies it as English, Hindi, or Hinglish, which routes it to a language-branched prompt (a prompt template tuned for that language's phrasing).",
    "From there, a tiered router sends the easy cases to a small, fast model (llama-3.1-8b-instant) by default, and escalates to a larger model (Llama 3.3 70B) only when the small model's output fails schema validation or comes back with low confidence — most reviews never need the expensive model.",
    "The model's response is validated against a strict JSON schema before it's accepted, and results are stored behind API-key authentication (using argon2id, a memory-hard password-hashing algorithm) with Postgres row-level security enforcing that one seller's data is never visible to another in the shared multi-tenant database.",
  ],
  architecture: {
    intro:
      "Sanitize, detect language, route by difficulty to the cheapest model that can do the job, and never let an unvalidated response reach storage.",
    stages: [
      { label: "Review text", kind: "input", detail: "English, Hindi, or Hinglish" },
      { label: "POST /v2/extract", detail: "argon2id API-key auth + per-tenant quota" },
      { label: "Sanitizer", detail: "strips PII before anything else touches the text" },
      { label: "Language detection", detail: "en / hi / hi-en" },
      { label: "Language-branched prompt builder" },
      {
        label: "Tiered router",
        parallel: [
          { label: "Small model", detail: "llama-3.1-8b-instant — default" },
          { label: "Large model", detail: "Llama 3.3 70B — escalation on validation failure/low confidence" },
        ],
      },
      { label: "Schema-validated JSON", detail: "response must pass strict schema before storage" },
      {
        label: "Storage",
        kind: "output",
        detail: "Postgres + row-level security (prod) / SQLite (dev)",
      },
    ],
    note: "Cross-cutting: structlog structured logging + Prometheus metrics, deployed on Cloud Run in asia-south1.",
  },
  decisions: [
    {
      title: "Groq only on the client-data path — Gemini is dev-only",
      body: "Gemini's free tier trains on submitted data, which is unacceptable for real customer reviews. The client-facing path is hard-restricted to Groq-hosted models, enforced in code by an `assert_privacy_safe()` check rather than left as a policy someone could forget to follow.",
      sourceRef: "reviewiq:privacy-routing",
    },
    {
      title: "Tiered routing: try the small model first, escalate on failure",
      body: "Sending every review to the large model would be simpler, but wasteful. Routing simple cases to the small model first and escalating only on validation failure or low confidence cut token cost 27.9% in v0.5.0, at a measured accuracy cost of 1.4 percentage points — both numbers published, not just the win.",
      sourceRef: "reviewiq:tiered-routing",
    },
    {
      title: "Cassette-replay CI — zero live API calls in CI",
      body: "Every CI run replays previously-recorded LLM responses keyed on a hash of the model name and prompt (sha256 of model+prompts), rather than calling a live LLM. That makes CI runs free, deterministic, and reproducible — and, as the debugging story below shows, it's also how a real prompt bug got diagnosed without spending a single new API call.",
      sourceRef: "reviewiq:cassette-ci",
    },
    {
      title: "Urgency rubric rewritten from tone-based to signal-based",
      body: "The original urgency rubric leaned on the review's tone — an angry-sounding review scored higher urgency than a polite one. That's backwards for safety: a physical-harm report should be HIGH urgency regardless of star rating or how politely it's phrased. The rubric was rewritten to key on the presence of a harm signal, not the emotional register of the writing.",
      sourceRef: "reviewiq:urgency-rubric",
    },
  ],
  results: [
    {
      label: "Overall extraction accuracy",
      value: "83.8% vs. an 83% CI gate — PASS",
      detail: "per-language: en 86.2% / hi 80.7% / hi-en 80.9% (2026-07-06 eval run)",
      sourceRef: "reviewiq:extraction-eval",
    },
    {
      label: "Authenticity scoring (40 fixtures)",
      value: "precision/recall/F1 = 1.000",
      detail: "the repo's own caveat: this is \"a starting calibration,\" not proof it holds in the real world",
      sourceRef: "reviewiq:authenticity",
    },
    {
      label: "Honest caveat on the Hindi/Hinglish gap",
      value: "hi/hi-en gold labels are LLM-generated, called \"not published-credible\" in the spec",
      detail: "a follow-up investigation attributed most of the apparent hi-en gap to benchmark-label noise, not model failure",
      sourceRef: "reviewiq:gold-label-caveat",
    },
  ],
  story: {
    title: "Harm in a positive tone — and a bug found without one new API call",
    body: [
      "A review that praised the product overall but mentioned a safety issue in passing came back scored as LOW urgency, because the original rubric keyed off tone: the review read as positive, so it scored as low-priority, regardless of the safety mention buried inside it. v2.2 rewrote the rubric to be signal-based instead of tone-based, so a harm signal drives urgency no matter how the rest of the review reads.",
      "v2.3 then dug into a related failure using cassette replay — re-running recorded LLM responses rather than calling the API again — and found the small model wasn't actually reasoning about the harm clause at all. It was pattern-matching the literal phrase \"poor fit,\" which happened to appear in one of the prompt's own few-shot examples, and copying that example's classification regardless of context. The fix was to remove that example from the prompt and add a regression fixture so the same shortcut couldn't silently return.",
      "Separately, the team investigated a suspected Hinglish-specific accuracy gap, traced it mostly to noise in the LLM-generated gold labels used for evaluation rather than a real model weakness, and logged the finding as \"NOT PURSUED\" instead of chasing a metric that wasn't measuring what it claimed to measure.",
    ],
    sourceRef: "reviewiq:urgency-rubric",
  },
  links: [
    { label: "Live API docs", href: "https://review-iq-ajjrytb3na-el.a.run.app/docs" },
    { label: "Source on GitHub", href: "https://github.com/gaurav-gandhi-2411/review-iq" },
  ],
};
