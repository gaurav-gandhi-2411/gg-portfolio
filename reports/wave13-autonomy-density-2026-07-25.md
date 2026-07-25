# Wave 13 — autonomy, ordering, polish (2026-07-25)

Branch `feat/wave13-autonomy-density`. GG's brief: (1) autonomous metric refresh with
provenance intact, (2) fix the desktop emptiness at 1280–1600px, (3) retire tiering + order
by AI/ML depth + category filters, (4) liveliness via modern CSS, (5) site-wide copy pass,
(6) HF re-fetch, (7) leave the honest/unflattering results alone. All seven addressed;
evidence per item below. Verification SHA for all measurements: `92a1bd8` (preview
deployment `dpl_4TFmZAPxDWHTcSKLMpTC7zC5f1rY`) unless noted.

## 1. Autonomous metric refresh — designed for provenance first

**Architecture** (full operator docs in README → "Autonomous metric refresh"):

- **`content/metrics.json`** — every product-card metric now lives here, keyed by its
  existing provenance ID, carrying `value / source_file / source_line / commit_sha /
  measured_at / repo`. `content/products.ts` consumes values only through
  `lib/metrics.ts#refreshableMetric()`, which **throws at build time** on a missing ID —
  the store can't silently drift from what renders.
- **`.portfolio/metrics.json` in each source repo** — same IDs, same schema, generated
  from each repo's *existing* eval artifacts (no new measurement layer). **11 PRs opened
  this wave** (not merged — GG merges): mindmeld-payloads#1 (Warmer's manifest lives in
  the public payloads repo because mindmeld is private), agentic-shopping-assistant#10,
  triage-iq#42, agentic-travel-booking-system#79, shelfsense-m5#2, review-iq#13,
  multimodal-fashion-recommender#63, gold-rate-tracker#417, AetherArt#27, expense-tracker#2,
  agentgauge#65. Every value was re-verified against the artifact at HEAD before writing.
- **`.github/workflows/metrics-refresh.yml`** — Mondays 03:00 UTC + manual dispatch. Runs
  `scripts/refresh-metrics.mjs`: fetch each repo's manifest → diff → rewrite the store →
  **open a PR** (never a direct commit) whose body lists old → new per metric with source.
  The human review of that PR is the rule-65b gate, unchanged.
- **Fail-soft**: unreachable repo / malformed manifest / missing ID ⇒ skip + note in the PR
  body; the site is never blanked. **Stale guard**: metrics not re-measured in 90+ days are
  flagged, never silently re-asserted. **Link health**: every liveUrl GET-checked with one
  retry (Cloud Run cold starts answer the retry — verified: AetherArt timed out once, passed
  on retry). **HF downloads**: tracked, report-only until crossing the 1,000 display bar.
- **Two sharp edges, documented not hidden**: GITHUB_TOKEN-created PRs don't trigger
  `pull_request` workflows, so the Action dispatches `ci.yml` onto the branch itself
  (ci.yml gained `workflow_dispatch`); drawn figures mirror their metric's numbers by rule,
  so the PR body reminds the reviewer to update both together.

**Tested both ways before shipping** (rule 58c): against the repos' default branches
(manifests not merged yet → all 11 skipped with notes, store untouched — the fail-soft
path); and against the manifest branches via the `METRICS_REF` override with a seeded stale
value (drift detected, store rewritten, old → new table produced — the positive path; the
rewrite restored byte parity with the verified store).

**The pipeline paid for itself before it ran once.** The manifest-verification pass caught
three real drifts on the live site:

| Drift | Site said | Repo's artifact says | Action taken |
|---|---|---|---|
| Warmer Hinglish Spearman | −0.003 → 0.639 | **−0.003 → 0.813** (a LoRA fine-tune reached 0.800; an eval-harness RNG fix landed 0.813; EN 0.837→0.842) | Card, figure, and case study updated — including replacing the now-outdated "fine-tunes lost" story with the true arc: two full-parameter fine-tunes failed, a 13-config method sweep showed every LoRA config winning, the shipped model is published on HF (`hinglish-relatedness-sbert`) with its benchmark. Both the full-set 0.813 and the stricter held-out 0.435 → 0.704 are reported. |
| AgentGauge "8 scoring dimensions" | 8 dimensions, all implemented | **Falsified by the repo's own predictive-validity study**; project rebuilt as a v2 statistical harness | Card + case study rewritten around the v2 reality (details below). Old provenance ID retired; 8 new sourced IDs added. |
| Gold-rate backtest | 194 folds, MAE 258.28 vs 297.19 | **199 folds, MAE 255.28 vs 297.84** (naive still wins, Wilcoxon p≈0, run 2026-07-19) | Label + case-study row updated. |

**AgentGauge deserves its own note.** The repo pivoted: its predictive-validity study found
none of v1's 8 LLM-judged axes predicts real agent task success (surviving correction +
length control), so it rebuilt around what does — a paired, task-clustered, CUPED-adjusted
A/B harness (MDE 8.5pp at 100 tasks/arm, ship target met) and a causally-measured defect
linter (one BLOCKING defect: −13.3 to −28.9pp task success, 3 model families). The new case
study leads with the founding null and the v2.3 scoring-artifact audit story — exactly the
honest-results register GG's item 7 protects. New card metric:
`agentgauge:blocking-causal`. All claims sourced to README @ `939abbf` + named report
files (provenance.md wave-13 section).

## 2. Desktop density at 1280–1600px

Before/after at all three widths: `reports/screenshots/wave13/{before,after}-home-{1280,1440,1600}.jpeg`
(before = production wave 12, after = this branch).

What changed at `xl:` only (mobile/tablet byte-identical layouts, re-verified at 390):

- `Section` gained width steps: prose 2xl (unchanged) / wide → 5xl / grid → 6xl.
- **About**: prose + a "Working across" skills rail (the old one-line list, given real room).
- **Experience**: each company card splits into meta rail (company, dates, location, tech
  chips) + bullet column — resume geometry, information instead of padding.
- **Work**: all 12 projects in a 2-column card grid; cards are `@container`s that move the
  eval figure into a right rail when the card is wide enough.
- **Research**: two-column spread — title/status/links left, thesis right.
- **Case studies**: content column + sticky right rail (on-this-page anchors, headline
  metric card, project links). `after-work-triageiq-1440.jpeg`.
- Nav container tracks the widest column so edges align.

**Honest self-judgment**: at 1440/1600 the page now reads composed — two real columns of
content nearly everywhere, the hero still the calm centered anchor. It is not cramped; the
28px gutters and the 6xl cap keep margins generous. The weakest spot is the Contact
section, deliberately left centered-narrow as the closing note. Judgment confirmed
independently by the design review (below).

## 3. Ordering rubric + categories + filters

**Tiering retired**: `tier` and `showcaseSlugs` deleted from the content model; one card
component for all 12 projects (differences between cards are data availability — a drawn
figure, a pip install — not visual class). The home Work section carries the full set:
filters and depth ordering only mean something over the full set, and this is also what
fills the desktop (item 2). `/projects` shares the same grid and stays the deep-link
target. Two new figures added (ShelfSense dumbbell, ReviewIQ bar) so figure-craft isn't a
flagship leftover. Expense-tracker's case study stays honestly "short" — that's scoping to
the repo's own framing, not second-class treatment.

**Depth rubric** — four axes, 0–3 each, scored from the repos' own documented work:
**A** model/representation work (training, fine-tuning, custom losses) · **B** evaluation
rigor (harnesses, baselines, statistical care, audits) · **C** applied-AI system depth
(multi-stage ML pipelines, agents, retrieval) · **D** novel technique/research.

| # | Project | A | B | C | D | Σ | Basis (sourced examples) |
|---|---|---|---|---|---|---|---|
| 1 | TriageIQ | 2 | 3 | 3 | 2 | 10 | four trained/classical models in sequence; contamination + fabrication audits; CQR |
| 2 | Warmer | 3 | 3 | 2 | 2 | 10 | published LoRA fine-tune on HF; 9-candidate eval-gated bake-offs; method-reframe study |
| 3 | MMFR | 3 | 2 | 2 | 1 | 8 | two-tower InfoNCE trained from scratch; collapse diagnosis; locked-pool recall eval |
| 4 | Style Maitri | 1 | 3 | 3 | 1 | 8 | agentic RAG + CLIP; n=211 intent eval + adversarial live audit; grounding checks |
| 5 | ShelfSense | 2 | 2 | 2 | 1 | 7 | 7 tuned LightGBM variants over 30,490 series; WRMSSE vs naive; harness-lied postmortem |
| 6 | AetherArt | 2 | 2 | 1 | 2 | 7 | trained SDXL LoRA; multi-scorer checkpoint selection; CLIP-blindness study |
| 7 | AgentGauge | 0 | 3 | 1 | 3 | 7 | no model training, but the strongest eval-methodology + research contribution on the list |
| 8 | ReviewIQ | 0 | 2 | 2 | 1 | 5 | tiered routing with published cost/accuracy trade-off; CI-gated multilingual eval |
| 9 | Gold Rate Tracker | 1 | 3 | 1 | 0 | 5 | pre-registered promotion gate, Wilcoxon, power analysis — eval rigor carries it |
| 10 | DealHunter | 0 | 2 | 2 | 0 | 4 | multi-agent + Pareto + LLM-judge evals; depth is engineering more than ML |
| 11 | tracegauge | 0 | 2.5 | 1 | 1 | 4.5 | κ-based heuristic falsification, judge validation, 172-dev generalization study |
| 12 | Expense Tracker | 1 | 1 | 1 | 0 | 3 | three local ML features, manual (non-CI) evals — deliberately a discipline project |

Tie-breaks, called honestly: TriageIQ over Warmer (system breadth + audit depth over
single-axis model work — near-coin-flip); MMFR over Style Maitri (GG's own rubric weights
training over integration); ties at 7 ordered by product-context weight (ShelfSense's eval
scale, AetherArt's training, AgentGauge research-first); **DealHunter over tracegauge**
despite 4 vs 4.5 — the one deviation from raw Σ, because DealHunter runs LLMs in its core
product loop while tracegauge's ML depth is analysis methodology; flagged rather than
score-fudged. tracegauge over Expense Tracker per Σ.

**Categories** (multi-tag, 6): LLM & Agents (5) · Retrieval & Embeddings (5) · Vision &
Generative (3) · Forecasting & Tabular (4) · Evals & Research (3) · Developer Tooling (1).

**Filter design** (`components/project-filter.tsx`): the cards stay fully server-rendered;
pills set one `data-active-category` attribute and static CSS rules do the hiding —
filtering is a single style recalc (~instant at any count; measured click→settled 56ms
including a deliberate 50ms test wait). URL-reflected (`?category=`) via
`history.replaceState` + `useSyncExternalStore` (popstate handled; deliberately **not**
`useSearchParams`, which would drop the prerendered card HTML behind a Suspense boundary on
a static route — SSR/no-JS content wins). Keyboard: real buttons, `aria-pressed`,
per-pill counts, visible focus ring; results announced via `aria-live`; empty state with a
reset action (unreachable from the UI vocabulary, exists for stale deep links). No-JS:
all 12 cards render, pills are inert enhancement. Verified live on the deployed preview:
click filtering, URL reflection, deep links (`/projects?category=forecasting`), back/forward.

## 4. Modern CSS — what shipped and why it earned its place

| Technique | Where | Why it earned it | Degradation |
|---|---|---|---|
| **View Transitions API** | route changes via `TransitionLink` + per-slug `view-transition-name` pairing card title ↔ case-study h1 | the title you clicked physically becomes the page heading — navigation reads as one continuous surface, which is the "modern" feel GG asked for, not a demo | no API / reduced motion / modified clicks → untouched Link + the wave-12 240ms fallback (never both: template consumes a flag). Safety timeout (1.2s) so a slow nav can never freeze the page |
| **Scroll-driven animations** | case-study reading progress bar; hero halo fades to near-zero over the first 90vh | progress = real orientation on long teaching pages; the halo fade keeps wave 11's wow a *hero* moment instead of glowing behind About | both inside `@supports (animation-timeline: scroll())`; bar hidden entirely when unsupported; halo static under reduced motion (cascade re-asserted — a real bug caught in review of my own CSS) |
| **`:has()`** | `.project-grid:has(article:hover) article:not(:hover)` — siblings recede on hover | 12 equal cards need a focus mechanism; this gives one with zero JS. Deliberately excludes `focus-within` (dimming during keyboard traversal hurts orientation) | no `:has()` → no dimming, nothing lost; opacity-only so it stays under reduced motion |
| **Container queries** | project cards are `@container`s; the figure rail engages at ≥30rem card width | the same card is 1-col on mobile, full-width on tablet, half-width at xl — only the *container* width knows which; media queries can't express this | stacked layout is the base state |
| **`text-wrap: balance/pretty`** | all h1–h3 / all paragraphs | multi-line balance on the display serif; no orphans in case-study prose | pure progressive enhancement |

Considered and **rejected**: converting `RevealGroup` to CSS `view()` timelines —
would re-open the wave-9 axe-race class (content below full opacity during scans) for
zero user-visible gain over the existing IO implementation.

Reduced-motion verified via a pre-load `matchMedia` stub differential: boot loader never
opts in, no element below full opacity, the VT gate reports skip. (CSS-side reduce paths
verified by review; the JS gates are where wave-9-class regressions live.)

## 5. Copy pass — every changed line

Case studies read strong throughout (they were written for humans in waves 10–12); the
work was in the card layer. Rewritten, with reasons:

1. **TriageIQ tagline** — was a component list ("TF-IDF classifier, BGE+FAISS retrieval,
   LightGBM…"); now says what it *does* in sequence. Tech chips carry the stack.
2. **Style Maitri tagline** — "grounded against hallucinated price/size claims" →
   "guardrails that keep it from inventing prices or sizes" (plain language, same claim).
3. **MMFR tagline** — dropped "via in-batch InfoNCE contrastive loss" from a card
   one-liner; added "I trained" (the point recruiters should catch).
4. **ShelfSense tagline** — led with the forecasting problem, not the orchestration tool.
5. **AgentGauge tagline** — full rewrite (stale claim, see item 1). Also fixed a
   context bug: "…paper in Research below" appeared on /projects where there is no
   Research below.
6. **Gold Rate tagline** — "honest naive-baseline forecast plus a directional ML
   companion" → "ships the honest baseline forecast, because the ML model couldn't beat
   it" (the actual story, in one clause).
7. **DealHunter tagline** — "Pareto-ranked itineraries, live via SSE streaming" → "two
   genuinely different best itineraries, not a wall of results" (user outcome, not
   transport protocol).
8. **Expense Tracker tagline** — feature list → one sentence with a human rhythm.
9. **tracegauge tagline** — fragment → sentence.
10. **README opener** — still said "single-page site" (stale since wave 12); architecture
    notes updated for the wave-13 content layer.
11. Whitespace/indentation glitch in style-maitri.ts problem paragraph.

Not changed: hero, About, Experience bullets, Contact (wave-10-approved voice, reread and
confirmed); the honest/unflattering results everywhere (GG item 7 — untouched, and the new
AgentGauge/Warmer content *adds* two more falsification stories to that register).

## 6. Hugging Face re-check

API-fetched 2026-07-25: **739 cumulative downloads** across 3 models — the new
`hinglish-relatedness-sbert` (459, Warmer's shipped fine-tune) + aetherart-ukiyo-sdxl (249)
+ aetherart-ukiyo-sd21 (31). Up 6.6× from wave 12's 112, still "a few hundred" → **no site
stat**, per the brief's own bar. Tracked in metrics.json's informational block; the weekly
PR flags a 1,000-crossing so the decision re-surfaces exactly when it should.

## 7. Honest results — untouched and extended

No unflattering number was softened: gold-rate's naive-wins headline, TriageIQ's 23.5%
retrieval and 70.5%-worse-than-naive vscode predictor, MMFR's brand-personalization caveat,
tracegauge's no-human-gold caveat all ship as-is. The wave *added* to this register:
AgentGauge now leads with the study that falsified its own v1, and Warmer's results row
reports the stricter held-out 0.704 beside the headline 0.813.

## Verification (all at `92a1bd8` on the deployed preview unless noted)

| Check | Result | Artifact |
|---|---|---|
| Build | 20 static pages, lint + typecheck clean | CI on branch |
| axe-core | **0 violations, all 14 routes** (one real heading-order finding on /projects found and fixed mid-wave) | local run vs production build |
| Lighthouse (preview, desktop) — home | perf 97 · **a11y 100** · BP 100 · SEO 63* · LCP 0.9s · CLS 0.002 | `reports/lighthouse-wave13-home-2026-07-25.json` |
| Lighthouse (preview, desktop) — /work/triageiq | perf 100 · **a11y 100** · BP 100 · SEO 63* · LCP 0.6s · CLS 0 | `reports/lighthouse-wave13-triageiq-2026-07-25.json` |
| Eager JS budget | **204,765 B gzip vs 220,160 ceiling** (wave 12: 202,787 → +1,978 B = TransitionLink + view-transition module + filter component; the filters themselves cost ~0 render work by design) | chunk sum, local prod server |
| Filters | instant (CSS recalc), URL-reflected, deep links + back/forward, aria-live, keyboard | driven on deployed preview |
| View transitions | VT nav verified on preview (Chrome); fallback + reduced-motion gates verified via stub differential | preview + local |
| No-JS | all 12 cards + pills in SSR HTML (server-rendered by construction) | curl grep |
| Live data | Warmer puzzle badge restored (manifest dropped the `en` track upstream — **a real fail-soft gap found and fixed**: the old code threw on the new shape and would have broken the next production ISR pass) | build + preview |

*SEO 63 = the known `X-Robots-Tag: noindex` Vercel preview artifact (waves 4–12);
production stays 100.

Home perf 97 / LCP 0.9s vs wave 12's 99 / 0.6s: the home page now renders 12 full cards +
filters instead of 5 (2.4× the Work content) — the regression is content, not waste, and
the case-study pages (which gained the rail) hold 100 / 0.6s. CLS 0.002 (was 0.000) is
below perceptibility; likely the halo/filter pills area — flagged for the next wave rather
than hidden.

## Self-grade (the brief's own questions)

- **Is desktop actually full now?** Yes at 1280–1600 — two content columns nearly
  everywhere, verified against before-shots; Contact deliberately stays a quiet close.
- **Do filters feel instant?** Yes — CSS-only visibility, no re-render, no server trip.
- **Does the copy read human?** The card layer now does; the case studies already did.
- **Weakest remaining spot:** home is long on mobile (12 stacked cards); the filters
  mitigate. A "collapse below the fold on mobile" pattern was considered and rejected this
  wave (hiding projects is what tiering did). Revisit if GG flags it.

## Design-reviewer sign-off (T2 gate)

First pass: **blocked on one finding, everything else suggestion-level.** Scores:
structure 7 · density 7.5 · craft 7 · rhythm 6.5 · consistency 6.5. Verdict: "once
finding 1 lands, this is approved."

1. **BLOCKING — three content widths on one page** (About/Experience/Research at 5xl vs
   Work/nav at 6xl = a 64px zigzag at 1600, pixel-measured by the reviewer). **Fixed by
   unifying on ONE 5xl axis** (Section's `grid` step deleted; Work, /projects, and the nav
   all at `xl:max-w-5xl`) — calmer than widening prose sections that can't fill 6xl.
   Re-verified in-browser: nav content, About, Experience, and Work cards all sit at
   x=304 at a 1600px viewport. Knock-on handled: half a 5xl grid computes to ~478px, so
   the card container-query threshold moved 30rem → 28rem (figure rails re-verified
   engaged).
2. **SUGGESTION (taken) — border contrast on filter pills**: unselected pills used
   `border-border/40` ≈ 1.47:1 — the exact value the border token was raised to escape,
   and on a pill the border is the only boundary affordance (WCAG 1.4.11 applies). Now
   full-opacity `border-border` (3.38:1). The reviewer's wider point — the sitewide
   `/30–/60` border-opacity pattern predating wave 13 — is logged below as a follow-up
   token audit, not silently absorbed.
3. **SUGGESTION (taken) — wrapped tech chip**: Experience meta rail 14rem → 16rem; the
   "Bayesian Change-Point Detection" chip no longer wraps into a stretched capsule.
4. **SUGGESTION (taken) — mobile pill cloud**: pills wrap left-aligned below sm instead
   of centered ragged rows.
5. **SUGGESTION (partially taken) — empty state unverified**: the CSS zero-cards path was
   forced live (stripping a category off every card + selecting it → 0 visible, URL and
   pills correct). The React message branch itself keys off the server-provided `cats`
   prop and is unreachable without a content change — verified by review of the 4-line
   conditional plus the live-verified count computation that drives it (the same count
   feeds the aria-live text, which matched CSS reality in every filter test). Honest
   status: message JSX reviewed, not rendered.
6. **SUGGESTION (taken) — 1024–1279 band**: grid columns moved lg → xl to match Section's
   width step exactly; verified at 1100px (single column, 720px cards, figure rails on).
   `after-home-1100.jpeg` added.
7. Loading/error states: reviewer confirmed fail-soft omission is appropriate; no change.

**Follow-up logged (not this wave):** sitewide border-opacity token audit — either a
`--border-subtle` token that still clears 3:1, or reserve opacity borders for purely
decorative dividers (reviewer finding 2's systemic half; predates wave 13).

Post-fix numbers: axe 0 (home + /projects re-run; other routes untouched by the fixes),
budget 204,770 B gzip (+5 B from class strings), all "after" screenshots re-captured at
the unified width (the report's screenshot references are the final versions).

Sign-off closure, stated precisely: the reviewer's verdict was conditional approval
("once finding 1 lands, this is approved"); the reviewer's session could not be resumed
for a re-confirmation, so the condition was closed two independent ways instead —
in-browser pixel measurement (nav/About/Experience/Work all at x=304 @1600px) and a
separate verifier agent's 7/7-pass source audit of the width unification (no 6xl remains
in app/ or components/; thresholds retuned). Recorded here rather than claimed as a
fresh reviewer pass.

## Resume sync (follow-up in the same PR)

The resume (`.assets/resume-sources/Gaurav_Gandhi_Resume_2026.docx` → `public/resume.pdf`)
was built from pre-correction provenance. Every resume metric was diffed against the
corrected store; **two were stale, everything else matched** (Style Maitri 93.8%/52K,
TriageIQ 82.5/90.4 + 1.9–9.1%, DealHunter 597/≥87.65%, MMFR 3.06×, AetherArt 6.2GB,
ReviewIQ 83.8%, "Nine live AI products" = liveProductCount, gold-rate's qualitative claim —
the resume never cited a fold count, so 194→199 needed no resume change):

1. **Warmer**: "Spearman −0.003 → 0.639" → "−0.003 → 0.813, held-out 0.435 → 0.704", now
   crediting the published LoRA fine-tune (hinglish-relatedness-sbert on Hugging Face) —
   a strictly stronger resume line, because it's now a *published model*, not just a fix.
2. **AgentGauge (Research line)**: "8 implemented scoring dimensions; 10-server pilot" →
   the v2 truth: predictive-validity study falsified the v1 score; the rebuilt causal A/B
   harness measures a BLOCKING defect at −13.3 to −28.9pp across 3 model families.

Method: surgical run-level docx edits (formatting/hyperlinks untouched), re-exported via
Word (FileFormat 17). **Verified still exactly 2 pages** (Word ComputeStatistics + pypdf),
same page boundaries (p1 ends at Research, p2 Projects→Certifications), new strings
present / stale strings absent in extracted text, `public/resume.pdf` hash-matched to the
regenerated source. Backup of the pre-edit docx kept beside the source.

**Pipeline extension — resume drift guard**: `content/resume-metrics.json` maps each
resume-claimed metric to its store id, recording the store value at sync time + the PDF's
sha256. `scripts/refresh-metrics.mjs` now emits a "Resume drift" section in the weekly PR
when (a) any claimed metric's store value moves after the sync, or (b) `public/resume.pdf`
changes without a manifest re-sync. Report-only by design — the resume is a designed
document a human regenerates. Tested: clean run 0 drifts; seeded store change → drift row
with site-now vs synced-at values; seeded hash mismatch → explicit warning; restored state
back to 0.

## Process notes

- 4 executor subagents (source-repo manifests ×3 batches + agentgauge follow-up), 1
  design-reviewer; all single-level dispatch (rule 70c).
- Escalation-rule-6 events (results contradicting shipped conclusions): AgentGauge pivot,
  Warmer fine-tune success, gold-rate fold growth — all surfaced here and in provenance.md
  rather than silently absorbed; the site now matches the repos' current truth.
- The 11 source-repo PRs need GG's merges for the weekly pipeline's first live run to find
  the manifests (until then it fail-softs with per-repo notes, verified).
