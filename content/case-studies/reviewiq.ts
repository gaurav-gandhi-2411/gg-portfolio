import type { CaseStudy } from "../types";

// Sources: review-iq repo (README.md, ARCHITECTURE.md, PROMPTS.md, spec.md,
// eval/README.md, eval/report.md, docs/compliance.md,
// review-iq-closeout-roadmap.md) — see provenance.md's ReviewIQ section.
export const reviewiq: CaseStudy = {
  slug: "reviewiq",
  verifiedAt: "2026-10-05", // 2026-10-05: copy aligned to review-iq README/ADR 0022/eval results.json (no Hindi support claim, gpt-oss models). Earlier: issue #123 -- re-checked extraction-eval numbers against review-iq's regenerated eval/report.md; n=43 and eval date added to the rendered figures (Step 1). Step 2 (same day): standardized the public display to "78.6% (95% CI 73-83%, n=43, eval 2026-09-19)" per GG's decision, dropped the en/hi-en per-language accuracy breakdown from public copy, and moved "gate 76%" so it only ever renders next to the CI, never alone -- no underlying number changed, this is a wording/format correction only.
  title: "Samidha Reviews",
  dek: "Turns customer-review text in English and Hinglish into structured sentiment and urgency signals. A safety-scoring bug in it was diagnosed by replaying recorded model responses, with no new API call (the fix itself needed a live re-record).",
  depth: "full",
  problem: [
    "Indian D2C (direct-to-consumer) sellers get customer reviews in English and Hinglish (romanized, code-mixed Hindi-English, \"yeh product bahut accha hai\" written in Latin letters), and reading all of them manually to catch the urgent or safety-related ones doesn't scale. Most review-analysis tools don't natively handle Hinglish at all.",
    "Samidha Reviews (built and shipped under the name ReviewIQ, live-rebranded since) turns unstructured review text into structured data: sentiment, pros/cons, and an urgency flag, so a seller can triage what actually needs attention instead of reading everything.",
  ],
  approach: [
    "A review first passes through a sanitizer that strips personally identifiable information, then a language detector classifies it as English or Hinglish (Devanagari input is detected as Hindi but gets only an unvalidated best-effort prompt, with no support claim), which routes it to a language-branched prompt (a prompt template tuned for that language's phrasing).",
    "From there, a tiered router sends the easy cases to a small, fast model (openai/gpt-oss-20b) by default, and escalates to a larger model (openai/gpt-oss-120b) when the small model's output fails schema validation, comes back with low confidence, or conflicts with the review's explicit star rating, or when the small model's quota is exhausted. On 106 held-out reviews, in cassette replay, 59.4% of calls ended on the large model, more than a \"most stay small\" assumption would predict.",
    "The model's response is validated against a strict JSON schema before it's accepted, and requests are authenticated with API keys (hashed with argon2id, a memory-hard password-hashing algorithm). By default nothing is stored (stateless mode); for orgs that opt into retained mode, results are stored with Postgres row-level security enforcing that one seller's data is never visible to another in the shared multi-tenant database.",
  ],
  architecture: {
    intro:
      "Sanitize, detect language, route by difficulty to the cheapest model that can do the job, and never let an unvalidated response reach storage.",
    stages: [
      { label: "Review text", kind: "input", detail: "English or Hinglish" },
      { label: "POST /v2/extract", detail: "argon2id API-key auth + per-tenant quota" },
      { label: "Sanitizer", detail: "strips PII before anything else touches the text" },
      { label: "Language detection", detail: "en / hi-en (Devanagari: unvalidated best-effort)" },
      { label: "Language-branched prompt builder" },
      {
        label: "Tiered router",
        parallel: [
          { label: "Small model", detail: "openai/gpt-oss-20b, default" },
          { label: "Large model", detail: "openai/gpt-oss-120b, escalation on schema failure / low confidence / star-sentiment mismatch / small-model exhaustion" },
        ],
      },
      { label: "Schema-validated JSON", detail: "response must pass strict schema before storage" },
      {
        label: "Storage",
        kind: "output",
        detail: "Stateless by default (nothing persisted); opt-in retained mode: Postgres + row-level security",
      },
    ],
    note: "Cross-cutting: structlog structured logging + Prometheus metrics, deployed on Cloud Run in asia-south1.",
  },
  decisions: [
    {
      title: "Groq on the client-data path; providers that train on input are rejected in code",
      body: "Gemini's free tier trains on submitted data, which is unacceptable for real customer reviews. Production extraction runs on Groq (with an optional second Groq account as failover; a zero-retention OpenRouter failover is supported in code but not used in production). In code, assert_privacy_safe() rejects any provider flagged as training on input before every org-key extraction, rather than leaving it as a policy someone could forget to follow. The Gemini fallback has since been removed entirely (ADR 0035).",
      sourceRef: "reviewiq:privacy-routing",
    },
    {
      title: "Tiered routing: try the small model first, escalate on failure",
      body: "Sending every review to the large model would be simpler, but wasteful. Splitting reviews between a small and a large model cut token cost 27.9% in v0.5.0 (a 31 small / 15 large split with 0 escalated in that run, measured against sending everything to the large model, so the saving came from the split, not from escalation). The same historical table lists 84.4% overall for that routed release and 85.8% for the direct-LLM v0.4.0 before it (46 fixtures each), a 1.4-point gap derived here by subtraction, not a published figure.",
      sourceRef: "reviewiq:tiered-routing",
    },
    {
      title: "Cassette-replay CI, zero live API calls in CI",
      body: "Every CI run replays previously-recorded LLM responses keyed on a hash of the model name and prompt (sha256 of model+prompts), rather than calling a live LLM. That makes CI runs free, deterministic, and reproducible, and, as the debugging story below shows, it's also how a real prompt bug got diagnosed without spending a single new API call.",
      sourceRef: "reviewiq:cassette-ci",
    },
    {
      title: "Urgency rubric rewritten from tone-based to signal-based",
      body: "The original urgency rubric leaned on the review's tone, an angry-sounding review scored higher urgency than a polite one. That's backwards for safety: a physical-harm report should be HIGH urgency regardless of star rating or how politely it's phrased. The rubric was rewritten to key on the presence of a harm signal, not the emotional register of the writing.",
      sourceRef: "reviewiq:urgency-rubric",
    },
  ],
  results: [
    {
      label: "Overall extraction accuracy",
      value: "78.6% (95% CI 73–83%, n=43, eval 2026-09-19)",
      detail: "PASS on review-iq's own CI regression gate (a regression detector, not a real-world accuracy claim)",
      sourceRef: "reviewiq:extraction-eval",
    },
    {
      label: "Honest caveat: authenticity scoring has no published accuracy figure",
      value: "No published accuracy figure; an earlier 40-item fixture result (21 positive) was in-sample and is not cited as a measurement",
      detail: "the authenticity routes were removed from the product because the flag is unmeasurable: no authenticity labels exist for the held-out set",
      sourceRef: "reviewiq:authenticity",
      format: "prose",
    },
    {
      label: "Honest caveat: Devanagari Hindi is retired scope",
      value: "Devanagari Hindi is not supported (retired scope, ADR 0022); the Hinglish gold labels are LLM-generated, called \"not published-credible\" in the spec",
      detail: "a follow-up investigation attributed most of the apparent hi-en gap to benchmark-label noise, not model failure",
      sourceRef: "reviewiq:gold-label-caveat",
      format: "prose",
    },
  ],
  story: {
    title: "Found a safety-urgency bug, and diagnosed it from recorded model responses, without one new API call",
    body: [
      "A review that praised the product overall but mentioned a safety issue in passing came back scored as LOW urgency, because the original rubric keyed off tone: the review read as positive, so it scored as low-priority, regardless of the safety mention buried inside it. v2.2 rewrote the rubric to be signal-based instead of tone-based, so a harm signal drives urgency no matter how the rest of the review reads.",
      "v2.3 then dug into a related failure using cassette replay, re-running recorded LLM responses rather than calling the API again, and found the small model of the time (an earlier model, since retired, not today's gpt-oss-20b) extracted the pain correctly but still scored the review MEDIUM. It was matching the literal phrase \"poor fit,\" which the rubric itself listed as an example of MEDIUM urgency, and resolved the rubric's tension in favour of that keyword match. The fix replaced \"poor fit\" in the MEDIUM examples with \"fit/comfort issue that causes NO pain,\" rewrote the harm clause so fit language never downgrades a pain signal, added a second grounding example, and added a regression fixture so the same shortcut couldn't silently return. The recorded responses then had to be re-recorded live.",
      "Separately, the team investigated a suspected Hinglish-specific accuracy gap, traced it mostly to noise in the LLM-generated gold labels used for evaluation rather than a real model weakness, and logged the finding as \"NOT PURSUED\" instead of chasing a metric that wasn't measuring what it claimed to measure.",
    ],
    sourceRef: "reviewiq:urgency-rubric",
  },
  closing: [
    "If your product has to catch safety-critical signals buried in ordinary-sounding text, this is the discipline worth copying: score on the signal, not the tone, and build CI so a bug in the shipped prompt can be diagnosed for free, from recordings, without spending a live API call to reproduce it.",
  ],
  links: [
    { label: "Live API docs", href: "https://api.samidhareviews.xyz/docs" },
    { label: "Source on GitHub", href: "https://github.com/gaurav-gandhi-2411/review-iq" },
  ],
};
