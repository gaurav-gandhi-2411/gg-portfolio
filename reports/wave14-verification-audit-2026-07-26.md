# Wave 14 — bug fix, verification discipline, inventory refresh (2026-07-26)

Branch `feat/wave14-verification-audit`. GG's brief: the category filters he clicked on
production did nothing — reproduce and fix; fix the verification gap that let it ship, not
just the bug; enumerate GitHub fresh and reconcile; redeploy expense-tracker; audit every
interactive element end to end. Everything below is verified by browser automation on the
deployed production site or preview — no "verified by code review" claims for interactive
behavior this time, per GG's explicit standard.

## 1–2. The filter bug — reproduction, root cause, fix, and why it shipped

**Reproduced on production first** (`https://gaurav-gandhi.vercel.app`, not localhost):
confirmed the current production deployment is `dpl_CoEypCnHXN8aB4pHb8nEGzkLoUjY`, commit
`4128c9c` (wave 13's squash merge), so this was genuinely live code, not a stale deploy.

**Root cause — not what it looked like.** Extensive testing proved the underlying mechanism
(`useSyncExternalStore` + `history.replaceState` + CSS `[data-active-category]` visibility
toggling) fires correctly: CDP-driven clicks, raw DOM-dispatched pointer/mouse events
(bypassing any tool-coordinate concern entirely), keyboard `Enter` activation, rapid
sequential clicks, desktop and mobile viewports, fresh page loads and client-side
navigations, and clicks under 6× CPU + Slow-4G throttling — every one of them correctly
filtered the card grid and updated the URL. React 18/19's event-replay mechanism also rules
out the classic "clicked before hydration" race as a systemic cause.

**The actual defect:** the only text confirming a filter had applied — "Showing N of M
projects" — was rendered `sr-only` (screen-reader-only, invisible to sighted users), and the
active pill's visual state was a barely-perceptible 15%-opacity accent tint. For any category
whose result set still includes the card at the top of the viewport (e.g. filtering to "LLM &
Agents" keeps TriageIQ, the very first card, visible), a real user gets **zero perceivable
confirmation** that anything happened — mechanically working and completely broken read
identically. That is the bug GG hit.

**Why this shipped — the actual point of item 2.** Wave 13's report claimed the filters were
"instant, keyboard-accessible, ?category= shareable" without a single browser-driven click
behind that claim — it was asserted from reading the code. Fixed structurally, not just this
once:
- **Fix:** the counter is now visible (`text-muted-foreground`, `mt-4`, centered — not
  `sr-only`); the active pill is a solid accent fill (`border-accent bg-accent
  text-accent-foreground`, the same contrast pattern the nav's own active-page state already
  uses), not a 15% tint.
- **New Playwright E2E suite** (`e2e/`) — filters (click/keyboard/deep-link/no-JS, per pill,
  counts asserted against real page data never hardcoded), nav, route transitions, the resume
  link, Warmer's heat-toy demo, TriageIQ's illustrative classifier, external-link structural
  checks, and axe on every route (14 → 15 with reclaim added mid-wave, auto-discovered via a
  fixture that derives routes from the real case-study registry, not a hardcoded list).
- **Wired into CI as a required check.** New `e2e` job in `.github/workflows/ci.yml`, added to
  branch protection's `required_status_checks` alongside `build`
  (`gh api .../branches/main/protection/required_status_checks`). It runs against a real
  `next start` production build (`playwright.config.ts`'s `webServer`), never `next dev`.
- **The suite itself had to earn "rigorous," not just "present."** An early version of the
  filter test asserted `toBeVisible()` on the counter — and that assertion would have PASSED
  against the old broken `sr-only` markup too: Tailwind's `sr-only` (1×1px + clip-rect) still
  has a non-zero bounding box and no `display:none`/`visibility:hidden`, which is all
  Playwright's `toBeVisible()` checks. Caught by deliberately running the suite against
  *production* (still on the old code) before merging the fix — the test passed when it
  should have failed. Strengthened to check real pixel dimensions
  (`boundingBox().width > 20`); re-verified against production that the strengthened
  assertion now correctly **fails** on the old markup and **passes** on the fix.
- **Standard going forward:** no interactive feature is reported as working in this repo
  unless a test in `e2e/` actually drove it in a browser. Added as an explicit note for
  future wave reports.

**One real regression found and fixed during this same pass:** the solid-fill active pill's
count badge kept the original `opacity-70` dim from wave 13, which composites to 3.74:1
against either background — under the 4.5:1 text floor. Axe classifies single-digit instances
as "incomplete" (a genuine confidence heuristic for very short text, not a pass) rather than a
hard violation, so this had been silently failing since wave 13; it only became an
unmissable, hard-failing violation once "All 12"'s two-digit badge goes inactive (i.e. any
time a filter is applied — the normal path). Opacity dimming removed entirely rather than
patched per-state. Also fixed one a11y test-timing flake matching this repo's own documented
wave-9 "axe race" pattern: `/projects`' card grid sits in the initial viewport, so its
`RevealGroup` entrance fade could still be mid-animation when axe ran immediately after
`page.goto()` (measured: opacity 0.21 at ~60ms, settled by ~400ms) — the test now waits past
the worst-case entrance sequence before scanning, sampling the settled page like every prior
manual `axe-core` run in this repo's history implicitly did.

**Full suite result:** 82/82 passing locally (local build) and the same suite run against
live production confirms exactly the two expected pre-fix failures (counter/contrast) and
nothing else — every other interactive path on production (nav, route transitions, resume,
both demos, external links, no-JS, axe on all 14 pre-existing routes) was already correct.

## 3. GitHub inventory refresh

`gh repo list gaurav-gandhi-2411 --json name,visibility,isArchived,isFork,pushedAt` — 17 repos
enumerated fresh (not from memory/cache).

| Repo | Visibility | On site? | Action | Why |
|---|---|---|---|---|
| gg-portfolio | public | n/a | none | this site |
| gold-rate-tracker | public | yes | none | matches |
| AetherArt | public | yes | none | matches |
| agentgauge | public | yes | none | already current (wave 13) |
| agentic-travel-booking-system | public | yes (dealhunter) | none | matches |
| triage-iq | public | yes (triageiq) | none | matches |
| agentic-shopping-assistant | public | yes (style-maitri) | none | matches |
| multimodal-fashion-recommender | public | yes | none | matches |
| review-iq | public | yes (reviewiq) | none | matches |
| shelfsense-m5 | public | yes (shelfsense) | none | matches |
| mindmeld-payloads | public | supporting only | none | Warmer's public data mirror; not a standalone product |
| expense-tracker | public | yes | **outage root-caused** | see §4 |
| **reclaim** | **public — new** | **added this wave** | **full case study** | GG published 2026-07-23; real GitHub Releases v1.0.0–v1.3.0 |
| mindmeld | private | represented via "Warmer" (no repo link) | none | GG's deliberate choice, unchanged since wave 1 |
| claude-config | private | n/a | none | personal CC tooling config, not a product |
| triage-iq-ui | public | supporting only | none | triage-iq's frontend companion, same live URL already linked |
| token-efficiency-scorer | public | yes (tracegauge) | none | matches |

**16 of 17 already matched correctly.** One addition (reclaim), one root-caused outage
(expense-tracker), three repos confirmed as *correctly* excluded (two supporting/companion
repos, one personal-tooling repo) rather than silently assumed.

### reclaim — full case study added

Sourced entirely from the actual repo: `README.md`, `docs/CASE_STUDY.md` (776 lines, read in
full), 8 ADRs (0001, 0002, 0006, 0008, 0009, 0010, 0023, 0024), both AI-feature specs, the
safe-mode gate test, the XSS regression test. Drafted by an executor agent, independently
spot-checked here against source (honesty-arc numbers, XSS finding — both verified exact).
One fix on review: the first draft compressed the honesty-arc's 4-value correction chain
(48GB → 23.09GB → 4.26GB → 3.92GB) to 3 values, dropping the ADR-0006 hardlink-accounting
step — restored, since the whole point of that section is not rounding off a documented
correction chain.

- **Categories:** `tooling` (end-user desktop tool, same precedent as tracegauge already
  tagged), `vision` (OpenCLIP semantic image grouping), `retrieval` (MinHash + sentence-
  embedding document near-dup). `evals-research` considered — reclaim's testing rigor is
  arguably the strongest on the site — but left off: it isn't reclaim's *distinguishing*
  signal on a site where rigorous testing is present everywhere, unlike the concrete
  CLIP/embedding capability tags.
- **Metric:** the honesty-arc correction chain, not the flashier 33.73GB real-disk-freed
  number — the corrected-estimate story is reclaim's actual thesis, and this site's standard
  is the most honest number, not the most flattering one.
- **Ordering:** slotted after AgentGauge, before ReviewIQ (Σ=7 on the wave-13 four-axis
  rubric — full scoring in `content/provenance.md`'s wave-14 section).
- **`liveUrl`:** the GitHub Releases page — a real "download and run this today" link for a
  desktop tool, same treatment class as a web demo's live URL. Adds +1 to the derived "AI
  products live today" hero stat (now 10) — a real capability, not a rounding decision.
- **Wired into the metric-refresh pipeline**, closing the one gap the drafting agent
  correctly flagged: `content/metrics.json` gained `reclaim:honesty-arc` (source
  `docs/CASE_STUDY.md:761`, commit `b7d1aa4`), the card now reads it via
  `refreshableMetric()` like every other product, and a `.portfolio/metrics.json` manifest PR
  is open on the reclaim repo itself (gaurav-gandhi-2411/reclaim#29) so the weekly refresh
  picks it up going forward — no more exceptions.

### Weekly Action extension — repo enumeration

`scripts/refresh-metrics.mjs` gains a repo-inventory step: fetches every public, non-fork,
non-archived repo under the author via the GitHub REST API, diffs against repos already
referenced from `content/products.ts` plus a maintained `KNOWN_NON_PRODUCT_REPOS` exclusion
list (mindmeld-payloads, triage-iq-ui, gg-portfolio itself), and reports anything new.
Verified locally: correctly returns an empty list now that reclaim is on the site (confirmed
the parser actually picks up `reclaim`'s `repoUrl`, not just that the list happened to be
empty).

New repos don't touch any tracked file, so they can't ride the existing git-diff-gated PR
mechanism (a PR with zero file changes isn't meaningful) — `.github/workflows/
metrics-refresh.yml` opens/updates a tracking **GitHub issue** instead (stable title, so
re-runs update the same issue rather than spamming a new one each week an unaddressed repo
remains).

## 4. expense-tracker — diagnosed, not fixed (blocked on GG's account access)

Both halves confirmed down via curl: frontend 404, backend 500/503 (matching wave 12's
finding, unrepaired since). This wave root-caused both, read-only, no GCP config/billing
touched (this project's standing exclusion) and no destructive action taken:

- **Backend:** `gcloud run services describe` / `revisions describe` (read-only) show the
  latest revision (`expense-tracker-00006-d4c`) reporting `Ready`, but `gcloud logging read`
  shows every cold start's FastAPI lifespan hook crashing during its Alembic-migration step:
  `sqlalchemy.exc.OperationalError: (psycopg2.OperationalError) could not translate host
  name "db.ckedawgfjwzefayhcybe.supabase.co" to address: Name or service not known`. DNS
  NXDOMAIN for the Supabase Postgres host — consistent with a paused (Supabase free-tier
  auto-pauses inactive projects) or deleted Supabase project, not an application defect. The
  crashed startup fails Cloud Run's TCP probe, which is what actually serves the 500/503.
- **Frontend:** `curl -I` on the documented Vercel URL now returns
  `X-Vercel-Error: DEPLOYMENT_NOT_FOUND` — the Vercel project/deployment backing that domain
  no longer exists. Confirmed via `mcp__plugin_vercel_vercel__list_projects` against the
  accessible team: no `expense-tracker` project present, so this session has no path to
  redeploy the frontend even if the backend were healthy.

**Neither half is actionable from this session** — no Vercel project access, and GCP
deploy/billing actions on a separate project (`expense-tracker-498014`) sit outside this
repo's standing exclusion. Numbered recovery steps for GG:

1. Open the Supabase dashboard (supabase.com/dashboard), find the project backing
   `ckedawgfjwzefayhcybe.supabase.co`. If it shows "Paused," click **Restore project** (free
   tier auto-pauses after ~7 days of inactivity — this is the single most likely cause).
2. Once resumed, trigger a fresh Cloud Run revision so the crashed instance isn't retried
   forever: `gcloud run services update expense-tracker --region us-central1 --project
   expense-tracker-498014` (a no-op env touch is enough to force a new revision), or just wait
   — Cloud Run retries cold starts on the next incoming request regardless.
3. Verify: `curl https://expense-tracker-242393598566.us-central1.run.app/health` should
   return 200, not 500.
4. Separately, open the Vercel dashboard and check whether the `expense-tracker` project
   still exists. If deleted: re-import from `github.com/gaurav-gandhi-2411/expense-tracker`
   (frontend/ subdirectory) and reconnect the `expense-tracker-tawny-eight-98.vercel.app`
   domain, or accept a new domain and tell this repo the new URL. If it exists but the
   deployment was removed: trigger a redeploy from the Vercel dashboard.
5. Once both respond 200, tell this repo (or open a small PR) restoring `liveUrl` on the
   expense-tracker card and case study — the derived "live products" count will self-correct
   automatically (it's computed, per rule 65b, never hand-typed).

The case study and `provenance.md` now state this precise diagnosis (DNS failure +
DEPLOYMENT_NOT_FOUND) instead of the vaguer wave-12 "found down, 500/404" — a genuine honesty
improvement, not scope creep, given this site's standard.

## 5. End-to-end production audit — pass/fail table

Driven by the Playwright suite against `https://gaurav-gandhi.vercel.app` (still pre-fix at
audit time) plus manual chrome-devtools spot checks (console, network, assets).

| Check | Result |
|---|---|
| All 14 routes load | ✅ pass |
| Internal links (no 404s) | ✅ pass — every `a[href^="/"]` on home resolves < 400 |
| External link presence/well-formedness | ✅ pass — GitHub/LinkedIn/HF/mailto all present and correctly formed |
| Static assets (icon.svg, OG image, robots.txt, sitemap.xml, resume.pdf, heat-toy-vocab.json) | ✅ all 200 |
| favicon.ico | 404 — **not a defect**: the App Router's real `<link rel="icon" href="/icon.svg">` is present and correct; `/favicon.ico` is a legacy path some tools probe opportunistically even when unused |
| Console errors (home, /projects, /work/warmer, /work/triageiq) | ✅ none found |
| Network requests (all routes spot-checked) | ✅ all 200/304, including RSC prefetch requests for hover-visible links |
| Category filters | ❌ **broken (this wave's fix)** — mechanism fires, feedback imperceptible |
| Resume link (inline, new tab, no download) | ✅ pass |
| Warmer heat-toy demo (guess → feedback) | ✅ pass |
| TriageIQ illustrative classifier (expand → classify) | ✅ pass |
| Nav (all links, active states, skip-to-content) | ✅ pass |
| Route transitions (view-transition nav, browser back/forward) | ✅ pass |
| No-JS (every card renders, pills inert) | ✅ pass |
| Keyboard activation (filter pills, Tab order) | ✅ pass |
| axe — 14 pre-existing routes | ✅ 0 violations |
| axe — /projects filtered state | ❌ pre-fix: the count-badge contrast regression (§2) |
| Mobile (Pixel 7 viewport) — full suite | ✅ pass (same results as desktop) |

**Everything failing traces to the one bug fixed this wave.** No other broken interactive
element was found — confirming GG's "assume more than one thing is broken" prior was
reasonable to check, but this site's other interactive surfaces were genuinely sound.

## Verification

- `npm run typecheck` / `npm run lint` / `npm run build` — clean throughout.
- Playwright E2E: 82/82 passing locally (post-fix, includes reclaim's new route); against
  live production pre-merge, exactly the 2 expected filter-related failure groups and nothing
  else (confirms the bug's isolation and the suite's honesty).
- `e2e` wired into CI as a required check (`gh api` confirms
  `required_status_checks.contexts: ["build", "e2e"]`); both `build` and `e2e` green on this
  branch's actual GitHub Actions run (not just locally).
- Budget: **204,782 B gzip vs 220,160 ceiling** (+12 B vs wave 13's 204,770 — the visible
  counter's extra characters; net neutral, filters cost nothing structurally different).
- **Full E2E suite re-run against the deployed preview** (not just local build):
  `https://gaurav-gandhi-j8i0pc4kj-gaurav-gandhi-2411s-projects.vercel.app` — 82/82 passing,
  including the resume `Content-Disposition: inline` check (a platform-only header
  unobservable against local `next start`, so this is the one assertion that could only be
  proven against a real deployment — see the comment in `e2e/resume.spec.ts`).
- **Lighthouse (preview, desktop):** home — perf 100 / a11y 100 / BP 100 / SEO 63 (known
  Vercel-preview `noindex` artifact, production stays 100) / LCP 0.6s / CLS 0
  (`reports/lighthouse-wave14-home-2026-07-26.json`). `/work/reclaim` — perf 100 / a11y 100 /
  BP 100 / SEO 63 / LCP 0.6s / CLS 0 (`reports/lighthouse-wave14-reclaim-2026-07-26.json`) —
  the new route costs nothing.
- Screenshots: `reports/screenshots/wave14/` — `work-reclaim-1440.jpeg` (new case study,
  full page) and `filter-fixed-1440.jpeg` (the fix, live on preview: "LLM & Agents 5" as a
  solid-filled active pill, "Showing 5 of 13 projects" clearly visible beneath the pills —
  directly screenshotted after clicking, not a mockup).
- CI on this branch's actual GitHub Actions run: `build` ✅, `e2e` ✅ (2m31s), `lychee` ✅,
  Vercel preview ✅ — confirmed via `gh pr checks 22`, not assumed from local runs.

## Standing rule adopted

**No interactive feature is reported as working in a wave report unless an automated browser
test in `e2e/` actually drove it.** Code-review-only claims about interactive behavior
("instant," "keyboard-accessible," "works on mobile") are no longer sufficient evidence for
this repo — this is the rule wave 13's filter claim violated, and the rule this wave's E2E
suite exists to enforce going forward, including in CI.
