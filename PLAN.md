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
