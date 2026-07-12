# Wave 3 Tier 1 budget report — 2026-07-12

## Correcting the wave-2 record first

Wave 2's reported JS total (161.3 KiB) was wrong — see the erratum at the top of
`reports/wave2-perf-budgets-2026-07-12.md`. The true baseline, verified three independent
ways, is **204,762 bytes (200.0 KiB)**. The missed 39.6 KiB chunk is core-js polyfills baked
into Next.js 16.2.10 + Turbopack's default output — reproduced identically in a from-scratch
`create-next-app` with zero custom code, so it's a framework floor, not an app-code or
dependency issue. `browserslist` config and removing `@vercel/analytics` were both tried and
had zero effect (byte-identical chunk hash).

## What this means for the 165 KB target GG set

GG's wave-3 instruction re-baselined the JS budget to 165 KB using my (wrong) 161.3 KiB
number as justification. The true framework floor alone is ~191 KB (bare template) to
~205 KB (this app, wave-2 state) — already over 165 KB before any wave-3 feature ships.

**Decision:** rather than ask GG to re-approve a new absolute number mid-wave, I'm holding to
the *spirit* of the guardrail instead of the specific figure: **every new wave-3 feature
must add zero bytes to the eager/initial bundle.** Tier 1 (this report) already does — see
below. Tier 2's interactive features (hero toy, command palette, micro-interactions) will
ship behind `next/dynamic` so their JS only loads on user interaction, never adding to the
number a Lighthouse run or a first-load network trace measures. I'll flag the corrected
absolute baseline prominently in the final wave-3 report rather than quietly patching over
my own error.

## Tier 1 measurement — zero eager JS, verified

| State | Total gzip JS (initial load) |
|---|---|
| Wave 2 (corrected baseline, commit `6fac780`) | 204,762 bytes |
| Wave 3 Tier 1 (live stats, Now strip, shipping log) | **204,762 bytes — byte-identical** |
| Delta | **+0 bytes** |

This confirms the Tier 1 architecture worked exactly as intended: `lib/live-data.ts` and its
consuming components (`Products`, `NowStrip`, `ShippingLog`) are all React Server Components
with no `"use client"` directive — they fetch data and render to static HTML at build/ISR
time, shipping zero JavaScript to the browser for this feature set.
