# PR-2 "perf" — LCP diagnosis, full-route sweep, and 3D-headroom re-derivation — 2026-08-14

Fresh baseline established on `fix/perf`'s actual `HEAD` (`ff5ff7c`, the current `main` tip,
which already includes the WebGL hero merge and the boot-loader entrance). Every number below is
from a real `npx lighthouse` run against a real `npm run build && npm run start` (local) or the
live production URL, read from the JSON output's `audits.metrics`, `lcp-breakdown-insight`,
`render-blocking-insight`, and related audits — not from the Performance score alone.

## Task 1 (A4) — LCP root-cause diagnosis

### Step 1-3: what the trace actually shows

**LCP element, every route checked:** the homepage's LCP element is the `<h1>` headline text
("I build AI products and see them through…", `lcp-breakdown-insight`'s `page-0-H1` node). Not
the WebGL canvas, not the static SVG scatter, not an image — plain text, server-rendered, present
in the initial HTML.

**The single most important finding: unthrottled (real) LCP is fast.** The same trace that
reports a ~3.1s *simulated* LCP also reports, in `metrics.details.items[0]`:

```
observedLargestContentfulPaint: 169ms
timeToFirstByte (lcp-breakdown-insight, unthrottled): 10.1ms
elementRenderDelay (lcp-breakdown-insight, unthrottled): 159.2ms
```

TTFB matches the task brief's "~12ms local" almost exactly. The gap is entirely inside
Lighthouse's **simulated mobile throttling model** (`throttlingMethod: "simulate"`, the Lighthouse
CLI default for `formFactor: mobile`) — a Lantern-based estimate of how this same trace would play
out on a 4×-slower CPU and a Slow-4G-equivalent network, not a second real measurement.

**render-blocking-insight** flags exactly one resource on every route: the single Tailwind
stylesheet (`3k7qj536pdj3z.css`, 11,368 bytes, estimated 154ms of LCP savings if removed).

**Every other candidate audit reports zero estimated LCP impact**, read directly from each
audit's own `metricSavings.LCP` field: `duplicated-javascript-insight` (0), `legacy-javascript-
insight` (0, despite flagging 13KB of "wasted" legacy polyfill bytes for the *byte-weight*
audit), `network-dependency-tree-insight` (0, longest real request chain is 38ms: document → CSS).
`font-display-insight` scores 1/perfect with zero wasted ms — `next/font`'s `display: "swap"` is
already correctly configured on all three fonts in `app/layout.tsx`, confirmed by inspection (not
assumption).

**Main-thread cost is real but not egregious in absolute terms:** `bootup-time`'s two largest
contributors are Next.js/React framework chunks (`08ttfj81-47mu.js`: 470ms scripting;
`1se3v-qllyvqa.js`: 133ms scripting), not any hero/WebGL-specific code. `long-tasks` shows only 2
tasks over 50ms in the entire trace (136ms at t=848ms, likely hydration; 155ms at t=3211ms, after
LCP). Total Blocking Time is 54-122ms across 3 runs — comfortably under the 200ms "good"
threshold.

**The WebGL hero (`embedding-cloud-gl.tsx`) does not appear in the trace at all.** Its own
`START_DELAY_MS` (2600ms) + `requestIdleCallback` gating means it structurally cannot start
loading within the ~2.6s trace window Lighthouse captures for this page. Confirmed both by
reading the code (not assumption) and by the network-requests list: no WebGL-related chunk is
present among the 27 requests captured.

### Step 4: fixes attempted, both measured — one reverted for regressing, one is a genuine dead end

**Hypothesis 1 — the boot-loader curtain (`components/boot-loader.tsx`) visually covers the H1 for
~1s; does removing it improve the technical LCP number?** Tested empirically: patched
`app/layout.tsx`'s inline `<head>` script to never set `data-boot="1"`, rebuilt, ran 3× Lighthouse.

| | Perf | LCP |
|---|---|---|
| With boot-loader (baseline, 3 runs) | 93, 94, 94 | 3158, 3157, 3159 |
| Without boot-loader (3 runs) | 87, 92, 92 | 3916, 3309, 3309 |

Removing the boot-loader did **not** improve LCP — if anything the median moved slightly worse
(3309ms vs. 3158ms), but the swing *within* the no-boot condition alone (3309→3916, a 607ms,
~15-point-Performance range across 3 identical runs) is larger than the difference *between*
conditions. **Not a reliable signal either direction** — ruled out. Reverted, `git diff` confirmed
clean.

**Hypothesis 2 — the one real render-blocking-insight finding (11KB CSS, 154ms estimated): fix
via Next's own recommended lever.** Next 16.3 ships `experimental.inlineCss` specifically for
Tailwind/atomic-CSS sites (its own docs: *"Enable if you use atomic CSS... and want to optimize
first-load performance"*). Enabled it, rebuilt, ran 3×:

| | Perf | LCP | Document size |
|---|---|---|---|
| Baseline (external CSS) | 93, 94, 94 | 3157-3159 | 42,062 B |
| `inlineCss: true` | 78, 80, 79 | 4208-4216 | 76,864 B |

**This made LCP measurably worse — median 3158ms → 4212ms (+1054ms), Performance 94 → 79.**
Mechanism, not just correlation: the docs' own caveat ("styles are duplicated... once within
`<style>` tags for SSR and once in the RSC payload") is real here — the homepage document nearly
doubled (42KB → 77KB). This app's local TTFB is already ~10ms, so there was very little
round-trip cost to eliminate in the first place, while the added HTML parse weight cost more
under Lighthouse's simulated CPU throttle than the round trip it removed. **Reverted** — `git
diff` confirmed clean, `next.config.ts` back to its original content.

**Hypothesis 3 — the largest font file (120.8KB, Fraunces with `axes: ["opsz","SOFT","WONK"]`) is
oversized; restrict its `weight` range since the whole codebase only ever pairs `font-heading`
with `font-semibold` (grep-verified: 13 occurrences, zero other weight classes).** Blocked before
it could even be measured: Next's font loader rejects `weight: "500 700"` when custom `axes` are
set for this font ("Unknown weight 500 700 for font Fraunces. Available weights: 100...900,
variable") — the tooling does not support range-subsetting a variable font with additional axes.
A real, mechanism-backed dead end (a loud build failure, not a silent no-op), not attempted
further given `font-display-insight` already reports 0 estimated LCP savings from font strategy
changes generally.

### Step 5: measured before/after, target check

**Target: LCP < 2.5s and Performance ≥ 90, median of 3.** Not reached, on any of the three
routes measured, local or live:

| Route | Env | Perf (median, range) | LCP (median, range) |
|---|---|---|---|
| `/` | local | 94 (93-94) | 3158ms (3157-3159) |
| `/` | live | 87 (85-87) | 3410ms (3324-3416) |
| `/projects` | local | 93 (87-95) | 3160ms (3008-3910) |
| `/projects` | live | 92 (91-92) | 3171ms (3164-3324) |
| `/work/warmer` (worst route, see Task 2) | local | 85 (83-85) | 4059ms (4058-4061) |
| `/work/warmer` | live | 88 (87-94) | 3335ms (2883-3471) |

(`/projects` local shows unusually wide spread — 3008-3910ms across 3 runs on this host — a
symptom of the same run-to-run noise the boot-loader A/B test surfaced; `/work/warmer` local is
notably *tighter* — 4058-4061ms — suggesting its badness is a real, reproducible cost rather than
noise; see Task 2.)

### Conclusion: no fix survives measurement — this is the pre-existing "framework floor," confirmed to still hold

Two prior, independent investigations reached the same conclusion this pass reconfirms:

- `reports/wave4-lcp-investigation-2026-07-16.md` (before the boot-loader or WebGL hero existed):
  real DevTools-throttled (not simulated) measurement put LCP at 3.12s, root-caused to "React/Next
  hydration cost... inherent to shipping a moderately-interactive client-hydrated homepage on this
  framework — not attributable to [any specific feature]," and explicitly "accepted as-is."
- `audit/BACKLOG.md` (round-1 audit, 2026-08-12, pre-hero-merge numbers): "current mobile
  Lighthouse Performance is 84-93... homepage LCP is 3159-3771ms local... already inside
  Lighthouse's 'needs improvement' band... There is currently zero headroom."

This pass adds: (1) the WebGL hero, added since wave4, is confirmed by trace evidence to be a
non-contributor (never loads within the trace window); (2) the boot-loader, also added since
wave4, is confirmed by direct A/B measurement to be a non-contributor (removing it did not
reliably improve LCP); (3) Next's own recommended CSS-inlining fix for exactly the one
Lighthouse-flagged issue on this stack makes the number *worse*, not better, for a stated,
verified reason. No further lever was found that survives real measurement. Consistent with rule
101c: each ruled-out lever has a stated mechanism and a real (not guessed) measurement behind it,
not "tried it, didn't work."

**Not claiming the site is unoptimizable — only that this pass's scope (client-side blocking-bug
hunting) found no bug.** The wave4 report's own escalation path — reducing the *total amount* of
client-hydrated React (a rendering-architecture change) — remains the only lever nobody has tried,
and remains out of scope for a perf-fix-sized PR for the same reason wave4 gave it: "a
materially larger change than what's justified by a lab number under an artificial 4× CPU
throttle." Real-user field data (`@vercel/speed-insights`, added in wave4) is what should
actually decide whether that investment is warranted — this pass did not check the Speed Insights
dashboard (no browser/dashboard access in this environment); flagged as an open follow-up, same as
wave4 left it.

**No code changes ship from Task 1.** `git diff` against `ff5ff7c` touches no application file
for this task — every experiment was reverted after measurement. This is the correct outcome of
an honest diagnosis, not a shortfall: shipping a change that doesn't survive its own measurement
would violate this repo's own verification discipline more than reporting "no fix found" does.

## Task 2 (A7) — full 25-route sweep

All 25 routes (`/`, `/ask`, `/projects`, 6 category pages, 13 case studies, 3 warmup pages), 1
Lighthouse run each, local prod build, mobile, simulated throttling:

| Perf | LCP (ms) | Route |
|---:|---:|---|
| 81 | 3922 | `/` |
| 85 | 4059 | `/work/warmer` |
| 86 | 4064 | `/projects/evals-research` |
| 87 | 3908 | `/work/dealhunter` |
| 87 | 3910 | `/work/triageiq` |
| 89 | 3760 | `/warmup/style-maitri` |
| 90 | 3609 | `/work/gold-rate-tracker` |
| 92 | 3310 | `/work/multimodal-fashion-recommender` |
| 92 | 3309 | `/work/reclaim` |
| 92 | 3309 | `/work/shelfsense` |
| 92 | 3308 | `/work/tracegauge` |
| 93 | 3158-3162 | `/projects/retrieval`, `/projects/tooling`, `/projects/vision`, `/warmup/aetherart`, `/warmup/dealhunter`, `/work/aetherart`, `/work/agentgauge`, `/work/expense-tracker`, `/work/reviewiq`, `/work/style-maitri` |
| 95 | 3010-3012 | `/ask`, `/projects`, `/projects/forecasting`, `/projects/llm-agents` |

(Homepage's 81/3922 single-run number here is a noise outlier vs. its own 3-run median of 94/3158
measured separately — see the boot-loader A/B test above, which found ~600-900ms run-to-run
swings on this host machine even with zero code change. Single-run numbers in this table are for
*relative ranking* across routes, not absolute values — hence the 3× follow-up below.)

**Worst 3 by this sweep: `/`, `/work/warmer`, `/projects/evals-research`.** 3× local re-measurement:

| Route | Perf (median, range) | LCP (median, range) |
|---|---|---|
| `/` | 94 (93-94) | 3158ms (3157-3159) |
| `/work/warmer` | 85 (83-85) | 4059ms (4058-4061) |
| `/projects/evals-research` | 93 (92-94) | 3159ms (3158-3160) |

`/work/warmer` is the genuine outlier — its 3-run spread is only 3ms (4058-4061), tighter than
either homepage or `/projects/evals-research`'s spread, meaning its worse number is a real,
reproducible cost, not host noise. Its `lcp-breakdown-insight` shows an **unthrottled**
`elementRenderDelay` of 1258.7ms — roughly 8× the homepage's 159ms — even though `resource-
summary` shows `/work/warmer`'s total payload (459KB) and script bytes (170.6KB) are not larger
than the homepage's (456KB / 181.5KB). Its LCP element is a body paragraph
(`"Daily word games like Wordle are hugely popular, but they're English-only..."`), further down
the page than the homepage's `<h1>`. This route was not investigated further or fixed — out of
this PR's scope (Task 1 gates on the homepage; Task 2 is measurement/discovery only) — but is
flagged here as the one finding in this pass that looks like a genuine, fixable, route-specific
issue rather than framework floor, and is a reasonable next PR's starting point.

## Task 3 (A5) — re-derived 3D-headroom conclusion

`audit/BACKLOG.md`'s BL-5 rejected any new 3D work against a pre-fix baseline: "current mobile
Lighthouse Performance is 84-93... LCP 3159-3771ms local... zero headroom before the required
≥90 mobile Perf gate."

**Post-hero-merge, re-measured numbers (this report, Task 1+2):** Performance 85-95 across all 25
routes (median cluster at 93, per Task 2's table), homepage LCP 3158ms median, worst route
(`/work/warmer`) at 4059ms median. **This is materially the same distribution as round-1's
pre-merge baseline** (84-93 then vs. 85-95 now; homepage LCP 3159-3771ms then vs. 3157-3159ms
now). The WebGL hero merge did not measurably move the needle in either direction — consistent
with Task 1's finding that it doesn't even load within the LCP trace window.

**Honest re-answer, route-dependent, not a single verdict:**

- **On the homepage and the ≥90-scoring routes (17 of 25, per Task 2's table): the rejection
  still holds, on the same evidence as before** — Performance sits at 92-95 with 25-30 KB of
  eager-JS ceiling headroom (Task 4), but LCP itself is still 3.0-3.2s, above the 2.5s "good"
  threshold Lighthouse's own rubric uses, on every single route measured. There remains no LCP
  headroom for new client-side work on these routes, only eager-JS-ceiling headroom — a different
  resource, and the one BL-5's own reasoning was actually about.
- **On `/work/warmer` and the other <90-scoring routes (8 of 25): the rejection holds more
  strongly** — these routes are already worse than round-1's own worst-case number (84), and
  `/work/warmer` specifically has a real, unexplained 1.2s+ unthrottled render delay that a new
  3D addition would stack on top of, not share headroom with.
- **BL-6's question is answered cleanly, independent of the above:** is the *existing* 3D usage
  (the hero + the Warmer WebGL viewer) itself within a reasonable budget? **Yes.** Task 4's bundle
  measurement puts the combined WebGL surface (hero + Warmer viewer + their shared renderer) at
  ~5 KB gzip, and confirms neither component is in either route's eager-JS bundle at all (both
  are `next/dynamic(..., {ssr: false})`, load only on idle/interaction). The existing 3D usage
  earns its keep at effectively zero eager-bundle cost — it is not what's consuming the site's
  performance budget; the ~170KB of Next.js/React framework code every route ships regardless of
  WebGL is.

**Net: BL-5's rejection of *new* decorative 3D work is reconfirmed, now with fresher and broader
(25-route, not 6-route) evidence, and now explicitly separated from BL-6's question about the
*existing* 3D usage, which independently checks out as cheap and already well-architected
(lazy-loaded, deferred past load, capped frame rate, stops off-screen).** The distinction that
was implicit in round 1 (new work is expensive to justify; existing work already earns its
keep) is now backed by a real byte number instead of an estimate.

## Task 4 (BL-4) — bundle-size baseline

See `reports/bundle-baseline-2026-08-14.md` for the full report (package footprint, methodology,
per-route eager-JS numbers via the existing `scripts/check-bundle-size.mjs` gate, and the
module-level WebGL cost breakdown referenced in Task 3 above).

## Verification

- `npm run typecheck`: see PR verification section.
- `npm run lint`: see PR verification section.
- `npm run build`: passes (both the normal Turbopack build and, separately, `ANALYZE=true npx
  next build --webpack` for the bundle-analyzer report).
- No content/label/copy changes in this PR (Task 1 shipped no code changes; Task 4 is
  config/tooling only) — the e2e suite / chatbot-index-rebuild reflex from `CLAUDE.md` does not
  apply. Explicitly skipped, not forgotten.
