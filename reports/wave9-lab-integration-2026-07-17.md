# Wave 9 — production integration of all 5 wave-8 lab prototypes — 2026-07-17

Branch `feat/wave9-lab-integration` (built on top of `explore/wave8-lab`, merged in —
see "Branch note" at the end). GG clicked through `/lab` live and approved all five
prototypes; this wave builds them production-grade, integrated into the live site per
GG's explicit integration map, and deletes the standalone `/lab/*` route.

## Integration map — what shipped where

1. **Embedding-space visualization → merged into the existing heat toy**
   (`components/heat-toy.tsx`), in its existing location (Warmer annex under Work). The
   guess/history/Cold-Warm-Hot mechanic is unchanged; the plot is an added channel, not a
   replacement — both render from the same real cosine-similarity number. Given the
   headline-feature status, this got the most scrutiny and is where this wave's two real
   bugs were found (see "Bugs found" below).
2. **Staggered reveal → the site's new default entrance pattern**
   (`components/reveal-group.tsx`), applied via `mode="onview"` to the Warmer annex,
   Research, Experience (with a nested per-company group — see design-review fix #1), and
   Contact. **Hero deliberately does not use it** — see "Bugs found," this was a real,
   evidenced reversal, not an oversight.
3. **Momentum slider replaces the flat Work list** (`components/work-slider.tsx`) — native
   scroll-snap (real trackpad/touch momentum, zero JS cost), peek-of-next, pointer-drag for
   mouse, thin progress bar + fraction counter. All 10 products, flagship cards carry their
   real eval figure.
4. **Scroll-linked figure draw-in merged into item 3** — `components/eval-figure.tsx`
   became a client component with an `IntersectionObserver`-triggered `Element.animate()`
   draw-in, rooted to the slider's own scroll container (`rootEl` prop) rather than the
   page viewport, so a figure animates when its *slide* is actually scrolled to.
5. **Live TF-IDF classifier → collapsed, clearly-secondary disclosure on TriageIQ's card**
   (`components/triageiq-classify-toy.tsx` + `triageiq-classify-disclosure.tsx` +
   `triageiq-classify-panel.tsx`), click-to-expand, labeled illustrative/not-production-
   model exactly as in the lab. A floating-popover version was tried first and hit a real
   CSS bug (see "Bugs found") — the shipped version renders the expanded panel in normal
   block flow below the whole slider, connected to its trigger via `aria-controls` +
   scroll-into-view (design-review fix #3).

`/lab/*` and all `components/lab/*` prototype files are deleted; production files fully
supersede them (`content/tfidf-samples.ts` replaces `content/lab-tfidf-samples.ts`).

## Bugs found and fixed during this wave's own build (not carried from wave 8)

Per rule 58c ("verify before declaring done") and rule 85 ("no fix ships without a
mechanism explanation"), every one of these was reproduced, root-caused, and fixed before
moving on — not patched around.

1. **Work-slider cards stretched to match the tallest sibling.** The flex row had no
   `align-items` set (default `stretch`); once TriageIQ's classifier expanded inline
   inside its card, every other card in the row silently stretched to match its height.
   Fixed with `items-start`.
2. **A genuine document-level horizontal-overflow bug**, found while testing the
   TriageIQ classifier expanded + slider scrolled together:
   `document.documentElement.scrollWidth` (1584px) exceeded `innerWidth` (1440px) — the
   exact defect class wave 6 fixed the old carousel for. Root-caused via a differential
   ancestor-chain scrollWidth check (every ancestor from the slider up to `<body>`
   measured clean; only `<html>` diverged from `<body>`), which pointed at the classifier
   panel's `position: absolute` popover escaping the scroller's *effective* clipping —
   confirmed via CSS spec: `overflow-x: auto` forces the UA to compute `overflow-y` as
   `auto` too, so the popover was being silently height-clipped by the scroller, and its
   overflow was leaking to the document root in a way plain `overflow-x/y` measurements on
   the scroller itself didn't show. Fixed structurally, not patched: the expanded panel
   moved out of the card entirely, into normal block flow below the whole slider (item 5
   above) — an absolutely-positioned popover was never the right shape for content inside
   a horizontally-scrolling ancestor.
3. **A real, pre-existing correctness bug in the heat toy's guess feedback**, found while
   QA'ing the headline feature: `guessFeedback()` used `sim < 0` as a sentinel for "word
   not in vocabulary." Cosine similarity is legitimately negative for two real, valid,
   dissimilar embeddings — verified live, "fire" scored **−0.083** against one real secret
   word — so a genuine match with negative similarity was misreported as "Not in the word
   list." This bug has shipped since wave 3 (the sentinel pattern predates this wave); it
   surfaced now because this wave's QA pass tested the guess flow more thoroughly than any
   prior wave did. Root-caused via a debug build (temporary `console.log` of `idx`,
   `vocab.words.includes(word)`, confirmed the lookup was correct — 124, valid — while the
   UI still showed "not found," isolating the bug to the *feedback* function, not the
   *lookup*). Fixed properly: history entries now carry an explicit `found: boolean` field
   instead of inferring "found" from the sign of `sim`. Verified: "fire" and "ocean" now
   correctly show `Cold (-0.08)` / `Cold (-0.04)`; a genuinely-invalid word still shows
   "Not in the word list."
4. **Hero's onload reveal raced axe-core's color-contrast check.** Applying
   `RevealGroup mode="onload"` to Hero (the literal reading of "the site's new default
   reveal pattern... globally") made `npx @axe-core/cli` flaky: 2 of 3 runs failed on
   `color-contrast` for hero elements, 1 passed, on **identical code** — confirming a race,
   not a real defect. Settled-state computed styles (checked directly) showed full
   opacity and the same already-audited, compliant token colors. Root cause: axe-core
   CLI's headless scan can run within the ~800ms first-paint cascade window, catching text
   at a transient low-opacity frame. Fixed by reverting Hero to instant render (no
   `RevealGroup`) — re-affirming wave 2/3's original principle ("Hero renders immediately,
   no reveal-on-load flash") for a second, concrete reason beyond cosmetics: first-paint
   content animating from invisible is fragile against real tooling, not just users on
   slow devices. `onview`-mode sections don't have this race (they only fire once already
   scrolled into view, long after any first-paint snapshot). Re-verified: 5/5 clean axe
   runs after the revert.

## Design-reviewer sign-off

Lens was the explicit reverse of waves 6/7: **"does this now feel modern and alive, or
does it still feel dull?"** — not restraint. Verdict: **approved with suggestions, zero
blocking.** Direct quote: "the Work section (heat-toy plot, momentum slider, TF-IDF toy)
is a real, legible step up from wave-6/7's flat list + Cold/Warm/Hot label — this is the
first wave where 'real-time compute moment' is an accurate description of what ships, not
marketing language." Two of the eight non-blocking suggestions were fixed before merge
per the reviewer's own recommendation (both above, items 1 and 3 in their numbering):

1. **Experience's cascade granularity** — `RevealGroup` only staggers *direct* children;
   the three-company block was one reveal unit, indistinguishable from wave 6's instant
   render at a glance. Fixed with a nested `RevealGroup` around the company list, so each
   company gets its own cascade step (`components/sections/experience.tsx`).
2. **TriageIQ panel connective tissue** — no `aria-controls` relationship and no
   scroll-feedback when the panel (rendered below the whole slider, not the card) opened.
   Fixed: `aria-controls`/`id` pair (APG disclosure pattern) +
   `scrollIntoView({block: "nearest"})` on open, reduced-motion-aware.
3. **A contrast finding on the heat-toy's reference dot** (`opacity={0.6}` on the
   `--text-lo` token computed to 3.03:1, below the 4.5:1 text floor and not in
   `globals.css`'s own contrast table) — also fixed: bumped to `opacity={0.8}`
   (4.55:1, computed not eyeballed).

Suggestions not taken this wave (logged, not blocking): plotting a faint full-vocab
scatter behind the heat-toy's two points for more visual "embedding cloud" context; a
live spot-check of the slider's progress-counter math on secondary-tier (non-flagship)
cards, since the reviewer couldn't verify this without a browser tool — this session
independently drove the slider in-browser afterward and the counter tracked correctly at
every position tested, so this is resolved, just not by the reviewer directly.

## Verification (final build, all fixes applied)

- `npm run typecheck` / `lint` / `build` — clean.
- **axe-core: 0 violations, 5/5 consecutive runs** (the flaky Hero-reveal race, found and
  fixed mid-wave, is the reason this was run 5× instead of once — see bug 4 above).
- **No-JS literal test**: JavaScript disabled at the browser engine level via CDP
  `Emulation.setScriptExecutionDisabled` (the same mechanism Chrome DevTools' own "Disable
  JavaScript" checkbox uses — not a curl/HTML-only check). Screenshot confirms the full
  page renders correctly: hero, stats, both visible Work cards with their real eval
  figures fully drawn (server-rendered SVG attributes, not JS-gated), Research,
  Experience, Contact all present. Method + screenshot in
  `reports/screenshots/wave9/` is referenced from this report; raw capture retained at
  session scratchpad (`no-js-render.png`) since it was produced by a throwaway CDP script,
  not the MCP browser tool.
- **Reduced motion: verified via a genuine browser-level forced media query**
  (`--force-prefers-reduced-motion` Chrome launch flag — confirmed via direct
  `matchMedia` query, not assumed), differentially, with a negative control:
  - Normal motion: heat-toy guess-point position at 30ms vs. 1030ms after submit
    **differs** ((653,1050) → (664,1041)) — proves the test methodology detects real
    animation.
  - Reduced motion: same measurement is **identical** ((664,1041) → (664,1041)) — proves
    the guess point renders at its final position immediately, no animation, on the
    headline feature specifically.
  - This is a materially more rigorous check than wave 8's JS-`matchMedia`-reasoning-only
    verification, per GG's explicit ask.
- **Budget recomputed**: **201,324 bytes gzip (196.6 KiB)** vs. the 220,160-byte (215 KB)
  ceiling — **+11,731 bytes vs. wave 7's 189,593** for: `RevealGroup` (site-wide), the
  heat-toy plot logic, the full `WorkSlider` (replacing the old flat-list Work component),
  and `EvalFigure`'s draw-in logic. Comfortably under budget (~18.8 KB headroom), no
  ceiling change needed.
- **Lighthouse** (`reports/lighthouse-wave9-2026-07-17.json`): Accessibility **100**,
  SEO **100**, Performance **100**, Best Practices 96 (documented localhost-only
  `/_vercel/insights` 404 non-defect, unchanged since wave 4), **LCP 0.7s, CLS 0**.
- **Responsive matrix**: full-page screenshots at 1440/768/390
  (`reports/screenshots/wave9/full-{1440,768,390}.jpeg`); heat-toy plot confirmed
  responsive at 390px (no horizontal overflow, verified via
  `document.documentElement.scrollWidth === innerWidth`); slider peek confirmed visually
  noticeable at 390px (design-review finding, resolved).
- **Real screen recordings**: re-checked for a recording tool per GG's ask — none
  available in this harness (same conclusion as wave 8). Verification here instead relies
  on CDP-driven differential position measurements (a stronger, quantitative substitute
  for visual recording — see reduced-motion section above) plus static screenshots.

## Honest gaps

- The design-reviewer's suggestion to plot a faint full-vocab scatter behind the heat-toy
  points (for a stronger "embedding cloud" visual) was not implemented this wave — logged
  as a fast-follow, not required for the "highest-leverage" bar GG set.
- `explore/wave8-lab` is **not deleted yet**, despite the instruction — its commit is not
  yet an ancestor of `main` (`git log origin/main..explore/wave8-lab` is non-empty; it
  only exists via this WIP branch). Deleting it now would risk losing that history if
  this PR needs rework before merging, violating the standing rule (never auto-delete a
  branch without confirming `git log <default>..<branch>` is empty). Deferred until after
  this PR merges to main, at which point the ancestor-check will pass cleanly — noted as
  an open follow-up in PLAN.md.
- The two bugs found in wave 9's own build (slider stretch, horizontal overflow) were
  introduced and fixed within this same wave, so they never reached `main` — noted here
  for the record per rule 53 (honest about what didn't work first try), not because they
  shipped.

## Branch note

This branch was created from `main` and then merged `explore/wave8-lab` into it (to
inherit the lab prototype files, which only existed on that branch), before doing the
production-integration work on top. `git log` on this branch therefore shows wave 8's
lab-prototype commit as an ancestor — expected and intentional, not a rebase artifact.
