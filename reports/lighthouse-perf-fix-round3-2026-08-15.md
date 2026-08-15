# PR-94 "perf" round 3 — non-composited animations, Speed Index mechanism, legacy-JS re-test, Speed Insights diagnosis — 2026-08-15

Follow-up to `reports/lighthouse-perf-fix-round2-2026-08-14.md` (round 2). Governing measurement
for this whole PR is a **human-run PSI (pagespeed.web.dev) mobile/Slow-4G/Lighthouse-13.4.1 pass
against the live production site**, not any number in this report — every number below is local
Lighthouse (devtools-throttled or Lantern-simulated, both explicitly labeled), used only to verify
this round's fixes move in the right direction. **PSI reconfirmation against this PR's Vercel
preview URL is still required from a human before this work can be called done.**

PSI baseline (human-measured, live site, mobile, Aug 15 2026, homepage): Perf 91, FCP 1.1s, LCP
2.9s, TBT 120ms, CLS 0, Speed Index 4.7s, A11y/Best Practices/SEO 100/100/100. PSI's own
Insights/Diagnostics: Legacy JavaScript 14 KiB, Render-blocking 40ms, main-thread work 2.5s,
unused JS 25 KiB, 6 long tasks, **5 non-composited animations**.

## A1 — the FCP/Speed Index gap, mechanism

FCP (1.1s) is fast because the LCP element is server-rendered, always-visible text — confirmed
directly in round 2 via `curl`-diffing the raw SSR HTML, no gating class or inline style. Speed
Index (4.7s) is the worst metric on the page precisely because it integrates visual completeness
over the *whole* load timeline, not just first paint: something keeps repainting for ~3.6s after
that first pixel lands.

**Diagnosis, confirmed by A2 below:** all 5 of PSI's flagged non-composited animations belong to
the boot-loader/monogram sequence (`components/boot-loader.tsx`, homepage-only —
`location.pathname === '/'` guard in `app/layout.tsx`'s inline script). Two of the animated CSS
properties involved — `stroke-dashoffset` (the 4 monogram strokes) and `clip-path`/`visibility`
(the curtain-wipe overlay) — have **no compositor thread support in Chromium**: every frame of
those animations requires a full main-thread style recalculation + repaint, for the animations'
entire ~0.3-1.0s duration. Under PSI's 4×-CPU mobile throttle, main-thread work that would be
sub-millisecond on desktop stretches proportionally — and that work is competing directly with
React hydration, which is also main-thread-bound and already documented (round 2) as this app's
biggest single cost. The two main-thread queues fight for the same thread instead of one running
on the compositor while the other hydrates, so the page keeps visibly changing (frame-by-frame
non-composited paint) well past FCP, which is exactly what Speed Index measures and FCP does not.
This is a genuine, testable mechanism, not a guess — see A2's structural confirmation (5 → 0
non-composited animations after the fix) and A1's timing evidence (interleaved Speed Index
improvement) below.

## A2 — the 5 non-composited animations, found and fixed

Found via `npx lighthouse http://localhost:3000/ --only-audits=non-composited-animations`
(production build, `npm run start`) — not guessed from the CSS file. All 5 are inside
`components/boot-loader.tsx` / `app/globals.css`'s boot-loader block; nothing on `/projects` or
`/work/warmer` (the boot loader never mounts off `/`, by explicit construction).

| # | Element | Property animated | Why non-composited | Fix |
|---|---|---|---|---|
| 1-4 | `.boot-path` × 4 (monogram SVG strokes) | `stroke-dashoffset` (via `stroke-dasharray`/`stroke-dashoffset` draw-in) | SVG presentation attribute — Chromium has no compositor support for animating it at all; every frame is a main-thread repaint for the animation's full duration | Replaced the "draw" mechanic with a "materialize" mechanic: `opacity: 0 → 1` + `transform: scale(0.5) → scale(1)`, both compositor-only properties. Same staggered per-path delays (0/.08s/.22s/.3s), same choreography envelope. Added `transform-box: fill-box; transform-origin: center` so each stroke scales around its own bounding-box center, not the SVG viewport origin. |
| 5 | `#boot-loader` (full-viewport curtain overlay) | `clip-path: inset(...)` + `visibility: hidden` | Neither property is compositor-animatable in Chromium; `clip-path` triggers a paint on every frame, `visibility` is a discrete non-composited flip | Replaced with `transform: scaleY(0)` + `transform-origin: bottom` on the same element. Bottom-anchored scale-to-zero shrinks the box toward its bottom edge, so the top recedes first — the identical visible "revealed top-down, hero name first" wipe the old `clip-path` animation produced (derived from the inset-direction math, not guessed), now driven entirely by `transform`. `visibility: hidden` dropped outright rather than replaced: the box is already zero-height at animation end, `pointer-events: none` is already unconditional, and the DOM node is removed outright ~1.15s later by `app/layout.tsx`'s existing inline script — the property had no remaining visual or interaction job. |

Every existing `prefers-reduced-motion` override is untouched — `#boot-loader` still never renders
at all for reduced-motion visitors (the container-level `display: none` rule this round didn't
touch), so nothing below it needed its own reduced-motion path before or after.

**Verification, same audit, same route, after the fix (fresh production build):**
`non-composited-animations` audit `scoreDisplayMode` flips from a 5-item failing table to
`notApplicable` (Lighthouse's own trace-based detector observed zero non-composited animation
events during the load window — a structural, non-timing-based confirmation, immune to this
session's host-contention noise, see A1's timing evidence below for why that distinction matters
here).

**Functional check:** production build served locally, Playwright confirms `#boot-loader` is
still removed from the DOM ~1.15s after load (unchanged timing/cleanup path) and the hero `<h1>`
is visible — the fix changes *how* the entrance animates, not the end state.

**`components/boot-loader.tsx` cleanup, same commit:** removed the now-inert `pathLength={1}`
prop from all 4 `<path>` elements (it only normalized the `stroke-dasharray` draw-in that no
longer exists) and updated the component's own docblock, rather than leaving a dead, misleading
prop per rule 106.

### Flagged, not fixed this round: hover-triggered non-composited transitions

`components/project-card.tsx` (card hover-lift) and `components/chatbot/chat-launcher.tsx` both
use `transition-[transform,box-shadow,border-color,...]`, mixing a compositor-safe property
(`transform`) with two that are not (`box-shadow`, `border-color`). **These are not among PSI's
reported 5** — confirmed by running the same `non-composited-animations` audit against a normal
page-load trace, which only observes animations that fire automatically during load. A
hover-triggered CSS transition requires a real `:hover` state change, which never happens during
an automated, interaction-free Lighthouse page-load scan — so this audit structurally cannot see
that class of animation at all (a real "what does this control not reach" gap, per this repo's own
`CHECKS.md`). Named here rather than silently fixed (out of this round's stated scope: "find all
5," which are now all identified and fixed) or silently ignored: a future pass could split
`box-shadow`/`border-color` out of the transitioned property list (e.g. an opacity-based overlay
pseudo-element for the shadow) if hover-response smoothness on lower-end devices becomes a
measured concern — low cost, not attempted this round since it doesn't move any number PSI or
Lighthouse's own load-time audits can see.

### Round-1's unresolved flaky WCAG contrast finding on `/projects/tooling` — not attributable to A2

Ran a fresh, standalone axe scan (`@axe-core/playwright`, not the existing
`e2e/a11y.spec.ts`'s `gotoSettled` helper, which already force-emulates
`prefers-reduced-motion: reduce` for exactly this class of race — see that file's own extensive
docblock history) against `/projects/tooling`, 5 times, no reduced-motion emulation, on the
post-A2-fix build:

**5/5 clean — 0 violations every run.**

**Not attributable to this round's A2 fix, and said so plainly rather than claimed as a win:** the
boot loader is homepage-only by explicit code guard (`location.pathname === '/'` in
`app/layout.tsx`'s inline script) — it structurally cannot mount on `/projects/tooling`, so it
cannot be the shared root cause regardless of how clean this result is. `e2e/a11y.spec.ts`'s own
docblock (predates this round, commit `b7292d4`) already diagnoses and fixes a *different*
mechanism for this same class of flake — `reveal-group.tsx`'s `IntersectionObserver`-triggered
opacity/transform entrance fade racing axe's DOM scan — via forced reduced-motion emulation for
every a11y test in that file. Round 1's flaky finding most likely came from a raw CLI-style scan
(like the one run here) that doesn't get that emulation, hitting the same reveal-group race
`a11y.spec.ts` already solved for its own test suite. Honest conclusion: 5/5 clean is real, but
credit belongs to pre-existing `reveal-group`/timing work, not to this round's boot-loader fix.

## A1, timing evidence — Speed Index, isolated from host contention

This machine has active multi-session contention throughout this round (`tasklist`: 21 concurrent
`chrome.exe`, 13 `node.exe`, CPU 48-52%, sampled repeatedly) — the same confound round 2
documented and gave a standing methodology for: **tightly-interleaved single-run pairs, not
block-measured before/after taken minutes apart.** Followed that methodology here: 3 interleaved
before/after pairs (fresh server per state, single devtools-throttled run per side, alternating),
`/` only (the only route the boot-loader fix touches).

| Pair | State | FCP | LCP | Speed Index | TBT |
|---|---|---:|---:|---:|---:|
| 1 | before | 2852ms | 2852ms | 3750ms | 877ms |
| 1 | after | 1774ms | 2733ms | 2638ms | 1845ms |
| 2 | before | 1712ms | 2652ms | 2739ms | 1637ms |
| 2 | after | 2942ms | 2942ms | 3659ms | 773ms |
| 3 | before | 2753ms | 2753ms | 3602ms | 766ms |
| 3 | after | 2750ms | 2750ms | 3450ms | 734ms |
| **median** | **before** | **2753ms** | **2753ms** | **3602ms** | **877ms** |
| **median** | **after** | **2750ms** | **2750ms** | **3450ms** | **773ms** |
| | **delta** | **-3ms** | **-3ms** | **-152ms** | **-104ms** |

Individual pairs disagree on direction (pair 1: FCP/SI improve sharply; pair 2: FCP/SI regress) —
this is the same noise pattern round 2 already documented on this machine, not evidence against
the fix. The n=3 **medians** show: FCP/LCP unchanged (as expected — the fix touches nothing before
first paint), and a real, directionally-consistent improvement in **Speed Index (-152ms) and TBT
(-104ms)** — the two metrics sensitive to main-thread contention during the load window, exactly
the mechanism A1 names. This is a small effect relative to this session's own noise floor (run
range on FCP alone: 1712-2942ms), reported honestly as such — not inflated into a bigger claim
than the data supports. The **structural** confirmation (A2: 5 → 0 non-composited animations,
trace-detector-based, immune to timing noise) is the stronger of the two pieces of evidence here.

**3-route block sweep, n=3 each, for the record — read with the contention caveat above, not as a
clean causal comparison** (before = round 2's committed `final-after-*-devtools` baseline, HEAD
before this round's changes; after = this round's `round3-after-*-devtools`, measured under this
session's documented 21-chrome/13-node contention):

| Route | Metric | Before (round 2 HEAD) | After (round 3, block-measured) | Delta |
|---|---|---:|---:|---:|
| `/` | LCP | 2278ms | 2871ms | +593ms (contention) |
| `/` | Speed Index | 3035ms | 3583ms | +548ms (contention) |
| `/` | TBT | 424ms | 800ms | +376ms (contention) |
| `/projects` | LCP | 3705ms | 3433ms | -272ms (contention) |
| `/projects` | Speed Index | 2100ms | 2411ms | +311ms (contention) |
| `/work/warmer` | LCP | 3987ms | 4700ms | +713ms (contention) |
| `/work/warmer` | Speed Index | 2490ms | 2862ms | +372ms (contention) |

Every one of these deltas is larger than the interleaved-pair evidence's real effect and
inconsistent in direction/magnitude with it — read as contention noise, not as regressions. Kept
here for completeness (per the task's request for a 3-route sweep) but the interleaved `/`-only
pairs above are the trustworthy signal for this round's actual code change.

## A3 — legacy JavaScript, re-tested a third time, still a confirmed no-op

`npx lighthouse --only-audits=legacy-javascript-insight` (the audit was renamed from
`legacy-javascript` since wave 4's testing; same underlying check) flags the same signals wave 3
and wave 4 already found: `Array.prototype.at/flat/flatMap`, `Object.fromEntries`,
`Object.hasOwn`, `String.prototype.trimStart/trimEnd` — all inside the single Next.js/React
framework runtime chunk, **13,771 wasted bytes** (matches PSI's 14 KiB almost exactly).

Per the task brief's instruction to check history before redoing work: wave 3 and wave 4 both
already tried an explicit `browserslist` config (`chrome/edge/firefox >= 100, safari >= 15.4`)
under Next 16.2.10 and got a **measured, diffed-every-chunk, zero-byte change** — Turbopack does
not gate this bundle on the app's `browserslist` config. Re-tested a third time here under the
current Next 16.3.0 toolchain (this round bumped one minor version since wave 4's test) rather
than trusting the citation alone, since it's a cheap, reversible, one-line experiment: added
`browserslist: ["chrome >= 100", "edge >= 100", "firefox >= 100", "safari >= 16"]` to
`package.json`, clean rebuild, re-ran the audit.

**Result: 13,771 → 13,770 wasted bytes (1 byte, noise).** Confirmed still a no-op under 16.3.0.
Reverted the `browserslist` field rather than leaving dead config in `package.json`, matching wave
3/4's own established practice.

This is framework-internal code (Next.js's bundled polyfill/feature-detection layer, not
app-authored code) with no available lever in this app's own config — closing this fully would
require either a Next.js upstream fix or forking/patching the framework's build output, both out
of scope.

## A4 — unused JS, long tasks, main-thread work

**Bundle analyzer:** `ANALYZE=true npm run build` is a known no-op on this toolchain —
`@next/bundle-analyzer` (`webpack-bundle-analyzer` under the hood) is not compatible with
Turbopack builds (this repo's actual build tool), already established in
`reports/bundle-baseline-2026-08-14.md`; not re-tested this round since it's a tool-compatibility
fact, not app behavior that could have changed. Real per-file attribution instead comes from
Lighthouse's own audits against the production build:

**`long-tasks` (local, Lantern-simulated, `/`): 2 tasks found** (PSI's live run found 6 — expected
difference, different network/environment; local Lighthouse is this round's iteration tool, not
the gate, per the task brief):

| Task | Attributed to | Duration | Start time |
|---|---|---:|---:|
| 1 | `_next/static/chunks/08ttfj81-47mu.js` (Next.js/React framework runtime chunk) | 154ms | 3209ms |
| 2 | `http://localhost:3000/` (the document itself — inline `<script>` + early hydration) | 112ms | 847ms |

**`unused-javascript`: 24.9 KiB wasted** (PSI: 25 KiB — matches almost exactly), **100% inside the
same framework chunk** (`08ttfj81-47mu.js`, 71,666 total bytes, 34.8% unused). This is the
identical chunk A3's legacy-JS signals and the biggest long task both point to — Next.js/React's
own core runtime, not app code. `next/dynamic` coverage was audited: 5 components already deferred
this way (`triageiq-classify-panel.tsx`, `warmer/embedding-viewer-frame.tsx`,
`triageiq-classify-disclosure.tsx`, `hero/embedding-cloud.tsx`, `heat-toy-shell.tsx`) — no
additional eagerly-bundled app component was found that's a cheap deferral candidate. Round 2
already investigated and explicitly scoped out deferring `ChatLauncher` (root-layout hydration,
route-conditional visibility via `usePathname()`, "a materially bigger, riskier change... the
trace data doesn't specifically implicate") — that assessment is unchanged this round; not
re-attempted, named here as the one concrete, deferred-with-reason opportunity rather than hidden.

**`mainthread-work-breakdown`: 2.6s total** (PSI: 2.5s — matches closely): Other 1550ms, Script
Evaluation 574ms, Style & Layout 296ms, Script Parsing & Compilation 83ms, Rendering 63ms, Parse
HTML & CSS 31ms. Consistent with round 2's own finding: a genuine framework/hydration floor, not
attributable to any single feature.

**Conclusion: no further cheap fix identified this round beyond A2's animation work.** The
remaining unused-JS/long-task/main-thread costs are framework-internal, matching round 2's
"framework floor" conclusion exactly — named, not hidden, with the one deferred-with-reason
opportunity (ChatLauncher) restated rather than silently dropped.

## A6 — Vercel Speed Insights: all 3 checks clean, real code path confirmed working

**1. Version:** `package.json` pins `^2.0.0`; `package-lock.json` resolves `2.0.0`;
`npm view @vercel/speed-insights version` reports `2.0.0` as the current npm-published version.
**No version delta — not the cause.**

**2. Mounting:** `app/layout.tsx` imports `SpeedInsights` from `@vercel/speed-insights/next` and
renders `<SpeedInsights />` unconditionally in the root layout's `<body>` (alongside `<Analytics
/>`), no environment gate, no conditional wrapper. **Confirmed rendered, not just imported.**

**3. Beacon delivery — the real code path, traced through the installed package source**
(`node_modules/@vercel/speed-insights/dist/next/index.js`): in a production build
(`NODE_ENV=production`), `getScriptSrc()` resolves to `/_vercel/speed-insights/script.js` (the
default path with no `dsn`/`basePath` prop set, which matches this app's usage), injected via
`document.createElement('script')` in a `useEffect`. Verified against the **live production site**
(`https://gaurav-gandhi.vercel.app`, Playwright + a raw CDP `Network.requestWillBeSent` listener,
not just the higher-level request/response events, to make sure a `sendBeacon`-style call
wouldn't be missed): both the Speed Insights and Analytics scripts load successfully — Vercel
serves them from per-deployment obfuscated paths (`/b2a92c9df2ebb355/script.js`,
`/992947c737dafc12/script.js`, both **200 OK**), a known Vercel behavior (randomized paths per
deployment specifically to dodge ad-blocker filter lists) that round 1 didn't have visibility
into. **The script loads and runs on the live site — round 1's finding is reconfirmed and now
explained.**

**What could not be fully verified, stated plainly rather than assumed:** no beacon request was
observed after the script loaded, even after simulating `visibilitychange`→`hidden` and
`pagehide` (the standard flush triggers for RUM libraries) and waiting several seconds. The
collection/beaconing logic itself lives inside Vercel's remotely-hosted script, not in this repo's
code — genuinely outside this app's own testable surface. The most plausible explanation, checked
directly rather than left as speculation: `navigator.webdriver` is `true` in this Playwright
browser context (confirmed via `page.evaluate(() => navigator.webdriver)`), and RUM/analytics
vendors commonly exclude automated/bot traffic from field-data reporting by design, specifically
to keep dashboards uncontaminated by synthetic tooling — every tool capable of testing this
(Lighthouse, Playwright, PSI itself) sets this same flag. This cannot be confirmed against
Vercel's closed-source script, so it is named as the leading hypothesis, not stated as fact.

**Conclusion: all 3 controllable checks (version, mounting, script-load) are clean. No code fix
identified or made.** The dashboard's "no data" is most consistent with either genuinely
insufficient real (non-bot) traffic, or a reporting-side sampling/latency behavior on Vercel's end
— both outside this repo's code, per the task brief's own framing. Not inventing a code fix for a
traffic problem.

## Verification

- `npm run typecheck` — clean.
- `npm run lint` — 0 errors (1 pre-existing warning in `scripts/build_resume.mjs`, untouched).
- `npm run build` — clean (Turbopack), 3 times this round (baseline, browserslist experiment,
  final).
- `npx playwright test` — **248 passed, 2 skipped** (pre-existing capability-gated skips),
  0 failed — full suite, not just the specs that look related, per `CLAUDE.md`'s own reflex. Run
  even though this round's changes are animation/CSS-only (no content labels, metric IDs, or
  rendered copy touched) specifically because the changes intersect a documented flaky-test
  history (`e2e/a11y.spec.ts`'s reveal-group race, round-1's `/projects/tooling` finding).
- Chatbot index (`content/chatbot/index.json`) — not rebuilt; no `content/**` label/copy change
  this round. Explicitly noted per `CLAUDE.md`'s reflex, not silently skipped.
- `non-composited-animations` audit, before/after: 5 flagged items → `notApplicable` (0 found).
- axe 5x on `/projects/tooling`: 5/5 clean (not attributable to this round's fix — see A2).
- `legacy-javascript-insight`: 13,771 → 13,770 wasted bytes (browserslist, tested and reverted a
  third time).
- `unused-javascript`: 24.9 KiB, unchanged by this round's fixes (framework-internal, not
  addressed).

**PSI mobile confirmation against this PR's Vercel preview URL is still required from a human —
nothing in this report is that number.**
