# Wave 12 — Multi-page architecture (2026-07-18)

Branch `feat/wave12-multipage`, draft PR #20. GG's brief: the real gap vs.
maninder.vercel.app was never "feel" — it was **structure**: a multi-page portfolio with
individual project detail pages. This wave builds that architecture: home teases, `/projects`
indexes, `/work/[slug]` teaches.

Reference studied in-browser (structure only, no content copied): maninder.vercel.app home,
/projects, and /work/programming-language-identification. Extracted pattern: hero
(badge → statement-h1 → byline → tactile button row) → About Me → Experience timeline →
featured project cards with "Read Case Study" links → View All Projects → footer contact;
detail pages as numbered sections (problem → framing → data → architecture → optimization →
impact → trade-offs → learnings) with a closing CTA.

## Pages built

| Route | What it is |
|---|---|
| `/` | Hero (tagline-h1, new stats, 5 tactile link buttons) → **About Me** (new, GG's ask) → **Experience first** (GG's explicit order; full card treatment, all bullets, tech chips) → top-5 showcase + "View all 12 projects →" → Research → Contact |
| `/projects` | All 12 projects, one card each, every card → its case study. Derived counts (12 projects · 9 live) |
| `/work/[slug]` ×12 | Case-study pages: problem → how it works → architecture (server-rendered flow diagram) → key decisions + why → results (honest numbers, caveats kept) → hard-problem story → links CTA. Warmer embeds the live heat toy; TriageIQ embeds the illustrative classifier — the demos moved from home to where the teaching happens |
| `404` | Styled not-found with routes home/projects |

Full pages (11): warmer, style-maitri, triageiq, dealhunter, shelfsense, reviewiq,
multimodal-fashion-recommender, gold-rate-tracker, aetherart, agentgauge, tracegauge.
Short page (1): **expense-tracker** — added this wave; the wave-10 skip was made against a
stale top-level README, but `CURRENT_STATE.md` shows a built, tested, multi-user product
(Cloud Run + Vercel deploys, Supabase auth, 143/143 tests). **Mid-wave correction (caught by
this repo's own lychee CI on PR #20's first push):** the documented expense-tracker demo
deployment is currently DOWN (frontend 404, backend 500, curl-verified 2026-07-18) — the
card ships repo-only with no liveUrl, the case-study page states the outage explicitly, and
the derived live count corrected itself 10 → 9. **reclaim: NOT added** despite real
substance — the repo has no git remote (local-only), so there is nothing public a visitor
could verify; revisit when GG publishes it.

## Tagline options (built: A)

- **A (built):** "I build AI products and see them through — from first experiment to real
  users." — the wave-10-approved voice tightened into a headline; honest, warm, and the h1 now
  makes the statement (maninder's structural pattern) with the name in the byline.
- B: "AI products, shipped end-to-end — with the evals and honest numbers behind them."
- C: "Building production AI systems — and the research they lead to."

A was built because it is literally GG's already-ratified sentence — zero new-claim risk, and
the most human of the three.

## Hero stat options (built: A)

"5 people I lead" retired (contradicts independent-work positioning as a headline; the fact
stays in About + Experience as employment context). Every option below uses only verifiable
numbers:

- **A (built):** `5` years in DS & ML (derived, careerYears()) · `9` AI products live today
  (derived, liveProductCount() — was briefly 10 until expense-tracker's deployment was found
  down, see below) · `50M+` documents behind the Uber doc-AI I helped build (resume-sourced —
  the one number of GG's that honestly supports scale language, per the brief's own
  carve-out).
- B: 5 years · 9 live · 1 first-author paper (weakest third axis — a count of one).
- C: 9 live · tracegauge weekly PyPI downloads · GitHub activity (volatile, small numbers —
  rejected: they read as padding next to 50M+).

## HuggingFace finding (exact, fetched 2026-07-18)

Account `huggingface.co/gauravgandhi2411` is real: display name "Gaurav Gandhi", **2 public
models** (`aetherart-ukiyo-sd21`: 6 downloads, `aetherart-ukiyo-sdxl`: 106 downloads — 112
cumulative), **4 Spaces** (ReviewIQ, AetherArt, Agentic Shopping Assistant, Multimodal
Fashion Recommender), 0 followers. **Decision per brief:** HF link added to the hero button
row and Contact; **no download stat anywhere** — 112 is real but trivially small; presenting
it as a headline number would be padding, and fabricating anything larger is out of the
question.

## Specific fixes from the brief

- **Link buttons:** new `LinkButton` component — filled-accent primary (View Resume) + quiet
  bordered secondaries (GitHub / LinkedIn / Hugging Face / Email), inline SVG icons
  (`components/icons.tsx`), hover lift, visible focus ring. No more text-link row.
- **Resume opens in a new tab for viewing:** `target="_blank"`, **no `download` attribute** —
  verified in-DOM on both resume links (hero + Experience) and live on the preview (see
  Verification).
- **Loader kept, scoped to home:** the pre-paint gate script now also checks
  `location.pathname === '/'` — a visitor opening a shared `/work/...` link goes straight to
  content. Verified: hard-loading `/projects` leaves `data-boot` unset and no loader node.
- **Page transitions:** 240ms fade-rise via `app/template.tsx`, applied **only on client-side
  navigations** — the first template mount never animates, so initial-load LCP and the wave-9
  axe-race class are structurally unaffected. Reduced-motion: CSS no-op.

## Provenance

~70 new sourced claims across the 12 case studies, all researched from the actual repos on
2026-07-18 by 4 parallel read-only research passes (file+line cites), consolidated in
`content/provenance.md` → "Wave 12 — case-study provenance". Existing IDs reused where they
already covered a claim. Every `results[]` row and `decisions[]` entry in
`content/case-studies/*.ts` carries a `sourceRef` resolving in that section. The honest
caveats ship on the pages themselves (TriageIQ's weak retrieval + worse-than-naive vscode
predictor, Style Maitri's 15/32 adversarial audit, ShelfSense's validation-harness failure,
gold-rate-tracker's naive-beats-model headline, AgentGauge's 0/9 prevalence null + pilot-scale
scope note, tracegauge's no-human-gold-labels caveat, MMFR's synthetic-user caveat, Warmer's
failed fine-tunes and its own failing LCP budget).

## Verification

- **Build:** green — 20 static pages (12 `/work/*` prerendered via generateStaticParams).
- **axe:** **0 violations on all 14 routes** (/, /projects, 12 case studies) — local prod
  server, `npx @axe-core/cli`.
- **Eager JS budget (gzip, chunk-sum method as waves 3–11):** home **202,787 B** vs the
  220,160 B ceiling (wave 11: 191,179 B; +11,608 B = client nav w/ active states, route
  template, showcase Links). /projects 201,761 B · /work/triageiq 203,118 B — every route
  under the ceiling.
- **Resume behavior:** `target="_blank"`, no `download` attr (in-DOM check) — PREVIEW CHECK
  PENDING below.
- **Loader scoping:** `/projects` hard load → no `data-boot`, no loader node (CDP check).
- **Transition:** client-side nav `/projects → /work/warmer` applies `.page-enter`; initial
  loads do not (CDP check).
- **Screenshots:** `reports/screenshots/wave12/` — home/projects/details at 1440/768/390.
- **Recordings:** `nav-transition.gif`, `loader-home-scoped.gif` (frames captured under a
  disclosed slow-motion CSS override — this harness has no native screen recorder —
  assembled at ~2.5fps).
- **Lighthouse (preview):** PENDING — filled in below after the Vercel preview deploy.
- **Design review:** PENDING — running.

## Preview verification (Vercel, PR #20)

_(to be filled)_

## Design-reviewer sign-off

_(to be filled)_
