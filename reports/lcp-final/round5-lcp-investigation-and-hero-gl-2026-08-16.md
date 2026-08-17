# perf/lcp-final — round 5 LCP close-out + hero-GL extension — 2026-08-16

Production PSI baseline (median of 3, GG's own measurement): Perf 91, LCP 2.9s, target 2.5s
(~400ms gap). Follow-up to `reports/lighthouse-perf-fix-round4-2026-08-15.md` (round 4), which
already landed the animation-compositing fix and the forced-reflow fix (PR #94, merged).

## Task 1 — browserslist target vs. the deployed bundle: verified directly, still a confirmed no-op

Round 3/4 already tested `browserslist` three times and got a zero-byte change each time,
measured via `next build`'s own "wasted bytes" self-report. This round verified against the
actual shipped bundle instead: `npm run build && npm run start`, then
`npx lighthouse http://localhost:3000/ --only-audits=legacy-javascript-insight`.

**Result: exactly one flagged module,** `_next/static/chunks/08ttfj81-47mu.js`, 13,771 wasted
bytes, signals `Array.prototype.at/flat/flatMap`, `Object.fromEntries`, `Object.hasOwn`,
`String.prototype.trimStart/trimEnd` (`reports/lcp-final/legacy-js-2026-08-16.json`).

**Classification, verified at the byte level, not inferred from the chunk name:** the chunk's
first ~500 bytes are a `String.prototype.trimStart in ... || (String.prototype.trimStart =
String.prototype.trimLeft)`-style feature-detection block — grepping
`node_modules/next/dist/build/polyfills/polyfill-module.js` confirms this is Next.js's own
built-in polyfill/feature-detection module, not app code. `grep -c "react-dom"` on the same chunk
returns 1 (present); `grep`s for `components/hero`, `components/sections`, `app/layout`,
`EmbeddingCloud`, `BootLoader`, `chat-launcher` all return 0 — no app-authored code appears in
this chunk at all. **Framework-internal, confirmed a 4th time under Next 16.3.0/Turbopack, with
stronger evidence than any prior round** (direct chunk-content match to the framework's own
polyfill source, not just "same chunk as the biggest long task"). Not fixable from this app's own
`browserslist` config — Turbopack bundles this module regardless of the app's target.

## Task 2 — network dependency tree to the LCP element: short and already optimal

`npx lighthouse --only-audits=network-dependency-tree-insight` (the successor to
`critical-request-chains`, which no longer exists as an audit ID in Lighthouse 13.4.1 — confirmed
by inspecting `lighthouse/core/config/default-config.js`'s own audit list before trusting a silent
empty result).

**Chain, `reports/lcp-final/network-chain-2026-08-16.json`:**

```
/ (HTML, 26ms) -> /_next/static/chunks/24apq2pjw5hk3.css (37ms, longest chain)
```

**Depth: 2. One round trip beyond the HTML itself.** No fonts, no JS in the critical chain — both
verified separately:

- **Fonts:** `curl`'d the served HTML directly — all 3 `next/font/google` fonts (Space Grotesk,
  Fraunces, JetBrains Mono) already emit `<link rel="preload" as="font">` (next/font's own default
  `preload: true`, confirmed in `app/layout.tsx`), and all three set `display: "swap"`. Because of
  `display: swap`, the hero `<h1>` paints immediately with the fallback font regardless of font
  load timing — fonts are fetched in parallel, never gating the LCP element's paint.
- **JS:** the LCP element (the hero `<h1>`, confirmed definitively in round 4 via
  `lcp-breakdown-insight`) is server-rendered static text — round 2 already confirmed this via raw
  SSR HTML diffing — so no JS is required for it to paint at all.

**Conclusion: the chain is already minimal.** There is no fixable dependency-ordering issue here
— no unpreloaded font, no render-blocking chain beyond the one CSS file (see Task 3). This is
consistent with round 4's `elementRenderDelay` finding (2196ms) dominating `timeToFirstByte`
(9.6ms) by two orders of magnitude: the remaining cost is compute-bound (hydration/paint timing),
not network-bound.

## Task 3 — render-blocking requests: one CSS file, one real lever tried and ruled out

`npx lighthouse --only-audits=render-blocking-insight` (renamed from `render-blocking-resources`
— confirmed via the same default-config audit-list check). **Exactly one flagged resource:** the
single global Tailwind stylesheet, `_next/static/chunks/24apq2pjw5hk3.css`, 11,739 bytes,
~154-159ms estimated savings across two runs (`reports/lcp-final/render-blocking-2026-08-16.json`).

**One concrete, first-party lever tried:** Next.js 16's `experimental.inlineCss` flag (bundled with
the framework, zero new dependencies — not `critters`/`beasties`, which aren't installed and
weren't added). Its own docs (`node_modules/next/dist/docs/.../inlineCss.md`) recommend it
specifically for "atomic CSS (Tailwind)" and first-time-visitor performance, which is exactly this
site's situation (recruiter first-visits, small Tailwind bundle).

**Result: verified no-op for this specific route, for a documented, mechanism-level reason.**
Enabled the flag, rebuilt, and inspected the served `<head>` directly — the `<link
rel="stylesheet">` was still present, not replaced by an inline `<style>` tag. The flag's own docs
state the exact cause: *"When navigating to prerendered pages, styles will use `<link>` tags
instead of inline CSS to avoid duplication."* `/` is a fully static, prerendered route (`○` in
`next build`'s own route table) — inlineCss's exclusion applies directly. Re-ran
`render-blocking-insight` after enabling the flag to confirm rather than assume: identical flagged
resource, same score (`reports/lcp-final/render-blocking-after-inlinecss-2026-08-16.json`).
**Reverted** the config change rather than leaving dead config, matching this repo's own
established practice (rounds 3/4 reverted the no-op `browserslist` config the same way).

No other concrete lever was found: disabling static prerendering for `/` to unlock inlineCss would
trade a guaranteed, larger cost (server compute + TTFB on every request) for an uncertain,
probably-smaller gain (eliminating one 37ms-observed / ~154ms-estimated CSS round-trip) — not a
defensible trade.

## Verdict: the ~400ms gap is framework-internal, not fixable from this app's own code or config

Evidence, combined across Tasks 1-3 and 4 prior rounds:

1. The only legacy/unused-JS signal traces, at the byte level, to Next.js's own polyfill module —
   not app code, not gated by `browserslist` (tested 4 times now, Turbopack ignores it for this
   bundle regardless of target).
2. The network chain to the LCP element is already 2 levels deep (HTML → one CSS file) with fonts
   preloaded and non-blocking (`display: swap`) and zero JS required for the LCP element to paint —
   there is no dependency-ordering fix available.
3. The one render-blocking resource (the CSS file) has exactly one first-party lever
   (`experimental.inlineCss`), and it is a structurally documented no-op for this specific
   prerendered route — not guessed, verified by inspecting the served HTML directly before and
   after.
4. Round 4's own `lcp-breakdown-insight` data: `elementRenderDelay` (2196ms) dominates
   `timeToFirstByte` (9.6ms) by two orders of magnitude — the cost is React/Next hydration and
   paint timing under CPU throttle, not a network or render-blocking-resource problem.

This is the same "framework floor" conclusion four consecutive rounds (rounds 2-4 plus this one)
have independently reached via different tooling and different hypotheses — each round tried a
genuinely new angle (compositing, forced reflow, Speed Insights cost, LCP-element identity, and
now the deployed-bundle-level legacy-JS classification, the network chain, and the render-blocking
lever) rather than re-asserting the same untested claim. **Closing this investigation**: the
remaining ~400ms gap between the current 2.9s and the 2.5s target is consistent with
framework-internal hydration cost under PSI's mobile CPU throttle, with no further lever available
in this app's own code or config.

## Task 4 — hero-GL pattern extension: two new surfaces

See the PR body for the full before/after numbers, laziness confirmation, static-fallback
confirmation, and a pre-existing, unrelated production bug discovered incidentally while verifying
this work (`app/template.tsx` / `lib/view-transition.ts` — a real, reproducible View-Transitions-API
race, confirmed present on unmodified `origin/main`, NOT fixed in this PR — flagged as a separate,
urgent follow-up).

**Data-authenticity note, stated up front:** the task brief suggested "TriageIQ's issue clusters"
as the case-study surface's data source. Checked before building against it (rule 99 — verify the
brief's own premise): there is no real per-issue-embedding dataset for any single case study
checked into this repo (TriageIQ's actual issue embeddings live server-side in a different repo,
never exported here). Fabricating point-cloud coordinates would violate this repo's own standing
rule that nothing ships without a real, sourced input (`PLAN.md`'s own header: "every displayed
number traces to `content/provenance.md` or it doesn't ship" — extended here to a visualization's
underlying data, not just headline metrics). Used the one real embedding dataset that already
exists instead: `content/search/project-embeddings.json` (13 real Xenova/all-MiniLM-L6-v2
embeddings, one per project, already verified for the search-methodology feature), PCA-projected
to 3D via `scripts/build_project_embedding_projection.mjs`. Both new surfaces show "where does
this project sit in the portfolio's real semantic-embedding space" — an honest, sourced claim
about the actual data, not an invented one about TriageIQ's issues specifically.
