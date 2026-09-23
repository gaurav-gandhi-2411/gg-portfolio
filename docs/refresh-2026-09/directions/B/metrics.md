# Direction B ("Product showcase") — metrics

Proposal only, on `explore/refresh-d-direction-b`. Not merged, no PR opened.

All numbers below are **local `next start` measurements** (`npx next start -p
3102` against this branch's own `npm run build` output), not the deployed
production site. Phase A's baselines (quoted for comparison, from
`docs/refresh-2026-09/audit-parts/07-perf-baselines.md`) were measured
against the live `https://gaurav-gandhi.vercel.app` instead — the two are not
a strict apples-to-apples comparison, most visibly in Best Practices (see
below), and should be read as "same tooling, different target" rather than
a regression check.

## Environment

- Lighthouse CLI (repo devDependency, `npx lighthouse`), headless Chrome
  (`--chrome-flags="--headless=new"`), against `http://localhost:3102/`.
- Server: `npx next start -p 3102` on this branch's production build
  (`npm run build`, Next.js 16.3.5 / Turbopack).
- Exact commands:
  - `npx lighthouse http://localhost:3102/ --output=json --output-path=<path> --form-factor=mobile --screenEmulation.mobile=true --chrome-flags="--headless=new" --quiet`
  - `npx lighthouse http://localhost:3102/ --output=json --output-path=<path> --preset=desktop --chrome-flags="--headless=new" --quiet`
- Known harmless tool quirk (same one Phase A's own baseline doc recorded):
  every `npx lighthouse` invocation prints an `EPERM` stack trace from
  `chrome-launcher`'s `destroyTmp()` cleanup after the report is already
  written — confirmed non-fatal each time, the JSON output was present and
  fully populated regardless.
- axe: `@axe-core/playwright` (repo devDependency) driven from an uncommitted
  script (`tmp-axe.mjs`, deleted before commit), one Chromium context per
  color scheme, `page.emulateMedia({ reducedMotion: "reduce" })` before
  `goto` — same rationale as `e2e/a11y.spec.ts`'s `gotoSettled`: a scan needs
  to land on the settled DOM, not mid-stagger, or contrast numbers become
  animation-frame noise rather than a real reading.

## Lighthouse — `/` (home)

| Form factor | Performance | Accessibility | Best Practices | SEO | CLS | LCP |
|---|---|---|---|---|---|---|
| Mobile (Direction B, local)  | 81 | 100 | 96 | 100 | 0 | 3.6s |
| Desktop (Direction B, local) | 99 | 100 | 96 | 100 | 0 | 0.8s |
| Mobile (Phase A baseline, prod)  | 82 | 100 | 100 | 100 | 0 | — |
| Desktop (Phase A baseline, prod) | 92 | 100 | 100 | 100 | 0 | — |

Performance and CLS are in line with (mobile) or ahead of (desktop) the Phase
A baseline despite the heavier hero (WebGL point-field plus a second card
panel) — CLS stays exactly 0 in both form factors, which is the number that
actually mattered given the new impact panel occupies space the old
single-column hero never reserved.

**Best Practices 96, not 100** — both runs' `errors-in-console` audit fails on
two requests, in both Direction B and (implicitly, since this local artifact
doesn't exist against production) every local `next start` run of this repo:

```
Failed to load resource: the server responded with a status of 404 (Not Found)
  http://localhost:3102/_vercel/insights/script.js
  http://localhost:3102/_vercel/speed-insights/script.js
```

These are Vercel Analytics/Speed Insights scripts the app requests
unconditionally; the production deployment's Vercel edge platform serves
them (hence Phase A's prod-measured 100), but a bare `next start` has no
Vercel platform behind it to answer those paths, so they 404 and Lighthouse's
console-error audit — correctly — counts that. Not a Direction B regression:
this is a property of testing locally rather than against Vercel, and would
reproduce identically on `main` today under the same local-`next start`
methodology.

## axe (`@axe-core/playwright`) — `/`

| Color scheme | Serious | Critical | All violations |
|---|---|---|---|
| Light | 0 | 0 | 0 |
| Dark  | 0 | 0 | 0 |

Matches Phase A's `0 serious/critical` baseline in both themes — the light
theme is new in this exploration and was not covered by Phase A's dark-only
baseline at all, so its own 0/0 is this branch's own result, not a repeat of
an existing number.

## Screenshots

`docs/refresh-2026-09/directions/B/`:

- `home-{375,768,1440}-{light,dark}.png` — full page
- `home-{375,768,1440}-{light,dark}-fold.png` — initial viewport only (900px
  tall), i.e. what's visible before any scroll

All twelve were reviewed directly (not just generated) for visual bugs before
this file was written; none found. Above-the-fold hard requirements (name,
"Lead Data Scientist", Uber attribution, two impact numbers with provenance,
"Résumé" CTA, contact) are all visible at every width/theme combination —
narrowest case is `home-375-*-fold.png`, where the identity column and the
impact panel both stack into the initial 375×900 viewport with room to
spare.
