# Direction A ("Editorial / credibility-first") — verification metrics

Branch: `explore/refresh-d-direction-a`, based on `origin/feat/open-source-section`
(`a8c694a`). Proposal only — never merged, never deployed.

All numbers below are from a local `npx next start -p 3101` production build
(no CDN, no edge caching, no Vercel Analytics/Speed Insights endpoints —
those 404 locally and are the reason Best Practices reads 96 instead of 100
in both runs below), measured on this machine on 2026-09-23. They are **not**
production numbers and are a single run each (n=1), not the repo's own
pinned n≥6 `scripts/lighthouse.mjs` protocol — read them as "does this
proposal have an obvious perf/a11y problem," not as a load-bearing benchmark.

## Lighthouse

Tool: `lighthouse@13.5.0` (chrome-launcher headless), same version this
session confirmed via `npx lighthouse --version`.

| Category | Mobile | Desktop | Phase A baseline (mobile / desktop) |
|---|---|---|---|
| Performance | 75 | 100 | 82 / 92 |
| Accessibility | 100 | 100 | 100 / 100 |
| Best Practices | 96 | 96 | 100 / 100 |
| SEO | 100 | 100 | 100 / 100 |
| CLS | 0 | 0 | 0 / 0 |
| LCP | 4.1s | 0.7s | — |
| FCP | 0.9s | 0.3s | — |
| TBT | 390ms | 0ms | — |

Raw reports: `lighthouse-mobile.report.json`, `lighthouse-desktop.report.json`
(same directory as this file).

**Best Practices (96, both runs):** the one failing audit is
`errors-in-console`, entirely from two expected local-only 404s
(`/_vercel/insights/script.js`, `/_vercel/speed-insights/script.js`) —
`@vercel/analytics`/`@vercel/speed-insights` only resolve on a real Vercel
deployment. Confirmed this is sitewide and pre-existing, not specific to
this branch: re-ran the same audit against the unmodified `/projects` route
on this same build and got the identical two 404s and the identical 96.

**Performance gap (mobile 75 vs. baseline 82, desktop 100 vs. baseline 92):**
mobile is below the Phase A baseline band; desktop is above it. This is a
single unpinned run (`npx lighthouse`, not the repo's own pinned
`scripts/lighthouse.mjs` n≥6 protocol) on a machine running several other
worktrees concurrently per GG's standing setup — the repo's own lighthouse
script docblock records CPU-throttled mobile perf as the noisiest of the
four categories even under pinned conditions (measured stddev ~2 points
same-session, historically much wider across unpinned/cross-session runs).
Not chased further given this is a proposal, not a ship candidate; a
same-session pinned re-run against the repo's own protocol before any
merge decision would be the next step, not a single `npx lighthouse` call.

## axe (via the repo's own e2e/a11y.spec.ts, against this build)

Ran with `PLAYWRIGHT_BASE_URL=http://localhost:3101 npx playwright test
e2e/a11y.spec.ts -g "zero violations on /$"` — the suite's own homepage
route-level scan, unmodified, against Direction A's build.

| Project | Violations (any severity) |
|---|---|
| desktop | 0 |
| mobile | 0 |

`results.violations` is asserted `toEqual([])` by the test itself — that is
zero violations at every severity axe reports (minor/moderate/serious/
critical), a strictly stronger bar than "0 serious+critical." Serious+critical
count: **0** (subset of the 0 total).

Two additional scans (not in the committed suite, written as scratch
verification and not committed) opened Direction A's own new
`MetricProvenance` disclosures — the hero's `$10M+` stat panel and a Work
ledger row's metric panel — and re-scanned with axe in both cases:
0 violations each. This exists because these are new usages of a shared
component in new markup positions, and the disclosure's *expanded* state
is exactly where a missing accessible name or focus-order bug would
surface (same reasoning the shipped suite already applies to
`/work/triageiq`'s own provenance-panel scans).

The suite's WebGL-specific homepage test (`axe: zero violations on the
homepage with the hero's WebGL layer active`) was not run against this
branch: it asserts `header canvas` is visible, and Direction A's hero has
no WebGL field by design (the brief's own "calm, typographic... no
animated backdrop" — see `components/directions/a/hero-a.tsx`'s header
comment). Not a failure of this build; a test written against the shipped
hero's specific implementation, structurally inapplicable here.

## A real bug found and fixed during this verification

The mobile Lighthouse run's first pass caught a genuine React hydration
error (console `pageerror`, React error #418) that the build/typecheck
steps do not catch. Root cause: `components/directions/a/work-ledger-a.tsx`
wrapped `<MetricProvenance>` in a `<p>` — that component's disclosure panel
renders `<p>`/`<ul>` internally, and HTML forbids block content inside a
`<p>` (the browser silently closes the outer `<p>` early, so server and
client DOM trees disagree). Every existing sitewide usage of
`MetricProvenance` (`components/headline-stats.tsx`,
`components/case-study-page.tsx`) already avoids this by wrapping it in a
`<dd>`, not a `<p>` — confirmed by re-reading both before writing the fix.
Fixed by changing the wrapper to a `<div>`. Re-verified: mobile Lighthouse's
console-error audit changed from a thrown `pageerror` down to just the two
expected local-only 404s; TBT dropped 690ms → 390ms and Performance rose
65 → 75 in the same environment as a side effect (a thrown, tree-regenerating
hydration failure was doing real main-thread work on every load). No visual
change — before/after crops of the same ledger row are pixel-identical
except for the fix.
