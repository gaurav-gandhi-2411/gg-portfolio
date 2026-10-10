# Direction B design rubric (written-rubric pass, 2026-10-10)

Scope: layout, typography and a11y only. No change to claims, numbers, titles or
wording about GG. Measured on a local production build (`next build` + `next start`)
at 320, 375, 768 and 1440px, light scheme unless stated (dark checked for contrast).
Local Lighthouse is not used (invalid on this machine).

Scale per criterion: 0 broken, 1 visible defects, 2 minor defects, 3 clean.
"Before" is origin/main at 41ab775; "after" is the three PRs below.

| PR | Branch | Concern |
|----|--------|---------|
| #302 | fix/design-b-nav-contact | nav scrim, current-page marker, accessible-name guard |
| #303 | fix/design-b-search-empty | /projects empty-search state, tailwind-merge size bug |
| PR 3 | fix/design-b-hero-contrast | hero token, small-text contrast, 1440 fold, 320 card pill, this rubric |

## Scores

| Criterion | Before | After | Evidence |
|-----------|:------:|:-----:|----------|
| Hierarchy | 2 | 3 | 1440 fold had the identity block pinned to the top with the lower ~40% empty (gap above 65px, below ~340px); now centred (test asserts neither side exceeds 2x the other). Empty-search showed the same sentence twice plus "Showing 0 of 0". |
| Contrast (text) | 2 | 3 | axe `color-contrast`: 0 violations before and after at all 4 widths on /, /projects, empty search. Computed-colour sweep (below) found 1 real failure, fixed. |
| Spacing / tokens | 2 | 3 | `.hero-name` used a literal `clamp(2.35rem, 6.6vw, 5.2rem)`; now `var(--text-hero)` (same values; measured 37.6px at 375, 83.2px at 1440, unchanged). Remaining literal: see deferred D3. |
| Touch targets (>=44, 24 min) | 2 | 2 | Nav, menu, filter pills, hero actions, social icons all >=44. Not fixed: see deferred D1, D2. Nothing under 24px except inline link rows listed in D1 (18-20px tall). |
| Focus visibility | 2 | 2 | NOT MEASURED systematically. Nav links/toggle/pills carry `:focus-visible` outlines in CSS; menu focus trap and Esc return are covered by `e2e/nav-menu.spec.ts`. No change made. |
| Overflow | 3 | 3 | `scrollWidth - clientWidth` = 0 at 320/375/768/1440 on /, /projects, empty search, before and after; `no-horizontal-overflow.spec.ts` green. Card title ran under the status pill at 320 (text overlap, not scroll overflow): fixed. |
| Above the fold, 375 | 3 | 3 | Name, Lead Data Scientist, Uber, $10M+ and ~70%, Resume CTA, four contact icons all visible (screenshots). Unchanged. |
| Above the fold, 1440 | 2 | 3 | Same required items visible before; layout was top-heavy. Now centred, all items still in the 900px fold. |
| Nav (mobile menu) | 2 | 3 | Open menu had no scrim and a tint-only current-page cue. Scrim + inset bar + weight 600 on `aria-current`. |
| Accessible names | 3 | 3 | Hero icons were already named (GitHub, LinkedIn, Hugging Face, Email); zero unnamed links/buttons on measured routes. A test now guards it. |

## Findings from the brief

| ID | Finding | Status | Detail |
|----|---------|--------|--------|
| a | hero h1 size not a token | FIXED (PR 3) | `--text-hero` in `@theme`, same clamp. |
| b1 | /projects empty-search duplicate content | FIXED (#303) | Dropdown popover removed; grid state is the single `role="status"`; zero counter hidden. |
| b2 | Ask pill overlaps something at 768 | NOT REPRODUCED | Scroll-probe of /, /projects, /open-source, /research, /work/triageiq, /work/warmer in 250px steps at 375/768/1024/1440: 0 intersections between the launcher and any link/button/text box. Hidden on /projects below lg by design. Shapes not covered: pages other than those six, pointer-state overlays (hover tooltips, open provenance popovers). |
| b3 | tailwind-merge drops `text-caption` (project-search.tsx:278) | FIXED for that site (#303) | Bracket form. Sibling site `components/metric-provenance.tsx:292` has the same group collision (see D4). |
| c | Small-text contrast | FIXED (PR 3) | Only failure: `.hero-role-detail` ("via Indium Software") at 11.5px, `opacity:.75`: 3.78:1 light, 4.12:1 dark. Opacity removed: now >= 4.5 in both (test). |
| d | Menu scrim + active marker | FIXED (#302) | Test asserts written first and failed on the reverted build. `aria-current` already existed; the marker is now more than a tint. |
| e1 | Half-empty fold at 1440 | FIXED (PR 3) | `.hero-inner` centres at >= 1024px. Linux baselines regenerated for the home route only. |
| e2 | Unlabeled contact icons | VERIFIED, NO CHANGE | All icon links have `aria-label`; hover/focus tooltip already exists. |
| f | 320px pill overlap in cards | FIXED (PR 3) | Overlaps at 320 on multimodal-fashion-recommender, shelfsense, dealhunter (title glyphs under the pill). Decorative project mark is hidden when the card container is under 230px of content width. 0 overlaps at 320/340/375 after. |

### Computed-colour sweep (what it covered)

Every visible text node on /, /projects, /open-source, /research, /work/triageiq,
/work/warmer at 320/375/768/1440 (light) and /, /projects, /work/triageiq at
375/1440 (dark): foreground (with element and ancestor opacity) composited over
the nearest solid ancestor background versus 4.5:1 (3:1 for large text).
Limits: text over gradient backgrounds (project cards, hero stat gradient text,
`background-clip:text`) is measured against the nearest solid ancestor, not
sampled from pixels; the gradients are low-contrast tints so a failure there is
unlikely but not excluded. Text inside canvas/SVG (embedding figures) is not
covered. The status/metric pills pass under this method.

## Deferred

| ID | Item | Reason |
|----|------|--------|
| D1 | Inline link rows on the homepage ("Pull request ↗", "Landing commit ↗", "PyPI ↗", "Repo ↗", "#6739") are 18-20px tall | Below the 24px WCAG 2.5.8 floor where they are not in running text. Fix is per-section row spacing across several sections; out of a 3-PR budget, wants its own visual check. |
| D2 | `/projects` search input is 42px tall | 2px under the 44px target; one-line `min-h-11` change, not bundled to keep PR 2 to one concern. |
| D3 | Other literal font sizes/clamps outside the hero | Not audited; only the h1 was in the brief. |
| D4 | `metric-provenance.tsx:292` tailwind-merge group collision (`text-popover-foreground` vs `text-caption`) | Fixing it (or configuring `extendTailwindMerge` with the custom `--text-*` sizes) changes popover colour or every `cn()` caller; needs a dedicated PR with visual review. |
| D5 | Focus-ring visibility audit | Not measured this pass. |

## GG-decision proposals (not implemented: they would add claims)

1. A one-line proof strip on each project card or under the hero linking to the case-study headline number, to fill the 1440 fold with evidence rather than whitespace.
2. A "currently at Uber" logo/wordmark treatment in the hero byline.

Both add or restate claims about GG, so they are left for a content decision.
