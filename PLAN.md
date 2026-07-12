# PLAN — GG Portfolio Site

Spec: `spec.md` (source of truth). Objective: a recruiter-facing portfolio positioning Gaurav
as a Senior/Principal Applied AI Scientist, driven entirely by a sourced content manifest —
every displayed number traces to `content/provenance.md` or it doesn't ship.

## Wave 1 — identity + skeleton (done, pending GG review)

Gate: GG reviews identity + copy before wave 2.

- [x] Content manifest (`content/provenance.md`): every claim in spec.md sourced from the
      actual repo README/reports @ specific file+line, dated 2026-07-12. Several spec.md
      numbers were found stale/wrong during sourcing and corrected — see provenance.md's
      per-product "Correction vs. spec.md" notes (TriageIQ fabrication claim, Style Maitri
      item count/brand name, ReviewIQ accuracy, DealHunter eval metric, AetherArt framing).
- [x] Blocking inputs from GG: resume PDF (canonical, MD5-verified), email
      (gauravgandhi429@gmail.com, GG's explicit choice), LinkedIn URL (extracted from resume
      PDF hyperlink annotations). Headshot: not provided, ships without one (optional).
- [x] Uber-metric confidentiality: no override from GG — default applied, publish only what's
      in the resume.
- [x] Visual identity: design tokens (`app/globals.css`), vector "GG" monogram logo
      (`app/icon.svg`, `public/logo-mark.svg` — hand-computed arc geometry, no font
      dependency), OG image (`app/opengraph-image.tsx`, generated via next/og). Palette: warm
      paper (#F7F5F0) + near-black ink (#14151A) + one terracotta accent (#C2703A). Single
      theme, no dark-mode toggle, per spec non-goal.
- [x] Next.js scaffold: App Router, Next 16 + React 19 + Tailwind v4 + shadcn/ui (base-ui,
      not Radix). All 6 IA sections built and wired: Hero, About, Experience, Products
      (flagship + secondary grid), Research, Contact.
- [x] Repo rig: `ci.yml` (lint + typecheck + build, required check `build`), pre-commit
      (trailing-whitespace, gitleaks, local eslint/typecheck hooks), PR template.
- [ ] Push to GitHub (`gaurav-gandhi-2411/gg-portfolio`, public), branch protection +
      required check, Vercel git-linked deploy, preview URL. In progress.

### Concurrency note (2026-07-12)

A separate Claude Code session was found to have been working on this same repo in parallel
earlier in this wave (discovered via `content/provenance.md`/`provenance-audit.md` appearing
mid-session with content this session didn't write, and contradicting some of this session's
findings). GG confirmed that session is now closed and this is the sole active session. Its
work was audited against this session's independent research: most claims matched
(Warmer, ShelfSense, Multimodal Fashion Recommender, tracegauge, AgentGauge, TriageIQ's
fabrication-rate correction — cross-confirmed by two independent reads). Two claims were
superseded with fresher/more precise sourcing (ReviewIQ accuracy, DealHunter metric choice) —
see `content/provenance.md` for the full reconciliation. `provenance-audit.md` was deleted as
redundant once folded into `provenance.md`.

## Wave 2 — polish + gates (not started)

Responsive pass, a11y (axe smoke), budgets measured (JS ≤150KB, LCP ≤1.5s, CLS ≤0.05 per rule
15e — bundle chunk sizes look reasonable pre-Lighthouse but not yet formally measured), SEO/meta
(JSON-LD Person schema, sitemap — basic OG/Twitter tags already in `app/layout.tsx`), real
resume already wired (done early, `public/resume.pdf`), prod deploy.

## Wave 3 — later, post-arXiv (not started)

Flip research section live with arXiv ID; add Tier 2 paper when public.

## Gotchas / decisions log

- AetherArt: reading its README for a one-line portfolio metric is not a GCP-project touch
  (the hard exclusion is about GCP billing/deploy/config specifically) — proceeded with
  README-only sourcing, no GCP access.
- `tracegauge` confirmed as `token-efficiency-scorer`'s published PyPI name (v0.10.0 live,
  confirmed via `pip index versions`) — same repo-predates-rebrand pattern as
  mindmeld/Warmer and agentic-shopping-assistant/Style Maitri.
- Several spec.md metrics were stale by the time of Wave 1 build (repos moved in the ~1 month
  since the spec was drafted, and in some cases within the same day) — always re-verified
  against live repo state on 2026-07-12, not trusted from spec.md or from the June-12 project
  inventory without a spot-check.
- lucide-react v1.24.0 dropped brand icons (Github/Linkedin) — replaced with small inline SVG
  components (`components/icons/brand-icons.tsx`).
- shadcn "base-nova" style here uses `@base-ui/react`, not Radix — polymorphism is via a
  `render` prop (`<Button render={<a href=... />}>`), not `asChild`.
