# gg-portfolio

[![CI](https://github.com/gaurav-gandhi-2411/gg-portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/gaurav-gandhi-2411/gg-portfolio/actions/workflows/ci.yml)

Gaurav Gandhi's portfolio site — a recruiter-facing, multi-page site (home → /projects →
per-project case studies) positioning him as a Senior/Principal Applied AI Scientist who
ships production AI products and independent research under his own name. Live at
[gaurav-gandhi.vercel.app](https://gaurav-gandhi.vercel.app).

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `npm run build && npm run start` runs
the production build locally — used for every performance/budget measurement in
`reports/`, since dev-mode overhead would misrepresent real numbers.

## Stack

Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui (`@base-ui/react`), deployed to
Vercel. Content lives as typed data files under `content/*.ts` — one source of truth per
section, no CMS, no database. Live stats (product freshness, PyPI downloads, shipping log)
are fetched at build time via ISR (`lib/live-data.ts`, 6h revalidation), not client-side —
every number on the page is either static content with a recorded source
(`content/provenance.md`) or a build-time fetch, never an invented figure.

## Performance budget

**Eager JS ceiling: ≤215 KB gzip.** Current measured total: 207,862 bytes (203.0 KiB) — see
`reports/wave3-tier2-microinteractions-2026-07-12.md` for the full chunk breakdown.

This repo's budget was mis-set once and corrected explicitly rather than quietly patched:
wave 2 originally reported 161.3 KiB, which was wrong (a missed chunk); wave 3 then
re-baselined to 165 KB using that wrong number as justification. Both are retired. The
current, correct ceiling and its full justification — including why ~200 KB is close to a
hard floor for this stack (React 19 + Next.js 16 App Router runtime, ~70 KB; a Next.js/
Turbopack core-js polyfill chunk, ~40 KB, present even in a from-scratch `create-next-app`
with zero custom code) — is in `reports/wave3-budget-reratification-2026-07-13.md`. New
interactive features load their heavy UI behind `next/dynamic`, on interaction, never adding
to this number for a visitor who doesn't trigger them.

Other budgets: Lighthouse Accessibility 100, axe-core 0 violations, CLS 0.00. Full artifacts
in `reports/`.

## Reproduction

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run build        # production build (also used for all reports/ measurements)
npx @axe-core/cli http://localhost:3000 --exit   # against a running `npm run start`
```

## Autonomous metric refresh

Every product-card metric on the site lives in `content/metrics.json`, keyed by its
provenance ID (`content/provenance.md`), with `value`, `source_file`, `source_line`,
`commit_sha`, and `measured_at` per entry. `content/products.ts` reads values through
`lib/metrics.ts`, which throws at build time on a missing ID — a metric can't render
without a store entry.

A weekly GitHub Action (`.github/workflows/metrics-refresh.yml`, Mondays 03:00 UTC) runs
`scripts/refresh-metrics.mjs`, which:

1. fetches each source repo's **`.portfolio/metrics.json`** (same IDs, same schema) from
   its default branch;
2. diffs against `content/metrics.json` and rewrites drifted entries;
3. checks every product live link (two attempts — Cloud Run cold starts answer the retry);
4. tracks the Hugging Face cumulative download count (report-only until it crosses the
   1,000 bar agreed in wave 13);
5. **opens a PR** — never a direct commit — whose body shows old → new per metric with its
   source. The human review of that PR is the provenance gate (rule 65b), unchanged.

Fail-soft rules: an unreachable repo or malformed manifest skips that project with a note
in the PR body; a metric missing from its repo's manifest is kept and flagged, never
blanked. Metrics not re-measured in 90+ days are flagged as stale rather than silently
re-asserted. Two caveats, both deliberate: PRs created with `GITHUB_TOKEN` don't trigger
`pull_request` workflows, so the Action dispatches `ci.yml` onto the branch itself; and
drawn figures (`figure:` in `content/products.ts`) mirror their metric's numbers by rule —
the PR body reminds the reviewer to update them together.

The refresh also guards the **resume**: `content/resume-metrics.json` records, per metric
the resume PDF claims, the store value at the last resume sync plus the PDF's sha256. The
weekly PR flags any claim whose store value has since moved (regenerate the resume or
consciously accept the gap) and any `public/resume.pdf` swap that skipped the manifest —
report-only, since the resume is a designed 2-page document a human regenerates
(`.assets/resume-sources/`, gitignored).

**Adding a future project**: drop a `.portfolio/metrics.json` in its repo
(`{"version": 1, "project": "<slug>", "metrics": [{"id", "label", "value", "source_file",
"source_line", "commit_sha", "measured_at"}]}`), add matching entries to
`content/metrics.json` (with `repo`), and reference them from `content/products.ts` via
`refreshableMetric(id)`. The weekly run picks it up from there.

## Architecture notes

- `app/` — Next.js App Router pages, layout, OG image generation, sitemap/robots.
- `components/sections/` — one component per home section (Hero, About, Experience, Work,
  Research, Contact), composed in `app/page.tsx`; the project grid + category filters are
  shared with `/projects` (`components/project-grid.tsx`).
- `content/` — typed data files (products, case studies, research, site copy) plus
  `provenance.md` (the narrative source record for every claim) and `metrics.json` (the
  machine-refreshable store behind the weekly metric refresh).
- `lib/live-data.ts` — build-time/ISR fetches for live stats (GitHub API, PyPI, a sibling
  project's public manifest). Fail-soft: any fetch failure degrades to no-badge, never a
  broken page.
- `reports/` — every performance/accessibility/design measurement this repo has made, with
  provenance (commit, methodology, raw artifacts where practical) per the project's rule 65b.
- `PLAN.md` — living execution tracker across waves.
