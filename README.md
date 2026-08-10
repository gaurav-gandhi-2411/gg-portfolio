# gg-portfolio

[![CI](https://github.com/gaurav-gandhi-2411/gg-portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/gaurav-gandhi-2411/gg-portfolio/actions/workflows/ci.yml)
[![Link Check](https://github.com/gaurav-gandhi-2411/gg-portfolio/actions/workflows/link-check.yml/badge.svg)](https://github.com/gaurav-gandhi-2411/gg-portfolio/actions/workflows/link-check.yml)

Gaurav Gandhi's portfolio site — a recruiter-facing, multi-page site (home → `/projects` →
per-project case studies) positioning him as a Senior/Principal Applied AI Scientist who ships
production AI products and independent research under his own name. Live at
[gaurav-gandhi.vercel.app](https://gaurav-gandhi.vercel.app).

The interesting part isn't the frontend — it's that **every number on the page can prove where
it came from**, and a mechanical system keeps that true after the day it was written.

## The provenance system

A portfolio site's numbers are exactly the kind of claim nobody checks: "97% accuracy," "3×
faster," "cut costs 20%." This site treats that as a correctness problem, not a copywriting one.

**Every metric traces to a committed source.** `content/provenance.md` is the narrative record —
one entry per claim, with the file, line, and commit it came from. `content/metrics.json` is the
machine-refreshable store behind it: `value`, `source_file`, `source_line`, `commit_sha`, and
`measured_at` per entry, keyed by a stable provenance ID. `content/products.ts` and the case
studies under `content/case-studies/*.ts` never hardcode a number — they read through
`lib/metrics.ts`, which **throws at build time** if a referenced ID has no store entry. A metric
literally cannot ship without a citation behind it.

**The citation is one tap away, not buried in a markdown file.** Every case-study metric is
wrapped in `components/metric-provenance.tsx` — a source-reveal disclosure (hover on desktop,
tap-to-pin on mobile, a real APG disclosure pattern for keyboard users) that shows the exact file,
line, and commit a number came from, right next to the number itself. A "structured" metric
(backed by `content/metrics.json`) renders a clickable link straight to the source line on GitHub.
A "prose" metric (cited only in `provenance.md`'s free text) deliberately does **not** try to
synthesize a citation link from that text — a wrong citation next to a real number is worse than
no citation, so it links to `provenance.md` itself instead and nothing else.

**Staleness is tracked separately from "the file was recently edited."** A git commit touching a
case study — fixing a typo, reframing a sentence — says nothing about whether its *numbers* are
still current. Every case study carries its own `verifiedAt` field (`content/types.ts`), bumped
only when someone has actually gone back to the cited source and re-confirmed the number. This
exists because of a real incident: a site-wide copy pass touched every case study's framing two
days after one case study's real source data had already superseded the number the page still
showed — the file *looked* fresh by git history; it wasn't. The freshness checker below flags any
case study whose `verifiedAt` is more than 30 days old, independent of whether it also finds
textual drift.

**Two independent checkers catch two different failure modes**, because they structurally cannot
catch each other's:

- **`scripts/check-metric-freshness.mjs`** (weekly, and locally on demand) re-fetches each
  metric's *actual current* cited source file — not an intermediate manifest — and checks whether
  the recorded value's numbers are still present verbatim. It fails **closed**: a fetch that 404s,
  times out, or returns something ambiguous is reported `UNVERIFIABLE`, never silently treated as
  "no drift found." It also understands rounding (a page showing `0.239` when the source computes
  `0.2391` is not drift) and pinned refs (`@<sha>` in a citation, for sources a bot rewrites on a
  schedule — checked against that exact commit, not a moving `HEAD`, so the check answers "did the
  site correctly report what its source said," not "does the bot's output still agree today").
- **`scripts/check-card-consistency.mjs`** (every CI run, zero network calls) catches the opposite
  failure: two files *inside this repo* disagreeing about the same claim. It exists because a
  stale, gitignored-sourced figure on a homepage project card survived an entire deploy cycle
  *after* the case-study body citing the same metric had already been corrected — a same-repo
  contradiction no rebase or merge conflict would ever have surfaced. It checks three invariants:
  a `metrics.json` entry against the case-study row citing the same ID, a product card's drawn
  `figure` against its own `metric` field (the figure is the metric drawn, never a second source
  of truth), and a card's `tagline` number against its own case study's body. It fails the build
  on any mismatch — a same-repo comparison has no flaky-fetch excuse to be soft about it.

**The resume gets the same treatment.** `content/resume-metrics.json` records, per claim the
resume PDF makes, the metrics-store value at the last resume sync plus the PDF's own SHA-256. The
weekly refresh flags any claim whose store value has since moved, and any `public/resume.pdf` swap
that skipped the manifest.

## How the checks actually run

| Gate | Where | When | What it does on failure |
|---|---|---|---|
| ESLint, `tsc --noEmit` | `ci.yml`, pre-commit | every PR / every commit | build fails |
| Chatbot index freshness | `ci.yml`, pre-commit | every PR touching `content/case-studies/**` or `provenance.md` | build fails — `content/chatbot/index.json` is a derived build artifact of that content, never hand-edited |
| Card/metrics/case-study consistency | `ci.yml` | every PR | build fails, zero network calls |
| Playwright e2e (incl. axe accessibility, mobile viewport) | `ci.yml` | every PR | build fails — runs against a real `next start` production build, never `next dev` |
| Metric freshness (external sources) | `metrics-refresh.yml` | weekly, Mondays 03:00 UTC | opens a PR with old → new per metric, never a silent commit — a human reviews it |
| Link check (`lychee`) | `link-check.yml` | every PR / weekly | build fails |
| Chatbot RAG eval (retrieval recall, groundedness, refusal precision) | `eval.yml` | PRs touching `app/api/chat/**`, `lib/chatbot/**`, `evals/chatbot/**` | build fails against thresholds set from a recorded live baseline; cassette-replay only, zero live LLM calls |
| Secrets scan (`gitleaks`), trailing whitespace, YAML/merge-conflict checks | pre-commit | every commit | commit blocked locally |

The weekly automation is **PR-only, never a direct commit** — the human review of that PR *is* the
provenance gate. It also runs an identity-drift check (README display names, repo
visibility/archived state, live/demo/PyPI/HF URL health against `content/identity-state.json`) and
an LLM-assisted content-pipeline job that proposes new, source-checked case-study facts — each as
its own PR, deliberately never bundled with the metric-value refresh, so a mechanical fact diff
never shares a review with an LLM-curated proposal.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `npm run build && npm run start` runs the
production build locally — used for every performance/budget measurement in `reports/`, since
dev-mode overhead would misrepresent real numbers.

```bash
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run build         # production build (also used for all reports/ measurements)
npm run test:e2e      # Playwright, desktop + mobile projects
node scripts/check-metric-freshness.mjs   # re-verify every cited metric against its live source
node scripts/check-card-consistency.mjs   # same-repo card/case-study consistency
npx @axe-core/cli http://localhost:3000 --exit   # against a running `npm run start`
```

## Stack

Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui (`@base-ui/react`), deployed to
Vercel. Content lives as typed data files under `content/*.ts` — one source of truth per section,
no CMS, no database. Live stats (product freshness, PyPI downloads, shipping log) are fetched at
build time via ISR (`lib/live-data.ts`, 6h revalidation), not client-side — every number on the
page is either static content with a recorded source (`content/provenance.md`) or a build-time
fetch, never an invented figure.

## Performance budget

**Eager JS ceiling: ≤215 KB gzip.** Current measured total: 207,862 bytes (203.0 KiB) — see
`reports/wave3-tier2-microinteractions-2026-07-12.md` for the full chunk breakdown.

This repo's budget was mis-set once and corrected explicitly rather than quietly patched: wave 2
originally reported 161.3 KiB, which was wrong (a missed chunk); wave 3 then re-baselined to
165 KB using that wrong number as justification. Both are retired. The current, correct ceiling
and its full justification — including why ~200 KB is close to a hard floor for this stack
(React 19 + Next.js 16 App Router runtime, ~70 KB; a Next.js/Turbopack core-js polyfill chunk,
~40 KB, present even in a from-scratch `create-next-app` with zero custom code) — is in
`reports/wave3-budget-reratification-2026-07-13.md`. New interactive features load their heavy UI
behind `next/dynamic`, on interaction, never adding to this number for a visitor who doesn't
trigger them.

Other budgets: Lighthouse Accessibility 100, axe-core 0 violations, CLS 0.00. Full artifacts in
`reports/`.

## Architecture notes

- `app/` — Next.js App Router pages, layout, OG image generation, sitemap/robots, `/ask` (the RAG
  chatbot demo — retrieval over `content/chatbot/index.json`, generation via Groq, cassette-replayed
  in CI so no eval run needs a live API key).
- `components/sections/` — one component per home section (Hero, About, Experience, Work,
  Research, Contact), composed in `app/page.tsx`; the project grid + category filters are shared
  with `/projects` (`components/project-grid.tsx`).
- `components/metric-provenance.tsx` — the source-reveal disclosure described above.
- `content/` — typed data files (products, case studies, research, site copy) plus
  `provenance.md` (the narrative source record for every claim) and `metrics.json` (the
  machine-refreshable store behind the weekly metric refresh).
- `lib/live-data.ts` — build-time/ISR fetches for live stats (GitHub API, PyPI, a sibling
  project's public manifest). Fail-soft: any fetch failure degrades to no-badge, never a broken
  page.
- `scripts/` — the freshness/consistency checkers above, the weekly refresh/identity-drift/content-
  pipeline automation, and the resume builder (`build_resume.mjs`, JD-variant PDFs under
  `variants/`).
- `evals/` — the chatbot RAG eval harness (`evals/chatbot/`), wired into `eval.yml`.
- `e2e/` — Playwright specs: navigation, filters, accessibility (axe), mobile viewport containment
  and tap-target sizing, route transitions, provenance disclosures.
- `reports/` — every performance/accessibility/design measurement this repo has made, with
  provenance (commit, methodology, raw artifacts where practical).
- `PLAN.md` — living execution tracker across waves.

## Adding a future project

Drop a `.portfolio/metrics.json` in the project's own repo
(`{"version": 1, "project": "<slug>", "metrics": [{"id", "label", "value", "source_file",
"source_line", "commit_sha", "measured_at"}]}`), add matching entries to `content/metrics.json`
(with `repo`), and reference them from `content/products.ts` via `refreshableMetric(id)`. The
weekly refresh picks it up from there; `check-card-consistency.mjs` and `check-metric-freshness.mjs`
apply to it automatically, with no per-project config.
