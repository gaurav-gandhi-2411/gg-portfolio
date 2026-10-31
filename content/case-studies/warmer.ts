import type { CaseStudy } from "../types";

// Sources: mindmeld repo (README.md, spec.md, spec-hinglish-fix.md,
// docs/known-limitations.md, PLAN.md) — see provenance.md wave-12 section.
// Perf-budget claim refreshed wave 19 (2026-07-31): the app fires zero LCP
// entries by design; README.md replaced the LCP budget with FCP on 2026-07-30.
// F12 (2026-09-23): added the public-benchmark result row + the model/
// dataset links, sourced to the hinglish-relatedness-sbert model card and
// hinglish-relatedness-benchmark dataset card on Hugging Face (fetched
// 2026-09-23) — see provenance.md's F12 section. Doesn't advance the
// verifiedAt date above: the pre-existing mindmeld-sourced numbers on this
// page were not re-checked this pass, only the new HF-sourced row was added.
export const warmer: CaseStudy = {
  slug: "warmer",
  verifiedAt: "2026-07-31", // wave 19 -- last re-checked against source this session
  title: "Warmer",
  dek: "Diagnosed a Hinglish embedding model stuck at zero correlation, fixed the real root cause, then caught its own 'more data' fix making things worse, and shipped the LoRA model that actually worked.",
  depth: "full",
  problem: [
    "Daily word games like Wordle are hugely popular, but they're English-only and letter-based: a guess is either right or wrong. Warmer asks a different question, how close is your guess in meaning? You guess a secret word, and an AI language model scores how semantically near you are, from Freezing to Scorching.",
    "It's built for word-game players in India in particular: Warmer is one of very few daily games with a native Hinglish (romanized Hindi-English) mode, which turned out to be the hardest engineering problem in the project.",
  ],
  approach: [
    "The key design decision is that no AI runs while you play. Each day's puzzle is fully precomputed offline: a Python generator takes the day's secret word from a curated schedule, embeds the entire vocabulary with a sentence-embedding model (a model that turns words into lists of numbers, where similar meanings land near each other), ranks every word by similarity to the secret, and writes one small compressed file per day per language.",
    "The Flutter app, Android and web, just downloads that day's file and looks your guess up in the precomputed ranking. That makes the marginal serving cost per player effectively zero, and it means the generator can afford a heavier, more accurate model, because it only runs once at build time.",
    "The payload is obfuscated (hashed keys, an encoded secret) so opening the file in a browser doesn't spoil the puzzle, and the app bundles a week of puzzles offline as a fallback.",
  ],
  architecture: {
    intro:
      "Two halves that never run at the same time: an offline generator that does all the ML work, and a runtime that is deliberately ML-free.",
    stages: [
      { label: "Daily secret schedule", kind: "input", detail: "one word per day per language" },
      {
        label: "Python payload generator",
        detail: "runs once at build time, zero runtime cost",
        parallel: [
          { label: "English embeddings", detail: "sentence-transformers" },
          { label: "Hinglish embeddings", detail: "gauravgandhi2411/hinglish-relatedness-sbert (LoRA fine-tune of l3cube-pune/indic-sentence-bert-nli)" },
        ],
      },
      {
        label: "Full-vocabulary similarity ranking",
        detail: "every word scored against the secret, quantized + obfuscated",
      },
      {
        label: "Gzipped daily payload → GitHub Pages CDN",
        detail: "EN ~777 KB/day · hi-en ~150 KB/day",
      },
      {
        label: "Flutter app (Android + web PWA)",
        detail: "guess = local rank lookup, no inference · 7 days bundled offline",
      },
      {
        label: "Heat-band feedback + social layer",
        kind: "output",
        detail: "Firebase groups, leaderboards, shareable results",
      },
    ],
    note: "Deployed with flutter build web --wasm on Vercel; uptime-checked every 15 minutes via GitHub Actions.",
  },
  decisions: [
    {
      title: "Precompute everything offline instead of running a model per guess",
      body: "The game only needs a fixed daily vocabulary ranked once, so the ML moves to build time. Runtime cost per player drops to ~$0, and the generator can use a more accurate model than a live API could afford.",
      sourceRef: "warmer:precompute-design",
    },
    {
      title: "Swap the Hinglish model, chosen by an eval-gated bake-off",
      body: "The original multilingual model was trained on Hindi in Devanagari script. Romanized words like \"baarish\" or \"jeet\" were out-of-distribution, so it clustered them near unrelated Latin-script languages by surface form. The fix was an eval-gated bake-off across nine candidates; l3cube-pune/indic-sentence-bert-nli, a multilingual Indic sentence-embedding model (MuRIL fine-tuned on NLI data for ten Indian languages plus English), scored highest on Spearman among the nine candidates and won on measured metrics.",
      sourceRef: "warmer:hinglish-fix",
    },
    {
      title: "Compile Dart to WebAssembly, decided by measurement",
      body: "The --wasm target was adopted only after an isolated preview measured the difference: total blocking time 221ms → 13.5ms and 417 KB less page weight versus the default JavaScript build.",
      sourceRef: "warmer:wasm-decision",
      selfReported: true,
    },
    {
      title: "When fine-tuning failed twice, change the method, not the data",
      body: "Two full-parameter fine-tuning attempts both regressed held-out Spearman correlation, the second got worse after adding more training data (543 pairs, then 756/1028 pairs), falsifying the \"more data fixes it\" hypothesis. The eventual win held the data fixed and swept the method instead: every full-parameter and frozen-layer config stayed within noise, every LoRA config beat the baseline, three of them CI-significantly. The shipped model is that LoRA fine-tune, published openly on Hugging Face with the benchmark that judges it.",
      sourceRef: "warmer:lora-reframe",
      selfReported: true,
    },
  ],
  results: [
    {
      // Split from a single "−0.003 → 0.813" row on 2026-08-13. The two numbers
      // come from the SAME file and line at two different commits (line 24 of
      // baseline_report.md, pre- and post-fine-tune), so they are two separate
      // citations and each now carries its own.
      label: "Hinglish ranking quality after the fine-tune (Spearman vs. AI-authored, owner-reviewed near/mid/far tiers)",
      headline: true,
      value: "0.813",
      detail: "the script-mismatch fix reached 0.639; the LoRA fine-tune reached 0.800 on the same 25-secret production set, which now includes secrets it was trained on; an eval-harness RNG fix then regenerated that set's random far-tier words, moving it to 0.813 (English 0.837 → 0.842 with no model change). The stricter held-out number, on secrets never trained on, is 0.435 → 0.704, both are reported, neither hidden",
      sourceRef: "warmer:hinglish-fix",
    },
    {
      label: "The same metric before the fine-tune",
      value: "−0.003",
      detail: "literally no correlation; same harness, same file and line, at the pre-fix commit (the far-tier words were regenerated at the 0.813 commit, so the two are not on identical items)",
      sourceRef: "warmer:hinglish-baseline",
    },
    {
      label: "Cluster separation, base vs fine-tuned (mean silhouette, raw embeddings)",
      value: "0.0370 base vs 0.0247 fine-tuned",
      detail:
        "each model scored on its OWN k=7 partition, the control. On the fine-tune's own partition the gap looks 9.3× the other way; that version favours the fine-tune by construction, so both are published and the viewer states the reversal",
      sourceRef: "warmer:embedding-separation",
    },
    {
      label: "Cross-language consistency (translation pairs landing in the right band)",
      headline: true,
      value: "5.1% → 78.0%",
      detail:
        "full 60-pair schedule (59 resolved), which includes secrets the model was trained on; on held-out secrets only, 37.5% → 81.25%",
      sourceRef: "warmer:hinglish-fix",
    },
    {
      label: "Hinglish relatedness benchmark (50 held-out secrets) vs. 7 off-the-shelf alternatives",
      value: "0.675 Spearman [95% CI 0.601, 0.741], 0.740 cross-language pass-rate [0.62, 0.86]",
      detail:
        "leads all 7 tested alternatives (including 2 released after the original bake-off) on both metrics, CI-significant in all 14 comparisons, on 50 held-out secrets (42 dim1-eligible). The public dataset publishes the 34 of those that were never game words (the other 16 are live game secrets); on those 34 the model scores 0.657 [0.569, 0.736]",
      sourceRef: "warmer:hinglish-public-benchmark",
      format: "prose",
    },
    {
      label: "Test suite",
      value: "781 passed generator · 530 passed app (2026-07-30) · 2/2 web integration (README figure, undated)",
      sourceRef: "warmer:tests",
      selfReported: true,
    },
    {
      label: "Web perf (tracked budget)",
      value: "FCP 992ms (≤1800ms) · TBT 26ms (≤200ms) · CLS 0",
      detail: "LCP is deliberately not budgeted, this CanvasKit-rendered app fires zero LCP entries by design (no traditional largest-contentful DOM element for the Paint Timing API to key off), confirmed via a live PerformanceObserver check; FCP is the tracked load-speed proxy instead",
      sourceRef: "warmer:perf-budget",
      selfReported: true,
    },
  ],
  story: {
    title: "Zero correlation to a published, working model, the debugging trail, including the fixes that made it worse first",
    body: [
      "At launch, the Hinglish mode's semantic ranking measured a Spearman correlation of −0.003 against the project's hand-tiered near/mid/far relatedness labels (AI-authored, owner-reviewed), literally no correlation. The root cause was empirical, not speculative: the multilingual embedding model had learned Hindi in Devanagari script, so romanized Hinglish words were gibberish to it. \"Dil\" landed near Turkish words; \"dua\" near Italian, clustered by how they're spelled, not what they mean.",
      "The fix was a nine-candidate bake-off under a fixed evaluation harness, transliteration pipelines, code-mixed BERT variants, raw mean-pooled MuRIL, decided purely on measured metrics. A multilingual Indic sentence-embedding model, l3cube-pune/indic-sentence-bert-nli (MuRIL fine-tuned on NLI data), won, taking Spearman to 0.639.",
      "Then came the more interesting result: two full fine-tuning cycles tried to push past that ceiling with curated and corpus-mined Hinglish word pairs, and both made the model worse, the second attempt, with more data, regressed further than the first. The project documented that as a falsified hypothesis and shipped the off-the-shelf model while the question sat open.",
      "The eventual breakthrough came from changing the method, not the data: holding the training set fixed and sweeping capacity-control configurations showed every full-parameter variant stuck at noise while every LoRA variant improved, a small-data overfitting signature the earlier attempts had misread as a data problem. The winning LoRA model now ships in production and is published on Hugging Face (hinglish-relatedness-sbert), alongside a public benchmark drawn from the same 50-secret evaluation that compared it against seven alternatives.",
    ],
    sourceRef: "warmer:lora-reframe",
  },
  closing: [
    "If you need a model that has to work across code-mixed or low-resource languages, not just English demos, this is the debugging discipline that gets it there: falsify the easy hypothesis, measure the alternative, and don't ship a fix until it's beaten the baseline on held-out data.",
  ],
  links: [
    { label: "Play Warmer", href: "https://playwarmer.vercel.app/" },
    {
      label: "hinglish-relatedness-sbert on Hugging Face",
      href: "https://huggingface.co/gauravgandhi2411/hinglish-relatedness-sbert",
    },
    {
      label: "Benchmark dataset on Hugging Face",
      href: "https://huggingface.co/datasets/gauravgandhi2411/hinglish-relatedness-benchmark",
    },
  ],
};
