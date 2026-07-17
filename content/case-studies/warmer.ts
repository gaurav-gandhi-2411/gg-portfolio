import type { CaseStudy } from "../types";

// Sources: mindmeld repo (README.md, spec.md, spec-hinglish-fix.md,
// docs/known-limitations.md, PLAN.md) — see provenance.md wave-12 section.
export const warmer: CaseStudy = {
  slug: "warmer",
  title: "Warmer",
  dek: "A daily semantic word game — and the embedding-model debugging story behind making it work in Hinglish.",
  depth: "full",
  problem: [
    "Daily word games like Wordle are hugely popular, but they're English-only and letter-based: a guess is either right or wrong. Warmer asks a different question — how close is your guess in meaning? You guess a secret word, and an AI language model scores how semantically near you are, from Freezing to Scorching.",
    "It's built for word-game players in India in particular: Warmer is one of very few daily games with a native Hinglish (romanized Hindi-English) mode, which turned out to be the hardest engineering problem in the project.",
  ],
  approach: [
    "The key design decision is that no AI runs while you play. Each day's puzzle is fully precomputed offline: a Python generator picks the secret word, embeds the entire vocabulary with a sentence-embedding model (a model that turns words into lists of numbers, where similar meanings land near each other), ranks every word by similarity to the secret, and writes one small compressed file per day per language.",
    "The Flutter app — Android and web — just downloads that day's file and looks your guess up in the precomputed ranking. That makes the marginal serving cost per player effectively zero, and it means the generator can afford a heavier, more accurate model, because it only runs once at build time.",
    "The payload is obfuscated (hashed keys, an encoded secret) so opening the file in a browser doesn't spoil the puzzle, and the app bundles a week of puzzles offline as a fallback.",
  ],
  architecture: {
    intro:
      "Two halves that never run at the same time: an offline generator that does all the ML work, and a runtime that is deliberately ML-free.",
    stages: [
      { label: "Daily secret schedule", kind: "input", detail: "one word per day per language" },
      {
        label: "Python payload generator",
        detail: "runs once at build time — zero runtime cost",
        parallel: [
          { label: "English embeddings", detail: "sentence-transformers" },
          { label: "Hinglish embeddings", detail: "l3cube-pune/indic-sentence-bert-nli" },
        ],
      },
      {
        label: "Full-vocabulary similarity ranking",
        detail: "every word scored against the secret, quantized + obfuscated",
      },
      {
        label: "Gzipped daily payload → GitHub Pages CDN",
        detail: "EN ~777 KB/day · hi-en ~146 KB/day",
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
      title: "Swap the Hinglish model for one trained on romanized text",
      body: "The original multilingual model was trained on Hindi in Devanagari script. Romanized words like \"baarish\" or \"jeet\" were out-of-distribution, so it clustered them near unrelated Latin-script languages by surface form. The fix was an eval-gated bake-off across nine candidates; a model trained natively on code-mixed romanized text won.",
      sourceRef: "warmer:hinglish-fix",
    },
    {
      title: "Compile Dart to WebAssembly, decided by measurement",
      body: "The --wasm target was adopted only after an isolated preview measured the difference: total blocking time 221ms → 13.5ms and 417 KB less page weight versus the default JavaScript build.",
      sourceRef: "warmer:wasm-decision",
    },
    {
      title: "Ship the off-the-shelf model, not a fine-tune — because the fine-tunes lost",
      body: "Two separate fine-tuning attempts to push the Hinglish model further both regressed held-out accuracy (Spearman 0.435 baseline → 0.376 → 0.324), falsifying the \"more data fixes it\" hypothesis. The honest off-the-shelf result shipped instead.",
      sourceRef: "warmer:finetune-failures",
    },
  ],
  results: [
    {
      label: "Hinglish semantic accuracy (Spearman correlation vs. human judgments)",
      value: "−0.003 → 0.639",
      detail: "after the script-mismatch fix; English holds at 0.837",
      sourceRef: "warmer:hinglish-fix",
    },
    {
      label: "Cross-language consistency",
      value: "5.1% → 54.2%",
      sourceRef: "warmer:hinglish-fix",
    },
    {
      label: "Test suite",
      value: "160/160 generator · 94/94 app · 2/2 emulator integration",
      sourceRef: "warmer:tests",
    },
    {
      label: "Web perf (tracked budget)",
      value: "TBT 26ms · LCP 3,082ms",
      detail: "LCP fails its own 3,000ms ceiling by 82ms — tracked openly as a known limitation, not hidden",
      sourceRef: "warmer:perf-budget",
    },
  ],
  story: {
    title: "The Hinglish engine launched broken — and the fix wasn't more data",
    body: [
      "At launch, the Hinglish mode's semantic ranking measured a Spearman correlation of −0.003 against human similarity judgments — literally no correlation. The root cause was empirical, not speculative: the multilingual embedding model had learned Hindi in Devanagari script, so romanized Hinglish words were gibberish to it. \"Dil\" landed near Turkish words; \"dua\" near Italian — clustered by how they're spelled, not what they mean.",
      "The fix was a nine-candidate bake-off under a fixed evaluation harness — transliteration pipelines, code-mixed BERT variants, MuRIL — decided purely on measured metrics. A model trained natively on romanized code-mixed text won, taking Spearman to 0.639.",
      "Then came the more interesting result: two full fine-tuning cycles tried to push past that ceiling with curated and corpus-mined Hinglish word pairs, and both made the model worse — the second attempt, with more data, regressed further than the first. The project documents this as a falsified hypothesis and ships the off-the-shelf model, imperfections and all.",
    ],
    sourceRef: "warmer:finetune-failures",
  },
  links: [{ label: "Play Warmer", href: "https://playwarmer.vercel.app/" }],
};
