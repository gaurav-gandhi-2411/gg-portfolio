# Fix: `/projects` hover-recede WCAG AA contrast failure

## Context

Wave 16 hit this as a full-suite e2e failure, attempted a quick opacity bump, found what looked
like a second, harder-to-explain "compounding" contrast reading, and reverted rather than ship an
unverified fix outside that wave's scope. Returning with fresh context per instruction: root-cause
properly, verify with axe plus manual contrast math across every state, fix it, own PR.

## What was actually wrong — two separate bugs, not one

### Bug 1: a real WCAG AA failure at the genuine settled state (production bug)

`app/globals.css`'s `:has()` sibling-recede rule (`.project-grid:has(article:hover)
article:not(:hover) { opacity: 0.55 }`) drops text contrast below 4.5:1 for **any real mouse user**
who hovers a project card — not a test artifact.

Root cause, worked with actual relative-luminance math (not trial-and-error via axe reruns): each
card is `bg-card/50` — already a translucent layer over the page background. The `opacity` rule
composites that *whole* translucent layer (card background **and** text together) against the page
background a second time. Modeled precisely:

| Role | Base contrast (bg-card/50) | At opacity 0.55 | Needs |
|---|---|---|---|
| `text-hi` (headings) | 16.45:1 | 5.45:1 | 4.5:1 — passes, but barely |
| `text-lo` (muted-foreground) | 6.38:1 | **2.68:1** | 4.5:1 — **fails** |
| `text-accent` (case-study link) | ~7:1 | below 4.5:1 | 4.5:1 — fails |

Minimum opacity for `text-lo` (the weakest role) to clear 4.5:1: **0.807**, by binary search on the
same model. **Fixed to 0.9** — comfortable margin on every role (text-hi 13.35:1, text-lo 5.35:1,
text-accent 5.37:1), not cut to the wire like the wave-16 attempt's 0.82 (text-lo 4.61:1, margin
0.11 — enough to flip under real rendering variance, which is exactly what happened).

The card border (`border-border/40`) is separately, pre-existingly low-contrast (1.47:1 even at
**full** opacity, unrelated to this rule) — axe doesn't flag it (WCAG 1.4.11 non-text contrast
isn't a decorative border's concern, and axe's `color-contrast` rule only checks text), and the
site's own token-header comment's "3.38:1" claim doesn't account for this specific `/40`-alpha
usage. Flagging as a separate, pre-existing documentation/implementation mismatch — not fixed here,
out of this bug's scope.

Confirmed empirically, not just in theory: `matchMedia("(hover: hover)")` returns `false` under the
Playwright "mobile" project's Pixel 7 emulation, so this rule (and the two new deliberate tests
below) are correctly a no-op on touch devices — desktop-only bug, by design, not an oversight.
Filter-active state doesn't introduce a new interaction: filtered-out cards are `display: none`
(removed from layout, never dimmed), confirmed by testing the combination directly rather than
assuming it from the CSS.

### Bug 2: a flaky e2e race with the entrance-fade animation (test-only, not a production bug)

The "second compounding case" from wave 16's revert — a contrast reading of 1.54 that didn't fit
any plausible opacity-based model — was **not a real second CSS interaction**. Direct browser
instrumentation this pass (`getComputedStyle` + `element.matches(':hover')` at the exact moment of
a real failure) proved it: `:hover` matched **nothing** on any card, and article opacities were
`0.9998, 0.9982, 0.9921, 0.9764, 0.9397, 0.8564` — a monotonic-by-stagger-index sequence, the exact
signature of `components/reveal-group.tsx`'s entrance fade still in flight, unrelated to the
hover-recede rule entirely.

`reveal-group.tsx` uses `mode="onview"`: the stagger doesn't start at page load, it starts whenever
an `IntersectionObserver` fires. The existing fixed wait (`page.waitForTimeout(1300)`, wave 9/14)
raced that observer under real load. A `document.getAnimations()`-based poll was tried next and
was **also** insufficient — proven by running the full suite under real parallel load
(`--repeat-each=3/5`, not just in isolation): a "zero running animations" check can be vacuously
true *before* the observer has even fired (nothing has started yet), and under CPU contention both
the observer and axe's own non-instantaneous DOM scan can land inside that same window.

**Actual fix**: stop racing the animation at all. `reveal-group.tsx` already skips the animation
entirely under `prefers-reduced-motion: reduce`, rendering the final (`opacity: 1`) state
immediately — the exact same rest state standard-motion visitors eventually reach (the animation's
own final keyframe is identical to the un-animated CSS state). Every axe scan in `e2e/a11y.spec.ts`
now emulates reduced motion via `page.emulateMedia({ reducedMotion: "reduce" })` before navigating
— deterministic, zero timing dependency, and it's testing a real, already-supported code path
rather than guessing at a duration long enough to outlast an async trigger.

## Verification

- Precise contrast math (worked by hand via a script, not eyeballed) for every text role used in a
  project card, against the card's real local background.
- Full `e2e/a11y.spec.ts` run under real parallel load, **5 repeats**: 230/230 passed, 0 failures —
  confirmed the reduced-motion fix isn't luck, unlike the two prior attempts which both still
  flaked under the same stress test.
- Full `npx playwright test` (all specs): 120 passed, 2 intentionally skipped (the new hover tests,
  correctly no-op on the mobile/touch project) — no regressions elsewhere.
- Two new deliberate tests added, both passing 5/5 on desktop, correctly skipped on mobile:
  hovering a card keeps every sibling AA-compliant; the filter-active + hover combination stays
  compliant too (verified directly, not assumed from the CSS).
- `npx tsc --noEmit`, `npm run lint`, `npm run build`: all clean.

## What this does NOT fix (flagged, not silently absorbed)

- `border-border/40`'s pre-existing 1.47:1 contrast (see above) — not a WCAG violation axe
  enforces here, and unrelated to the bug fixed; a design decision, not a defect.
