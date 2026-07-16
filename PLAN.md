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

## Wave 3 (original) — post-arXiv (blocked on paper 1's arXiv endorsement)

Flip research section live with arXiv ID; add Tier 2 paper when public. Once wave 4's draft PR
merges and the recommended follow-up Lighthouse pass is run, this is the only remaining open
item on the repo — no other work is queued until this unblocks or GG redirects.

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
