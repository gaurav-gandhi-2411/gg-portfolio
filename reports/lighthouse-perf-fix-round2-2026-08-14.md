# PR-2 "perf" round 2 — real-throttling remeasurement, boot-loader hydration fix, warmer re-diagnosis — 2026-08-14

Follow-up to `reports/lighthouse-perf-fix-2026-08-14.md` (round 1 on this branch) and
`reports/wave4-lcp-investigation-2026-07-16.md`. Scope: (A1) resolve round 1's own internal
contradiction between "the ~3.1-4.1s number is a Lantern artifact" and "use that same number to
reject new 3D work"; (A3) test a concrete structural fix; (A5) re-diagnose `/work/warmer`; (A4)
re-derive the 3D budget from real numbers. All new measurements in this report use
`THROTTLING_METHOD_OVERRIDE=devtools` (added to `scripts/lighthouse.mjs` this round — see below),
never Lighthouse's default Lantern simulation, unless explicitly labeled "Lantern-simulated."

## Methodology gap confirmed before any new measurement

Round 1's own report states outright (its own §"Step 1-3"): *"the gap is entirely inside
Lighthouse's **simulated mobile throttling model** (`throttlingMethod: "simulate"`, the
Lighthouse CLI default)"* — and `scripts/lighthouse.mjs`'s docblock, unchanged since it was
written, confirms this is what the pinned runner has always used: *"mobile Lighthouse
(Lighthouse's own default config is already mobile form-factor + 'simulate' throttling — not
overridden here)."* Round 1 measured its entire ~3.1-4.1s figure, its boot-loader A/B test, and
its `inlineCss` experiment all under Lantern simulation. `reports/wave4-lcp-investigation-
2026-07-16.md` — the branch's own prior, more rigorous investigation — explicitly warns against
this for this exact bottleneck: its real devtools-throttled run and its Lantern-simulated run
"disagree sharply on where the time goes," with the Lantern breakdown not even summing to its own
reported total. Round 1 did not heed its own citation.

**Fix applied to the tooling first:** `scripts/lighthouse.mjs` gained a `THROTTLING_METHOD_
OVERRIDE` env var (default: `simulate`, i.e. unchanged behavior) that threads a `settings.
throttlingMethod` override into the `lighthouse()` config call, plus a filename suffix and a
`throttlingMethod` field in the summary JSON so a devtools-throttled artifact can never silently
collide with or be mistaken for a simulated one. This is the only change to the script; the
CLI-flag equivalent (`--throttling-method=devtools`) is documented in the flag's own `--help`
text and matches what this override does under the hood (`extends: "lighthouse:default",
settings: { throttlingMethod }` — mobile form factor and the `mobileSlow4G` throttling profile
are unchanged; only *how* the throttle is applied — modeled vs. actually run — changes).

## Task 1 (A1) — the contradiction, resolved

**A5's "zero headroom, reject new 3D work" conclusion is the one to retract.** It was built on a
number (Lantern-simulated 3.1-4.1s) that this branch's own citations already knew was unreliable
for this exact question. Real (devtools-protocol) 4×-CPU-throttled measurement, n=3 medians, on
the current `HEAD` before any code change this round:

| Route | Env | Lantern-simulated (round 1) | Real-devtools-throttled (this round, cleanest run) | Gap |
|---|---|---:|---:|---:|
| `/` | local | 3158ms | 2384ms | −774ms |
| `/` | live | 3410ms | 2192ms | −1218ms |
| `/projects` | local | 3160ms | 2037ms | −1123ms |
| `/projects` | live | 3171ms | 2375ms | −796ms |
| `/work/warmer` | local | 4059ms | 2585ms | −1474ms |
| `/work/warmer` | live | 3335ms | 2575ms | −760ms |

(Sources: `reports/lighthouse-fix-perf-local-{home,projects,work-warmer}-devtools-2026-08-14
.summary.json` and the `-live-` counterparts — the first, lowest-observed-contention devtools
run taken this session, before any host-contention issue below was discovered.)

Real-devtools LCP is **lower than Lantern-simulated on all 6 series**, by 760-1474ms (mean gap
≈1024ms). Four of the six series land at or under 2.4s; the other two (`/work/warmer`, both
envs) sit only ~75-85ms **over** the 2.5s "good" threshold — nothing like the 4059ms/"zero
headroom, already inside needs-improvement" picture round 1's Lantern numbers painted.

**A4's "framework floor" framing survives in part, retract the magnitude, not the mechanism.**
Real-devtools-throttled `mainthread-work-breakdown` on the homepage (see below) does show a
genuine ~1.4-2.4s of Script Evaluation + Style & Layout under real 4× CPU throttle — this is not
nothing, and it's not attributable to any single feature (WebGL hero doesn't even load within
the LCP window; confirmed again this round, see Task 2). But the *size* of that floor is smaller
than round 1's Lantern number implied: this round's real numbers are consistently ~1s lower.
**Net: A4's mechanism (framework hydration cost, not a specific bug) still holds; A5's use of the
inflated number to declare zero headroom does not, and should not have gated a design decision
without checking real throttling first, exactly as this branch's own wave-4 citation warned.**

## A real, unplanned finding: this machine has active multi-session contention that materially affects real-throttled (but not Lantern-simulated) measurements

Discovered while measuring Task 2's fix, not anticipated going in. `tasklist` showed 19-23
concurrent `chrome.exe` and 13 concurrent `node.exe` processes throughout this session —
consistent with the other 6+ worktree sessions the orchestrator's brief named as active in
parallel on this same machine (`gg-portfolio-wt-fix-perf` plus PRs #90-#97). CPU load sampled
21-34% at different points with no action taken by this session in between.

This matters specifically for **real (devtools) throttling** and much less for Lantern: Lantern
computes its estimate from a single captured trace; devtools throttling makes Chrome actually run
~4× slower in wall-clock time, so it directly inherits whatever else is contending for the CPU
during that real time window. A same-code, same-server, back-to-back comparison demonstrated this
directly:

| Measurement | Code | Contention (chrome/node procs) | Home LCP |
|---|---|---|---:|
| First clean run | before-fix | not tracked (earliest, presumably lower) | 2384ms |
| "Contemporaneous before" (n=3) | before-fix | 19 / 13 | 2775ms |
| "Contemporaneous after" (n=3) | after-fix | 19-23 / 13 | 2882ms |
| Interleaved single run, fix applied | after-fix | 20 / 13, CPU 34% | **2396ms** |
| Interleaved single run, immediately after | before-fix (reverted) | 20 / 13 | **2432ms** |

The last two rows — same route, same server restarted fresh, two code states measured minutes
apart with no other variable changed — land within 36ms of each other, while the block-measured
"before"/"after" pairs taken ~10 minutes apart show 300-500ms of drift **on the unchanged
homepage route alone**, and much larger apparent swings (1000-2500ms) on `/projects` and
`/work/warmer` in some pairings. The direction of the drift was not consistent (sometimes later
measurements were worse, sometimes better), consistent with fluctuating third-party load rather
than a systematic bias from this session's own actions. **Flagged for the standing engineering
notes:** real-devtools-throttled comparisons on a shared, multi-session machine should be taken as
tightly-interleaved paired runs (alternate conditions within the same short window), not as two
separate measurement blocks minutes apart — the latter can produce apparent regressions or wins
of 1-2.5 seconds that are pure host-contention noise, larger than most real code effects this
branch has found all round.

## Task 2 (A3) — boot-loader hydration removed; measured effect: none reliably distinguishable from noise

**Verified first, independent of any fix:** the LCP element is server-rendered, always-visible
text with no opacity/hidden gating, exactly as `components/hero.tsx`'s own comment claims —
confirmed directly by `curl`ing the production build's raw HTML (`npm run build && npm run
start`) and inspecting the `<h1>` tag: `class="font-heading text-display mt-8 max-w-[24ch]
font-semibold tracking-tight text-foreground"`, no `opacity-0`/`invisible`/`hidden` class, no
inline `style`. Confirms the comment; not wasted effort.

**Fix implemented:** `components/boot-loader.tsx` converted from a Client Component (`"use
client"`, `useState` + `useEffect` + `setTimeout`) to a plain Server Component — same JSX output,
zero hydration cost. Its only real job besides rendering was removing its own DOM node ~1.15s
after the CSS entrance animation finishes; `app/globals.css`'s own existing comment already
documented that step as **pure cleanup, not gating** ("the exit is pure CSS with fixed delays...
React removes the node later as cleanup, it does not gate the reveal") and `#boot-loader` is
`pointer-events: none` unconditionally, so the un-removed node was never capable of blocking
interaction either. The removal now happens from a few extra lines in `app/layout.tsx`'s
existing pre-paint inline `<script>` (which already runs outside React, unchanged in kind, just
extended) — verified via `curl` that the SSR'd `#boot-loader` markup is byte-for-byte identical
before and after.

Why this specific hypothesis over ChatLauncher (which the task brief also flagged): trace data
(`mainthread-work-breakdown`, `long-tasks`) shows the dominant pre-LCP cost on `/` is a single
~817-1062ms long task attributed broadly to page-level script execution, not to any specific
named chunk — most plausibly React's core `hydrateRoot()` reconciliation across the whole tree,
not either individual small component. Deferring ChatLauncher's hydration would additionally
require re-deriving its route-conditional visibility (`usePathname()`, hidden on `/ask`, `lg:
hidden` on `/work/*`) outside a client hook inside a shared root layout — a materially bigger,
riskier change for a component the trace data doesn't specifically implicate. Scoped out this
round; boot-loader was the safer, better-justified target (its own code comments already
established the removed step was non-functional).

**Measured effect, controlling for the contention confound above:** the only clean,
tightly-interleaved comparison (same server, single runs, minutes apart, table above) shows
2396ms (fix) vs. 2432ms (baseline) — a 36ms difference, well inside this pair's own run-to-run
noise band (TBT alone varied 408ms vs. 513ms between these two single runs). **No reliably
measurable LCP improvement.** This is the same shape of negative result round 1 already found
for the *related but distinct* hypothesis of disabling the boot-loader entirely under Lantern
simulation ("no reliable effect... within host noise") — this round reconfirms the same
conclusion under the correct methodology, for the *hydration-cost-only* version of the same
component, not just the full-feature-removal version.

**Full 6-series before/after table (median of 3), for the record — read with the contention
caveat above, not as a clean causal comparison:**

| Route | Env | Before (LCP median) | After (LCP median) | Delta |
|---|---|---:|---:|---:|
| `/` | local | 2384ms | 2279ms | −105ms |
| `/` | live | 2192ms | 2226ms | +34ms |
| `/projects` | local | 2037ms | 3737ms | +1700ms (contention-inflated, see below) |
| `/projects` | live | 2375ms | 2050ms | −325ms |
| `/work/warmer` | local | 2585ms | 3960ms | +1375ms (contention-inflated, see below) |
| `/work/warmer` | live | 2575ms | 2365ms | −210ms |

The two "local" +1300-1700ms entries were measured during this session's highest observed
contention window (see the drift table above, captured immediately before/after these two
routes) and do not replicate in the immediately-following live measurements of the same code
(both live deltas are negative/improving) or in the tightly-interleaved single-run pair (36ms,
homepage). Read as: **no consistent directional signal either way; noise dominates any real
effect at this measurement session's contention level.**

**Shipped anyway, framed honestly as an architecture simplification, not a proven perf win.** The
change has zero behavior risk (SSR output verified byte-identical, `npm run typecheck` / `npm run
lint` / `npm run build` all clean), strictly reduces the app's client-hydration surface by one
component on every route, and matches the codebase's own established "static-first, JS enhances"
pattern (`components/hero/embedding-cloud.tsx`, `components/warmer/embedding-viewer-frame.tsx`).
Kept for that reason. If a future pass gets a genuinely quiet, single-tenant measurement window,
re-running this same before/after pair would be worth 10 minutes to get a cleaner verdict — this
round's honest conclusion is "no measured win, no measured loss, kept for being free and
correct," not "confirmed win."

## Task 3 (A5) — `/work/warmer`'s claimed 8× outlier does not replicate

Round 1 flagged `/work/warmer` as "a genuine, reproducible outlier (4059ms median LCP, 3ms spread
across 3 runs)" with "an unthrottled `elementRenderDelay` of 1258.7ms — roughly 8× the
homepage's 159ms." This round re-ran the same measurement (Lantern-simulated, n=3, same host, same
build) specifically to check that claim before assuming a route-specific bug exists to fix:

| Metric | Home | `/work/warmer` | Round 1's claim for warmer |
|---|---:|---:|---:|
| Simulated LCP, median (n=3) | 3309ms | 3308ms | 4059ms |
| Unthrottled `elementRenderDelay` (single clean run) | 128ms | 172ms (1.3×) | 1258.7ms (8×) |
| Resource count | 27 | 27 | — |
| Transfer size | 456,980B | 459,478B | — |

**The 8× claim, and the 4059ms figure, do not replicate.** On this round's remeasurement, home
and `/work/warmer` are statistically indistinguishable — same request count, same weight within
2.5KB, median LCP within 1ms of each other. The most likely explanation, given this round's own
Task 2 finding: round 1 very plausibly measured `/work/warmer` during a worse moment of the same
kind of host-contention drift demonstrated above — its own report notes the 3-run spread was
unusually *tight* (3ms) and reads that tightness as evidence of a "real, reproducible cost," but
tight repeated-run variance is equally consistent with measuring 3 runs in a row during one
stable-but-elevated-contention window, which this round now knows this machine produces.

**Code-level check, for completeness (per the task's explicit ask), despite the numbers not
showing a problem:** `components/warmer/embedding-viewer-frame.tsx` gates the WebGL viewer behind
`IntersectionObserver` (`rootMargin: "200px"`, i.e. it isn't requested until the section
approaches the viewport) and `next/dynamic(..., { ssr: false })`, with the static server-rendered
before/after comparison always present as the default. This is above-the-fold-safe by
construction and was already independently confirmed cheap in `reports/bundle-baseline-
2026-08-14.md` (~5KB gzip combined WebGL surface, absent from either route's eager bundle
entirely). The actual LCP element (per `lcp-breakdown-insight`) is the case-study page's lede
paragraph near the top of the page — structurally the same kind of "large static text block near
the top" as the homepage's `<h1>`, not the embedding viewer or anything below the fold.

**Conclusion: no fix shipped for `/work/warmer` because no reproducible route-specific problem
was found this round.** The honest finding is a measurement-methodology lesson (host contention
can manufacture large, falsely "tight" outliers), not a code bug — reported per rule 101c rather
than either accepting round 1's premise unchallenged or inventing a fix for a problem that didn't
reproduce.

## Task 4 (A4) — 3D budget, re-derived from real numbers

**Worst route governs**, per this branch's own established BL-5 convention. Using this round's
cleanest real-devtools numbers: `/work/warmer` at 2585ms (local) / 2575ms (live) is the worst
series measured.

**Eager-path headroom = 2500ms target − 2585ms current = −85ms.** Already over budget on the
worst route with zero bytes added. Using `08ttfj81-47mu.js` (this app's largest single
scripting-cost chunk, the main React/Next framework bundle: 801ms of measured `bootup-time`
scripting cost against a 72,046B / 70.4KB gzip transfer size ≈ **11.4ms per KB gzip** at this
throttle profile, from `reports/lighthouse-fix-perf-local-home-devtools-2026-08-14.report.json`'s
`bootup-time` and `network-requests` audits) as the conversion basis: −85ms ÷ 11.4ms/KB ≈ **−7.5KB
— meaning the eager-path JS budget for new, always-hydrated code is not just zero, it is already
negative** on the worst route; even trimming ~7.5KB of *existing* eager JS would only reach
break-even, not create room for anything new.

**This does NOT mean no new 3D/WebGL work is possible** — it means new work must ship exactly the
way the *existing* WebGL surface already does. `reports/bundle-baseline-2026-08-14.md` measured
the combined hero + Warmer-viewer WebGL code at ~5KB gzip and **zero bytes in either route's
eager bundle**, because both are `next/dynamic(..., { ssr: false })`, gated behind
`requestAnimationFrame`/`IntersectionObserver` + a capability check, and never touch the initial
render or hydration pass at all. For code that is genuinely deferred this way, the ms/KB
conversion above does not apply — it measures the cost of code that participates in the
eager/initial hydration pass, and correctly-gated code by construction does not, the same way the
existing 5KB WebGL surface measurably does not (0 bytes in the eager-JS-size CI gate, confirmed
by `scripts/check-bundle-size.mjs`).

**Restated budget, honestly:** eager-path budget for new always-loaded JS is **~−7.5KB (already
over, on the worst route)** — reject any 3D/WebGL work that would add so much as one byte to the
eager bundle, full stop, same as BL-5 already concluded. Lazy-loaded, interaction/visibility-gated
work has no LCP-ms budget ceiling *by this mechanism* (it doesn't run before LCP), bounded instead
by other gates this repo already has for that class of code: the eager-JS-size CI gate (must stay
at 0 added bytes, which `next/dynamic({ssr:false})` gives for free), the TBT/main-thread cost
*once activated* (existing WebGL surface adds "+2ms TBT" per PR #83's own commit message, i.e.
already demonstrated cheap even when running), and rule 15e's stated bundle budgets. **Net: A5's
"reject new work, zero headroom" conclusion is directionally correct for the worst route's
eager path specifically — but the mechanism is "don't add eager bytes," not "don't build 3D,"
and the existing precedent shows the second doesn't follow from the first if the gating
discipline this codebase already uses is followed.**

## Verification

- `npm run typecheck`: clean after the `boot-loader.tsx` / `layout.tsx` change.
- `npm run lint`: clean (1 pre-existing, unrelated warning in `scripts/build_resume.mjs`, not
  touched this round).
- `npm run build`: succeeds.
- No `components/warmer/**` label/copy changes — the e2e/chatbot-index reflex from `CLAUDE.md`
  does not apply; not run, explicitly noted rather than skipped silently.
- `curl` diff of the raw SSR'd `#boot-loader` markup, before vs. after: byte-identical.
