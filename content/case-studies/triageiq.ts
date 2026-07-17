import type { CaseStudy } from "../types";

// Sources: triage-iq repo (README.md, reports/03_classifier_comparison.md,
// docs/architecture/adr/0009-resolution-predictor-diagnosis.md,
// docs/architecture/adr/0010-conformal-quantile-regression.md,
// docs/architecture/adr/0018-gold-set-train-contamination.md,
// docs/architecture/adr/0028-per-model-eval-audit.md) — see provenance.md's TriageIQ section.
export const triageiq: CaseStudy = {
  slug: "triageiq",
  title: "TriageIQ",
  dek: "An ML issue-triage assistant for busy open-source maintainers — and the 682-day MAE that turned out to be a data-splitting bug.",
  depth: "full",
  problem: [
    "On a busy open-source repository, a maintainer has to work out, for every new issue that lands: which subsystem does this touch, has someone already reported this, how long will this realistically take to fix, and what should happen next. Doing that by hand doesn't scale past a small team.",
    "TriageIQ automates the first pass. Give it an issue's title and body and it returns a structured triage decision — predicted component, similar past issues, an expected resolution-time range, a priority, and next steps — in under 4 seconds. It's trained on roughly 20,000 real issues from two very different repos, microsoft/vscode and kubernetes/kubernetes, so its numbers reflect what real, messy open-source data looks like rather than a clean lab set.",
  ],
  approach: [
    "Rather than asking one big model to do everything, TriageIQ runs four independent ML and AI systems in sequence, each doing one job well: (1) a TF-IDF + logistic regression classifier picks the likely component in about 5ms — TF-IDF turns text into weighted word-frequency vectors, a cheap and fast representation; (2) BGE sentence embeddings plus a FAISS index retrieve similar past issues in about 27ms; (3) a LightGBM quantile-regression model estimates a resolution-time range with conformal calibration (a statistical technique that gives the range an honest, guaranteed coverage probability) in about 4ms; (4) a Groq-hosted LLM takes all of that structured output and writes it up as a readable plan, in about 3 seconds.",
    "The LLM's job is deliberately narrow: it only writes narrative on top of facts the first three stages already computed — it's not asked to invent the component, the similar issues, or the time estimate itself. A grounding checker then verifies that the LLM's write-up didn't quietly claim something the earlier stages never actually produced.",
  ],
  architecture: {
    intro:
      "Four purpose-built models in a fixed pipeline, followed by a verifier that checks the one component (the LLM) capable of making things up.",
    stages: [
      {
        label: "New issue",
        kind: "input",
        detail: "POST /triage { repo, title, body }",
      },
      {
        label: "Stage 1 — Component classifier",
        detail: "TF-IDF (1–2gram) + per-repo logistic regression, 28–35 classes, ~5ms",
      },
      {
        label: "Stage 2 — Similar-issue retrieval",
        detail: "BGE-base-en-v1.5 embeddings + FAISS cosine search, top-5, ~27ms",
      },
      {
        label: "Stage 3 — Resolution-time estimate",
        detail:
          "LightGBM quantile regression (79 features) + Conformal Quantile Regression, ~4ms",
      },
      {
        label: "Stage 4 — LLM synthesis",
        detail: "Groq llama-3.1-8b-instant, 3-shot, JSON-schema retry + fallback, ~3s",
      },
      {
        label: "Grounding verifier",
        detail: "checks every LLM claim against what stages 1–3 actually produced",
      },
      {
        label: "TriagePlan",
        kind: "output",
        detail: "component + similar issues + resolution-time interval + priority + next steps",
      },
    ],
    note: "FastAPI on Cloud Run, Prometheus metrics, CI/CD via Workload Identity Federation, models stored in GCS.",
  },
  decisions: [
    {
      title: "TF-IDF + logistic regression over a transformer, for the classifier",
      body: "A three-way bake-off tested TF-IDF against DistilBERT and an LLM. DistilBERT beat TF-IDF on vscode by only 1.2 percentage points of macro-F1 — nowhere near the 11-point margin needed to justify 20x the latency — and actually lost on kubernetes by 5.1 points at 35x the latency. At the ~1,500–2,300 training examples per repo this system has, TF-IDF's simpler inductive bias (its built-in assumptions about how text maps to labels) generalizes better than a transformer does with that little data.",
      sourceRef: "triageiq:classifier-bakeoff",
    },
    {
      title: "Conformal Quantile Regression, not the model's raw quantile outputs",
      body: "LightGBM can output a Q10–Q90 prediction interval directly, but its raw coverage (how often the true answer actually fell inside the stated range) was unreliable — 74.4% on kubernetes and just 38.2% on vscode, against a nominal 80% target. Conformal Quantile Regression is a distribution-free, post-hoc calibration step that recalibrates those raw quantiles and comes with a guaranteed marginal coverage rate, which the raw model output simply didn't have.",
      sourceRef: "triageiq:cqr",
    },
    {
      title: "Split the data by created_at, not closed_at",
      body: "The original train/test split used each issue's closed_at date, which quietly guaranteed that every issue still open at the cutoff date landed in the test set — meaning test was structurally full of slow, unresolved issues while train was full of fast, already-closed ones. Re-splitting by created_at (when the issue was filed, not when it was closed) dropped mean absolute error from 693 days to 87 days — an 8x improvement that came entirely from fixing a methodology bug, not from improving the model.",
      sourceRef: "triageiq:split-fix",
    },
    {
      title: "Report top-3 accuracy as the headline classifier metric",
      body: "The product surfaces three candidate components to the maintainer, not one, so top-1 accuracy alone understates how useful the classifier actually is in the workflow it's built for. Reporting top-3 instead of top-1 is a 21–31 percentage-point difference — using the metric that matches what the product actually shows is more honest than picking whichever number looks best.",
      sourceRef: "triageiq:classifier-top3",
    },
    {
      title: "Leave the fabrication-rate gate informational, not blocking, for now",
      body: "The grounding verifier's fabrication-rate numbers (1.9% on kubernetes, 9.1% on vscode) are tracked and reported, but deliberately not wired up as a hard CI gate yet — the team wants an observation window to understand the metric's stability before it can block a deploy. Shipping a gate before trusting the number it's built on would be premature.",
      sourceRef: "triageiq:contamination-adr0018",
    },
  ],
  results: [
    {
      label: "Component classifier accuracy (top-3 / top-1), p50 4.9ms",
      value: "90.4% / 69.0% (vscode) · 82.5% / 51.4% (k8s)",
      sourceRef: "triageiq:classifier-top3",
    },
    {
      label: "Similar-issue retrieval, Recall@5",
      value: "23.5% (kubernetes) — \"genuinely weak\" per the project's own README",
      detail:
        "vscode's number was retired after an audit found its gold pairs were ~80% noise; three zero-training fixes (BM25 fusion, cross-encoder reranking, a stronger embedder) all failed to clear the bar, and reranking made it worse at 190–330x the latency",
      sourceRef: "triageiq:retrieval",
    },
    {
      label: "Resolution-time predictor MAE vs. naive baseline",
      value: "k8s: 104.05d vs. 106.29d naive (+2.1% better)",
      detail: "vscode: 6.02d vs. 3.53d naive — 70.5% worse; served as-is with a transparency badge",
      sourceRef: "triageiq:resolution",
    },
    {
      label: "LLM fabrication rate (grounding-verified)",
      value: "1.9% (k8s) / 9.1% (vscode)",
      sourceRef: "triageiq:contamination-adr0018",
    },
  ],
  story: {
    title: "The model reported a 682-day error — and the fix was a data-splitting bug, not a better model",
    body: [
      "An early version of the resolution-time predictor reported a mean absolute error of roughly 682 days — flagged immediately as suspicious rather than accepted at face value. The investigation found the root cause was the train/test split itself: it divided issues by closed_at, the date an issue was closed. That guarantees, by construction, that any issue still open at the cutoff date lands in the test set and every already-resolved issue lands in train. The train set's median resolution time came out to 1.0 day; the test set's came out to 677 days. The model wasn't failing to learn — it had never seen anything like its test set during training.",
      "Re-splitting by created_at (when an issue was filed, which doesn't leak information about how long it took to close) collapsed the MAE from 693 days down to 87 days. That 8x jump was entirely a bug fix, not a modeling improvement, and the team documented it as exactly that rather than presenting it as a win.",
      "The same investigation surfaced a second, subtler leak: the model's top feature by importance, has_priority (correlation 0.595), turned out to be a label that gets applied during the triage process itself — meaning it wasn't actually available at the moment a real prediction would need to be made. Separately, a routine disjointness-guard build (checking that train and eval data never overlap) turned up a third finding: the judge-eval gold set had been silently contaminated with training data for about three months, affecting 54 of 60 evaluation cases. The team disclosed the contamination at the membership level honestly, rather than trying to compute and publish a \"corrected\" score for numbers they could no longer fully trust.",
    ],
    sourceRef: "triageiq:split-fix",
  },
  links: [
    { label: "Try TriageIQ", href: "https://triage-iq-orcin.vercel.app/" },
    { label: "Source on GitHub", href: "https://github.com/gaurav-gandhi-2411/triage-iq" },
  ],
};
