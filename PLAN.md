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
- [x] Pushed to GitHub (`gaurav-gandhi-2411/gg-portfolio`, public), branch protection
      (required check `build`, no force-push/deletion, admins can bypass — solo-maintainer
      posture), auto-merge + delete-branch-on-merge enabled. Vercel git-linked deploy live at
      `https://gaurav-gandhi.vercel.app` (renamed from the auto-generated `gg-portfolio-phi`;
      GitHub repo name intentionally kept as `gg-portfolio` — repo/project names don't need
      to match). CI green on all pushes.
- [x] Domain rename gotcha: renaming the Vercel *project* does not reassign or kill the old
      auto-generated `.vercel.app` domain — that's a separate alias operation
      (`vercel alias set`), and the old domain has to be explicitly removed
      (`vercel alias rm`) or it keeps serving traffic indefinitely. Also: newly-created
      aliases inherited team-level SSO deployment protection
      (`all_except_custom_domains`) that the original auto-generated domain was
      exempt from — had to explicitly `vercel project protection disable --sso` to make
      the canonical URL publicly reachable without a Vercel login wall.
- [x] **Critical follow-up gotcha, found during wave 2's post-merge live-verification
      (2026-07-12):** `vercel alias set <deployment> gaurav-gandhi.vercel.app` (used to
      create the canonical domain) is a **static, one-time pointer** — it does NOT track
      future production deployments. Every wave-2 PR merge to `main` was deploying
      correctly, but the canonical URL kept silently serving the wave-1 snapshot; only the
      auto-generated per-deployment/branch URLs were updating. Root cause: `vercel alias`
      is a raw imperative pointer, not the same mechanism as a real Vercel **project
      domain** (the dashboard's Settings → Domains, which does auto-track production).
      Fixed by registering the domain properly via the API:
      `POST /v10/projects/{id}/domains {"name": "gaurav-gandhi.vercel.app"}` — the response's
      `verified: true` and no `gitBranch` pin confirms it now tracks production like a
      normal project domain. **Lesson: verify the live canonical URL after every deploy
      claim, not just CI green — CI and the deployment both succeeding does not guarantee
      the public-facing alias actually updated.**

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

## Wave 2 — design elevation + content reorder + polish (in progress)

- [x] Content reorder: Hero → About → Products → Research → Experience → Contact (was
      Hero → About → Experience → Products → Research → Contact). About paragraphs and hero
      stats reordered to lead with independent-builder identity; employer/Uber-scale numbers
      moved to supporting position, not headline.
- [x] Engineering story lines added to the 3 flagship cards (Warmer, Style Maitri, TriageIQ),
      each independently verified against the source repo before writing — see
      `content/provenance.md` `warmer:hinglish-fix` (root cause detail added),
      `style-maitri:garment-normalizer` (new), `triageiq:contamination-adr0018` (new, plus the
      ADR-0018→0028→0030 continuity was verified as a real documented thread, not an invented
      narrative).
- [x] Live-link verification (every external URL in `content/*.ts` curl-checked against the
      deployed site): found and fixed two real breaks — Warmer's GitHub repo link removed
      (mindmeld is a **private** repo, confirmed via `gh repo view --json visibility`, only
      private repo among all products referenced); ReviewIQ's live link repointed from the
      bare API root (404, no handler) to `/docs` (200, browsable Swagger UI). Two false
      positives investigated and left as-is: AetherArt Cloud Run cold-start timeout (200 on
      retry), LinkedIn's 999 anti-scraping response (not a real break).
- [x] `link-check.yml` CI job (lychee): non-blocking (`continue-on-error`) on PRs, weekly
      scheduled run, `.lychee.toml` accepts LinkedIn's 999 and gives Cloud Run cold starts a
      generous timeout/retry budget so link rot surfaces without false-alarming every PR.
- [x] SEO: JSON-LD Person schema (`components/json-ld.tsx`), `app/sitemap.ts`, `app/robots.ts`.
      Vercel Analytics wired (`@vercel/analytics`).
- [x] **Design elevation — candidates rendered, awaiting GG's pick (gate held, nothing
      rolled out further):** dark base tokens (deep graphite `#0A0B0D`/`#131417`, light text
      `#EDEEF0`/`#9195A0`) built in `app/globals.css`; 3 accent candidates rendered and
      screenshotted — cyan `#22D3EE`, electric blue `#3B82F6`, indigo `#818CF8`
      (recommended — most distinctive without being loud, pairs well with the Fraunces
      headline). One full-page render done with the recommended candidate to confirm the
      token-driven architecture reskins every section automatically (About/Products/
      Research/Experience/Contact all consume semantic tokens already, no bespoke
      per-section work needed for the base remap). GG monogram recolored per candidate
      (`public/logo-mark.svg`) since it's a static SVG, not itself token-driven.
      Found-and-fixed in passing: a pre-existing a11y bug in Hero's 4 CTA buttons (Base UI's
      `Button` defaulted to `nativeButton=true` while rendering `<a>` via the `render` prop —
      now `nativeButton={false}` on all four). Exploration lives on local branch
      `explore/dark-theme-candidates`, **not pushed/merged** — held for GG's pick per the
      explicit gate instruction.
- [ ] Blocked on the above pick: full dark remap merge, restrained motion (scroll-reveal + hover only),
      full-page screenshots per section, responsive pass (390px–1440px matrix), a11y re-verify
      (contrast changes with the dark remap), Lighthouse budgets (150KB/1.5s/0.05) measured
      and committed to `reports/`.

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
