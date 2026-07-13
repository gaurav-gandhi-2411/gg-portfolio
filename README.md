# gg-portfolio

[![CI](https://github.com/gaurav-gandhi-2411/gg-portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/gaurav-gandhi-2411/gg-portfolio/actions/workflows/ci.yml)

Gaurav Gandhi's portfolio site — a single-page, recruiter-facing site positioning him as a
Senior/Principal Applied AI Scientist who ships production AI products and independent
research under his own name. Live at
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

## Architecture notes

- `app/` — Next.js App Router pages, layout, OG image generation, sitemap/robots.
- `components/sections/` — one component per page section (Hero, About, Products, Research,
  Experience, Contact), composed in `app/page.tsx`.
- `content/` — typed data files (products, research, site copy, live "now" line) plus
  `provenance.md`, which records the source for every claim/metric on the site.
- `lib/live-data.ts` — build-time/ISR fetches for live stats (GitHub API, PyPI, a sibling
  project's public manifest). Fail-soft: any fetch failure degrades to no-badge, never a
  broken page.
- `reports/` — every performance/accessibility/design measurement this repo has made, with
  provenance (commit, methodology, raw artifacts where practical) per the project's rule 65b.
- `PLAN.md` — living execution tracker across waves.
