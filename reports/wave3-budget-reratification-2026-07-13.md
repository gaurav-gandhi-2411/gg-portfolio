# Budget re-ratification — 2026-07-13

## Retiring the 165 KB figure

The wave-3 kickoff instruction re-baselined the eager JS budget to **165 KB**, using a then-
believed wave-2 measurement of 161.3 KiB (165,135 bytes) as justification. That measurement
was wrong — see the erratum in `reports/wave2-perf-budgets-2026-07-12.md` and the full
investigation in `reports/wave3-live-stats-budget-2026-07-12.md`. The true wave-2 baseline was
already **204,762 bytes (200.0 KiB)**, confirmed three independent ways, including a
from-scratch `create-next-app` reproducing an identical 39.6 KiB core-js polyfill chunk that
Next.js 16.2.10 + Turbopack bakes into every build regardless of application code.

**The 165 KB figure is retired as of this report.** It was never an achievable target for this
stack — the framework floor alone (~191 KB for a bare template, ~200 KB once this app's own
routing/fonts/analytics are added) already exceeds it before a single wave-3 feature ships.
Any future wave measuring against 165 KB would be failing against a number that was wrong from
the day it was set, not against a real regression. Every existing reference to it
(`PLAN.md`, `reports/wave2-perf-budgets-2026-07-12.md`,
`reports/wave3-live-stats-budget-2026-07-12.md`, `reports/wave3-tier2-microinteractions-2026-07-12.md`)
stays as an honest historical record of the mistake and its correction — not rewritten — but
none of them are the operative budget going forward. This report is.

## New ceiling: ≤215 KB gzip, eager JS

| State | Bytes | Source |
|---|---|---|
| Wave 2 (corrected baseline) | 204,762 | `reports/wave2-perf-budgets-2026-07-12.md` erratum |
| + Tier 2.4 (hero heat toy) | 206,318 | `reports/wave3-heat-toy-budget-2026-07-12.md` |
| + Tier 2.5/2.6 (palette + micro-interactions) | 207,862 | `reports/wave3-tier2-microinteractions-2026-07-12.md` |
| **New ceiling** | **220,160 (215 KB)** | this report |

215 KB gives 12,298 bytes (12.0 KiB, ~5.9%) of headroom over the current measured total —
enough for one or two more small interaction shells at the ~1.5–3 KB eager cost this wave's
own features have run (heat-toy shell: 1,556 bytes; palette shell + count-up + monogram +
cursor-glow combined: 3,100 bytes), without inviting a feature to ship its full UI eagerly
just because there's room. The operative discipline stays unchanged from wave 3's own
guardrail: **new interactive features load their heavy UI behind `next/dynamic`, on
interaction, not on page load** — 215 KB is a ceiling on shell cost accumulating across
features, not a license to spend it on one eagerly-loaded component.

If a future feature would push past 220,160 bytes, the response is the same as this wave's
own guardrail: dynamic-import it, or cut it and say so — not silently re-ratify the number a
third time.

## What's updated

- `README.md` (new) — Performance section states the 215 KB ceiling and current measured
  total, citing this report.
- `spec.md` line 38 — budget line updated from the original `≤150 KB` (already superseded
  twice: once to 165 KB in the wave-3 kickoff, now to 215 KB here) to point at this report as
  the current source of truth, so the spec doesn't silently drift from what's actually being
  measured against.
- `PLAN.md` — wave 3 section gets a pointer to this report.
