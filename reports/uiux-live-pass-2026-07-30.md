# UI/UX pass — desktop density, "feels alive," chatbot streaming (2026-07-30)

Branch `feat/uiux-live-pass`, off `main` post the chatbot production hotfix (`a2fa3e1`).
GG's brief: the site should "feel like a live website," with both mobile and laptop/desktop
genuinely well-served — desktop density has been a recurring complaint. Audited real
production at 390/768/1024/1280/1440/1600 before changing anything; every fix below traces
to a concrete finding at a specific breakpoint, not a guess.

## 1. Desktop density — the actual root cause, not a missed breakpoint

Screenshotting production at 1024px showed the site rendering **identically to the 768px
tablet screenshot**: single-column Experience, no About skills rail, one-column project
grid, stacked Research. Reading the source (`components/section.tsx`, `project-grid.tsx`,
`experience.tsx`, `about.tsx`, `research.tsx`, `case-study-page.tsx`, `site-nav.tsx`,
`app/ask/page.tsx`, `app/projects/page.tsx`, `app/projects/[category]/page.tsx`) found why:
wave 13's own desktop-composition pass (which explicitly exists to fix "GG's standing
1280–1600px complaint") anchored the **container's own width step** — not just the
column-split toggles — to Tailwind's `xl` breakpoint (1280px). Below `xl`, every "wide"
section's container was capped at the same `max-w-3xl` (768px) as the tablet layout, so
1024–1279px (a common laptop band, and the exact viewport this audit was asked to cover)
never had the width for the intended 2-column compositions to engage — reproducing the same
complaint wave 13 was meant to have closed.

**Fix:** moved the one shared width step and every component's column-split toggle keyed
off it — `xl` → `lg` (1024px) — in lockstep across all 10 files, preserving the "one shared
width" invariant wave 13's own design review required. Verified the tightest case
(`case-study-page.tsx`'s fixed-width sticky rail: 960px minimum content vs. ~976px available
at exactly 1024px viewport) renders cleanly, not squeezed — screenshotted before/after at
1024px on `/`, `/projects`, and `/work/triageiq`.

Commit `91b3db5`.

## 2. The chatbot feeling alive

GG's ask: streaming token-by-token rather than spinner-then-dump, a typing indicator, smooth
message entry, suggested follow-ups. `route.ts`'s non-streaming backend is a deliberate,
documented decision (citation validation must run to completion server-side before anything
is safe to show) — not renegotiated. Instead the already-complete, already-validated answer
now **reveals progressively on the client** (`useAnswerReveal`, ~190 chars/sec, prefers-
reduced-motion respected) — same bytes, paced arrival, never content validation would later
have stripped.

- The animated paragraph is `aria-hidden` (its rapid per-tick mutations would otherwise spam
  a screen reader through the ancestor `aria-live` region); a `sr-only` twin carries the
  complete answer from the start, so AT users get one atomic announcement, unchanged from
  before this wave.
- "Thinking…" is real bouncing dots (CSS, motion-reduce-gated), not static text.
- New turns fade/slide in (`.message-in`).
- Follow-up chips below a turn exclude any question already asked this conversation, hidden
  entirely once the fixed 5-question catalog is exhausted rather than repeating.
- The Ask button and suggested-question chips had **no focus-visible ring or press feedback
  at all** — every other interactive element on the site already had both. Brought up to the
  same standard.

New tests: forced-failure route interception already existed (prior chatbot-fix PR); this
wave added follow-up-chip filtering and an axe check on the **answered** state (the prior
`/ask` axe test only ever scanned the empty pre-question state, so it never exercised this
wave's new markup).

Commit `1ddecd3`.

## 3. Interaction feedback + live-data signal, site-wide

Audit found the same gap repeated in every embedded demo widget: `heat-toy.tsx` (Guess /
Try-again / starter-word buttons), `triageiq-classify-toy.tsx` (sample-issue / Classify
buttons), `triageiq-classify-disclosure.tsx` (the toggle) all had hover-only or zero
interaction feedback, while every "core" site element (`LinkButton`, `PrintButton`,
site-nav, project-filter pills, chat-launcher) already carries a consistent focus-visible
ring + active-press pattern. Brought all of them up to the same standard.

Separately: `project-card.tsx`'s dateline ("shipped 4d ago", "puzzle #49 live today") is
genuinely live-fetched data (ISR + GitHub push activity — `project-grid.tsx`'s own comment
confirms it) but rendered as plain gray text with no visual signal of that. Added a small
pulsing accent dot (`.live-dot`, motion-reduce-gated), reusing the hero's existing
availability-badge dot language rather than inventing a new visual system.

Commit `7df1ba2`.

## Verification

- `npm run typecheck` / `npm run lint` / `npm run build` — clean after every commit.
- Full Playwright suite, both projects, after every commit: **74 desktop + 72 mobile passed**
  (2 intentionally-skipped desktop-only hover tests), axe zero-violations on all 22 routes
  unchanged throughout.
- Real keyboard Tab navigation (not programmatic `.focus()`, which doesn't reliably trigger
  `:focus-visible` in Chromium) confirmed the Ask button now shows a real focus ring.
- Lighthouse (desktop, local prod server — the `_vercel/{insights,speed-insights}/script.js`
  404s flagged under Best Practices are Vercel's own platform scripts, which only exist on
  real Vercel infra; expected local-testing noise, not a regression):

  | Route | Accessibility | Best Practices | SEO | Agentic Browsing |
  |---|---|---|---|---|
  | `/` | 100 | 96 | 100 | 100 |
  | `/ask` | 100 | 96 | 100 | 100 |
  | `/projects` | 100 | 96 | 100 | 100 |

  Reports: `reports/lighthouse-uiux-{home,ask,projects}-2026-07-30.report.json`.

- Performance trace on `/` (desktop, local prod server, no throttling): **LCP 323ms, CLS
  0.00** — both comfortably inside spec.md's budget (LCP ≤1.5s, CLS ≤0.05).
- Eager JS budget (chunk-sum method, matching waves 3–13's methodology — real
  `performance.getEntriesByType('resource')` transfer sizes on a hard-reloaded home page,
  local prod server): **169,504 B gzip vs. the 220,160 B ceiling** (~49.5 KiB headroom;
  excludes two 300 B Vercel-analytics 404 responses that don't exist in this local
  environment).

Screenshots: `reports/screenshots/uiux-audit/` (breakpoint survey, before/after density
comparison, chatbot typing indicator).

## Aside, unrelated to this wave

Two pre-existing uncommitted files found in the working tree at session start
(`content/case-studies/aetherart.ts`, `content/provenance.md` — a "wave 17" AetherArt
content update, not authored by this session) were WIP-committed on `fix/projects-hover-
contrast` to avoid losing them rather than touched or discarded. Turned out moot — the same
content merged separately via PR #27 while this wave was in progress.
