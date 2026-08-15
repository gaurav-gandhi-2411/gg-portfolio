# PLAN — GG Portfolio Site

Spec: `spec.md` (source of truth). Objective: a recruiter-facing portfolio positioning Gaurav
as a Senior/Principal Applied AI Scientist, driven entirely by a sourced content manifest —
every displayed number traces to `content/provenance.md` or it doesn't ship.

## P0 — sitewide DOM-crash fix; the original View-Transitions diagnosis was wrong (2026-08-16, PR pending GG's merge)

**Severity confirmed, root cause was NOT what the assigning brief (or the prior session) believed.**
A prior session found the site could crash with `insertBefore`/`removeChild` DOMExceptions and
attributed it to `components/transition-link.tsx`'s View Transitions API navigation, then shipped
a partial mitigation scoped to only 2 new draft-PR components (`perf/lcp-final`, PR #118) — worse
than no fix, since it suppressed the evidence exactly where it was tested and left the crash live
everywhere else. This round's brief inherited that diagnosis and assigned "remove View Transitions
sitewide" as the fix. **Removing View Transitions did not close the crash** — verified directly,
not assumed (see Task 4) — because View Transitions was never the actual mechanism. The real cause,
found via direct-load isolation and a monkey-patched `Node.prototype.insertBefore/removeChild`,
was `app/layout.tsx`'s boot-loader cleanup script calling `#boot-loader.remove()` on a DOM node
still owned by a mounted React Server Component, corrupting React's fiber-to-DOM bookkeeping for
the rest of the SPA session. Both fixes are in this PR; only the second one actually closes the
crash. Rule 101c / rule 99 applied here: a shipped conclusion (View Transitions is the cause) was
tested against ground truth rather than carried forward, and it did not hold.

- [x] **Task 1 — local repro, headed Playwright, production build, unmodified `main`.** `npm run
      build && npm run start`, headed Chromium (`headless: false`), 8 navigation cycles across
      home↔case-study and /projects↔case-study routes via the real nav (site-nav.tsx logo/links,
      project-card.tsx title/"Case study →" link). **6/8 hit rate** — first hit threw the exact
      `insertBefore`/`removeChild` `NotFoundError` DOMExceptions the prior report described; the
      remaining hits threw React error #418 (hydration mismatch), a softer, self-recovering
      symptom of the same underlying corruption.
- [x] **Task 2 — real production, headed Playwright, 10 cycles.** Against
      `https://gaurav-gandhi.vercel.app/` (not a preview, not local): home→4 case studies via
      card and header-logo nav, /projects→3 case studies via card. **10/10 cycles produced at
      least one uncaught page error.** 3/10 were the hard `insertBefore`/`removeChild` crash,
      screenshot-confirmed as Chromium's own native "This page couldn't load" interstitial (not
      a Next.js error boundary — the renderer itself gives up); the rest were the recoverable
      React #418 hydration mismatch (page still renders, console-only). Conclusion: real,
      frequent, production-reproducing P0, not a hypothetical.
- [x] **Task 3 — revert PR #118's partial mitigation.** `perf/lcp-final`'s
      `fix(nav): resolve in-flight view transitions before an async component mutates DOM`
      (commit `75b81eb`) reverted via `git revert`; its two call sites
      (`project-embedding-toggle.tsx`, `project-embedding-ambient.tsx`) updated in a follow-up
      commit since they imported the now-removed `waitForViewTransition` export — branch
      wouldn't otherwise build. `npm run typecheck && npm run build` reconfirmed clean on
      `perf/lcp-final` after both commits; pushed. PR #118 stays draft, not merged.
- [x] **Task 4 — removed the View Transitions API sitewide** (all 12 files:
      `components/transition-link.tsx`, `lib/view-transition.ts` deleted; 9 call sites moved to
      plain `next/link`; the per-slug `view-transition-name` shared-element morph and the
      `::view-transition-old/new(root)` cross-fade CSS removed from `app/globals.css`;
      `html:active-view-transition` overflow-lift rule removed, `overflow-x: clip` guard kept) —
      done as instructed, but **rebuilding and re-testing after this alone showed the crash
      completely unchanged (8/8 hit rate)**, which is the finding that triggered the actual
      investigation below. What's visually lost from this task alone: the browser-native
      cross-fade between routes and the project-card-title↔case-study-h1 shared-element morph.
      What's kept, cheaply: `app/template.tsx`'s pre-existing wave-12 `.page-enter` 240ms
      opacity/rise CSS fade now runs on every client-side nav unconditionally.
  - [x] **Root-cause investigation (not in the original task list, added because Task 4 alone
        didn't fix anything).** Direct `page.goto('/work/<slug>')` with zero client-side
        navigation involved still threw React error #418 on every route except `/` — proving the
        mechanism had nothing to do with client-side transitions or View Transitions at all.
        `npm run dev`'s unminified hydration diff pointed at `<BootLoader>`:
        `+ id="boot-loader" / - id={null}`. Traced to `app/layout.tsx`'s inline `<head>` script,
        which called `document.getElementById('boot-loader').remove()` 0ms after
        `DOMContentLoaded` on every non-home route (1150ms-delayed only on `/`) — racing React's
        hydration of `components/boot-loader.tsx` (a Server Component, rendered unconditionally
        on every route). Monkey-patching `Node.prototype.insertBefore`/`removeChild` to log the
        actual parent/child/reference nodes on failure confirmed the deeper problem: `<body>` was
        the parent, `#boot-loader` (already detached) was React's stale `insertBefore` anchor —
        and this reproduced on **any** later commit that touched `<body>`'s children, including
        client-side navigations that happened *well after* the 1150ms removal window (6/6 on a
        deliberately-late 1500ms-then-click retest), which is what proved a longer delay would
        not have fixed it either. Fix: the script no longer calls `.remove()` at all — it only
        deletes the `data-boot` attribute, which is sufficient on its own since `#boot-loader` is
        `display:none` by default in `globals.css`. `components/boot-loader.tsx` and
        `app/layout.tsx` both carry the full mechanism in comments.
- [x] **Gate — 24-hop single-session stress test (exceeds the assigned 20/10 gate) + full 8-cycle
      fresh-context sanity suite, both 0 errors after the real fix; re-ran against the fix
      branch's Vercel preview deployment per the assigned gate — see PR body for the preview URL,
      exact route pairs, and Playwright output.**
- [x] **Task 5 — e2e regression test** (`e2e/nav-crash-regression.spec.ts`) covering every route
      pair reachable from the header nav plus home→each case study in `content/products.ts`,
      failing on any `pageerror` or rendered error-page text. Prevents recurrence of either
      mechanism (View Transitions or a future React-ownership DOM conflict), not just documents
      this one fix.
- [x] **Task 6 — `git fsck --full`** on both `gg-portfolio` and `gh-profile` main checkouts:
      clean, no dangling/corrupt objects. Last check per this round's instruction.

Full methodology, exact hit-rate numbers, and screenshots: PR body (`fix/remove-view-
transitions`, not yet merged — this needs GG's review given severity and reach, and given the
mid-task pivot away from the assigned diagnosis).

## Wave 18 — site-vs-repo + resume-vs-site reconciliation (2026-08-05, content-only, not yet deployed)

GG's brief, two items, item B priority: (A) cap resume-generator full entries at
`max_full_entries` (see the resume-variant-generator amendment 5 log below); (B) sync the
portfolio site to verified repo truth across all 13 projects, then a resume-vs-site diff, then
deploy only once both are clean.

- [x] **Site-vs-repo diff, all 13 projects**: 8 parallel research agents independently verified
      every numeric/factual claim in every case study against its repo. 10 of 13 projects needed
      fixes (TriageIQ, AgentGauge, Style Maitri, Warmer, MMFR, Reclaim, Gold Rate Tracker,
      DealHunter, tracegauge, AetherArt); ShelfSense, ReviewIQ, Expense Tracker were clean. Full
      per-project table with file:line citations: `content/provenance.md`'s new Wave 18 section.
      Biggest findings: TriageIQ's retrieval Recall@5 was stale by *two* uncalled ADR corrections
      (vscode's number isn't "retired" anymore — it recovered to 50.5%); Style Maitri's catalogue
      more than doubled (52,494→112,425 items, 8→42 stores) with a same-day eval report the site
      never picked up; Gold Rate Tracker's backtest results row silently mixed numbers from two
      different bot-refreshed snapshots (an internal-consistency bug, not a new measurement).
      GG's own two premises were checked, not assumed: TriageIQ's 87.1%/89.8% and the CQR
      coverage numbers were both confirmed correct as stated; tracegauge was checked against the
      same "mis-derived like AgentGauge" hypothesis and found **not** to match it — already
      correctly `surface: "pypi"` (this was a finding from the resume-generator's amendment 4,
      not new here, but re-confirmed).
- [x] **Resume-vs-site diff (do-not-auto-resolve gate)**: every number in
      `content/resume-data.json`'s 13 project bullets checked against the now-corrected site.
      **4 mismatches found, NOT auto-resolved per GG's explicit instruction — reported below,
      deploy held until GG says how to resolve them:**

  | Project | Resume value | Site value (post-fix) |
  |---|---|---|
  | Style Maitri | "~52K items from 8 store catalogues" | "112,425 items across 42 stores" |
  | Style Maitri | "93.8% (n=211)" | "94.4% (n=378)" |
  | Gold Rate Tracker | "Wilcoxon p=0.0003" | "p≈0" |
  | tracegauge | "601/601 tests passing" | "643/643 passing" |

  All 4 are cases where the resume was extracted from the site/repo *before* this wave's
  corrections landed — the resume is simply older, not independently wrong. The obvious
  resolution is updating the resume to match the now-verified site/repo values, but that wasn't
  done automatically per the explicit gate; needs GG's confirmation before touching
  `content/resume-data.json` (a file the resume-variant-generator amendments above depend on).
- [ ] **Deploy — still blocked, for a different and more serious reason than the original 4
      mismatches.** GG discovered this branch (`feat/uiux-live-pass`) was stale relative to
      `main` — PR #32 had already merged nearly-identical fixes independently, and an open
      automation PR (#44) was about to revert them. Full resolution: `content/provenance.md`'s
      new Wave 19 section (2026-08-05). Summary:
      - PR #44 **closed, not merged**.
      - Style Maitri accuracy/catalogue-size **reverted** to the git-verified numbers
        (93.8%/n=211, 52,494/8 stores) — PR #32's higher numbers (94.4%/n=378, 112,425/42) trace
        only to gitignored, never-committed local reports with no git commit date; per GG's
        explicit rule, no dated artifact = doesn't ship, even lowering a number.
      - DealHunter test count **corrected to 727** (live `pytest --collect-only`, independently
        reproduced, matches PR #32).
      - `scripts/refresh-metrics.mjs` **fixed at the root cause**: fail-closed on a stale
        manifest (21-day gate) + a regression guard rejecting any manifest-proposed value whose
        `measured_at` isn't strictly newer than what's already recorded — the second guard would
        have mechanically blocked PR #44's regression.
      - Manifest staleness audited across all repos with a `.portfolio/metrics.json` (report
        only, full table in provenance.md) — 4 repos have no manifest at all (structural gap),
        several more have manifests over 21 days old (some with real drift, some false-positive
        holds on values that are still correct).
      - **3 background shells confirmed still running** (live `eval_gate.py` in
        agentic-shopping-assistant, a live Nuitka build in reclaim, GCP IAM investigation shells
        in triage-iq) — per GG's explicit instruction, **no git operation** (rebase, commit,
        push) runs until GG confirms these have exited. Everything above is local file edits
        only, nothing committed.
      - All 4 resume variants rebuilt against the corrected data (local build, no git needed):
        8 rendered entries each (TriageIQ, Style Maitri, AgentGauge, MMFR, Warmer, AetherArt,
        Gold Rate Tracker, DealHunter), 5 collapsed, 2/2 pages, independently re-verified with
        `pypdf`.
- [x] **Verification**: `tsc --noEmit` clean, `eslint` clean on every touched file,
      `content/metrics.json`/`content/resume-data.json` valid JSON, resume-generator smoke tests
      passing, resume-vs-site diff re-confirmed empty after the reversion.

## UI/UX pass — desktop density, "feels alive," chatbot streaming (2026-07-30, draft PR pending GG's merge + design-reviewer sign-off)

Branch `feat/uiux-live-pass`, off `main` post the chatbot hotfix. Full report:
`reports/uiux-live-pass-2026-07-30.md`. Three commits:

1. **Desktop density root cause** (`91b3db5`): wave 13's own desktop-composition pass
   anchored the shared container width step to `xl` (1280px), not just the column-split
   toggles — so 1024–1279px got the tablet layout, reproducing GG's exact standing
   complaint. Moved the whole system (10 files) from `xl` to `lg` in lockstep.
2. **Chatbot alive** (`1ddecd3`): client-side progressive reveal of the already-validated
   answer (route.ts's non-streaming design stays — citation validation can't run on partial
   output), real typing dots, message fade-in, follow-ups that exclude already-asked
   questions, focus/press states on the Ask button and chips (previously had none).
3. **Interaction feedback + live-data signal, site-wide** (`7df1ba2`): every embedded demo
   widget (heat-toy, TriageIQ classifier toy + disclosure) was missing the focus-visible +
   active-press pattern every "core" element already has; project-card datelines are
   genuinely live-fetched data now marked with a small pulsing dot (hero's existing
   availability-badge language, not a new one).

Verified after every commit: typecheck/lint/build clean, full Playwright suite (74 desktop +
72 mobile) green, axe zero-violations unchanged on all 22 routes. Lighthouse 100/96/100/100
(a11y/best-practices/SEO/agentic) on `/`, `/ask`, `/projects` — the 96 is Vercel's own
analytics scripts 404ing locally, not a real regression. LCP 323ms, CLS 0.00 on `/`. Eager JS
169,504 B gzip vs. the 220,160 B ceiling (chunk-sum method, matching prior waves).

**Design-reviewer sign-off:** first pass blocked on one real, evidenced issue — this wave's
own `xl→lg` density fix newly exposed a collision between the fixed chat-launcher pill and
case-study-page.tsx's sticky rail at 1024–1440px (rail links became unclickable, not just
crowded). Fixed (`97bd728`): launcher hides on `/work/[slug]` at the rail's own `lg`
breakpoint. Both non-blocking suggestions (the `.live-dot` pulse read as "happening now" on
every card, including past-tense ones; a screenshot mislabeled as the typing state) also
addressed. Follow-up review verified the fix directly (not the claim) and signed off:
**approved with suggestions**. One tradeoff recorded rather than silently absorbed: case-
study readers at lg+ lose the corner chatbot entry point on that page — judged acceptable
given the rail's existing CTAs, flagged to revisit if usage data ever shows it costing the
chatbot funnel.

## Hotfix — production /api/chat 500s (2026-07-30, draft PR pending GG's merge)

GG reported the `/ask` chatbot broken in production with a generic "check your connection"
message. It wasn't the user's connection — two independent server-side bugs, both only
reachable once wave 16's chatbot actually shipped to Vercel's real runtime (neither is
visible locally, where node_modules/tmp are writable):

1. `@huggingface/transformers`' onnxruntime-node native binding (`libonnxruntime.so.1`)
   wasn't in the deployed function bundle — Next's static file-tracing can't see a
   template-literal `require` path or a `dlopen`'d sibling `.so`. Fixed with
   `outputFileTracingIncludes` in `next.config.ts`.
2. Found only after #1 was fixed and the code ran further than ever before: transformers.js's
   default model-file cache tried to `mkdir` inside its own (read-only on Vercel)
   `node_modules` directory. Pointed `env.cacheDir` at `os.tmpdir()`.
3. `GROQ_API_KEY` was set for Production (added when wave 16 shipped) but never for
   Preview, per `vercel env ls` — closing wave 16's own pending TODO, and meaning no preview
   deployment could ever have caught this even after a code fix. Added to Preview.

Also fixed the complaint itself: `route.ts` now catches everything and always returns
well-formed JSON (never Next's raw HTML crash page) with structured `console.error` logging;
`ask-panel.tsx` distinguishes offline/timeout/server-fault/network instead of one generic
message. New `chat-canary.yml` (every 6h) catches this class of regression going forward —
dry-run against the still-broken prod during this fix correctly caught the live 500.

Verified end-to-end on the fix's own Vercel preview (not just locally): real grounded answer
with a working citation link, refusal path, and all four error states — via direct `curl`,
the full Playwright suite pointed at the preview URL, and a real Chrome session. Cold-start
on Vercel's actual network to Hugging Face Hub measured 4.3s (well inside the 30s
client/server timeout bound chosen). Lighthouse on `/ask`: a11y 100, best-practices 100
(`reports/lighthouse-chatbot-fix-ask-2026-07-30.report.json`). Branch
`fix/chatbot-prod-runtime`, off `main` post the a11y-contrast PR (`b04f18f`).

Found and preserved (not authored this session, not investigated) two uncommitted files in
the working tree at session start — a "wave 17" AetherArt content update
(`content/case-studies/aetherart.ts`, `content/provenance.md`) — WIP-committed on
`fix/projects-hover-contrast` rather than touched or discarded. Flagged for GG: looks like
real, source-verified work that never got its own PR.

## Wave 16 — state reconciliation, identity-drift detection, portfolio chatbot (code-complete 2026-07-26, pending GG's merge + live eval baseline)

GG's brief: reconcile all 13 projects to ground truth (three rebrands had gone unnoticed);
extend the weekly Action to detect identity drift, not just metrics drift; build a RAG chatbot
over GG's own case-study corpus as a flagship applied-AI demo, with a published eval; four
think-ahead improvements. Branch `feat/wave16-reconciliation-chatbot`, off `main` post wave-15
merge (`24a258d`). Full report: `reports/wave16-writeup-2026-07-26.md`.

- [x] **Item 1 — reconciliation**: two premises in the brief didn't hold up under verification
      against the real source repos (no Samidha custom domain at verification time, no MMFR
      Vercel app) — reconciled to verified reality instead, documented plainly.
      `reviewiq` renamed "Samidha Reviews" (the live rebrand checked out); `expense-tracker`
      given its actual working `liveUrl` (wave 15's report had cited a dead one). Full 13-row
      table: `reports/wave16-reconciliation-2026-07-26.md`.
- [x] **Item 2 — identity-drift detection**: new `scripts/identity-drift.mjs` + machine-owned
      `content/identity-state.json`, third job in `metrics-refresh.yml`. Rename detection is
      diffed against the *previous run's* value (not README-vs-`products.ts` directly) so
      permanently-intentional cosmetic name gaps don't reopen an issue every week. A real
      name-mismatch also opens a per-repo GitHub issue.
- [x] **Item 3 — portfolio chatbot (`/ask`)**: build-time corpus indexing (400 chunks, local
      ONNX embeddings via `@huggingface/transformers` — not a hosted API, so corpus and query
      embeddings share one vector space with zero external dependency at request time) → hybrid
      dense+lexical retrieval with a threshold refusal gate → Groq JSON-mode generation with
      every citation validated server-side before reaching the client → dedicated `/ask` page
      (not a widget) + corner launcher → 30-case eval harness with cassette-replay CI. **Live
      eval baseline still pending** — no `GROQ_API_KEY` in this environment; `/ask`'s eval-numbers
      block shows placeholder "pending" copy, not fabricated numbers.
- [x] **Item 4 — think-ahead**: structured `content/availability.ts`; related-projects section
      (free from existing category tags); printable case-study view (`@media print`, no PDF
      lib); "Currently building" signal on the hero from real GitHub push activity.
- [x] **Verification**: full Playwright suite 131/132 passed — the 1 failure is a **pre-existing
      bug on `main`** (confirmed via a clean worktree check before touching anything): the
      `/projects` hover-recede opacity drops text contrast below WCAG AA on real mouse hover.
      Attempted a fix, hit a second harder-to-explain compounding case, reverted rather than ship
      a partially-understood tweak outside this wave's scope — flagged for a follow-up wave.
      Lighthouse: home 0.91/1.00/0.96/1.00 (412 KiB), `/ask` 0.92/1.00/0.96/1.00 (392 KiB) — the
      chatbot doesn't blow the home page's budget.
- [ ] Large diff → **draft PR for GG's manual review/merge**. Needs GG's action on: a live
      `GROQ_API_KEY` run to record the eval baseline and wire real CI thresholds; adding
      `GROQ_API_KEY` as a Vercel production env var (live serving-config change, not done
      autonomously); the pre-existing `/projects` contrast bug.
- **Separate task, not part of this branch**: mid-wave, GG asked (explicitly separately) to get
  `samidhareviews.xyz` live for the `review-iq` repo. Handled entirely outside `gg-portfolio` —
  findings and remaining manual DNS/Cloudflare steps were reported directly, not duplicated here.

## Wave 15 — content framing, progressive disclosure, agentic pipeline (code-complete 2026-07-26, pending GG's merge)

GG's brief: rewrite case-study framing to lead with capability not failure; progressive
disclosure (4-card tease + category pages); replace the metric-refresh pipeline with a
multi-agent extractor/curator/framer/verifier pipeline; audit manifest/CI coverage across all
17 repos; migrate expense-tracker onto review-iq's Supabase; five forward-looking enhancements.
Branch `feat/wave15-content-framing-pipeline`. Full report:
`reports/wave15-content-pipeline-2026-07-25.md`.

- [x] **Item 1 — framing rewrite**: all 13 case-study deks + story titles rewritten to lead
      with the capability/action demonstrated; body/results/numbers unchanged. New `closing`
      field ("What this means if you need something similar") added to all 13. Before/after
      headline table in the wave report.
- [x] **Item 2 — progressive disclosure**: home + `/projects` cap every filter view to 4 cards
      + "See all N" (home's "All" caps too; `/projects`'s own "All" stays uncapped — it's the
      destination). New `/projects/[category]` SSG route, one per category. `<noscript>`
      override keeps the cap from becoming a permanent no-JS content gate (dedicated e2e
      assertion). Budget +558B gzip.
- [x] **Item 4 — manifest/CI audit, all 17 repos**: re-verified fresh against `origin/main`
      (a research agent's snapshot was stale on 2 of 4 flagged repos — nothing done there).
      Real gaps: `token-efficiency-scorer` (missing both — PR #1, green after 3 fix-rounds:
      stale/gitignored `uv.lock`, a numpy-stub/mypy `python_version` mismatch, 2 real-corpus
      test dependencies, 1 Linux-only flake, all investigated not blind-excluded) and
      `mindmeld-payloads` (missing CI — PR #2, minimal JSON-validation check, green). Full
      repo-by-repo table in the wave report.
- [x] **Item 6 — enhancements**: per-project OG images, per-case-study JSON-LD
      (SoftwareApplication), git-derived last-updated + reading time, a "Work with me" CTA on
      every case study. Vercel Web Analytics data blocked on GG enabling the dashboard feature
      itself (client lib already wired since wave 2) — numbered steps in the wave report, no
      fabricated numbers.
- [x] **Item 3 — agentic content pipeline**: done. `scripts/content-pipeline/`
      (extractor→curator→framer→verifier), rubric documented at
      `docs/content-pipeline-rubric.md`. Curator/framer on Groq/Llama-3.3-70B, verifier on
      Groq/Qwen3.6-27B (genuinely different family — the OpenRouter path tried first for a
      different *provider* used a dead reused key, found Qwen on Groq's own catalog instead, zero
      new credentials). Output lands in `content/provenance.md` as a dated "LLM-consensus,
      pending human review" section — never a direct edit to the case-study files. Validated
      against real repos before wiring in: 3 proposals, and the verifier caught a real framer
      hallucination (a flipped win/loss comparison) in the same test run. Wired into
      `.github/workflows/metrics-refresh.yml` (renamed "Content + metrics refresh") as its own
      job/PR, separate from the metric-value refresh. Shared-Groq-quota consideration (this key
      also serves live traffic on other GG projects) surfaced in the wave report, not hidden —
      bounded to ~20 candidates/run to keep the marginal impact small.
- [x] **Item 5 — expense-tracker on review-iq's Supabase**: done. STRIDE pass written; dedicated
      `expense` schema + non-superuser `expense_app` role (zero grants on `public`, verified by
      direct denial test, not just convention); migrations 001-003 land in `expense` unchanged
      (role's own `search_path`); new `app_profiles` table + auth hook documents the shared-
      `auth.users` handling. review-iq regression-tested with its own live-Supabase integration
      suite: **71 passed, 0 failed** — one transient failure investigated and traced to my own
      interrupted prior test run, not this change. Backend redeployed to Cloud Run (was 500 on
      every route, now 200/401 correctly); frontend redeployed fresh on Vercel (previous project
      gone) at https://expense-tracker-eight-xi-93.vercel.app; CORS verified end-to-end. PR:
      `gaurav-gandhi-2411/expense-tracker#3`. **Residual risk (review-iq's own superuser
      connection) closed same day at GG's request**: `gaurav-gandhi-2411/review-iq#14` rotates
      it to a dedicated non-superuser `review_iq_app` role (member of `authenticated` +
      `BYPASSRLS`, matching Supabase's own `service_role` shape). Verified via review-iq's own
      71-test live-Supabase suite before touching any deployed config — first attempt (no
      BYPASSRLS) failed 26/71 on the org-admin RLS-boundary paths, fixed, re-ran clean, then
      rotated the live secret and redeployed per `ops/runbooks/secret-rotation.md`. Bidirectional
      isolation between expense-tracker and review-iq is now real, not an accepted gap.
      Numbered steps for GG in the wave report (PR review, password custody, custom domain,
      when to flip the case-study's "offline" claim to live).
- [ ] Large diff (6 substantial items) → **draft PR for GG's manual review/merge**, same posture
      as prior waves. Also needs GG's merge on the two manifest/CI PRs (item 4) and the
      expense-tracker Supabase-migration PR (item 5) opened on their own repos this wave.

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
- [x] **Accent ratified 2026-07-12: indigo (`#818CF8`).** Warmer's card stays without a
      GitHub link — repo stays private, GG's deliberate call, not a bug to fix.
- [x] Full dark+indigo remap shipped: tokens finalized (renamed `--accent-cyan` →
      `--indigo`, border bumped `#2C2F36`→`#62656E` after contrast-checking found it failed
      the 3:1 non-text-contrast requirement — see globals.css header comment for the full
      WCAG table), monogram + favicon + OG image all recolored to match.
- [x] Restrained motion: `components/reveal.tsx` — IntersectionObserver fade+rise on
      scroll, once, `motion-reduce:` CSS variant handles reduced-motion (not a JS branch, to
      avoid a setState-in-effect lint violation). Applied to every section except Hero
      (renders immediately, no reveal-on-load flash). Card hover: accent-tinted ring + soft
      `color-mix()` glow shadow on Products/Research cards — subtle by design, not a heavy
      glow.
- [x] Responsive matrix 390/768/1024/1440px, screenshotted — clean at every breakpoint.
      Gotcha: `resize_page` has a ~501px hard floor on this Windows Chrome install (can't
      size below it); had to use `emulate` (CDP device-metrics override) to actually hit
      390px. Found and fixed one polish issue along the way: product cards weren't stretching
      to equal height in their grid row — added `h-full`.
- [x] A11y re-verified post-remap: `npx @axe-core/cli` → 0 violations; contrast recomputed
      for every token pair (see globals.css); keyboard-tab focus ring confirmed visible
      (indigo outline, high contrast against the dark background).
- [x] Lighthouse: Accessibility 100, Best Practices 96 (1 finding — `/_vercel/insights/script.js`
      404s on local-only `next start`, confirmed 200 on the real deployment, not a real
      defect), SEO 100. LCP 171ms / CLS 0.00 (localhost, unthrottled — real-world will be
      higher, no CrUX field data yet for this new domain). **JS budget: 161.3 KiB gzip vs.
      150 KB target — over by 11.3 KiB (7.5%).** Root cause: React 19 + Next 16 App Router
      runtime alone is 69.3 KiB; chasing the remainder would mean swapping out
      `@base-ui/react` or auditing per-component import weight — not attempted this wave,
      flagged as an open follow-up rather than silently passing. Full report:
      `reports/wave2-perf-budgets-2026-07-12.md` + `reports/lighthouse-2026-07-12.json`.

## Wave 3 — "Living portfolio" (code-complete 2026-07-13, pending PR #9 merge)

Redefined scope per GG: liveliness = proof of connection to real running systems + premium
micro-interaction craft. Priority-tiered. Supersedes/postpones the original "flip arXiv ID"
wave 3 definition below, which still applies whenever GG has a real arXiv ID.

**Budget correction (important, found during Tier 1 build-testing):** wave 2's reported
161.3 KiB JS total was **wrong** — a chunk-enumeration miss, corrected to the true
**204,762 bytes (200.0 KiB)**, verified 3 ways including a from-scratch bare `create-next-app`
reproducing the identical missed chunk (39.6 KiB of core-js polyfills baked into Next.js
16.2.10 + Turbopack's default output — not app code, not fixable via `browserslist` or
dependency changes, tried both). This means GG's "re-baseline to 165KB" instruction was based
on my wrong number — the real framework floor alone is already ~191-205 KB. Rather than
re-litigate the absolute figure mid-wave, holding to the guardrail's actual intent: **every
wave-3 feature must add zero bytes to the eager bundle**, via `next/dynamic` for anything
interactive. Full writeup: `reports/wave3-live-stats-budget-2026-07-12.md`. **Update
2026-07-13:** the 165 KB figure is now formally retired — re-ratified to ≤215 KB gzip in
`reports/wave3-budget-reratification-2026-07-13.md`, which is the current source of truth.

- [x] **Tier 1 — living data (zero JS cost, build-time/ISR only):** `lib/live-data.ts` — all
      4 fetches revalidate every 6h, fail soft (never throw, degrade to no-badge on error).
      Warmer "Puzzle #N live today" (mindmeld-payloads manifest, confirmed Puzzle #31 on
      2026-07-12), tracegauge weekly PyPI downloads (pypistats.org, confirmed 32/week),
      per-product "shipped Nd/mo ago" freshness badges (GitHub commits API, per public repo),
      shipping log of recent merged PRs across all public repos (GitHub public events API —
      found and fixed a payload-shape assumption bug during build-testing, see
      `content/provenance.md`'s Tier 1 section for the correction). `content/now.ts` +
      `NowStrip` component — manually dated building-in-public line, date always renders so a
      stale Now is visibly stale, never silently presented as current.
      Deliberately unauthenticated GitHub API calls (60/hr limit) rather than provisioning a
      token/secret — ISR's 6h revalidation means call volume is trivially within that limit,
      and least-privilege (rule 96) favors not managing a new credential for read-only public
      data.
- [x] **Tier 2.4 — hero semantic-heat toy:** reuses Warmer's actual mechanic (same base
      model, `all-MiniLM-L6-v2`) — `scripts/generate-heat-toy-vocab.py` embeds 410 curated
      words, PCA-reduces to 72 dims (72.3% variance retained, verified semantic neighbors
      stay sensible post-reduction), quantizes to uint8 → `public/heat-toy-vocab.json`
      (41.7 KiB gzip, well under the 80KB asset budget). `components/heat-toy.tsx` (cosine
      sim + form) is `next/dynamic`-loaded only on interaction, behind a 1.5KB eager
      `HeroHeatToyShell`. Verified isolated: eager bundle went 204,762 → 206,318 bytes
      (+1,556, exactly the shell's size — the heavy component and vocab data cost zero
      bytes for visitors who never click). Logic verified correct via a Node.js simulation
      against the real generated vocab file; UI verified via accessibility-tree snapshot
      (labeled form, `aria-live` feedback). Full report:
      `reports/wave3-heat-toy-budget-2026-07-12.md`.
- [x] **Tier 2.5+2.6 — command palette + micro-interactions:** ⌘K/`/` command palette
      (native `<dialog>`, dynamic-imported UI behind a 1.5KB eager shell), count-up hero
      stats, animated monogram draw-in, cursor-glow on flagship+research cards, staggered
      card-grid reveal (≤280ms spread, under the 400ms ceiling). Eager JS +3,100 bytes
      (207,862 bytes total). **LCP investigation:** initial measurement showed +21.7% vs.
      wave 2's recorded 171ms — investigated rather than shipped blind. Re-measured the
      pre-this-PR commit fresh in an isolated worktree under identical current system load:
      211ms, statistically identical to this branch's 205.7ms 3-run average. The 171ms
      figure was stale (measured under different background load earlier in the session);
      this PR adds no measurable LCP cost. Fixed one real a11y finding pre-merge
      (`label-content-name-mismatch` on the palette trigger — redundant `aria-label` didn't
      include the button's own visible text, WCAG 2.5.3; axe-core didn't catch it, Lighthouse
      did). Full report: `reports/wave3-tier2-microinteractions-2026-07-12.md`.
- [ ] **Tier 3.7 — dynamic per-section OG images: cut.** Brief's own condition ("if sections
      gain routes") doesn't apply — still a single-page site, no per-section routes exist.
      Single dark+indigo OG from wave 2 stands.
- [x] **Design-reviewer sign-off (Tier 2.5+2.6):** caught one real blocking bug the manual
      browser check missed — the command palette's native `<dialog>` rendered pinned to the
      top-left corner instead of centered (Tailwind Preflight strips the UA stylesheet's
      `dialog:modal { margin: auto }`). Fixed with explicit positioning
      (`fixed inset-auto top-24 left-1/2 -translate-x-1/2`), re-screenshotted, re-verified
      (axe still 0 violations). 3 non-blocking suggestions logged and since fixed in the
      close-out below.
- [x] **Post-PR#9 close-out (2026-07-13):** three items —
      1. **Budget re-ratified to ≤215 KB gzip** on the corrected measurement (current: 207,862
         bytes / 203.0 KiB). The 165 KB figure from this wave's kickoff is explicitly retired
         — it was built on the wave-2 mismeasurement, never an achievable target for this
         stack. `README.md` (new — none existed before) and `spec.md` both updated to cite
         `reports/wave3-budget-reratification-2026-07-13.md` as the source of truth going
         forward.
      2. **Design-reviewer's 3 non-blocking items fixed:** `animated-monogram.tsx` now
         references `var(--text-hi)`/`var(--accent)` instead of hardcoded hex (was a rule 15b
         token-bypass); the duplicated hover-shadow arbitrary value in `products.tsx` +
         `research.tsx` promoted to a named `--shadow-glow` token, consumed via the
         `shadow-glow` utility; mobile (390px) screenshot set added at
         `reports/screenshots/wave3-mobile/` — palette centers correctly at mobile width too
         (the reviewer's speculative "flush to top edge" concern didn't materialize, since
         the centering fix's `top-24` offset is a fixed value, not viewport-relative).
      3. This close-out lands as additional commits on the still-open `feat/wave3-palette-
         microinteractions` branch (PR #9) rather than a separate PR — items 2's fixes touch
         files that only exist on that unmerged branch, so a fresh PR from `main` isn't
         possible until #9 merges. **PR #9 is still open/draft, not yet merged** — gate 3
         (515 reviewable lines vs. the ~400 cap) still fails, which is why this couldn't ship
         as the small, independently-auto-mergeable PR originally framed. Needs GG's manual
         merge.

**Wave 3 ("Living portfolio") is complete** — PR #9 merged 2026-07-13.

## Wave 4 — design concept divergence + editorial production rebuild (2026-07-16)

**Phase 1 (concept exploration, no production code):** three genuinely divergent design
concepts built as throwaway static routes (`explore/wave4-concepts` branch, never merged) —
A: editorial/magazine (giant Fraunces display, asymmetric grid, products as feature spreads
with a pull-quote signature element), B: terminal/systems (monospace console, live-telemetry
dashboard as the star, heat toy as a REPL widget), C: spatial/narrative (five-act scroll story,
an evolving monogram as the signature element, CSS-only scroll mechanics). All three real
content, real live data, axe-clean (2 real bugs found and fixed during review: a command-
palette-style z-index collision behind Concept C's hero text, and a heading-order/missing-h1
pair caught across A and B's boot-sequence). GG picked **Concept A**, with B's telemetry band
and heat toy to transplant.

**Phase 2 (production rebuild, `feat/wave4-editorial-redesign` branch, draft PR pending GG's
merge):**
- [x] **9-vs-10 provenance fix, shipped first as its own small PR (#10, merged 2026-07-16,
      auto-merge eligible):** the hero's "9 live products" stat was a hand-typed string that
      happened to match `provenance.md`'s manual count at write-time — nothing kept it in sync
      with `content/products.ts` going forward. Now derived via `liveProductCount()`.
- [x] **Concept A rebuilt as the production homepage**: Fraunces + Space Grotesk (replaces
      Inter sitewide) + JetBrains Mono for data figures. Flagship products as pull-quoted
      feature spreads; secondary products as a linked editorial index (GitHub/live links on
      every product, not just flagship — conversion-pass requirement).
- [x] **B's telemetry transplanted as "00 — Live"** (`components/sections/live-band.tsx`) —
      real Warmer puzzle #, real tracegauge downloads, a curated "recently shipped" feed
      (bot/CI-noise filtered out, humanized branch names, 2-per-repo cap for diversity).
      Replaces the separate wave-3 NowStrip + ShippingLog sections.
- [x] **B's heat toy transplanted into the hero**, reframed with a one-line plain-language
      instruction instead of REPL chrome — same underlying cosine-similarity engine.
- [x] **Weak spots designed, not defaulted**: Research abstract as a true pull-quote with an
      intentional "preprint, pending arXiv" margin note; tracegauge moved out of the secondary
      index (its `pip install` didn't fit a metric-shaped row) into its own colophon footnote.
- [x] **Conversion pass**: resume CTA in hero + again at end of Experience; a consulting line
      in Contact ("open to short-term AI/ML build or advisory projects" — wording confirmed
      with GG); large unmissable email CTA closing Contact.
- [x] **Design-reviewer sign-off**: first pass blocked on 3 issues (unhumanized/bot-noisy
      shipping-log transplant, jargon-first secondary taglines, missing phase-1 screenshots in
      this branch) — all 3 fixed and confirmed resolved in a second pass. Full detail:
      `reports/wave4-editorial-redesign-2026-07-16.md`.
- [x] **Budget**: 201,895 bytes (197.2 KiB) eager JS, comfortably under the 220,160-byte
      (215 KB) ceiling — no new client interaction surface added; also removed genuinely dead
      code surfaced by the layout change (`components/cursor-glow.tsx` + the `--shadow-glow`
      token had zero consumers once the card grid was replaced by spreads; `reveal.tsx`'s
      unused wave-3 stagger hook removed too).
- [x] **Accessibility**: axe 0 violations (checked repeatedly through the build), correct
      heading hierarchy end-to-end, one real duplicate screen-reader announcement bug found
      and fixed on the hero stats.
- [x] **Lighthouse captured (2026-07-16, follow-up pass):** ran `npx lighthouse` CLI against
      PR #11's Vercel preview (the chrome-devtools MCP tool used for the wave-3 baseline
      wasn't used this time — went straight to the CLI). Accessibility held at 100, Best
      Practices improved 96→100 (wave-3's 96 was a localhost-only `/_vercel/insights` 404
      that doesn't fire against a real deployment). SEO reads 63 on the preview but this is a
      Vercel preview-URL artifact (`X-Robots-Tag: noindex`, auto-injected on every
      `*.vercel.app` preview, confirmed absent on production and absent from this PR's diff)
      — production SEO stays 100. Full detail: `reports/lighthouse-wave4-2026-07-16.md` +
      `reports/lighthouse-wave4-2026-07-16.json`.
- [x] **LCP deep-dive (2026-07-16):** the preview's simulated LCP came in at 4.03s vs. wave
      3's 205.7ms (different measurement method — DevTools trace vs. Lighthouse — not a
      true apples-to-apples baseline). Investigated whether the hero heat toy or ⌘K palette
      hydrate eagerly and are fixable: **they don't** — both already defer their heavy logic
      to interaction via `next/dynamic`, confirmed by reading `hero-heat-toy-shell.tsx` and
      `command-palette-shell.tsx`, unchanged from wave 3's design. Isolated preview-only
      overhead (~550ms, mostly the `vercel.live` preview-toolbar script) via a local
      production-build comparison; re-tested wave 3's already-documented `core-js`/
      browserslist finding under the current Turbopack toolchain (still a no-op — 0 byte
      change after adding an explicit modern browserslist target, reverted). Real (non-simulated)
      devtools-throttled measurement: 3.12s, matching the trace breakdown exactly (unlike the
      Lantern-simulated run, which under-reports the render-delay subpart). **Conclusion:
      framework floor, accepted.** The remaining ~3.1-3.5s under a 4×-CPU-throttle profile is
      React/Next hydration + style/layout cost inherent to a client-hydrated homepage of this
      shape, not attributable to any single wave-4 feature, and not moved by the app-level
      levers available without a materially larger rendering-architecture change than this
      pass's scope. Full trace evidence and methodology: `reports/wave4-lcp-investigation-2026-07-16.md`.
- [x] **Real field LCP: instrumentation added, data not available yet.** `@vercel/analytics`
      (already installed) only reports pageviews, not Core Web Vitals — there was no way to
      get a real p75 LCP regardless of traffic. Added `@vercel/speed-insights`
      (`<SpeedInsights />` in `app/layout.tsx`), verified zero measurable eager-path cost.
      **Open follow-up: check the Speed Insights p75 LCP once this deploys and gets real
      traffic — that field number, not the lab figure above, is the actual bar.**
- [x] **`/concepts/*` deleted** from the production branch once the rebuild was verified.

Opened as a **draft PR** (large diff, full homepage rebuild) for GG's manual review and merge —
never intended to be gate-3-eligible at this size, not forced through. **2026-07-16 update:
PR #11 marked ready for review (no longer draft) at GG's request, but is still unmerged** —
`gh pr merge` is mechanically blocked by this repo's rule-70a hook (gate 3: diff size), which
is working as designed; the Lighthouse + LCP follow-up work above landed as additional commits
on the same branch (same pattern as wave 3's PR #9 post-review close-out) rather than a
separate PR, since the files being investigated only exist on this branch. Still needs GG's
manual merge via the GitHub UI or `gh pr merge` run outside this session.

## Wave 5 — restraint + restructure (2026-07-16, draft PR pending GG's merge)

GG's brief: wave 4 was over-scaled and unbalanced; reposition around INDEPENDENT work.
Reference for feel only (maninder.vercel.app) studied in-browser and measured — principles
extracted (h1 only ~1.5× section headings, whitespace does the separation, employment named
once outside Experience), not pixels. Full report:
`reports/wave5-restraint-restructure-2026-07-16.md`.

- [x] **Phase 0 gate honored:** two hero options at the restrained scale built as throwaway
      routes (`explore/wave5-hero-options`, desktop+mobile screenshots) and posted for GG's
      pick BEFORE any production rebuild — the last two waves over-committed before GG saw
      proportions. **GG ratified Option A ("byline": left-aligned, name-led, 40-64px cap).**
- [x] **Modular type scale** (ratio exactly 1.25 on the 18px body): five tokens in
      `globals.css` (`--text-lead/title/heading/stat/display`) + `--tracking-eyebrow`. Full
      typographic audit — hero 180px→64px max, section numerals 104px→35px, flagship titles
      88px→28px, contact email 64px→35px, `font-black`→`font-semibold` sitewide; grep-verified
      no component-level clamp()/oversize/arbitrary-tracking remains. Rhythm: `py-16 md:py-24`
      sections, `mt-10` after every section mark.
- [x] **Positioning shift:** Uber-derived stats out of the hero (stay in Experience);
      `content/site.ts` scaffolds 3 independent stats — derived live-product count + two
      em-dash placeholders **TODO(GG): supply the two numbers**. Now-strip and shipping log
      deleted entirely (`content/now.ts`, `live-band.tsx`, `getShippingLog`, orphaned
      `flagship-feature.tsx`/`secondary-index.tsx` all removed). Surviving live data
      relocated with context: Warmer puzzle # → heat-toy annex, tracegauge downloads →
      colophon footnote.
- [x] **Products → APG-pattern carousel** (`work-carousel.tsx`): 9 slides, scroll-snap
      touch, arrows + ArrowLeft/Right/Home/End, position counter, reduced-motion instant
      path. Three real bugs found and fixed by driving it in-browser (offsetLeft
      double-counting, ambiguous IntersectionObserver current-slide tracking → replaced with
      nearest-snap-offset, role=group-on-li axe violation → APG div structure).
- [x] **Heat toy relocated** hero → Warmer annex under the carousel, GG's exact intro copy
      verbatim, live puzzle number in the eyebrow, still 0 eager bytes until interaction.
- [x] **Design-reviewer sign-off** (explicit lens: "balanced and restrained, or does it
      shout?"): approved-with-suggestions; 2 blocking findings BOTH fixed + re-verified
      same-session (mobile hierarchy inversion — 44px decorative numeral vs 40px h1 floor on
      ≤800px viewports, caught by the reviewer's math; Experience `mt-4` rhythm break). Two
      non-blocking suggestions also taken (hero stats onto the token scale; eyebrow tracking
      consolidated). One logged for later (heat-toy-annex return-to-Warmer affordance).
- [x] **Verification:** axe 0 violations · eager JS 204,618 bytes gzip vs 220,160 ceiling
      (+2,723 = the carousel shell) · Lighthouse a11y 100 / SEO 100 / BP 96 (known
      localhost-only non-defect) / LCP 3.33s = wave-4's accepted framework floor, no
      regression (`reports/lighthouse-wave5-2026-07-16.json`) · desktop+mobile full-page
      screenshots post-fixes (`reports/screenshots/wave5-restraint/`).
- [x] **Hero stats resolved (2026-07-16):** GG's call — "we already have verified numbers,
      use that; decision on you to pick the best metrics." Picked, from existing
      provenance-backed data, the two that read as distinct axes from the product-count
      stat (breadth): **live Warmer puzzle count** (operational cadence/real daily users —
      derived via `getWarmerPuzzleNumber()`, same live-data function verified in wave 3, fails
      soft to "—" not a stale/fabricated number) and **research paper count** (technical
      depth — `researchPaperCount(researchPapers)`, mirrors `liveProductCount`'s pattern).
      Passed over as weaker/redundant-with-the-carousel: Style Maitri catalogue size and
      tracegauge weekly downloads (small, volatile number; already visible on its own card).
      `heroStats` moved out of `content/site.ts` into `hero.tsx` (now async) — that file is
      also imported by the client-side command palette, and the puzzle fetch needs
      `lib/live-data.ts`'s `server-only` import, which can't reach a client bundle. Verified
      live in-browser: puzzle #35 resolved and cross-checked directly against the public
      manifest (index 34 for 2026-07-16 → puzzle #35). Provenance entries added
      (`derived:warmer-puzzle-count`, `derived:research-paper-count`). Re-verified post-change:
      typecheck/lint/build clean, axe 0 violations, Lighthouse unchanged (a11y 100/SEO 100/
      LCP 3.32s), screenshots re-captured with live numbers.

Large diff (full-page redesign) → **draft PR for GG's manual review and merge**, same posture
as waves 3/4. No more open items on this wave — PR #14 is ready for GG's review as-is.

## Wave 10 — content, voice, and two real bugs (2026-07-17)

GG deployed wave 9 and gave direct feedback: the slider doesn't slide, the heat toy errored in
production and gives no hint how to engage, the hero/contact voice reads boastful/vague, and
more completed projects exist than the site shows. Not a redesign — fixes inside the wave-9
structure. Branch `feat/wave10-fixes-content`; full report
`reports/wave10-fixes-content-2026-07-17.md`.

- [x] **Slider bug** — reproduced on production (120px mouse drag = 0px movement): mandatory
      scroll-snap re-snaps every programmatic scrollLeft assignment, so sub-half-card drags did
      nothing; no wheel path, no visible controls. Fixed: snap off during drag + restore/snap on
      release, 4px click-safe threshold, visible ←/→ arrow buttons with end-disabled states.
- [x] **Heat toy prod error** — root cause is failure *handling*, not the fetch path (vocab
      200s in prod): single-attempt fetch parked a permanent error on any transient blip. Now
      3 attempts with backoff + a Try-again button; verified via stubbed-fetch end-to-end test.
- [x] **Heat toy hint** — "one of 410 everyday English words" + two clickable daily starter
      chips (deterministic offsets, never the secret).
- [x] **Voice pass** — hero intro rewritten warm/humble (3 options drafted, A built), stats
      rebalanced to 5 yrs / 9 live / 5-person team (all provenance-backed, alternates in
      report), contact rewritten direct-professional.
- [x] **Inventory** — full ml-projects sweep: AgentGauge added as 11th card (descriptive
      metric honoring its own "pilot-scale research artifact" scope note);
      expense-tracker/reclaim/support-repos skipped with reasons in the report.
- [x] **Verification** — axe 0, Lighthouse a11y 100/SEO 100, budget 201,535B ≤ 220,160B,
      responsive matrix, design-reviewer sign-off, slider+toy re-verified on the deployed
      Vercel preview (GG's explicit standard this wave).
- [ ] **Item 6 (resume rewrite)** — HELD until GG supplies the resume file; do not derive from
      repo contents.

Draft PR for GG's merge (diff exceeds the 400-line auto-merge gate).

## Wave 9 — production integration of all 5 wave-8 prototypes (2026-07-17)

GG clicked through `/lab` live and approved all five wave-8 prototypes; this wave builds
them production-grade per GG's explicit integration map and deletes `/lab/*`.

- [x] **Embedding-space visualization → merged into the existing heat toy** (Warmer
      annex under Work) — headline feature, most QA attention. Found and fixed a real
      pre-existing bug (shipped since wave 3, surfaced by this wave's own thorough guess-
      flow testing): `guessFeedback()` used `sim < 0` as a "not found" sentinel, but
      cosine similarity is legitimately negative for real dissimilar embeddings (verified:
      "fire" scored -0.083 against a real secret word and was misreported as "not in the
      word list"). Fixed with an explicit `found: boolean` field, no longer inferred from
      sign.
- [x] **Staggered reveal (`components/reveal-group.tsx`) → the site's new default
      entrance pattern**, applied to Work's Warmer annex, Research, Experience (nested
      per-company), Contact. **Hero deliberately excluded** — this wave's own testing
      found the onload version raced axe-core's color-contrast check (flaky 2/3 failures
      on identical code, settled-state contrast confirmed compliant — a transient
      first-paint opacity artifact, not a real defect). Reverted to instant render,
      re-affirming wave 2/3's original "no reveal-on-load flash for Hero" principle for a
      second, concrete reason. 5/5 clean axe runs after the revert.
- [x] **Momentum slider (`components/work-slider.tsx`) replaces the flat Work list** —
      all 10 products, native scroll-snap, peek-of-next, mouse-drag, progress bar +
      counter. Flagship cards carry their eval figure with scroll-linked draw-in
      (`components/eval-figure.tsx`, now client, rooted to the slider's own scroll
      container, not the viewport).
- [x] **TF-IDF classifier → collapsed disclosure on TriageIQ's card**, click-to-expand,
      illustrative label unchanged from the lab. A floating-popover version hit a real
      CSS bug (`overflow-x:auto` forces `overflow-y:auto` per spec, silently clipping the
      popover — traced via a genuine document-level horizontal-overflow defect, the same
      class wave 6 fixed the old carousel for) — fixed structurally by rendering the
      panel in normal block flow below the whole slider instead, connected via
      `aria-controls` + scroll-into-view.
- [x] **Design-reviewer sign-off**, reversed lens ("modern and alive, or still dull?"):
      approved with suggestions, zero blocking. Quote: "this is the first wave where
      'real-time compute moment' is an accurate description of what ships." Two
      suggestions fixed pre-merge (Experience's cascade granularity was one reveal unit,
      not per-company; TriageIQ panel needed `aria-controls` + scroll feedback); one
      contrast finding also fixed (heat-toy reference dot opacity 0.6→0.8, 3.03:1→4.55:1,
      computed not eyeballed).
- [x] **Verification**: axe 0/5 runs, no-JS literal test via CDP
      `Emulation.setScriptExecutionDisabled` (real engine-level JS disable, not curl-only —
      full page renders correctly, screenshot on file), reduced-motion via a genuine
      `--force-prefers-reduced-motion` browser flag with a differential + negative-control
      proof (normal motion: guess-point position changes 30ms→1030ms; reduced motion:
      identical — confirmed on the headline feature specifically), Lighthouse a11y 100/
      SEO 100/perf 100/LCP 0.7s, budget 201,324 B gzip (+11.7KB vs wave 7, ceiling
      unchanged at 220,160B). Full report: `reports/wave9-lab-integration-2026-07-17.md`;
      screenshots: `reports/screenshots/wave9/`.
- [ ] **`explore/wave8-lab` deletion deferred** (not an ancestor of `main` yet — deleting
      now would violate the standing never-delete-without-ancestor-check rule). Delete
      once this wave's PR merges to main.

Large diff → draft PR for GG's manual review, same posture as prior waves.

## Wave 11 — calm base, concentrated wow (2026-07-17, draft PR #19 pending GG's merge)

GG's direction, reconciling the "calm/centered like maninder.vercel.app" and
"modern/impressive" feedback that pulled waves 6–10 in opposite directions: restrained
centered foundation, craft concentrated in exactly 3 moments. Full design authority, no
mid-build option gates. Full report: `reports/wave11-calm-base-wow-2026-07-17.md`.

- [x] **Foundation:** one centered column (max-w-2xl prose / max-w-3xl work), centered
      section headers, wave-6 sticky label rail deleted, whitespace-only separation,
      Contact + footer centered. Wave-10-approved copy carried verbatim; the intro
      paragraph split at its natural seam (sentence 1 → hero one-liner, sentences 2–3 →
      Work lede) — documented in content/about.ts.
- [x] **Wow 1 — boot loader:** monogram stroke-draw + hairline + top-down curtain
      reveal, pure CSS, visually done ~1.0s. Structurally cannot appear for no-JS or
      reduced-motion visitors (pre-paint head-script opt-IN gate); content never dips
      below full opacity (wave-9 axe-race lesson); overlay bg = page bg token. axe 5/5
      local + preview clean; LCP unmoved (0.6s preview, perf 100).
- [x] **Wow 2 — hero:** centered stack, conic indigo halo (28s transform-only drift,
      static under reduced motion), gradient stat numerals (both endpoints AA-checked).
      Design review scored the halo weakest (0.17 opacity read inert) → raised to 0.26,
      axe re-verified 3/3.
- [x] **Wow 3 — Work:** slider retired after two failed passes (GG: "can't slide it",
      then "classy modern is not there") — the brief's own bar (usability + beauty over
      the slider concept) points static: 3 flagship showcase cards (eval-figure rail,
      tokenized hover lift) + 2-col index grid. TriageIQ disclosure finally inline
      (the overflow-x scroller that forced the remote-panel workaround is gone);
      EvalFigure rootEl plumbing deleted.
- [x] **Budget:** eager JS **191,179 B gzip vs 220,160 ceiling** (−10,356 vs wave 10 —
      the slider's client bundle deleted outright).
- [x] **Verification (deployed preview, PR #19):** axe 0 · Lighthouse perf 100 /
      a11y 100 / BP 100 / LCP 0.6s / CLS 0 (SEO 63 = known preview noindex artifact) ·
      no-JS SSR proof · reduced-motion differential · fail-soft 0px-shift capture ·
      screenshots 1440/768/390 + 3 recordings, all preview-captured
      (`reports/screenshots/wave11/`).
- [x] **Design-reviewer sign-off:** approved with suggestions, zero blocking (base 8.5,
      loader 9, work 8.5, halo 6.5 → fixed). All actionable suggestions taken same-day
      (`cbf3a6b`); eval-figure width-constant consolidation logged for a cleanup pass.
- [ ] Large diff → **draft PR #19 for GG's manual review/merge**, same posture as prior
      waves. `explore/wave8-lab` deletion still deferred until its content is an
      ancestor of main (unchanged standing note).

## Wave 12 — multi-page architecture (2026-07-18, draft PR #20 pending GG's merge)

GG's brief: the real gap vs maninder.vercel.app was STRUCTURE, not feel — build the
multi-page portfolio (home teases → /projects indexes → /work/[slug] teaches). Full report:
`reports/wave12-multipage-2026-07-18.md`.

- [x] **Reference studied in-browser** (maninder home, /projects, a /work case study) —
      structure extracted, no content copied.
- [x] **12 case-study pages** (`content/case-studies/*.ts` + `/work/[slug]` route): problem →
      approach → architecture (server-rendered FlowDiagram, zero JS) → decisions-with-why →
      honest results → hard-problem story. 11 full + 1 short (expense-tracker). Content
      researched from the actual repos by 4 parallel read-only passes; ~70 new file:line
      provenance rows in provenance.md's wave-12 section. Heat toy → /work/warmer, TriageIQ
      classifier → /work/triageiq (demos live where the teaching happens).
- [x] **Inventory correction:** expense-tracker added (wave-10 skip rested on a stale
      README; CURRENT_STATE.md shows a built, tested, multi-user product). **Mid-wave
      catch by this repo's own lychee CI:** its documented demo deployment is DOWN
      (frontend 404 / backend 500, curl-verified) — shipped repo-only, outage stated on the
      page, derived live count self-corrected 10 → 9. reclaim NOT added (no git remote —
      local-only, nothing public to verify).
- [x] **Home restructured per GG's order:** hero → About Me (new) → Experience first (full
      card treatment, all bullets, tech chips) → top-5 showcase (3 flagships + DealHunter +
      ShelfSense) + "View all 12 →" → Research → Contact.
- [x] **Hero:** tagline is the h1 (wave-10 voice tightened), name in byline; "5 people I
      lead" retired from stats → resume-sourced "50M+ documents" scale axis; LinkButton row
      (primary View Resume + GitHub/LinkedIn/HuggingFace/Email).
- [x] **HF verified 2026-07-18:** real account, 2 public models, 112 cumulative downloads,
      4 Spaces → link added (hero + contact), NO download stat (too small, per brief).
- [x] **Resume opens in a new tab for VIEWING** — target=_blank, no download attr,
      `Content-Disposition: inline` verified live on the preview.
- [x] **Nav + transitions:** first persistent top nav (client, active states, skip link);
      240ms route transition on client navigations only (initial load never animates —
      wave-9 axe-race lesson); boot loader scoped to home (deep links skip it).
- [x] **Verification:** build 20 static pages · axe 0 on ALL 14 routes · eager JS 202,787 B
      gzip vs 220,160 ceiling (+11.6KB vs wave 11 for nav+transitions) · Lighthouse preview
      desktop: home 99/100/100 LCP 0.6s CLS 0, /work/triageiq 100/100/100 LCP 0.6s (SEO 63
      = preview noindex artifact) · full nav click-through on deployed preview · screenshots
      1440/768/390 + nav-transition/loader GIFs (`reports/screenshots/wave12/`).
- [x] **Design-reviewer sign-off:** approved with suggestions, zero blocking (structure 9,
      hero 9, craft 9, rhythm 7, consistency 8). All 4 actionable suggestions taken
      same-session (`761eea4`); shared contrast token + OG green dot logged for cleanup.
- [ ] Large diff → **draft PR #20 for GG's manual review/merge**, same posture as prior
      waves. `explore/wave8-lab` deletion still deferred (unchanged standing note).

## Wave 14 — bug fix, verification discipline, inventory refresh (2026-07-26, draft PR pending GG's merge)

GG's brief: the category filters he clicked on production did nothing — reproduce and fix;
fix the verification gap that let it ship, not the bug alone; enumerate GitHub fresh and
reconcile; redeploy expense-tracker; audit every interactive element end to end. Full report:
`reports/wave14-verification-audit-2026-07-26.md`.

- [x] **Filter bug reproduced on production first**, root-caused: the click mechanism itself
      worked (proven via CDP clicks, raw DOM pointer/mouse dispatch, keyboard, throttled,
      desktop+mobile, fresh-load+client-nav — all correct). The real defect: the only
      confirmation text was `sr-only` (invisible to sighted users) and the active-pill state
      was a barely-perceptible 15%-opacity tint — for any category keeping the top card
      visible, a working click and a dead one looked identical. Fixed: counter now visible,
      active pill is a solid accent fill.
- [x] **Found + fixed a real regression from the fix itself**: the solid pill's count badge
      kept wave-13's `opacity-70` dim, composing to 3.74:1 — under the 4.5:1 text floor in
      either pill state (axe filed single-digit instances as "incomplete," a confidence
      heuristic, not a pass; two-digit "All 12" fails outright the moment any filter is
      applied — the normal path). Dim removed entirely.
- [x] **New Playwright E2E suite** (`e2e/`): filters, nav, route transitions, resume
      (inline-not-download), Warmer's heat-toy, TriageIQ's classifier, external-link
      structure, axe on every route (auto-discovered from the real case-study registry).
      Wired into CI as a **required** `e2e` job (branch protection updated via `gh api`).
      The suite's own rigor was tested: an early counter assertion used `toBeVisible()`,
      which does NOT catch Tailwind's `sr-only` clip-rect trick — strengthened to check real
      pixel dimensions, verified it now correctly fails against the old code and passes
      against the fix. Also fixed one test-timing flake matching this repo's own documented
      wave-9 "axe race" pattern (RevealGroup's entrance fade, now also racing on /projects'
      in-viewport grid).
- [x] **Standing rule adopted:** no interactive feature is reported as working unless a test
      in `e2e/` actually drove it in a browser — code-review-only claims are no longer
      sufficient evidence for this repo.
- [x] **GitHub inventory reconciled fresh** (17 repos via `gh repo list`, not memory):
      16/17 already matched; **reclaim** added (GG published it 2026-07-23, real GitHub
      Releases v1.0.0–v1.3.0) with a full case study at the same depth as the other 12,
      wired into `content/metrics.json` + a `.portfolio/metrics.json` manifest PR opened on
      the reclaim repo itself; mindmeld-payloads/triage-iq-ui confirmed as correctly-excluded
      supporting repos; claude-config confirmed as personal tooling, not a product.
- [x] **Weekly Action extended**: `scripts/refresh-metrics.mjs` now enumerates public repos
      via the GitHub API and opens/updates a tracking GitHub issue (not a PR — no file diff)
      when a new un-added repo appears, so this reconciliation doesn't need GG to remember to
      ask again.
- [x] **expense-tracker root-caused, not fixed** (read-only diagnosis, no GCP config/billing
      touched — this repo's standing exclusion; no Vercel project access for the frontend
      either): backend crashes every cold start because its Supabase Postgres hostname no
      longer resolves (DNS NXDOMAIN — a paused/deleted free-tier project, not a code defect);
      frontend's Vercel deployment returns `DEPLOYMENT_NOT_FOUND` (project/deployment no
      longer exists). Numbered recovery steps for GG in the wave report; case study and
      provenance updated with the precise diagnosis.
- [x] **Full production audit**: pass/fail table in the wave report — everything traces to
      the one filter bug; no other broken interactive element found. axe 0 on all routes
      (including the new /work/reclaim), Lighthouse preview home 100/100/100 LCP 0.6s,
      /work/reclaim 100/100/100 LCP 0.6s (SEO 63 = known preview noindex artifact), budget
      204,782 B vs 220,160 ceiling (+12 B vs wave 13).
- [ ] Large diff → **draft PR for GG's manual review/merge**, same posture as prior waves.

## Wave 13 — autonomy, ordering, polish (2026-07-25, draft PR pending GG's merge)

GG's brief: autonomous metric refresh (his #1), desktop density at 1280–1600px, tiering
retirement + AI/ML-depth ordering + category filters, modern-CSS liveliness, copy pass, HF
re-check, honest results untouched. Full report:
`reports/wave13-autonomy-density-2026-07-25.md`.

- [x] **Metric refresh pipeline:** `content/metrics.json` (per-metric value/source/sha/
      measured_at, keyed by provenance IDs) + `lib/metrics.ts` (build fails on missing ID)
      + weekly `metrics-refresh.yml` → `scripts/refresh-metrics.mjs` → **reviewed PR, never
      a direct commit**. Fail-soft per repo, 90-day stale flags, link health w/ cold-start
      retry, HF count tracked vs the 1,000 display bar. Both paths tested pre-ship.
      **11 `.portfolio/metrics.json` PRs opened across the source repos (GG merges);**
      Warmer's manifest lives in public mindmeld-payloads (mindmeld is private). Gotcha
      documented: GITHUB_TOKEN PRs don't fire pull_request workflows → the Action
      dispatches ci.yml onto its branch (ci.yml gained workflow_dispatch).
- [x] **Pipeline caught 3 live drifts before its first scheduled run:** Warmer Hinglish
      0.639 → **0.813** (a *successful* LoRA fine-tune published as
      hinglish-relatedness-sbert on HF — card, figure, and the outdated "fine-tunes lost"
      story all updated, held-out 0.435→0.704 reported beside the headline); **AgentGauge's
      "8 scoring dimensions" claim was falsified by the repo's own predictive-validity
      study** — card + case study rebuilt around the v2 statistical harness (founding null
      leads the results; 8 new provenance IDs); gold-rate backtest 194 → 199 folds.
- [x] **Also found/fixed:** getWarmerPuzzleNumber threw on the manifest's new hi-en-only
      shape (would have broken the next production ISR pass) — now truly fail-soft.
- [x] **Desktop density:** Section width steps (wide→5xl, grid→6xl at xl); About skills
      rail, Experience meta rail, Research two-col spread, case-study sticky rail
      (TOC + metric + links), 2-col card grid. Mobile/tablet untouched (verified 390).
      Before/after at 1280/1440/1600 in `reports/screenshots/wave13/`.
- [x] **Tiering retired; depth rubric** (4 axes, table + tie-breaks in the report) orders
      all 12 on home + /projects; 6 multi-tag categories; filters are CSS-visibility over
      server-rendered cards (instant), ?category= via history.replaceState +
      useSyncExternalStore (NOT useSearchParams — would un-SSR the grid), aria-pressed
      pills + aria-live count, no-JS safe.
- [x] **Modern CSS:** View Transitions (TransitionLink + card-title↔h1 morph, 240ms
      fallback preserved, 1.2s safety timeout), scroll-driven reading progress + halo
      fade (@supports-gated; reduce-cascade bug caught in self-review), :has() sibling
      dim on hover, container-query cards, text-wrap balance/pretty. Rejected: view()
      reveal conversion (wave-9 axe-race class).
- [x] **Copy pass:** 9 taglines rewritten (reasons per line in the report), stale
      "single-page" README fixed; case studies confirmed strong as-is.
- [x] **HF:** 739 cumulative (was 112) — still below the low-thousands bar, no stat;
      weekly PR flags a 1,000-crossing.
- [x] **Verification:** axe 0 × 14 routes (1 heading-order finding fixed) · Lighthouse
      preview home 97/100/100 LCP 0.9s, /work/triageiq 100/100/100 LCP 0.6s (SEO 63 =
      preview noindex artifact) · budget 204,765 B vs 220,160 (+1,978 justified) ·
      filters/VT/deep-links driven on the deployed preview · reduced-motion stub
      differential · no-JS SSR grep.
- [x] **Design-reviewer sign-off:** blocked-then-approved. The one blocking finding —
      three content widths at xl (5xl sections beside a 6xl Work/nav, a pixel-measured
      64px zigzag) — fixed by unifying everything on ONE 5xl axis (verified: nav/About/
      Experience/Work all at x=304 @1600; card container threshold 30→28rem so figure
      rails still engage). Suggestions taken same-session: full-opacity pill borders
      (1.47:1 → 3.38:1, WCAG 1.4.11), Experience rail 14→16rem (chip wrap), left-aligned
      mobile pills, grid columns lg→xl (1024–1279 band verified at 1100px). Follow-up
      logged: sitewide border-opacity token audit (pre-existing pattern).
- [x] **Resume sync (GG follow-up, same PR):** resume metrics diffed against the
      corrected store — 2 stale (Warmer 0.639→0.813 + held-out + published-model credit;
      AgentGauge research line rewritten to the v2 harness), everything else matched
      (gold-rate's resume line never cited a fold count). Run-level docx edits →
      Word re-export → verified exactly 2 pages, same page boundaries, stale strings
      absent. NEW: content/resume-metrics.json + a "Resume drift" section in the weekly
      refresh (store-moved-since-sync per claim + resume.pdf hash-vs-manifest check,
      report-only) — the resume can no longer rot silently while the site self-heals.
      Both failure paths tested.
- [ ] Large diff → **draft PR for GG's manual review/merge** (same posture as prior
      waves). GG also needs to merge the 11 source-repo manifest PRs for the weekly
      pipeline's first live run to find them (it fail-softs until then).

## Wave 8 — creative delight pass, prototype-first (2026-07-17, holding for GG's pick)

GG's read on waves 6/7: too restrained, feels dull — wants lively/modern (sliders,
loading patterns), while acknowledging the tension with wave 6/7's calm-minimal
benchmark (emilkowal.ski/paco.me/rauno.me). Resolved by prototyping, not reskinning:
5 isolated demos at `/lab/1`–`/lab/5` on throwaway branch `explore/wave8-lab`, every
demo built on real data/computation from GG's actual work, nothing merged.

- [x] **Lab 1 (GG's highest-leverage pick): embedding-space visualization as a loading
      state.** Reuses the real production heat-toy vocab + cosine-sim engine; guess and
      secret plotted at the real 1st/2nd PCA components, animating between real
      coordinates on a deliberate ~450ms reveal (computation already <5ms — reveal is
      disclosed staged pacing, not a disguised wait).
- [x] **Lab 2: staggered stream-in** (real skill-chip/Experience content, 50-60ms
      cascade via `Element.animate()` + IntersectionObserver, `fill:"backwards"`) —
      directly answers the wave-6 tension: DOM default state is always fully visible,
      so the wave-6 "blank without JS" bug class is structurally unreachable here.
- [x] **Lab 3: modern momentum slider** — native scroll-snap (real trackpad/touch
      momentum, zero JS cost) + pointer-drag for mouse + peek-of-next + thin
      progress-bar/fraction-counter. Found and fixed the *same* `role="group"`-on-`<li>`
      axe violation wave 5's carousel hit — caught by this wave's own axe pass.
- [x] **Lab 4: live TF-IDF classify** — real TF-IDF + cosine similarity computed
      client-side over 12 real, sourced GitHub issue titles (6 k8s / 6 vscode, fetched
      2026-07-17, cited per-item), mirroring TriageIQ's real technique + published
      accuracy figure, explicitly labeled illustrative (not the production model).
- [x] **Lab 5: scroll-linked reveal** of the real wave-7 eval figures (same sourced
      values), drawing in from 0 as they enter view.
- [x] Verification: axe 0/5 routes (1 bug found+fixed, see Lab 3), reduced-motion via
      code-pattern review, marginal per-route bytes measured against the shared
      framework baseline (0.8–4.1 KiB each — nowhere near budget-relevant, and `/lab/*`
      is never linked from production). Recordings: GIFs assembled from real captured
      frames (slow-motion override + WAAPI pause/scrub techniques, both disclosed) since
      this harness has no native screen-recording tool. Full report:
      `reports/wave8-lab-2026-07-17.md`; recordings + screenshots:
      `reports/screenshots/wave8-lab/`.

**Nothing merges without GG's pick.** Awaiting which lab(s), in what combination,
advance to a production-grade build (same process as wave 7: harden, design-review,
PR through the 70a gates). `explore/wave8-lab` can be deleted once superseded.

## Wave 6 — composition rebuild (2026-07-17, autonomous wave)

GG's standing brief: five waves in, still unsatisfying — audit independently against
external references, rebuild with full design authority, self-verify. Diagnosis
(`reports/wave6-audit-2026-07-17.md`, written before any code, benchmarked against
emilkowal.ski / paco.me / leerob.com / rauno.me / karpathy.ai): wave 5 fixed *scale* but
not *composition* (one narrow column floating down a 6,090px dark void) or *conviction*
(7 typographic voices, boxed-UI everywhere, a carousel hiding 7 of 9 products).

- [x] One `max-w-5xl` grid, shared left edge (fixed hero's 64px misalignment bug), sticky
      label-column composition on desktop.
- [x] Two type voices; killed long italics, section numerals, chip wall, green pill,
      near-all tracked caps. No boxes anywhere; links are underlined text (`InlineLink`).
- [x] Carousel deleted → flat Work: 3 flagship entries + 6-row index (tracegauge promoted
      from footer, live downloads intact). About dissolved into hero + Experience.
      Experience: 7/10 bullets via `featured` flag (verbatim selection), ~40%→~20% of page.
- [x] Deleted: command palette (+⌘K chip that rendered on touch), count-up, monogram
      draw-in, reveal-on-scroll. Deps dropped: @base-ui/react, lucide-react, cva.
- [x] Bugs fixed from audit: heat-toy intro copy duplication, carousel native scrollbar
      (moot — deleted), no-JS/print blank page (reveal layer), contact email mid-word wrap
      at 768/390.
- [x] Verification: axe 0 · eager JS **189,608 B gzip** (−15,010 vs wave 5, ceiling
      220,160) · Lighthouse a11y 100 / SEO 100 / BP 96 (known non-defect) /
      **Performance 100, LCP 0.6s** (was 79 / 3.32s — the wave-4 "framework floor" was
      actually the reveal layer holding sections at opacity:0; deleting it un-stuck LCP)
      · before/after/reference screenshots at 1440/768/390
      (`reports/screenshots/wave6/`). Full report:
      `reports/wave6-composition-rebuild-2026-07-17.md`.
- [x] Design-reviewer sign-off: see report/PR.

**Waves 6+7 merged 2026-07-17** (PR #15, squash `9e10805`, GG's manual merge per gate 3).
Post-merge gotcha: the merge push landed during a GitHub API incident (503s on
Actions/check-runs) and the push event never reached Vercel — no production deployment
existed for `9e10805` and the canonical URL kept serving wave 5. Retriggered via a fresh
docs-only push to main (this commit). Lesson reconfirmed from wave 1: **verify the live
canonical URL serves the new build after every merge — CI green and even "merged" are not
proof the deploy pipeline fired.** The Speed Insights field-p75 clock (queued follow-up 1)
starts from the actual deploy, not the merge.

### Queued follow-ups (GG, 2026-07-17, low priority)

1. **Field p75 LCP check — blocked on PR #15 merge + a few days of real traffic.** Method:
   Vercel dashboard → gaurav-gandhi project → Speed Insights → LCP p75 (mobile + desktop,
   7-day window). Compare against the wave-6 lab baselines (localhost, unthrottled):
   LCP 0.6s desktop / Lighthouse perf 100 (`reports/lighthouse-wave6-2026-07-17.json`
   @ `4b68cd8`), and against the pre-rebuild field data accumulated since wave 4's
   instrumentation (whatever the dashboard shows for the pre-merge window — the wave-5
   page's reveal layer held sections at opacity:0, which is what the rebuild removed).
   Record in this file whether the lab/field gap holds or the reveal-layer fix
   under-delivered in the field. Note: Speed Insights has no public API — this is a
   dashboard read, GG or a browser-tool session.
2. **Right-rail data-as-visual — GG picked Option A (2026-07-17), built production-grade
   same day** on the PR #15 branch: typed `ProductFigure` content fields mirroring each
   flagship metric + sourceRef, static server-rendered SVG (0 eager bytes), responsive
   below-lg placement, worded `role="img"` aria-labels (a11y-tree verified; live-SR pass
   still unexecuted — noted honestly), design-reviewer approved with suggestions (all 5
   taken). Build record appended to `reports/wave7-right-rail-proposal-2026-07-17.md`;
   final screenshots at 390/768/1024/1440 in `reports/screenshots/wave7-proposals/`.
   `explore/wave7-right-rail` (the throwaway mock) can be deleted once PR #15 merges.

## Wave 3 (original) — post-arXiv (blocked on paper 1's arXiv endorsement)

Flip research section live with arXiv ID; add Tier 2 paper when public. After wave 5's draft
PR merges, the open items are: GG's two hero stats, and this arXiv flip — no other work is
queued until one unblocks or GG redirects.

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

## JD-tailored resume variant generator (2026-08-01, in progress — blocked on LibreOffice)

Full spec: `spec-resume-variants.md`. Brief assumed a `resume.js` (docx-js build script)
already existed as the master content source — it didn't (confirmed by search across
`gg-portfolio` and `ml-projects`); the real chain was manual python-docx → Word COM export
per `reports/resume-rework-2026-07-17.md`. Built fresh per GG's direction (AskUserQuestion,
2026-08-01): `content/resume-data.json` (39 entries: header/summary/13 experience/1
research/13 projects/6 skills/2 education, extracted from
`.assets/resume-sources/Gaurav_Gandhi_Resume_2026.docx` + cross-referenced against
`content/provenance.md`/`content/metrics.json`), `content/certifications.json`,
`variants/{google-applied-scientist,meta-research-scientist,amazon-applied-scientist,
salesforce-senior-ds}.json`, `scripts/build_resume.mjs` + `scripts/lib/{resume-select,
resume-layout,resume-lint}.mjs`. New npm dep: `docx` v9.7.1 (pulls in `adm-zip` transitively,
which npm audit flags high-severity for zip-bomb-style crafted-file handling — not a live
risk here since we only ever *write* docx files with it, never parse untrusted ones, but
flagged for the record).

**Mid-build amendment (surface gating, section renames, summary/cert/research lint gates)**
folded in before implementation — see `spec-resume-variants.md`'s hard-gates section for the
full list. `resume-lint.mjs` has a real smoke test (`resume-lint.smoketest.mjs`, no framework —
repo has no unit-test runner, only Playwright e2e) proving every gate actually fires, not
just that it stays quiet on clean data; caught one real bug during that pass (the
project/product-count regex only matched a bare number immediately before the noun — missed
the actual original-summary phrasing "nine live AI products" with words in between — fixed to
allow up to 2 intervening words + spelled-out numbers).

**4 project entries added beyond what's in the current docx** (ShelfSense, Reclaim, AgentGauge
as a project card, Expense Tracker) so the variant selector has the full 13-project pool
rather than only the 9 the static resume already features — sourced entirely to already-
verified metrics.json/case-study content, flagged explicitly rather than silently expanding
scope.

**Known judgment calls, not yet confirmed with GG:**
- Certifications: all 4 marked `status: "held"` (canonical-resume.pdf lists them with no
  in-progress qualifier) — no independent completion-ID verification exists for any of them.
- Reclaim's `surface`: mechanically `"live_demo"` per the rule (products.ts has a `liveUrl`),
  but that URL is actually a GitHub Releases download page, not a hosted interactive demo —
  the 5-value enum has no "downloadable app" bucket. Judgment call, documented in
  `content/resume-data.json`'s entry, not silently smoothed over.
- TriageIQ's top-3 accuracy bullet uses **87.1%/89.8%**, not the 82.5%/90.4% still live in
  `content/metrics.json`/`content/case-studies/triageiq.ts` on the portfolio site — the
  triage-iq repo's own README (ADR-0036, 2026-07-24) has since corrected past that; this
  session's resume-metrics verification pass (same day) found the site itself is stale. The
  portfolio site's own metrics.json needs the same correction — not done here, out of scope
  for this task, flagged for a separate pass.
- Google/Meta JD keyword lists are sourced from WebSearch's indexed-content aggregate
  (real quoted snippets, cited sources) because both careers sites are JS-rendered SPAs that
  WebFetch can't extract past the nav shell — direct-fetch worked for Amazon; Salesforce
  403'd direct fetch, same WebSearch-aggregate fallback. Noted per-variant in each
  `variants/*.json`'s `_source` field.

**Blocked:** `soffice` (LibreOffice) needed for the spec's hard page-count requirement
(render → count real pages → fail if over). Both `winget` (present as an appx package but not
actually invokable on this machine) and `choco install libreoffice-fresh -y` (needs
elevation; this shell isn't admin) failed non-interactively. GG chose to run the elevated
install themselves (`choco install libreoffice-fresh -y` in an admin PowerShell) — not yet
confirmed done as of this checkpoint. Everything else is built and independently verified
without it: selection/scoring dry-run across all 4 variants (sensible, role-appropriate
orderings — e.g. Meta's boost weights TriageIQ/Style Maitri's ranking+retrieval work and the
research paper to the top; Amazon/Salesforce weight Reclaim/Expense Tracker/ShelfSense-style
mlops+forecasting work higher), the repo_only hard gate (ShelfSense, AgentGauge-as-project
correctly force-collapse), the lint smoke test, and a standalone docx render (valid 12.7KB
file, correct rendered-text extraction). Next step the moment `soffice` is on PATH: run
`node scripts/build_resume.mjs --variant <name>` for each of the 4 variant names — no code
changes needed, just execution.

### Amendment 2 (2026-08-01) — intrinsic quality scoring, cert kinds, More-on-GitHub cap

Replaced project ordering: was tag-overlap-vs-`boost_tags`, now a weighted combination of 4
new 1-5 scores (`demo_quality`, `role_relevance`, `technical_depth`, `metric_strength`) added
to every project record, default weights `{.30, .30, .25, .15}`, overridable per variant via
an optional `score_weights` field (none of the 4 shipped variants override it — no principled
reason to yet). Research entries (only 1 exists) keep the original tag-overlap scoring —
amendment 2 scoped itself to "project record," not research. Full detail:
`spec-resume-variants.md`.

**Required verification (item 3) — result: does NOT reproduce the target sequence, reported
rather than silently fixed, per the explicit instruction not to adjust weights to force a
match.** Computed programmatically
(`weighted_score = demo×.30 + role×.30 + depth×.25 + metric×.15`) from the exact seeded
scores:

| Project | Scores (demo/role/depth/metric) | Weighted score |
|---|---|---|
| TriageIQ | 4/5/5/5 | 4.70 |
| Style Maitri | 5/4/4/4 | 4.30 |
| Multimodal Fashion Recommender | 4/5/4/4 | 4.30 |
| AgentGauge | 2/5/5/5 | 4.10 |
| Hinglish+Warmer | 5/3/4/4 | 4.00 |
| AetherArt | 5/3/4/3 | 3.85 |
| DealHunter | 4/3/3/3 | 3.30 |
| Samidha Reviews | 2/3/3/4 | 2.85 |

Computed order: TriageIQ, Style Maitri, **MMFR**, **AgentGauge**, **Hinglish+Warmer**,
**AetherArt**, DealHunter, Samidha Reviews.
Target order: TriageIQ, Style Maitri, **AgentGauge**, **MMFR**, **AetherArt**,
**Hinglish+Warmer**, DealHunter, Samidha Reviews.

Two genuine mismatches, not tie-break artifacts (verified — Style Maitri/MMFR's 4.30 tie
*does* correctly resolve to Style Maitri first via stable-sort-on-original-order, matching the
target at position 2; the two flagged pairs below are real score inversions):
- **Position 3 vs. 4:** MMFR (4.30) genuinely outscores AgentGauge (4.10) under these weights
  — AgentGauge's `demo_quality: 2` (no live surface, repo-only-adjacent) is weighted at 0.30,
  the largest single weight, and drags its total below MMFR's despite AgentGauge's role/depth/
  metric all being ≥ MMFR's. Gap: 0.20.
- **Position 5 vs. 6:** Hinglish+Warmer (4.00) genuinely outscores AetherArt (3.85) — the two
  are identical on demo/role/depth; the only difference is `metric_strength` (Warmer=4 vs.
  AetherArt=3), weighted at 0.15. Gap: 0.15 = 0.15×(4−3), exactly.

Not resolved unilaterally — flagged for GG to pick one: (a) accept the computed order (the
scores are self-consistent, the target sequence was likely eyeballed rather than computed),
(b) adjust AgentGauge's `demo_quality` and/or AetherArt's `metric_strength` upward if GG
believes those specific axis scores were too harsh, or (c) accept that this is what
weighting `demo_quality` at 0.30 does to a repo-only-adjacent project like AgentGauge and
revisit the weight itself. Implemented and shipped with the seeded scores exactly as given —
`content/resume-data.json` is not silently patched to force a match.

**Other changes, all implemented and dry-run verified (no code changes pending):**
- Scores for the 5 non-seeded projects (ShelfSense, Reclaim, Gold Rate Tracker, tracegauge,
  Expense Tracker) assigned by the same rubric, flagged as my own judgment call, not seeded by
  GG — see each entry's context in `content/resume-data.json`.
- `content/certifications.json`: added `kind` (`certification`/`course`/`self_paced`) +
  `description`; all 4 existing certs classified `course` (the 3 DeepLearning.AI
  specializations) or `certification` (Google Cloud, the only proctored exam). No `self_paced`
  entries exist yet — that render path is implemented and covered by a synthetic smoke-test
  case, but unexercised by real data.
- Section rename: "CERTIFICATIONS" → "Certifications & Continuing Education".
- "More on GitHub" line: capped at 200 chars, metric for at most one project (the
  highest-weighted-score collapsed entry), hard-gated. **Caught a real bug while dry-run
  testing this**: `buildCollapsedLine`'s "exactly one metric" check counts `(` characters, but
  4 of 13 `headline_metric` strings (style-maitri, triageiq, aetherart, agentgauge) originally
  embedded their own parens (e.g. AgentGauge's "−13.3 to −28.9pp (3 model families)"), which
  broke the invariant even though the selection logic correctly picked only one carrier. Fixed
  at the content level (removed all embedded parens from `headline_metric` values) and added a
  dedicated root-cause lint (`lintHeadlineMetricNoParens`) plus smoke-test coverage, rather
  than just patching the symptom.
- `resume-lint.smoketest.mjs` extended with real assertions for all 4 new/changed gates —
  re-ran clean after the fix.

**Still blocked on the same `soffice` install as amendment 1** — nothing in amendment 2 needed
it, so no additional blocker introduced.

### Amendment 3 (2026-08-05) — two-stage positional ranker

GG's brief: the single linear weight vector produces two order inversions against the intended
sequence because rank-position value is non-linear (`demo_quality` drives click-through for the
first two entries only; below rank 2, substance dominates) — one linear vector can't express
that. Replaced with a two-stage model: stage 1 fills ranks 1-2 with demo-dominant weights
(`.45/.25/.20/.10`), stage 2 ranks everything else with substance-dominant weights
(`.10/.35/.35/.20`), deterministic tie-break (`demo_quality` desc → `metric_strength` desc → id
asc). Full detail: `spec-resume-variants.md`'s "Selection algorithm" section.

**Bug found and fixed during implementation, not in the brief:** the tie-break's initial
`score !== score` equality check is exact-float, and two mathematically-equal scores (Reclaim vs.
Expense Tracker, both 2.55 by hand) land on opposite sides of IEEE-754 rounding
(`2.5499999999999998` vs. `2.5500000000000003`) — the tie-break silently never fired and order
fell out of float noise instead of the spec'd rule, exactly the "no random/insertion-order
fallback" determinism the brief required. Fixed with a `1e-9` epsilon compare
(`compareScored` in `scripts/lib/resume-select.mjs`). Caught by hand-verifying the dry-run output
against the hand-computed table below, not by a pre-existing test — the new regression test
(below) now covers this specific case (`proj:higher-demo`/`proj:lower-demo` fixture in
`resume-select.smoketest.mjs`).

**Required verification (item 3) — result: matches the intended sequence for every gate-eligible
project; does NOT and cannot include AgentGauge as a full entry, and that mismatch is structural,
not a weighting artifact.** Computed programmatically from the exact seeded scores, restricted to
the same 8 projects amendment 2's table used (the other 5 non-seeded projects are additional
judgment-call scores, not part of this comparison):

Stage 1 (demo-dominant, all 8 candidates — AgentGauge included here since the surface gate, not
stage 1, is what excludes it):

| Project | Stage-1 score |
|---|---|
| TriageIQ | 4.55 |
| Style Maitri | 4.45 |
| Multimodal Fashion Recommender | 4.25 |
| Hinglish+Warmer | 4.20 |
| AetherArt | 4.10 |
| AgentGauge | 3.65 (excluded pre-scoring by the repo_only gate — shown for completeness only) |
| DealHunter | 3.45 |
| Samidha Reviews | 2.65 |

Stage-1 winners (ranks 1-2, cutoff=2): **TriageIQ, Style Maitri** — matches target positions 1-2.

Stage 2 (substance-dominant, remaining 6 eligible candidates — AgentGauge is not in this pool,
it was already gated out before stage 1 ran):

| Project | Stage-2 score |
|---|---|
| Multimodal Fashion Recommender | 4.35 |
| Hinglish+Warmer | 3.75 |
| AetherArt | 3.55 |
| DealHunter | 3.10 (tie-break winner over Samidha Reviews via demo_quality 4 > 2) |
| Samidha Reviews | 3.10 |

Combined final order (7 full entries — AgentGauge is not in this list, it force-collapses):
**TriageIQ, Style Maitri, MMFR, Hinglish+Warmer, AetherArt, DealHunter, Samidha Reviews.**

This is the target sequence with AgentGauge removed, in exactly the target's relative order for
the other 7 — the two-stage model's math is correct. AgentGauge is absent as a full entry
because it is `surface: "repo_only"` in `content/resume-data.json` (no `liveUrl` in
`content/products.ts`, confirmed by direct read) — the spec's own hard gate (amendment 1, unchanged)
excludes `repo_only` projects from the ranked pool *before either stage scores anything*, same as
it correctly excludes ShelfSense. Amendment 2's own table appears to have hand-computed a
weighted score for AgentGauge anyway despite it already being `repo_only` at that time — an
inconsistency in that table, not evidence the gate ever didn't apply. **Not resolved
unilaterally, per the explicit instruction not to tune weights to force a match — flagged for GG:
(a) accept AgentGauge collapsed into "More on GitHub" (it has no live surface, consistent with
every other repo_only project's treatment), or (b) if AgentGauge should render as a full entry,
that needs a real live surface or a deliberate one-off carve-out of the repo_only gate — not a
ranker change, since the ranker was never what was excluding it.**

**Other changes, all implemented and verified:**
- `scripts/lib/resume-select.mjs`: `resolveWeights` now returns `{ stage1, stage2, stage1Cutoff }`;
  new `twoStageRank()`; `buildCollapsedLine` takes the same shape and scores collapsed entries
  (repo_only + page-fit drops) with stage-2 weights for a single consistent ordering, since
  collapsed entries are by construction never stage-1 material.
- `scripts/build_resume.mjs`: `printRankingTable` now prints both stage tables plus the combined
  final order (item 2's stdout requirement) instead of one linear table.
- `variants/*.json` schema: `score_weights` retired, replaced by optional `stage1_weights`/
  `stage2_weights`/`stage1_cutoff`. None of the 4 shipped variants use any of these — no
  principled reason to yet, same as amendment 2.
- New `scripts/lib/resume-select.smoketest.mjs` (item 4's regression test): unit coverage of the
  two-stage model, the tie-break rule (including the float-epsilon fix, as its own dedicated
  case), and a regression assertion of the exact full project sequence + forced-collapse set
  against the real, current `content/resume-data.json` — a future score or `surface` edit that
  reorders the resume fails this immediately instead of drifting silently.

**LibreOffice unblock (items 5-7):** `winget` is not on PATH or invokable via bare `winget` in
either this Bash or PowerShell session (`command not found` / `not recognized`, reproducing
amendment 1's finding) — but its App Execution Alias *is* directly invokable at
`%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe` (`v1.29.280`, confirmed). Ran
`winget install --id TheDocumentFoundation.LibreOffice --accept-package-agreements
--accept-source-agreements` via that full path — installer downloaded and verified
(`LibreOffice_26.2.5_Win_x86-64.msi`, hash-verified) but **failed with exit 1603** ("Install
server not responding" per the winget diagnostic log at
`%LOCALAPPDATA%\Packages\Microsoft.DesktopAppInstaller_...\LocalState\DiagOutputDir\`) —
consistent with amendment 1's non-elevated-shell finding, not retried per the brief's explicit
instruction to report the exact error and stop rather than skip the gate.

**Fallback (item 6) — Word COM via docx2pdf: works.** Microsoft Word confirmed present
(`C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE`). `docx2pdf` needed installing
into the actual interpreter `execFileSync("python", ...)` resolves to, not whichever `pip` was
first on PATH — `pip install docx2pdf` silently landed in an unrelated `C:\Python314` install
while `python` itself resolves to `C:\Users\gaura\anaconda3\python.exe` (this machine's default
conda `base` env, per my standing environment defaults); re-ran as `python -m pip install
docx2pdf` to install into the interpreter that's actually invoked, verified via
`python -c "import docx2pdf"`.

**Backend detection (item 6) wired into `scripts/build_resume.mjs`:** `detectPdfBackend()` tries
soffice first (3 known paths, unchanged from amendment 1), falls back to Word COM only if both
`WINWORD.EXE` and the `docx2pdf` Python package are independently confirmed present — returns
`null`, never a guess, if neither backend is real. `findSoffice()`/`findWordCom()` no longer
throw; `main()` fails closed with an explicit "page-count gate unavailable" message and non-zero
exit if `detectPdfBackend()` returns `null` (item 7's fail-closed requirement). Also fixed a
found-in-passing fail-open bug while wiring this in: `renderAndCountPages` now deletes any
stale `.pdf` from a prior run *before* invoking either backend — if a conversion ever silently
no-ops, the page-count check must not pass by counting old output (rule 98a).

### Amendment 3 close-out — all 4 variants built (2026-08-05)

All 4 variants built via the Word COM backend (soffice unavailable, see above) and independently
re-verified with a standalone `pypdf` read (not just trusting the build script's own count):

| Variant | Pages | Projects (full/collapsed) | Keywords | "More on GitHub" |
|---|---|---|---|---|
| google-applied-scientist | 2/2 | 11 full, 2 collapsed | 6/14 (43%) | AgentGauge (−13.3 to −28.9pp across 3 model families), ShelfSense |
| meta-research-scientist | 2/2 | 11 full, 2 collapsed | 3/13 (23%) | AgentGauge (−13.3 to −28.9pp across 3 model families), ShelfSense |
| amazon-applied-scientist | 2/2 | 11 full, 2 collapsed | 4/13 (31%) | AgentGauge (−13.3 to −28.9pp across 3 model families), ShelfSense |
| salesforce-senior-ds | 2/2 | 11 full, 2 collapsed | 2/11 (18%) | AgentGauge (−13.3 to −28.9pp across 3 model families), ShelfSense |

Every variant's project order and force-collapse set is identical (no variant overrides
`stage1_weights`/`stage2_weights`/`stage1_cutoff`/`drop_ids` — ordering is intrinsic per-project,
not JD-tailored, unchanged since amendment 2). AgentGauge correctly carries the collapsed line's
one allowed metric (highest stage-2 score of the two collapsed entries) — consistent with the
amendment 3 finding above: it's excluded as a full entry by the repo_only gate, not absent
entirely.

**New finding, not previously flagged: keyword coverage is well below the spec's ≥60% success
metric on every variant (18-43%, average 29%).** This is a pre-existing content-authoring gap
(the resume's actual bullet text doesn't use enough of each JD's vocabulary), not a ranker or
build-pipeline defect — out of this amendment's scope per its explicit "do not propose further
ranker sophistication" instruction, and not a ranking problem at all (coverage is a full-text
substring match, unaffected by project order). Flagged for GG as a separate, future content pass:
per-keyword breakdowns are in `reports/resume-coverage-<variant>.md`.

**Outstanding for GG, not resolved unilaterally this session:**
1. The AgentGauge/repo_only structural finding above — pick (a) leave collapsed or (b) give it a
   real live surface / a deliberate gate carve-out.
2. Keyword coverage below the 60% target on all 4 variants — needs a content pass, not a ranker
   change.
3. LibreOffice still not installed (Word COM covers the gate for now, but soffice was the spec's
   originally-specced tool) — install manually in an elevated shell if soffice is ever needed
   specifically (e.g. a non-Windows CI runner later).

### Amendment 4 (2026-08-05) — AgentGauge PyPI verification + surface-derivation audit

GG's brief: two blocking verifications before any content edit — (1) is `agentgauge-harness`
actually published to PyPI, (2) audit every project's `surface` value for the same
liveUrl-only-capture gap that caused AgentGauge to misclassify, explicitly flagging tracegauge as
a likely second case. Verify-first, no edits until both were answered.

**Finding 1 — VERIFIED-PUBLISHED, from 3 independent sources:**
- `curl https://pypi.org/pypi/agentgauge-harness/json` → **HTTP 200**, `version: 0.5.2`, wheel
  uploaded `2026-07-30T17:51:50.441005Z`, sdist `2026-07-30T17:51:51.724399Z`.
- `agentgauge` repo: git tag `v0.5.2` exists; `.github/workflows/release.yml` (triggered on
  `push: tags: v*`) ran **green** for tag `v0.5.2` at `2026-07-30T17:51:24Z` (31s) —
  `gh run list --workflow=release.yml` confirms, timing consistent with the PyPI upload 26s
  later. Uses PyPI Trusted Publishing (OIDC `id-token: write`, `pypa/gh-action-pypi-publish`) —
  no `PYPI_API_TOKEN` secret exists by design, not a gap.
- Canonical project page `https://pypi.org/project/agentgauge-harness/` also independently
  returns HTTP 200.

**Finding 2 — surface audit, all 13 projects.** Only **1 real misclassification** (AgentGauge).
**tracegauge was NOT mis-derived** — the brief's hypothesis that it shared AgentGauge's bug does
not hold; reported as a finding rather than assumed:

| Project | Surface (before) | Evidence | Correct surface |
|---|---|---|---|
| TriageIQ, Warmer, Style Maitri, DealHunter, AetherArt, Samidha Reviews, Gold Rate Tracker, Expense Tracker | live_demo | `liveUrl` on a known free subdomain (vercel.app/run.app/github.io) | live_demo ✓ (unchanged) |
| Multimodal Fashion Recommender | hf_model | `liveUrl` host `huggingface.co` | hf_model ✓ (unchanged) |
| Reclaim | live_demo | `liveUrl` is a GitHub Releases download page, not an interactive demo (pre-existing documented judgment call) | live_demo ✓ (unchanged, judgment call stands) |
| tracegauge | pypi | `products.ts` already has a `pypi` field; independently re-verified `pypi.org/pypi/tracegauge/json` → HTTP 200, v0.10.0 | pypi ✓ (unchanged — **the brief's premise was wrong**) |
| ShelfSense | repo_only | no `liveUrl`/`pypi` in `products.ts`; independently checked `pypi.org/pypi/shelfsense/json` and `.../shelfsense-m5/json` → both 404 | repo_only ✓ (unchanged) |
| **AgentGauge** | **repo_only** | `products.ts` had no `pypi` field despite real publication (finding 1) | **pypi — corrected** |

Also checked while auditing: `reviewiq`'s `liveUrl` is still the Cloud Run URL, not
`samidhareviews.xyz` — curled directly, `000` (no response), confirming the custom domain isn't
live yet and `domain` surface still correctly stays unused sitewide, per spec.

**Root cause, precisely stated:** there is no code that derives `surface` — it's a value hand-set
once when a `resume-data.json` entry is authored, per the spec's rule. The rule itself already
handles `pypi` correctly (proven by tracegauge). AgentGauge's `products.ts` entry was simply
missing its `pypi` field even after the package published — a **stale source record**, not a
**broken derivation rule**. Full detail promoted into `spec-resume-variants.md`'s surface-rule
section so a future session doesn't rediscover this from scratch.

**Fix (only AgentGauge changed, per the verified finding):**
- `content/products.ts`: added the missing `pypi` field to AgentGauge's entry (same shape as
  tracegauge's). Side effect, named explicitly: `liveProductCount()` counts `liveUrl || pypi`, so
  the **live portfolio site's hero "live product count" stat goes 11 → 12** — a real, correct
  consequence of fixing the data, not a resume-generator-only change. Not deployed/verified live
  this session (out of this task's scope — this session touched `content/*` only, no deploy).
- `content/resume-data.json`: `proj:agentgauge.surface` → `"pypi"`; `verified_source` appended
  (not overwritten) with the PyPI verification evidence. **No score field touched** —
  `demo_quality`/`role_relevance`/`technical_depth`/`metric_strength` all unchanged, per the
  standing "don't adjust scores" rule from amendment 3.
- **New `artifact_url` field** added to all 13 project entries (schema documented in
  `spec-resume-variants.md`) — the verified link backing each `surface` claim: `liveUrl` for
  live_demo/hf_model, the canonical `pypi.org/project/<name>/` page for pypi (independently
  curled 200 for both tracegauge and agentgauge-harness), `null` for ShelfSense (repo_only,
  exempt).
- **New hard gate, item 3 (`lintArtifactUrl` in `resume-lint.mjs`)**: any project with
  `surface != "repo_only"` and no well-formed `http(s)` `artifact_url` fails the build. Wired
  into `build_resume.mjs`'s static-lint block (runs before any render, same as
  `lintHeadlineMetricNoParens`). Smoke-test coverage added to `resume-lint.smoketest.mjs` (4 new
  assertions: repo_only exempt, valid URL passes, missing URL caught, malformed URL caught).
- **Regression test updated**: `resume-select.smoketest.mjs`'s `EXPECTED_SEQUENCE` now includes
  AgentGauge (it wins stage 2 outright, score 4.70 — highest of any project in either stage,
  driven by its 5/5/5 role/depth/metric with only demo_quality=2 dragging it down, which stage 2's
  substance-dominant weights barely penalize); `forcedCollapse` regression narrowed to
  `["proj:shelfsense"]` only. New assertion that `lintArtifactUrl` returns clean on the real,
  current data.

**Verification — new full sequence, all 4 variants rebuilt and independently re-checked with a
standalone `pypdf` read:**

TriageIQ, Style Maitri, **AgentGauge**, MMFR, Warmer, AetherArt, Gold Rate Tracker, DealHunter,
Samidha Reviews, tracegauge, Expense Tracker, Reclaim (12 full entries; ShelfSense alone
collapses to "More on GitHub").

**This exactly reproduces amendment 3's original target sequence for the 8 seeded projects**
(TriageIQ, Style Maitri, AgentGauge, MMFR, Warmer, AetherArt, DealHunter, Samidha Reviews, with
the 4 non-seeded projects correctly interleaved by score) — confirming the amendment 3 mismatch
was **entirely** the repo_only misclassification and not, even partially, a weighting artifact.
The two-stage model itself needed no further changes.

| Variant | Pages | Projects (full/collapsed) |
|---|---|---|
| google-applied-scientist | 2/2 | 12 full, 1 collapsed |
| meta-research-scientist | 2/2 | 12 full, 1 collapsed |
| amazon-applied-scientist | 2/2 | 12 full, 1 collapsed |
| salesforce-senior-ds | 2/2 | 12 full, 1 collapsed |

**Not done, deliberately out of scope:** deploying the `products.ts` change to the live site
(hero stat), and building a code-level `surface` auto-derivation from `products.ts`/live PyPI
checks (considered, explicitly deferred — noted in `spec-resume-variants.md` so it isn't silently
lost).

### Amendment 5 (2026-08-05) — max_full_entries cap

Item A of GG's 2-item request (item B, the site sync, is the priority — see the separate
`gg-portfolio` site-reconciliation log below). Added `max_full_entries` (default 8,
per-variant override) to `build_resume.mjs`: the two-stage ranker's full sequence is unchanged;
only the top N of that sequence render as full entries, everything below collapses into "More on
GitHub" alongside `repo_only`. The 2-page gate still applies on top — if the capped set still
overflows, the existing page-fit loop trims further. Every collapse now carries an explicit,
distinct reason (`repo_only` gate / cap / page-fit overflow), printed to stdout and written into
`reports/resume-coverage-<variant>.md`'s new "Full entries" / "Collapsed" sections — nothing
silent.

All 4 variants rebuilt (identical result — none override `max_full_entries`, ordering unaffected
by the JD-specific fields as before): **8 full entries** (TriageIQ, Style Maitri, AgentGauge,
MMFR, Warmer, AetherArt, Gold Rate Tracker, DealHunter), **5 collapsed**
(ShelfSense/repo_only + Samidha Reviews/tracegauge/Expense Tracker/Reclaim/cap), **2/2 pages**
on every variant (independently re-verified with `pypdf`). "More on GitHub" line: 115/200 chars,
one metric (ShelfSense's), both hard gates hold with 5 collapsed entries.
