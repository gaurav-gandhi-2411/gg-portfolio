# Wave 7 proposal — the 1440px right rail on flagship rows — 2026-07-17

**Status: GG picked Option A (2026-07-17) — built production-grade same day on the PR #15
branch. Build record appended at the end of this file. The original proposal follows
unchanged.**

Wave 6's honest-shortfalls section named the one surviving composition gap: on text-heavy
flagship rows at 1440, the content column's right ~200px is unoccupied whitespace.
References solve this with images/artifacts; this site has none and won't fabricate UI
screenshots. GG asked for 2–3 concrete options — data-as-visual (a small static chart per
flagship sourced from its own eval results, not decoration) vs. intentional whitespace.

## Option A — per-flagship eval figure (recommended)

A small static SVG figure (≤72px tall, ~13rem wide) in a right column on each of the three
flagship entries only (never index rows), drawing the **numbers already on the row** — same
values, same sourceRefs, zero new claims:

- **Warmer** — dumbbell/slope, −0.003 → 0.639 Spearman on a 0–1 track: the before/after of
  the Hinglish embedding fix (`warmer:hinglish-fix`). The delta *is* the story; two dots
  and a line show it faster than the sentence does.
- **Style Maitri** — single filled bar on a 0–100% track, 93.8%, caption "n=211"
  (`style-maitri:intent-accuracy`).
- **TriageIQ** — two thin bars, 82.5% (k8s) / 90.4% (vscode), labels on the bars
  (`triageiq:classifier-top3`).

The figure **absorbs the row's existing metric line** (value + label become the figure's
caption) rather than duplicating it. Form per the dataviz method: magnitude → bars,
change → dumbbell; single series per figure → no legend; values direct-printed in mono
text tokens so nothing is color-alone and the "table view" is the caption itself. Marks in
the ratified indigo on a `border/40` track; palette validator run for dark surface
`#0a0b0d`: contrast 6.6:1 (pass, ≥3:1); the lightness-band check flagged `#818cf8` but is
scoped to categorical palettes per the validator's own note — single-hue marks with
direct labels are governed by the contrast check. If a second series ever appears,
re-validate a real two-hue palette.

**Pros**: fills the void with information, not decoration — a portfolio that charts its own
evals is a differentiator perfectly aligned with the provenance thesis; zero JS, zero
bytes beyond inline SVG; server-rendered. **Cons**: three more visual elements to keep
honest; a restraint risk if it ever spreads to index rows; the Warmer 0–1 Spearman scale
needs a one-word axis note to be self-explanatory.

**Restraint rules if adopted**: flagship rows only; height cap 72px; one hue + muted
track; no gridlines, no legend, no animation; caption text = the existing metric label
verbatim; every figure value carries the row's existing sourceRef.

## Option B — repo-activity sparklines (rejected)

52-week commit sparkline per flagship from GitHub's unauthenticated stats API (same
fail-soft ISR pattern as freshness). Rejected on three grounds: Warmer — flagship #1 — is
a private repo and would be the only row *without* a chart; commit volume is activity
theater, not a quality signal (the site's thesis is verified outcomes, not busyness); and
it adds API-shape fragility for a decorative payoff. This is the "GitHub-green-squares"
cliché the wave-6 teardown would flag on someone else's site.

## Option C — keep intentional whitespace (status quo)

The references treat margin as margin; the rail reads "empty" mostly by contrast with the
old card layout. Zero risk, zero work. But it leaves the one audit finding GG's own
reaction history keeps circling (composition of the dark canvas) answered only at the
section level, and wave 6 already named it the weakest surviving point — so "do nothing"
should be a deliberate pick, not a default.

## Recommendation

**A**, under the restraint rules above. It is the only option where the fix advances the
site's actual thesis (every number verifiable) instead of decorating around it.

## Mockup

Top option mocked on `explore/wave7-right-rail` (throwaway branch off the wave-6 branch —
mock code is not merge-ready and skips the production niceties: no responsive collapse
polish, no provenance-comment pass). Screenshots for the pick:

- `reports/screenshots/wave7-proposals/optionA-work-1440.png` — the three flagship rows
  with figures, full section context
- `reports/screenshots/wave7-proposals/optionA-warmer-closeup-1440.png` — Warmer dumbbell
  close-up

Decision needed from GG: **A / C / neither** (B documented as rejected). On a pick of A,
wave 7 builds it production-grade: responsive behavior (figure drops below text under
`lg`), axe pass on the SVG semantics (`role="img"` + label per figure), provenance
comments, and a design-review pass.

---

## Build record — wave 7 (2026-07-17, GG-approved)

Shipped on `feat/wave6-composition-rebuild` (PR #15, still open at build time), per GG's
four requirements:

1. **Responsive below-lg**: the figure renders between tagline and story under 1024px
   (DOM order), and moves to the right rail via explicit grid placement
   (`lg:col-start-2 lg:row-start-1 lg:row-span-4 lg:self-center`) at lg+. Verified at
   390/768/1024/1440 (`reports/screenshots/wave7-proposals/final-work-*.png` — the 1024
   capture exists specifically to show the literal breakpoint transition).
2. **SVG a11y pass**: every `<svg>` is `role="img"` with a worded aria-label carrying the
   full claim — verified in the rendered accessibility tree (image nodes read
   "Hinglish embedding eval (Spearman correlation): improved from -0.003 to 0.639, on a
   0–1 scale." / "Intent-parsing accuracy: 93.8% (n=211)." / "Component classifier top-3
   accuracy: 82.5% on k8s, 90.4% on vscode."). The visible figcaption is `aria-hidden`
   (its text is subsumed by the image's accessible name — avoids a double announcement).
   axe: 0 violations on the final build. **Screen-reader spot-check caveat:** verified via
   Chrome's rendered accessibility tree, not a live NVDA/JAWS session — the a11y tree is
   what SRs consume, but an actual SR pass remains unexecuted (this session cannot drive
   one non-interactively).
3. **Provenance (65b)**: figure data is a typed `ProductFigure` field in
   `content/products.ts`, each carrying a comment binding it to the row's `metric` and
   sourceRef (`warmer:hinglish-fix`, `style-maitri:intent-accuracy`,
   `triageiq:classifier-top3`). The component (`components/eval-figure.tsx`) carries no
   numbers of its own. The figure replaces the flagship text metric line — the claim
   appears once, drawn.
4. **Design-reviewer sign-off**: approved with suggestions, zero blocking. All five
   suggestions taken: figure optically centered in the rail (`self-center` — also evens
   out the residual rail whitespace the reviewer re-flagged), figcaption aria-hidden,
   figure text 11px → 12px matching the caption's text-xs (named constant), a
   cross-reference comment on the 208px/13rem coupling, and the 1024px screenshot. One
   geometry fix found post-review during re-capture: 12px labels clipped their ascenders
   at the old svg top edges (dumbbell/bar) — track lines moved down 2px, svg boxes +2px.

Verification on the final state: typecheck/lint/build clean · axe 0 violations · eager JS
**189,593 bytes gzip, unchanged** (server-rendered static SVG, zero client JS) · no
horizontal overflow at 390.

**Honest residual**: the rail below each figure is still whitespace (the figure fills the
top of a tall row; `self-center` distributes it evenly rather than eliminating it). The
proposal's height cap was deliberate — filling the rail would mean decoration, which
Option A exists to avoid. Named here per the reviewer's ask, not implied-solved.
