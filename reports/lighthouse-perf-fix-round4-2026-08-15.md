# PR-94 "perf" round 4 — same-surface PSI comparison setup, forced-reflow diagnosis, Speed Insights beacon confirmation, LCP-element identification — 2026-08-15

Follow-up to `reports/lighthouse-perf-fix-round3-2026-08-15.md` (round 3). This round's own trigger
was invalid data: GG ran PSI mobile once against this PR's Vercel **preview** deployment (Perf 87,
LCP 3.6s) and compared it to a **production** baseline measured hours earlier (Perf 91, LCP 2.9s).
That comparison mixes two different surfaces (preview vs. production have different
caching/edge/deployment-protection behavior) and is each a single PSI run (this branch's own prior
reports already document PSI LCP swinging ±0.5s run-to-run). **Task 1 below sets up the
same-surface, median-of-3 comparison this needs — it does not itself produce a verdict.**

## Task 1 — same-surface comparison for GG to run

Two Vercel **Preview**-target deployments, same project, same edge/caching class:

- **This PR's current tip:** `https://gaurav-gandhi-git-fix-perf-gaurav-gandhi-2411s-projects.vercel.app`
  — the branch alias `gh pr view 94 --json url` / the PR's own Vercel check resolve to; it updates
  automatically to whatever this branch's latest commit is, so it is already correct for the
  commits this round adds (re-verified after push, see Verification below).
- **`origin/main` baseline (`2938df2`), same Preview target:** no existing Preview-target
  deployment of `main` was found in this project's deployment history — every historical
  deployment of `main` (`vercel list gaurav-gandhi --json`, filtered by `meta.githubCommitRef ==
  "main"`) has `target: production`, because this project's Vercel GitHub integration deploys the
  production branch straight to Production, never Preview. So a new one was triggered from a
  detached worktree of `origin/main` (`git worktree add --detach <tmp> origin/main`, `vercel link`,
  `vercel deploy` — no `--prod` flag, a local Preview/staging deploy, which rule 31a explicitly
  permits; the temporary worktree was removed immediately after):
  `https://gaurav-gandhi-pczycf1eg-gaurav-gandhi-2411s-projects.vercel.app` (commit `2938d203`,
  `target: null` = Preview, confirmed via `vercel inspect`). Both URLs return `200` with no
  deployment-protection redirect (`curl -o /dev/null -w "%{http_code}"`, both `200`).

**Steps for GG:**
1. pagespeed.web.dev → paste `https://gaurav-gandhi-pczycf1eg-gaurav-gandhi-2411s-projects.vercel.app`
   → Mobile → Analyze. Repeat 2 more times (3 total). Record Perf/LCP/SI/TBT/CLS each run, take the
   median of each metric across the 3.
2. Same 3x-and-median for `https://gaurav-gandhi-git-fix-perf-gaurav-gandhi-2411s-projects.vercel.app`.
3. Compare the two medians — that delta is the real, same-surface signal this PR's gate needs, not
   the invalid preview-vs-production number that triggered this round.

## Task 2 — forced reflow diagnosis

**Correct audit ID first:** Lighthouse 13.4.1 renamed this audit `forced-reflow-insight` (not
`forced-reflow`, which doesn't exist and silently returns an empty `audits` object under
`--only-audits` — caught before trusting a false-empty result).

**Named hypothesis (the boot-loader's pre-paint inline `<script>` in `app/layout.tsx`) — checked
directly and refuted.** Read the script's full source (it's inline, trivially readable): it calls
`matchMedia()`, reads/writes `document.documentElement.dataset`, and calls
`document.addEventListener`/`setTimeout`/`getElementById`/`.remove()`. None of `offsetWidth`,
`offsetHeight`, `getBoundingClientRect`, `scrollHeight`, `scrollWidth`, `clientWidth`/`clientHeight`,
or `getComputedStyle` appear anywhere in it. This script cannot be a forced-reflow source — it
never reads a geometric property at all.

**Real candidate found by code search, not guessing:** grepped the whole app for the actual
layout-reading APIs the audit's own description names. Two hits outside test/e2e files, both the
same shape:

- `components/hero/embedding-cloud-gl.tsx:122-128` (homepage hero's WebGL layer)
- `components/warmer/embedding-viewer-gl.tsx:141-147` (`/work/warmer`'s WebGL layer — same
  pattern, a sibling per rule 85, fixed alongside even though `/work/warmer` isn't the LCP route
  under investigation)

Both had a `sizeToBox()` function that reads `canvas.getBoundingClientRect()`, then called it
**eagerly and synchronously** right after mount, immediately after `EmbeddingCloud`/`EmbeddingViewer`
swap the SSR'd static SVG/image for the `<canvas>` element (a DOM structural change that invalidates
style/layout) — a textbook match for the audit's own description: "JavaScript queries geometric
properties... after styles have been invalidated by a change to the DOM state."

**Fix:** removed the eager `sizeToBox();` call in both files. `ResizeObserver.observe(canvas)`
(already present, already using the same `sizeToBox` as its callback) delivers one initial callback
with the target's current box shortly after observation starts, by spec timed to land after layout
is already fresh — that is the entire reason `ResizeObserver` exists over a raw
`getBoundingClientRect()` poll. The eager call was both forced and redundant. No behavior change:
canvas CSS sizing (`h-full w-full`) is controlled by CSS regardless of the JS resize call, which
only sets the internal WebGL drawing-buffer size and re-renders one frame — a one-frame delay
before the first GL frame renders is imperceptible on an already-slow-motion (~5 min/revolution),
`aria-hidden`, "no lift" ambient background layer.

**Verified NOT the (or not the only) source, honestly:** re-ran `forced-reflow-insight`
(devtools-throttled, production build) 3x after the fix. Score stayed 0 (failing) every run, and
the reported total (`323ms` / `487ms` / `330ms`, all bucketed `[unattributed]`) did not improve
versus the pre-fix baseline (`312ms`, one run) or `forced-reflow-devtools.json`'s separate pre-fix
run (also `[unattributed]`, comparable magnitude) — see `reports/forced-reflow-round4-before-*.json`
and `-after{1,2,3}-*.json`. **Differential test to rule out the app-code hypotheses entirely:** ran
the same audit against `/projects` — a route with neither the boot-loader nor any WebGL canvas —
and got the same `[unattributed]` signature (`199ms`,
`reports/forced-reflow-round4-projects-devtools-2026-08-15.json`). A signal present on a route with
neither flagged mechanism cannot be caused by either; grepped `chat-launcher.tsx`/`site-nav.tsx`
(the two components common to every route) for the same layout-reading APIs and found none either.

**Honest conclusion, not forced into a code fix:** the fix removes a real, code-verified,
textbook-shaped forced reflow (kept — it's correct regardless of whether it moves this aggregate),
but the dominant `[unattributed]` bucket is not attributable to any app code found via the tooling
available here. Manually reconstructed the trace's own forced-reflow detection algorithm
(`node_modules/@paulirish/trace_engine/.../WarningsHandler.js`'s exact nesting-stack logic: a
`Layout`/`UpdateLayoutTree` event is "forced" only while a JS-invocation event is on the ancestor
stack, summed per task, warned past a 30ms threshold) directly against the raw trace
(`--save-assets`, 188,967 events) to find real call frames — it independently found only ~5.8ms
attributable to a JS-nested reflow (inside the Next.js/React framework runtime chunk
`08ttfj81-47mu.js`, the same chunk round 3's A3/A4 already named as framework-internal), nowhere
near the 300-490ms Lighthouse's own insight reports. This gap between my reconstruction and the
tool's own number, plus the tool's own `[unattributed]` label (meaning even its trace engine found
no call frame — `Extras.StackTraceForEvent`/`getStackTraceTopCallFrameInEventPayload` both came
back null), is most consistent with V8's sampling CPU profiler losing stack resolution under heavy
CPU throttling (a known class of gap, not specific to this app) rather than an app-code bug this
round's tooling can pin down further. Named plainly as a genuine attribution gap in the audit's own
reach (this repo's own `CHECKS.md` theme) rather than claimed as fixed or hidden as unfixable
without evidence.

## Task 3 — Speed Insights beacon: cost measured, confirmed non-blocking

Round 3 (A6) confirmed the script loads (200 OK, obfuscated per-deployment path) but could not
observe transfer size, main-thread cost, or ordering relative to LCP. This round measured all
three directly against the PR's live preview deployment (Playwright + real CDP sessions — the
same class of gap round 3 flagged in Playwright-vs-real-traffic terms doesn't apply here since
this only needs the script's own load behavior, not a beacon send).

**Identified which obfuscated script is which** (previously assumed, not confirmed): fetched both
response bodies via `Network.getResponseBody` and grepped content —
`/992947c737dafc12/script.js` contains Speed Insights markers (`speed-insights`/`vitals`
patterns), `/b2a92c9df2ebb355/script.js` contains Analytics markers (`window.va`-style patterns).

**Cost, under a real (not assumed) approximation of PSI's mobile throttle** (CDP
`Emulation.setCPUThrottlingRate(4)` + `Network.emulateNetworkConditions` at ~Slow-4G-class
latency/throughput):
- Transfer size: Speed Insights **~4.9-5.0 KiB** (`transferSize` 5046/5027 bytes across 2 runs),
  Analytics **~1.6 KiB** (1600 bytes).
- Main-thread self time (CDP `Profiler`, 100μs sampling interval, summed self-time across all
  profile nodes attributed to each script's URL): Speed Insights **0.60ms**, Analytics **0.20ms** —
  both negligible relative to this app's ~2.5-2.6s total main-thread work (round 3's A4).
- **Loads after LCP, confirmed on the same navigationStart-relative clock** (`performance.mark`
  Resource Timing vs. the buffered `largest-contentful-paint` PerformanceObserver entry, not two
  different clocks): across 2 throttled runs, LCP landed at 1488ms/1788ms while the Speed Insights
  script's network request didn't even *start* until 2804ms/2833ms — roughly 1.0-1.3s after LCP,
  both runs, consistently.
- `<script>` tag confirmed `async: true, defer: true` in the live DOM for both, matching the
  package's documented injection behavior.

**Conclusion: genuine, measured non-issue.** Small transfer, negligible main-thread cost, and
starts loading over a second after LCP in both measured runs — Speed Insights is not a credible
contributor to this PR's LCP delta. `app/layout.tsx`'s `<SpeedInsights />` placement (client
component, root layout, no SSR-blocking behavior) is unchanged and reconfirmed correct.

## Task 4 — LCP element, identified definitively (not the rotating line)

Round 3 and GG's own two PSI captures never pulled the actual LCP element from tooling — this round
did, via `largest-contentful-paint-element` (which no longer exists as its own audit ID in
Lighthouse 13.4.1 — consolidated into `lcp-breakdown-insight`'s own details, second list item,
`type: "node"`).

**Definitive result, consistent across 3 separate devtools-throttled runs
(`reports/lcp-breakdown-round4-home-devtools-{2026-08-15,run2,run3}.json`):**

```
selector: div > main#main > header.relative > h1.font-heading
nodeLabel: "I build AI products and see them through — from first experiment to real users."
```

**This is the hero `<h1>` headline, not the "Currently building: X" rotating line.** The
hypothesis is refuted with direct tool evidence, not argued away — `grep`'d the codebase for
"Currently building" (`components/sections/hero.tsx`) to confirm that text exists and is a
different, separate element from the `<h1>`, so the two were never at risk of being confused by
selector alone. **No fix applied for this task** — reserving a fixed box for the rotating line
would be solving a problem this app doesn't have; the LCP element's paint geometry does not depend
on that line's content length at all.

Same `lcp-breakdown-insight` runs also reconfirm round 2's finding: `elementRenderDelay` (2196ms)
dominates over `timeToFirstByte` (9.6ms) by two orders of magnitude — the LCP cost here is
render-delay-bound (hydration/paint timing), not network-bound, consistent with every prior round.

## Task 5 — legacy JS / unused JS: still unresolved, no new attempt

Per the task brief's own instruction not to re-litigate a settled negative result: round 3
(`reports/lighthouse-perf-fix-round3-2026-08-15.md`, its own A3/A4) already re-tested the
`browserslist` lever a third time (wave 3, wave 4, round 3 — all three under measured,
diffed-every-chunk conditions) and got a **zero-byte** change each time; unused JS traces 100% to
the same framework-internal runtime chunk with no cheap deferral candidate found after auditing
`next/dynamic` coverage.

**Checked for anything genuinely new before restating the negative, per rule 101c:** confirmed the
Next.js version is unchanged since round 3's test (`node -e "require('next/package.json').version"`
→ `16.3.0`, identical) — no new toolchain state to justify a 4th browserslist attempt. No new
hypothesis surfaced in a short review. **Status restated plainly, not re-attempted:** legacy JS
(13,771 wasted bytes, framework polyfill/feature-detection layer) and unused JS (24.9 KiB, same
`08ttfj81-47mu.js` chunk) remain unresolved, framework-internal, with no lever available in this
app's own config — matches round 3's own conclusion exactly, restated rather than silently dropped.

## Verification

- `npm run typecheck` — clean.
- `npm run lint` — 0 errors (1 pre-existing warning in `scripts/build_resume.mjs`, untouched, same
  as every prior round).
- `npm run build` — clean (Turbopack), 2 times this round.
- `npx playwright test` — **248 passed, 2 skipped** (pre-existing capability-gated skips), 0
  failed — full suite, run because this round's fix touches `components/hero/embedding-cloud-gl.tsx`
  and `components/warmer/embedding-viewer-gl.tsx`'s mount-time rendered behavior.
- `non-composited-animations` — still `notApplicable` (0 found) after this round's changes; round
  3's fix did not regress (`reports/non-composited-animations-round4-regression-check-2026-08-15.json`).
- `forced-reflow-insight` — before `312ms`/`323-487ms` after, both `[unattributed]`, not measurably
  improved (Task 2's honest conclusion: fix is real but not the dominant contributor).
- Local devtools-throttled Lighthouse, pinned script, n=3, `/`, current HEAD (supporting evidence
  only — **not a replacement for the real PSI gate**, and not a strict before/after given host
  contention risk this session didn't control for via interleaving): performance 83.67±4.73, LCP
  2228ms±32ms, Speed Index 2865ms±129ms, TBT 356ms±34ms
  (`reports/lighthouse-fix-perf-round4-supporting-home-devtools-2026-08-15.summary.json`).
- Chatbot index — not rebuilt; no `content/**` label/copy change this round (explicitly checked,
  `git diff --stat` shows only the two `.tsx` files under `components/`).

**PSI mobile confirmation against the two same-surface preview URLs from Task 1 is still required
from a human before this PR's gate can be called satisfied — nothing in this report is that
number.**
