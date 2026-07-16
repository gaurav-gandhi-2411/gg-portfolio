# Wave 4 Phase 2 — editorial production rebuild — 2026-07-16

Production rebuild of the homepage on Concept A's editorial/magazine system (picked by GG
after the phase-1 concept comparison — see `reports/screenshots/wave4-concepts/` and
`PLAN.md`'s wave-4 phase-1 entry), with Concept B's telemetry band and hero heat-toy
transplanted and restyled editorially, the two named phase-1 weak spots (research, tracegauge)
given deliberate treatment, and a full audience-conversion pass.

## What shipped

- **Base system**: Fraunces display type (`clamp()`-scaled, up to ~9.5rem on the hero name) +
  Space Grotesk body (replaces Inter sitewide) + JetBrains Mono for tabular data figures.
  Numbered `SectionMark` sections (00–05), flagship products as feature spreads with a
  pull-quote signature element, secondary products as a plain editorial index.
- **Transplant 1 — "00 — Live" band** (`components/sections/live-band.tsx`): consolidates the
  wave-3 NowStrip + ShippingLog into one editorial data band. Real Warmer puzzle number, real
  tracegauge weekly downloads, a curated "recently shipped" list — typeset as stat blocks and a
  plain dated list, no bordered panels, no terminal chrome.
- **Transplant 2 — hero heat toy**: same cosine-similarity engine, reframed with a one-line
  plain-language instruction ("I've hidden one word. Type a guess and I'll tell you how close
  you are — this is the exact matching engine behind Warmer...") instead of REPL/dev-tool
  framing. Button copy simplified to "Guess today's secret word."
- **Research weak spot**: abstract renders as a true pull-quote (same voice as a flagship
  storyLine); "Preprint — pending arXiv" is a designed margin note with its own explanatory
  sentence, not a small badge.
- **tracegauge weak spot**: moved out of the secondary product index (where its `pip install`
  command sat awkwardly in a column built for benchmark numbers) into a colophon-style footnote
  at the very end of the page, with the install command set as a real typographic code object.
- **Conversion pass**: resume CTA in the hero AND again at the end of Experience; a consulting
  line in Contact ("Also open to short-term AI/ML build or advisory projects, if the scope is a
  good fit" — wording confirmed with GG); GitHub/live-demo links on every product (flagship and
  secondary, not just flagship); a large, unmissable email CTA closing Contact.

## Design-reviewer sign-off

First pass returned **blocked** on 3 issues: (1) the shipping-log transplant rendered raw git
branch refs verbatim with no human-readable transform, dominated by automated bot-PR noise on
a side repo with zero flagship products appearing; (2) four secondary-tier taglines (ShelfSense,
ReviewIQ, Multimodal Fashion Recommender, and AetherArt on the same pattern) were pure jargon
with no plain-language lead, unlike the flagship taglines; (3) the phase-1 concept-A screenshots
this review needed to diff against didn't exist in this branch.

All three fixed and re-verified in a second pass, which returned **cleared to ship**:
1. `live-band.tsx` now fetches more raw entries, filters out anything matching `/bot/i` in the
   activity detail (catches both `bot/*`-prefixed branches and `fix/bot-pr-sync-*`-style
   branches under a different prefix), caps 2 entries per repo for diversity, and renders a
   humanized sentence ("Fixed hero stat provenance") instead of a raw ref.
   **Residual, non-blocking**: the live GitHub events feed simply hasn't had recent merged PRs
   on the flagship repos (Warmer/mindmeld, Style Maitri, TriageIQ) at review time, so the
   curated list currently surfaces `gg-portfolio` and `gold-rate-tracker` only — a live-data
   availability fact, not a code defect. Will self-correct as those repos ship; flagging
   honestly rather than seeding fake/pinned entries to make the list look more diverse than it
   currently is (rule 65b).
2. Four taglines rewritten to lead with plain language before the em dash, matching the
   flagship pattern exactly. No underlying facts/numbers changed — confirmed by spot-checking
   ShelfSense's WRMSSE figure and ReviewIQ's 83.8% accuracy figure both survived unchanged.
3. `reports/screenshots/wave4-concepts/{a-desktop-full,a-desktop-hero}.png` copied into this
   branch from `explore/wave4-concepts`'s git history.

Also fixed (non-blocking suggestions from the first pass, done anyway since they were cheap
and clearly correct): restored a visible role/location eyebrow in the hero (`site.role` was
previously only used in invisible JSON-LD — concept A's identity had it, production had
silently dropped it); fixed a duplicate screen-reader announcement on hero stats (a
`sr-only` `<dt>` and a visible `<dd>` both carried the same label text — removed the redundant
hidden element).

## Budget

| Checkpoint | Bytes |
|---|---|
| Ceiling (rule 65e re-ratification, `reports/wave3-budget-reratification-2026-07-13.md`) | 220,160 (215 KB) |
| **This wave, final measurement** | **201,895 (197.2 KiB)** |
| Headroom | 18,265 bytes (8.3%) |

Comfortably under budget despite a full homepage rebuild — no new client-side interaction
surface was added (the heat toy reuses its existing dynamic-import shell; the live band is a
Server Component, zero client JS). Two dead-code removals from the wave-3 card-grid era also
shipped in this pass: `components/cursor-glow.tsx` and the `--shadow-glow` token had zero
remaining consumers once the card-grid layout was replaced by the spread/index layout (cursor
hover-glow doesn't map onto full-width editorial spreads the way it did onto a grid of
same-sized cards), and `components/reveal.tsx`'s unused `data-visible`/`group/reveal` stagger
hook (added in wave 3 for the old card grid, never consumed by the new layout) was removed.

## Accessibility

- `npx @axe-core/cli` — **0 violations**, checked repeatedly through the build (before fixes,
  after the design-reviewer fixes, and after deleting `/concepts/*`).
- Correct heading hierarchy end-to-end: `h1` (name) → `h2` per numbered section (Live, About,
  Work, Research, Experience, Contact) → `h3` per product/paper/employer — verified via the
  accessibility-tree snapshot, not just visually.
- Fixed the hero-stats duplicate-announcement bug (see above) as part of this pass.
- Contrast: no new colors introduced this wave — all typography reuses the existing,
  pre-verified dark-graphite + indigo token set from wave 2 (`app/globals.css`'s documented
  WCAG contrast ratios).

## Responsive

Verified at 1440px (desktop) and 390px (mobile emulation) via screenshots in
`reports/screenshots/wave4-editorial-redesign/`: hero, "00 — Live" band, flagship product
spread (desktop + mobile), secondary product index with per-row links, research pull-quote +
margin note, contact CTA, and the heat-toy interaction (activated, guess submitted, feedback
rendered). Mobile screenshots for Research/Experience/Contact/Colophon specifically were not
captured this pass — see the tooling note below — but use the same Tailwind stacking patterns
already confirmed correct in the hero and flagship-spread mobile captures (single-column
`grid-cols-12` collapsing to `col-span-12`, no fixed widths), so risk is low.

## Lighthouse — not captured this pass (tooling failure, not skipped)

The `chrome-devtools` MCP browser tool failed with a persistent "browser already running" error
for the second half of this session, including every Lighthouse attempt. Investigated
thoroughly rather than assumed: killed and confirmed **zero** `chrome.exe` processes running at
the OS level while the tool still reported the conflict, ruling out a real lingering-process
cause; a later tool-availability system message confirmed the `chrome-devtools` MCP server
itself had disconnected mid-session. This is an infrastructure/tooling failure outside the
code, not a UI defect and not something skipped for convenience — flagging it honestly per the
project's standard rather than fabricating a number. **Recommendation: run a Lighthouse pass
against this branch (or the Vercel preview once pushed) before merging to confirm
Accessibility/Best-Practices/SEO scores hold at their prior 100/96/100 baseline** — axe's 0
violations is a meaningful but partial substitute (axe and Lighthouse's accessibility audit
share substantial rule overlap, including contrast, but Lighthouse also scores Best Practices
and SEO, which weren't independently re-checked this pass).

## What's next

This PR is large (a full homepage rebuild) and is opened as a **draft** for GG's manual review
and merge, per the wave-4 instruction that large diffs get draft + human merge rather than
auto-merge — this was never going to be gate-3-eligible at this size and isn't being forced
through.
