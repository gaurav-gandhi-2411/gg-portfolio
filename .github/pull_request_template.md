## What & why (2–4 lines)

## Changes (bulleted, grouped)

## Gate results

State the actual result for every gate this PR's diff touches — a checked box with no result
next to it isn't evidence. Numbers, not "passed"/"looks good" (README's provenance culture
applies to gate results too).

- [ ] `npm run lint` — eslint:
- [ ] `npm run typecheck` — tsc:
- [ ] `npm run build` (chatbot index freshness + card/metrics/case-study consistency run inline):
- [ ] `npm run test:e2e` — Playwright (desktop + mobile projects), incl. axe accessibility:
- [ ] `node scripts/check-metric-freshness.mjs` — only if `content/*.ts`/`provenance.md` changed:
- [ ] Lighthouse mobile (all categories) — only if a UI path changed:

## Screenshots (before/after — required for any visible UI change, else state explicitly why not
applicable, e.g. "docs/backend-only, no UI path touched")

## Risk & rollback (blast radius, revert plan)
