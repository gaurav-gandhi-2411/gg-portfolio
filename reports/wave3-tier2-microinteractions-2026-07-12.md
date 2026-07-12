# Wave 3 Tier 2.5+2.6 — command palette + micro-interactions — 2026-07-12

Scope: command palette (⌘K / `/`), animated count-up on hero stats, animated monogram
draw-in, magnetic cursor-glow on flagship product cards + the research card, and staggered
reveal on the products card grids. Measured against a **local production build**
(`npm run build && npm run start`), same methodology as wave 2 (rule 65b).

## Budget table

| Metric | Prior (Tier 1 + 2.4, PR #8) | This PR | Delta |
|---|---|---|---|
| Eager JS (gzip, homepage) | 204,762 bytes (200.0 KiB) | 207,862 bytes (203.0 KiB) | **+3,100 bytes (+3.0 KiB)** |
| Command palette UI (search/list/keyboard nav) | — | dynamic import, 0 eager bytes | loads only on ⌘K/`/`/click |
| axe-core violations | 0 | 0 | PASS |
| Lighthouse Accessibility | 100 | 100 | PASS |
| Lighthouse Best Practices | 96 (1 pre-existing local-only finding) | 96 (same 1 finding) | no change |
| Lighthouse SEO | 100 | 100 | PASS |
| CLS | 0.00 | 0.00 | PASS |

Full JS chunk enumeration (gzip, via `curl -H "Accept-Encoding: gzip"` against every
`/_next/static/chunks/*.js` referenced in the initial HTML):

| Chunk | Size (gzip) |
|---|---|
| `0iec5q4ack_04.js` (React + Next.js runtime) | 70,982 |
| `0cz1d0mv5g_q7.js` (core-js polyfills, framework default — see wave-2 erratum) | 39,627 |
| `20msfz3016icq.js` | 38,777 |
| `16qmlxq9f3ku7.js` | 18,210 |
| `14mumt5_n0xhi.js` | 13,813 |
| `1ptwltjb3h6jf.js` | 10,752 |
| `2tfmhdq7fyu1m.js` | 7,648 |
| `turbopack-06y037vsppmgz.js` | 4,150 |
| `05nmevpxw-0i9.js` | 3,238 |
| `0icbp1agttmjw.js` | 383 |
| `1d4h-sglyo8ft.js` | 282 |
| **Total** | **207,862 bytes (203.0 KiB)** |

The +3.0 KiB delta is the sum of every eager-loaded piece added this tier: the command
palette's global keydown-listener shell (button + `useEffect`, the heavy search/list UI is
`next/dynamic`-imported and loads only on first trigger), `CountUpStat`, `AnimatedMonogram`
(mostly inline SVG + a CSS keyframe, negligible JS), and `CursorGlow` (one `useRef` +
mousemove handler, instantiated 4× — 3 flagship product cards + the research card). Against
the wave-2-corrected 165 KiB re-baseline (`wave3-live-stats-budget-2026-07-12.md`), Tier 1
added 0 bytes and Tier 2.4 added 1,556 bytes (the heat-toy shell) — this tier's 3,100 bytes
keeps the cumulative wave-3 eager total at 207,862 bytes, i.e. **+42.9 KiB over the 165 KiB
target**. That target was set before the wave-2 measurement erratum was discovered (the real
wave-2 floor was already 200.0 KiB, not 161.3 KiB — see the erratum in
`wave2-perf-budgets-2026-07-12.md`). Restated against the corrected floor, wave 3 so far has
added a total of 4,656 bytes (1,556 + 3,100) of eager JS across two shipped tiers, all of it
small interaction shells with the actual feature UI behind dynamic imports. Flagging this
honestly rather than silently re-defining the target a second time — the operative guardrail
this wave has been "every new feature adds near-zero eager bytes," which holds.

## LCP: no regression, after re-baselining under identical conditions

Initial measurement showed LCP at 208–210ms across two runs (Chrome DevTools performance
trace, localhost, unthrottled — same caveat as wave 2: this is a regression *signal*, not a
field metric), against the wave-2 report's recorded baseline of 171ms. That's +21.7%, over
the 10% guardrail — investigated before shipping rather than waved through.

**Root-cause check:** re-measured the exact pre-this-PR commit (`32d1e88`, Tier 1 + Tier 2.4)
in an isolated `git worktree`, built fresh, served on a separate port, traced under the
current system load (same machine, same session, run immediately after the branch
measurements). Result: **211ms** — statistically identical to this branch's 208–210ms (a
third run on the branch came in at 199ms; three-run branch average ≈ 205.7ms).

**Conclusion:** the wave-2 report's 171ms figure was measured under different background
system load on 2026-07-12 earlier in the session and was never a stable number to diff
against — LCP on an unthrottled localhost trace is sensitive to whatever else is running on
the machine at measurement time, not just page weight. This PR's actual code changes add
**no measurable LCP cost**: 205.7ms (this branch, 3-run avg) vs. 211ms (identical commit,
re-measured right now) is noise, not a regression. Root cause of the 198–204ms "render delay"
phase itself (not new this PR — present in the freshly-measured baseline too) is React/Next
hydration cost on the LCP paragraph, unrelated to any Tier 2.5/2.6 code.

**Going forward:** treat 171ms as stale and no longer a valid comparison point; ~205–211ms
(this session, this machine, unthrottled) is the current honest baseline. Documenting this
transparently rather than either (a) silently keeping the old number or (b) hiding the
investigation — same posture as the wave-2 JS-budget erratum.

## Accessibility: 1 finding, fixed before merge

Lighthouse flagged `label-content-name-mismatch` (WCAG 2.5.3) on the command-palette trigger
button: it had both visible text ("⌘K Search") and an `aria-label="Open command palette"`
that didn't include that visible text — voice-control users saying "click Search" wouldn't
match. axe-core's default ruleset didn't catch this (different rule coverage than
Lighthouse's a11y-best-practices audits). Fixed by removing the redundant `aria-label` and
letting the button's own visible text serve as its accessible name
(`components/command-palette-shell.tsx`). Re-ran Lighthouse post-fix: 0 findings in that
category, Best Practices back to the same 96/100 as wave 2 (only the pre-existing, confirmed
non-defect `/_vercel/insights/script.js` 404 in local dev — real production returns 200).

axe-core (`npx @axe-core/cli http://localhost:3000 --exit`): **0 violations**, both before and
after the fix (didn't regress, didn't improve — it was never able to see this class of issue).

## What shipped

- **Command palette** (⌘K, `/`, or click) — `components/command-palette-shell.tsx` (eager,
  ~1.5 KB) + `components/command-palette.tsx` (dynamic-imported on first trigger). Native
  `<dialog>` for built-in focus trap and Escape-to-close. Lists all sections, all products
  with a live demo (tracegauge excluded — PyPI-only, no `liveUrl`), and 4 actions (resume,
  email, GitHub, LinkedIn). Verified: opens via ⌘K, filters as you type, closes on Escape,
  closes on backdrop click.
- **Count-up hero stats** — `components/count-up-stat.tsx`. Animates the numeric portion of
  each stat (9 / 50M+ / $10M+) from 0 once on mount, 900ms, cubic ease-out. Reduced-motion:
  duration collapses to 0 inside the RAF callback (not a bare effect-body `setState`, which
  would trip `react-hooks/set-state-in-effect`).
- **Animated monogram** — `components/animated-monogram.tsx`. Pure SVG + CSS
  `stroke-dashoffset` keyframe draw-in, replacing the static `logo-mark.svg` `<Image>` in the
  hero. `motion-reduce:` variant snaps straight to the final state.
- **Cursor-glow** — `components/cursor-glow.tsx`. Soft indigo radial highlight following the
  pointer, applied to the 3 flagship product cards and the research card (not the 8 secondary
  product cards — restrained per brief, "a soft highlight, not a spotlight"). `motion-reduce:`
  hides it entirely.
- **Card-grid stagger** — `components/reveal.tsx` gained a `data-visible`/`group/reveal` hook;
  `components/sections/products.tsx` uses it to stagger each card's own opacity/translate-y
  transition, capped at 70ms/card up to a 280ms max spread (comfortably under the brief's
  400ms ceiling regardless of how many product cards the grid grows to). Applied to the
  `CursorGlow` wrapper for flagship cards (so cursor-glow and stagger compose without a double
  wrapper) and directly to the `Card` element for secondary cards.

## What was cut (Tier 3.7 — dynamic OG images)

Not built. The brief's own conditional applies: *"Dynamic OG images per section route if
sections gain routes; otherwise keep single OG."* This is still a single-page site — no
section has its own route — so there is nothing for a per-section OG image to key off. The
existing dark+indigo `opengraph-image.tsx` from wave 2 remains the single OG. Revisit if/when
any section (e.g. Research, once there's more than one paper) gets a dedicated route.

## Screenshots

`reports/screenshots/wave3-palette-microinteractions/`:
1. `01-hero-monogram-countup.png` — hero with animated monogram (settled) and count-up stats
   (settled at 9 / 50M+ / $10M+)
2. `02-products-flagship-cursorglow.png` — flagship product grid, staggered-in
3. `03-command-palette-open.png` — palette open via ⌘K, full unfiltered list
4. `04-command-palette-filtered.png` — palette filtered to "warm", showing live keystroke
   filtering
5. `05-cursor-glow-hover.png` — Style Maitri card mid-hover, indigo glow visible near the
   cursor position

No screen-capture video was taken this pass (static screenshots plus the interaction
descriptions above cover the same evidence — 15c requires screenshots for UI changes, video
is called out as a bonus for the hero interaction specifically, which was already delivered
with screenshots in the Tier 2.4 PR #8).
