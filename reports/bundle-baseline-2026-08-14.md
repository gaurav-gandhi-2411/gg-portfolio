# Bundle-size baseline (BL-4) — 2026-08-14

PR-2 "perf" task 4. Round-1's `audit/BACKLOG.md` (BL-4) flagged that Next.js 16/Turbopack's build
output carries no First Load JS table and no bundle analyzer was configured — so no existing
proposal (BL-5/BL-6, the 3D backlog items) could be evaluated against a real KB number. This
report is that number, from three independent, cross-checked measurements.

## What was added

`@next/bundle-analyzer@16.3.1` as a devDependency, wired into `next.config.ts` behind
`ANALYZE=true` (never runs on a normal `npm run build`/CI build).

**Real, measured install footprint** (`du -sb` on every newly-added `node_modules/` entry,
cross-checked against the 16 new entries in `package-lock.json`'s diff): **1,761,186 bytes
(1.68 MiB)**, almost entirely `webpack-bundle-analyzer` itself (1,502,463 bytes / 85% of the
total). This is dev-tooling footprint only — a devDependency gated behind an env var, never
installed in `npm ci --no-dev`/production, never shipped to a browser.

**Compatibility finding, not in the original task framing:** `@next/bundle-analyzer` is built on
`webpack-bundle-analyzer` and **is not compatible with Turbopack builds** — this repo's actual
build tool (`▲ Next.js 16.3.0 (Turbopack)`, confirmed in every `npm run build` output). Running
`ANALYZE=true npm run build` prints "The Next Bundle Analyzer is not compatible with Turbopack
builds, no report will be generated" and exits without a report. It only produces output via
`ANALYZE=true npx next build --webpack`, which compiles a **parallel webpack build** that is not
what Vercel actually deploys — its per-chunk sizes are directionally useful (module-level
composition, see below) but not the authoritative "what ships" number.

Next 16.3 ships its own Turbopack-native alternative, `next experimental-analyze`, discovered
while investigating the above. It only produces an interactive web-UI dataset (`next
experimental-analyze -o` writes RSC/route dumps to `.next/diagnostics/analyze/`, not a
size-summary table), so it wasn't usable as the primary source for this report either. Kept as a
note for whoever next needs a live interactive treemap of the real Turbopack output.

Given neither tool alone produces a trustworthy, build-accurate "First Load JS per route" table
on its own, this report uses three converging, real measurements instead of one:

## 1. Eager JS per route — `scripts/check-bundle-size.mjs` (existing, CI-gated, real Turbopack build)

This repo already has a rigorous eager-JS gate (added before this task, see
`reports/bundle-budget-reratification-2026-08-12.md`) that curls the real gzip size of every
`<script>`/preload-as-script chunk a route's live HTML actually serves, against the real Turbopack
production build. Run against the current `HEAD` (`ff5ff7c` + this PR, no functional change to
the gate itself):

| Route | Total (gzip) | Baseline (08-12) | Δ | Ceiling headroom |
|---|---:|---:|---:|---:|
| `/` (homepage, hosts the WebGL hero) | 194,284 B | 192,560 B | +1,724 B | 25,876 B (220,160 ceiling) |
| `/work/warmer` (hosts the Warmer WebGL embedding viewer) | 194,126 B | 192,560 B | +1,566 B | 26,034 B |

**Both routes are within 200 bytes of each other and both pass the existing 220,160-byte (215
KiB) ceiling with >25 KB of headroom.** Neither WebGL component shows up as eager-bundle cost —
consistent with both being `next/dynamic(..., { ssr: false })` client components that only load
on interaction/idle, not with the initial route shell.

## 2. Real network bytes per route, all 25 routes — Lighthouse `resource-summary`, one run each

From the Task 2 sweep (`http://localhost:3000<route>`, mobile, simulated throttling). This is
what a browser actually fetched during the traced load, not a static build artifact — it
naturally reflects the lazy/deferred components' real absence from the initial load:

| Route | Total | Script | Font | Doc | CSS |
|---|---:|---:|---:|---:|---:|
| `/` | 456,946 | 181,470 | 184,502 | 42,601 | 11,353 |
| `/work/warmer` | 459,463 | 170,563 | 184,502 | 56,025 | 11,353 |
| `/projects` (no WebGL at all) | 461,616 | 170,563 | 184,502 | 13,805 | 11,353 |
| `/ask` (no WebGL, no hero) | 400,407 | 165,704 | 184,502 | 6,044 | 11,353 |

`/`'s script bytes (181,470) are ~11 KB higher than `/work/warmer`/`/projects` (170,563) within
the traced window — this is the homepage's own above-the-fold interactive shells (heat-toy
shell, command-palette shell — both confirmed tiny non-WebGL wrappers per
`reports/wave4-lcp-investigation-2026-07-16.md`), not the WebGL hero, which the trace confirms
never loads within the ~2.6s window at all (see reports/lighthouse-perf-baseline-2026-08-14
task-1 diagnosis: `EmbeddingCloudGL`'s own `START_DELAY_MS=2600` + `requestIdleCallback` means it
structurally cannot appear in a trace this short).

## 3. Module-level cost of the WebGL code itself — webpack analyzer treemap

`ANALYZE=true npx next build --webpack` (`.next/analyze/client.html`), gzip sizes per module:

| Module | statSize | parsedSize | gzipSize |
|---|---:|---:|---:|
| `lib/webgl/point-cloud.ts` (shared renderer, used by both hero and Warmer viewer) | 11,444 B | 5,661 B | **2,582 B** |
| `components/hero/embedding-cloud-gl.tsx` (homepage hero WebGL layer) | 6,943 B | 1,828 B | **922 B** |
| `components/warmer/embedding-viewer-gl.tsx` (Warmer page WebGL layer) | 11,083 B | 3,253 B | **1,481 B** |
| `components/warmer/embedding-viewer-frame.tsx` | 2,857 B | 699 B | 457 B |

**The entire WebGL surface — both components plus the shared renderer they both import — is
~5 KB gzip combined, loaded once and shared.** This is a webpack-build measurement (Turbopack
incompatibility, above), so treat the exact byte counts as directional, not the authoritative
total — but module-level *relative* size and the fact that both `page 1's` and `route 2's` WebGL
code round to single-digit KB is not sensitive to which bundler measured it.

## Answering BL-4/BL-6's actual question

BL-6 asked, once BL-4 had real numbers: is the *existing* 3D usage (the hero + the Warmer viewer)
within a reasonable budget? **Yes, unambiguously.** Combined WebGL code is ~5 KB gzip against a
~194 KB eager-JS ceiling headroom of ~26 KB per route — the WebGL layers alone could 5x and still
fit inside just the *headroom*, before touching the ~170 KB of framework/app code that dominates
every route's total regardless of WebGL. Both components are lazy-loaded and don't touch the
eager-JS gate at all in the current build.

## Verification

`npm run typecheck` and `npm run build` both pass with `@next/bundle-analyzer` installed and
wired in (config change is inert unless `ANALYZE=true`, confirmed via clean `npm run build` with
no `ANALYZE` set producing the normal Turbopack output, no analyzer side effects).
