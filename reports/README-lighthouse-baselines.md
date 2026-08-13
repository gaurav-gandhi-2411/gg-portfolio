# Lighthouse baselines — which file is comparable to what

## Current baselines (use these)

| route | file | origin |
|---|---|---|
| `/` | `lighthouse-main-preview-baseline-home-2026-08-13.summary.json` | **deployed** |
| `/work/warmer` | `lighthouse-main-preview-baseline-work-warmer-2026-08-13.summary.json` | **deployed** |

Measured on a Vercel **preview deployment of `main`'s exact code**, n=8. A
preview is the only fair reference for a PR branch, because a PR branch can only
ever produce a preview — production deploys come from `main`.

`scripts/lighthouse.mjs` reads these automatically and refuses to compare across
origins.

## Superseded, kept as history — NOT comparable to anything deployed

| file | origin |
|---|---|
| `lighthouse-feat-lighthouse-perf-baseline-home-2026-08-12.summary.json` | **localhost only** |
| `lighthouse-feat-lighthouse-perf-baseline-work-warmer-2026-08-12.summary.json` | **localhost only** |

These were measured against `http://localhost:3000`. They are retained because
they are the provenance for figures quoted in commits and PRs between
2026-08-12 and 2026-08-13, and deleting them would orphan those citations.

**Do not compare a deployed run against them.** localhost has no CDN, no real
TLS handshake, no cold start, and a different CPU contention profile. Doing so
on 2026-08-13 produced an apparent 4.83-point hero regression that was mostly an
artifact of the mismatch, and drove three rounds of rework — settle, static
frame, revert — before anyone measured a deployed no-canvas reference and found
the real difference was about 1 point.

They carry no `origin` field, because they predate it. The comparison guard
treats a missing origin as a mismatch rather than assuming it matches, so these
cannot be used accidentally.

## What the re-baseline showed

Against the new deployed baseline for `/` (83.75 ±3.62, main's rotating hero):

| hero variant | Performance | vs deployed baseline |
|---|---|---|
| rotating (what `main` has) | 83.75 ±3.62 | — |
| 4.5s settle then stop | 89.33 ±3.78 | +5.58 |
| one static frame | 87.00 ±1.31 | +3.25 |
| no canvas, static SVG | 88.00 ±1.07 | +4.25 |

Every variant improves on what is currently deployed. The earlier conclusion
that the canvas cost ~6 points was the localhost artifact; the honest spread
between the variants is a few points, and they overlap within their own
run-to-run variance.
