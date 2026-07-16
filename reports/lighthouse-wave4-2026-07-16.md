# Lighthouse — Wave 4 Phase 2 (editorial production rebuild) — 2026-07-16

PR #11 (`feat/wave4-editorial-redesign`), commit `ddbed9a`, measured against its Vercel
preview deployment:
`https://gaurav-gandhi-git-feat-wave-ca0e7c-gaurav-gandhi-2411s-projects.vercel.app`

## Method

`npx lighthouse <preview-url> --output=json --only-categories=accessibility,best-practices,seo,performance --form-factor=desktop --screenEmulation.width=1350 --screenEmulation.height=940 --chrome-flags="--headless=new"`

Same CLI tool and desktop screen-emulation settings as the wave-3 baseline
(`reports/lighthouse-wave3-tier2-2026-07-12.json`), with one deliberate difference: the
`performance` category is included here. Wave 3's Lighthouse runs never collected it
(`onlyCategories` there was `accessibility,seo,best-practices,agentic-browsing`) — its LCP
numbers came from a separate, unthrottled Chrome DevTools trace on `localhost`
(`reports/wave3-tier2-microinteractions-2026-07-12.md`, 205.7ms 3-run average). That number
and this run's Lighthouse-simulated, throttled LCP are not on the same scale — flagged below
rather than presented as a false apples-to-apples delta.

## Headline numbers vs. wave-3 artifact

| Metric | Wave 3 (`lighthouse-wave3-tier2-2026-07-12.json`, localhost) | Wave 4 (this run, Vercel preview) | Status |
|---|---|---|---|
| Accessibility | 100 | **100** | PASS — held at 100 |
| Best Practices | 96 | **100** | Improved — see note below |
| SEO | 100 | **63** | **Not a real regression — preview-deployment artifact, see below** |
| LCP | 205.7ms (DevTools trace, unthrottled localhost — different method) | **4.03s** (Lighthouse, simulated throttling, Vercel preview) | See LCP investigation below — not font-loading |

## SEO: 63 is a Vercel preview-URL artifact, not a code regression

The only failing SEO audit is `is-crawlable` (score 0, "Page is blocked from indexing"),
caused by:

```
X-Robots-Tag: noindex
```

on the preview response. Verified this is Vercel platform behavior, not something this PR
introduced:
- `git diff main...feat/wave4-editorial-redesign -- app/layout.tsx public/robots.txt` shows
  no robots/indexing-related change in this PR.
- The production deployment (`https://gaurav-gandhi.vercel.app`) does **not** send
  `X-Robots-Tag`, confirmed by a direct `curl -I` against it same-session.

Vercel auto-injects `noindex` on every `*.vercel.app` preview URL so search engines never
index in-progress work — expected and desired. Production SEO remains 100 once merged. Every
other SEO audit (meta description, canonical, structured data, crawlable links, robots.txt
validity) scored clean.

## Best Practices: 96 → 100 (real improvement, explained)

Wave 3's 96 was one pre-existing, already-documented finding: `/_vercel/insights/script.js`
404s under `next dev` on localhost but returns 200 in any real Vercel environment (noted in
`wave3-tier2-microinteractions-2026-07-12.md`). This run is against an actual Vercel preview
deployment, so that script resolves and the finding doesn't fire. No Best Practices audit
scored below 1.0 in this run.

## LCP investigation: element and font-loading confirmed clean

**LCP element** (`lcp-breakdown-insight` audit): `h1.font-heading` — "Gaurav Gandhi", the
180px-clamped Fraunces display headline. Confirms the concern in scope: the editorial
redesign's big display type is now the LCP element (wave 3's LCP element was the hero
paragraph, per that report's own note on hydration cost).

**Font-display and preload — not the cause of the higher number:**
- `app/layout.tsx` loads Fraunces via `next/font/google` with `display: "swap"` explicitly
  set (same for Space Grotesk and JetBrains Mono).
- `font-display-insight` audit: score 1, **0ms** estimated savings — Lighthouse found no
  font-display-related waste.
- Confirmed 3 `<link rel="preload" as="font" type="font/woff2" crossorigin>` tags present in
  the served HTML `<head>` — `next/font` auto-preloads fonts used in the initial render, and
  it's working as intended here.

**Where the time actually goes** (`lcp-breakdown-insight`, unthrottled-trace timings):
time-to-first-byte 79.6ms + element-render-delay 1,364ms ≈ 1.44s. The main LCP metric
(4.03s) is Lighthouse's Lantern-*simulated* figure — 150ms RTT, ~1.6Mbps throughput, 4×
CPU slowdown baked in — not a raw trace number, so the two don't sum to the same total; this
is a known divergence between Lighthouse's simulated core metrics and its trace-derived
"insight" breakdowns, not a measurement error. `mainthread-work-breakdown` (0),
`total-blocking-time` (0.78, 210ms), `render-blocking-insight` (0.5), and
`network-dependency-tree-insight` (0) point at JS execution / render-blocking request-chain
cost under simulated throttling — consistent with wave 3's own conclusion that hydration
cost, not fonts, drives LCP on this page.

**Conclusion:** no font-loading regression. The 4.03s figure is a throttled-simulation
number with no directly comparable wave-3 baseline (wave 3 never ran Lighthouse's performance
category) — the honest comparison point is qualitative (LCP element identity, font-display,
preload), all of which check out. Recommend adding a Lighthouse performance-category run to
the wave-3-style budget process going forward so future waves have a real like-for-like
number.

## Raw report

`reports/lighthouse-wave4-2026-07-16.json` — full Lighthouse JSON output.
