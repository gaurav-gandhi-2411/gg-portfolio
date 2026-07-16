# Wave 4 — LCP investigation: is the 4.03s simulated LCP fixable? — 2026-07-16

Follow-up to `reports/lighthouse-wave4-2026-07-16.md`. That report found the Fraunces
headline is now the LCP element and confirmed font-display/preload are correctly configured.
This pass investigates the actual ~3-4s figure itself: is it eager hydration in the heat toy
or command palette (both interactive, both plausible suspects), or something else — and can
it come under a 2.5s target without cutting any feature.

## Hypothesis checked: heat toy / command palette hydrating eagerly

**Not the cause — both already defer their heavy logic to interaction, confirmed by reading
the code, not by assumption:**

- `components/hero-heat-toy-shell.tsx`: `"use client"`, holds one `useState`. The real
  `HeatToy` component (cosine-similarity logic + the ~41.7KB vocab fetch) is loaded via
  `next/dynamic` and only mounts after `setActivated(true)` on click. Until then the DOM is a
  single `<button>`.
- `components/command-palette-shell.tsx`: same pattern. The `CommandPalette` UI is
  `next/dynamic`-loaded only after `⌘K`, `/`, or a click sets `loaded=true`. The only always-on
  cost is a global `keydown` listener and one small fixed button.

Both match the design already documented in `reports/wave3-tier2-microinteractions-2026-07-12.md`
("Deliberately tiny — ... the heavy component ... loads only on interaction"). Nothing changed
that in wave 4. This hypothesis is ruled out.

## What's actually driving the number

Four measurements, same page, isolating one variable at a time:

| Run | Throttling | LCP | Notes |
|---|---|---|---|
| PR #11 Vercel preview | Lighthouse-simulated (Lantern) | **4.03s** | includes preview-only overhead |
| Local prod build (`next start`) | Lighthouse-simulated (Lantern) | **3.48s** | isolates preview-only overhead |
| Local prod build | **Real** devtools throttling (actually runs 4× slower, not modeled) | **3.12s** | most trustworthy number — see below |
| Local prod build + Speed Insights added | Lighthouse-simulated (Lantern) | 3.35s | confirms Speed Insights adds no measurable cost |

**Preview-only overhead (≈550ms of the gap):** `network-dependency-tree-insight` flagged
`https://vercel.live` (Vercel's preview-comments toolbar, injected only on `*.vercel.app`
preview deployments — never on production) as costing ~300ms of estimated LCP time, plus
real network RTT to Vercel's edge vs. localhost. This evaporates on merge; not an app-code
issue, same class of preview-artifact as the SEO 63 finding in the prior report.

**The real floor — React/Next hydration under CPU throttling.** The simulated (Lantern) and
real (devtools) throttling runs disagree sharply on where the time goes:

- Simulated run's `lcp-breakdown-insight`: TTFB 18ms + element-render-delay 361ms ≈ 380ms —
  looks fine, but this is Lantern's *modeled* estimate, not what actually happened.
- Real devtools-throttled run's `lcp-breakdown-insight`: TTFB 10.8ms + element-render-delay
  **3,111ms** — this one sums to the reported LCP (3,122ms) because it's measuring an actual
  browser instance genuinely running 4× slower, not a model. This is the trustworthy number.

`mainthread-work-breakdown` (score 0, i.e. flagged as poor) attributes the cost: Style &
Layout (~676-946ms) and Script Evaluation (~644-870ms) dominate, under simulated 4× CPU
slowdown — consistent with wave 3's own prior conclusion ("React/Next hydration cost on the
LCP paragraph, unrelated to any Tier-specific code").

**Tried and ruled out: browserslist.** Wave 3's budget report already noted the ~39-40KB
`core-js` chunk is "framework default... not fixable via browserslist or dependency changes,
tried both." Re-tested this wave under Next 16.2.10 + Turbopack: added an explicit modern
`browserslist` (`chrome/edge/firefox >= 100`, `safari >= 15.4`) to `package.json`, clean
rebuild, diffed every chunk — **zero bytes changed**, including the 112KB chunk containing
`core-js` and the 224KB chunk carrying the flagged legacy-method signals (`Array.prototype.at`,
`.flat`, `.flatMap`, `Object.fromEntries`, `Object.hasOwn`). Turbopack does not gate this
bundle on the app's browserslist config — reverted the no-op change rather than leaving dead
config in `package.json`. Confirms wave 3's finding still holds under the current toolchain.

## Conclusion: framework floor, target not reached without cutting features

The 2.5s target is not reached. The ~3.1-3.5s figure (real-hardware-equivalent, 4×-CPU-throttled
measurement) is dominated by React/Next.js hydration and style/layout work that is inherent to
shipping a moderately-interactive client-hydrated homepage on this framework — not attributable
to the heat toy, the command palette, or any single wave-4 addition, all of which were checked
individually. Getting materially under 2.5s on this throttle profile would mean reducing the
total amount of client-hydrated React on the page (e.g. converting more of the tree to
server-only rendering) — a rendering-architecture change, not a "defer this one eager thing"
fix, and out of scope for this pass since it wasn't asked for and would be a materially larger
change than what's justified by a lab number under an artificial 4× CPU throttle.

**Accepted as-is.** Real user hardware on desktop (this page's `formFactor`) is not uniformly
4× slower than the test machine — Lighthouse's throttle profile approximates a low-end/budget
device, not a typical recruiter's laptop. Field data (see below) is what should actually decide
whether this needs revisiting.

## Field data: not available yet, instrumentation added

`@vercel/analytics` (already installed) reports pageviews/events only — it does not capture
Core Web Vitals. There was no way to get a real p75 LCP number before this pass regardless of
traffic volume. Added `@vercel/speed-insights` (`app/layout.tsx`: `<SpeedInsights />` next to
the existing `<Analytics />`) so real-visitor LCP/CLS/INP starts accumulating in the Vercel
dashboard's Speed Insights tab from the next production deploy onward. Verified it adds no
measurable eager-path cost (3.35s vs. 3.48s baseline, within run-to-run noise) and that its
`/_vercel/speed-insights/script.js` 404 on local `next start` is the same known,
already-documented non-issue as `@vercel/analytics`'s equivalent 404 (real Vercel infra serves
both at 200).

**Open follow-up:** once this deploys and gets real traffic, check the Speed Insights p75 LCP
figure — that field number, not this lab measurement, should be the actual bar for whether
further investment here is warranted.

## Verification run

`npm run typecheck` and `npm run lint` both clean after the `@vercel/speed-insights` addition.
Production build (`next build`) succeeds.
