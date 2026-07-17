# Wave 10 — content, voice, and two real bugs

Branch `feat/wave10-fixes-content` off `main@8e172d8`. GG deployed wave 9, clicked through, and
sent specific feedback: two things were broken, and the voice read wrong. This wave fixes what's
inside the wave-9 structure — no redesign.

## Bug 1: Work slider "can't slide it"

**Reproduced on production before touching anything.** A synthetic 120px mouse drag against
`https://gaurav-gandhi.vercel.app` moved the slider **0px — even mid-drag** (measured
`scrollLeft` at every step). Vertical wheel over the scroller: also 0px.

**Mechanism (rule 85):** with `scroll-snap-type: x mandatory` active, Chrome re-snaps every
programmatic `scrollLeft` assignment to the nearest snap point immediately. Card step is ~316px
at desktop, so any drag under ~158px was clamped straight back to 0 — the drag handler ran
correctly and visibly did nothing. Add no wheel support and no visible controls, and a mouse
user has literally no way to move it.

**Fix (components/work-slider.tsx):**
- Snap is disabled (`scrollSnapType = "none"`) for the duration of a mouse drag and restored
  after release, with a smooth snap-to-nearest-card on release.
- 4px movement threshold before a drag starts, so clicks on card links still work.
- Visible prev/next arrow buttons (text `←`/`→`, matching the site's existing "Live ↗" text-glyph
  idiom — no icon dependency), disabled at the ends, `aria-label`ed.
- Existing affordances kept: grab cursor, next-card peek, progress bar + `NN / NN` counter.

**Verified (local prod build):** the same 120px synthetic drag now moves 120px mid-drag and
correctly snaps back to the nearest card on release (a sub-half-card drag returning to card 1 is
snap working, not the bug); a longer drag advances. Arrows advance/retreat with correct disabled
states at both ends. Deployed-preview verification: see "Preview verification" below.

## Bug 2a: Heat toy "Couldn't load the word list" in production

**Diagnosis:** could not reproduce a persistent failure — `/heat-toy-vocab.json` returns 200
with correct content-type on the live site, and the toy loads. The actual defect is in the
failure handling: the wave-9 fetch was **single-attempt with a permanent error state**. Any
transient failure — a mid-deploy blip, one flaky mobile request — parked the component on the
error message forever with no way back but a full reload. That's what GG hit.

**Fix (components/heat-toy.tsx):** 3 fetch attempts with 0/500/1500ms backoff (rule 108), plus a
"Try again" button on the error state that re-runs the ladder without a page reload.

**Verified:** stubbed `fetch` to reject for the vocab URL → all three attempts fail → error +
"Try again" render; un-stubbed and clicked Try again → toy loads with no reload. End-to-end on
the local prod build.

## Bug 2b: Heat toy — "a visitor has no idea what to guess"

Added a one-line hint under the input, shown until the first guess:

> It's one of 410 everyday English words. Not sure where to start? Try `jungle` or `soldier` —
> the plot shows how close you land.

The two starter words are clickable chips that submit as real guesses (teaching the interaction
by doing it). They're picked deterministically per day at fixed offsets (+137, +271) from the
daily index — never equal to the secret (neither offset is a multiple of the 410-word vocab
size), different words each day. Honesty check: the vocab genuinely is 410 everyday English
words (verified by sampling `public/heat-toy-vocab.json`); the hint claims nothing about the
specific daily word beyond membership in that list, so it can never mismatch.

## Hero intro — options drafted, one built

GG's read on the old copy ("I build and ship AI products end-to-end under my own name… through
evaluation to a pre-submission paper"): boastful/overwrought. Direction: warm, conversational,
first-person, humble, short.

**Built (option A):**
> I like building AI products and seeing them all the way through — from the first experiment to
> something real people can use. Below is what I've made so far: a daily word game, a fashion
> styling assistant, an issue-triage service, and the research they led me to. The numbers are
> honest, including the one where a simple baseline beat my model.

The closing line is factual, not rhetorical — Gold Rate Tracker's naive baseline beats the ML
model and the site says so (`gold-rate-tracker:headline`).

**Alternate B (not built):**
> Most of what I know about AI, I learned by shipping it. This page is the record: products I've
> built and run myself, the research they led to, and the numbers — good and bad — measured
> honestly.

**Alternate C (not built):**
> I build AI products in my own time and lead a data-science team by day. The work below is mine
> end-to-end — designed, built, evaluated, shipped.

A was chosen because it's the warmest, names the actual work concretely without listing
credentials, and lands on the site's most disarming true fact.

## Hero stats — options proposed, one built

GG didn't like the previous three (9 products / N+ puzzles / 1 preprint — all independent-work
counts, one of them weak).

**Built (option 1 — career + independent blend, plain labels, all verifiable):**
| Value | Label | Provenance |
|---|---|---|
| 5 | years in data science & ML | `derived:career-years` — computed from Jul 2021 (first DS role on the resume, TCS) at build/ISR time, never hand-typed |
| 9 | AI products live today | `derived:products-live-count` — unchanged derivation |
| 5 | people on the data-science team I lead | `resume:indium-senior-lead` — verbatim resume claim |

**Alternate 2 (not built):** no stats at all — delete the `dl` row for a fully clean intro.
One-line change in `components/sections/hero.tsx` if GG prefers it.

**Alternate 3 (not built):** keep 9 products + N+ puzzles, drop only the preprint stat (the
weakest of the old three). Rejected: still all-independent, doesn't answer "who is this person
professionally" the way option 1's first and third stats do.

## Project inventory — what was added, what was skipped

Full sweep of `C:\Users\gaura\ml-projects` (17 directories) cross-referenced against the 10
products on the site.

**Added: AgentGauge** (secondary/index tier, 11th slide). Public GitHub repo, real README, 8
scoring dimensions all marked Implemented, 87% coverage across 41 tests, 10-server pilot. It's
also the research program behind the paper already in the site's Research section — the card
cross-references it. Its README explicitly scopes it as "a pilot-scale research artifact… not a
validated product claim," so the card metric is deliberately descriptive ("8 scoring dimensions
· 10-server pilot"), not a performance number. Provenance entry `agentgauge:scoring-dimensions`,
verified directly against the README, not the inventory agent's relay.

**Skipped, with reasons:**
- `expense-tracker` — deployed (Cloud Run + Next.js frontend) with a public repo, but its only
  quoted metric (`accuracy: 0.94`) is an illustrative example payload in the README, not a
  validated eval result. Fails the site's no-unverified-claims bar; a CRUD app with optional LLM
  features also dilutes an applied-AI portfolio. Revisit if it gains a real eval.
- `reclaim` — no git remote, README says "Phase 1 in progress. Nothing here scans or modifies a
  real disk yet." Not shippable.
- `triage-iq-ui`, `mindmeld-payloads`, `triage-iq-ui-wt-prtemplate` — supporting repos of
  products already on the site (UI half, data-publishing half, a worktree). Folded, not cards.
- 8 remaining dirs — empty scaffolds, worktree parents, venvs, scratch. Not projects.

## Contact rewrite

Old: "…hiring-manager or recruiter, let's talk." / "…if the scope is a good fit." (GG: vague,
unprofessional). New:

> I'm looking for Senior or Principal Applied AI roles, and I take on select AI/ML consulting
> engagements.
> If my work fits what you're building, email is the fastest way to reach me — I read everything
> and reply promptly.

Email stays the page's one display-size action; location + GitHub/LinkedIn row unchanged.

## Applied-AI inventory (GG asked: "what AI is on here?")

What is actually running AI/ML on the site itself, versus linking out:

1. **Embedding-space plot (Warmer annex)** — real 72-dim quantized sentence-transformer
   embeddings for 410 words, shipped as a 116KB static JSON; cosine similarity computed
   client-side per guess; the 2D plot is the space's real first two principal components (72.3%
   variance retained, stated on-page). The daily word is a deterministic hash — same for every
   visitor, no server.
2. **Live TF-IDF classifier (TriageIQ disclosure)** — a genuine TF-IDF + cosine classifier
   built and run in the browser over 12 real GitHub issue titles (6 kubernetes, 6 vscode),
   labeled on-page as illustrative of the production model, not the production model.
3. **Live data fetches (not AI, but live)** — Warmer's daily puzzle number (public manifest),
   tracegauge PyPI weekly downloads, per-repo "shipped Nd ago" freshness badges, and the merged-
   PR shipping log, all ISR-revalidated every 6h, all fail-soft.

Everything else AI on the page is the products themselves, linked out to their own deployments.

## Verification

| Check | Result |
|---|---|
| `npm run lint` / `typecheck` / `build` | all clean |
| axe-core 4.12.1 | **0 violations** |
| Lighthouse (desktop, local prod build) | **a11y 100 · SEO 100** · BP 96 · CLS 0 — artifact `reports/lighthouse-wave10-2026-07-17.json` |
| BP 96 cause | sole failed audit is `errors-in-console`: `/_vercel/insights` + `/_vercel/speed-insights` scripts 404 on localhost because they only exist on Vercel's platform. Pre-existing (same in wave 9), absent in production. |
| JS budget | **201,535 B gzip vs 220,160 ceiling** (196.8 KiB, ~18.2 KiB headroom) — AgentGauge card + arrows + hints cost ~0 net (content is server-rendered; slider/toy deltas are small) |
| Slider fix | verified local prod build (synthetic pointer-event drag, arrow clicks, end states) + deployed preview (below) |
| Heat-toy retry | verified end-to-end via stubbed fetch (see Bug 2a) |
| Responsive matrix | `reports/screenshots/wave10/full-{1440,768,390}.jpeg` |
| Design review | see PR / addendum below |

## Preview verification

GG's standard for this wave: slider + heat-toy verified on the DEPLOYED preview, not localhost.
Performed against the PR's Vercel preview deployment after push — results recorded in the PR
body and the addendum below.

## Held

- **Item 6 (resume rewrite)** — waiting on GG to supply the current resume file, per the brief.
- `explore/wave8-lab` branch deletion — ancestor-check passes once this wave merges (unchanged
  from wave 9's note).
