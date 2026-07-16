# Wave 5 — restraint + restructure — 2026-07-16

Branch `feat/wave5-restraint-restructure`. GG's brief: the wave-4 editorial design was
over-scaled and unbalanced; reposition the site around independent work, cut the display
type hard, convert products to a carousel, relocate the heat toy, remove the
building-in-public surfaces. Reference for feel only: maninder.vercel.app (studied in-browser,
principles extracted and measured — not cloned).

## Reference principles extracted (measured, not eyeballed)

- H1 72px desktop / 40px mobile — only ~1.5× the 48px section headings. Hierarchy from
  weight and whitespace, not size jumps. Scale: 72 → 48 → 28 → 18 body.
- Whitespace does the separation: 128px vertical section padding, ~1150px content width.
- Hero formula: eyebrow → headline → one-line role → stat chip → CTA row. Employment
  appears once, in the role line; all headline stats are personal/independent numbers.
- Projects: calm equal-weight cards, quiet category badges, ~28px serif titles, one text
  CTA each.

## Phase 0 — hero options ratified before the rebuild

Two hero variants at the restrained scale (both capped at clamp(2.5rem, 5vw, 4rem) =
40–64px vs. wave 4's 180px) built as throwaway routes on `explore/wave5-hero-options`,
screenshotted desktop + mobile (`reports/screenshots/wave5-hero-options/`), posted for GG's
pick before any production code — the last two waves over-committed before GG saw
proportions. **GG picked Option A ("byline"): left-aligned, name-led, tagline in the quiet
body voice.** The scale below was ratified by that pick.

## Type scale (tokens in app/globals.css, rule 15b)

Modular scale, ratio exactly 1.25 on the 18px body the site already reads at:

| Token | Size | Assigned to |
|---|---|---|
| (text-lg, Tailwind) | 18px | body copy |
| `--text-lead` | 22.5px | about lead, sub-role titles, hero stat figures |
| `--text-title` | 28.1px | product card titles, research title, employer names |
| `--text-heading` | 35.2px | contact email CTA, section-mark numerals |
| `--text-stat` | 44px | research pull-quote mark (decorative) |
| `--text-display` | clamp(40→64px) | hero h1 only — the GG-ratified cap, the one ratio exception |

Retired sizes, before → after: hero 180px → 64px max; section numerals 104px → 35px;
flagship product titles 88px → 28px; flagship metric figures 72px → 18px mono in cards;
contact email 64px → 35px. Weights dialed from `font-black` to `font-semibold` throughout.
Plus one `--tracking-eyebrow: 0.3em` token replacing four ad-hoc eyebrow tracking values
(0.2/0.25/0.3/0.35em) found during the audit. Verified by grep: no component carries its own
`clamp()`, `text-3xl+`, or `font-black` anymore; no arbitrary `tracking-[...]` remains.
Vertical rhythm: every section `py-16 md:py-24`, content starts `mt-10` after its
section mark.

## Positioning shift

- **Hero stats**: employer-derived figures (50M+ docs, $10M+ savings) removed from the hero
  — they remain, with context, in the Experience section. `content/site.ts` scaffolds three
  independent-work stats: the derived live-product count (real) plus two visible em-dash
  placeholders marked `TODO(GG)` — **open item: GG supplies the two remaining numbers.**
- **"Now / Right now" strip: removed entirely** (`content/now.ts` deleted).
- **"Recently shipped" / shipping log: removed entirely** (`getShippingLog` deleted from
  `lib/live-data.ts`; the whole `live-band.tsx` section deleted — the two surviving live
  data points relocated to where they have context: Warmer's puzzle number into the
  heat-toy annex, tracegauge weekly downloads into its colophon footnote).
- Orphans deleted with the section: `flagship-feature.tsx`, `secondary-index.tsx`.

## Products → carousel

New `components/work-carousel.tsx` (client, the wave's only eager-JS addition): 9 slides
(3 flagship first, then secondary; tracegauge keeps its colophon treatment). Native
scroll + CSS scroll-snap does the sliding — touch/trackpad cost zero JS — with a thin shell
for arrows, slide-wise keyboard steps (ArrowLeft/Right/Home/End), and the position counter.
A11y per the APG carousel pattern: `role="region"` + `aria-roledescription="carousel"`,
slides `role="group"` + `aria-roledescription="slide"` + "N of M: name" labels, focusable
labelled scroller, visible focus rings, no aria-hidden on off-screen slides (links stay
tabbable), smooth scrolling collapses to instant under `prefers-reduced-motion`.

**Three real bugs found and fixed during in-browser verification** (rule 58c — driven, not
assumed):
1. `offsetLeft`-based scroll targets double-counted the container's page offset (the slide's
   offsetParent is the page, not the unpositioned scroller) — scroll-snap partially masked
   it into a two-slide jump. Fixed with rect-based math.
2. IntersectionObserver current-slide tracking was ambiguous: with card-width slides, two
   slides clear any visibility threshold simultaneously and "current" landed on whichever
   entry came last — stepping then skipped slides. Replaced with nearest-snap-offset
   derivation from scroll position, which cannot be ambiguous.
3. `role="group"` on `<li>` is an axe violation (aria-allowed-role) and breaks the parent
   list's structure (list) — caught by the axe scan, restructured to the APG div pattern.

Stepping robustness: arrows/keys step from a target ref, not the rendered index (mid-animation
the visual index lags intent — rapid input verified to land exactly N slides on), and free
swipes resync the target immediately via the scroll handler.

## Heat toy relocation

Out of the hero, into a Warmer annex directly under the carousel: eyebrow "From Warmer's
engine — puzzle #N today" (live number, fail-soft) + GG's exact intro copy verbatim ("I've
hidden one word. Type a guess and I'll tell you how close you are — this is the exact
matching engine behind Warmer, my daily word game.") + the same lazy-loading shell
(renamed `heat-toy-shell.tsx`, still 0 eager bytes for the engine + vocab until first
interaction). Verified playable in place.

## Design-reviewer sign-off (lens: "balanced and restrained, or does it shout?")

Verdict: **approved with suggestions** — desktop restraint a clear pass, carousel called out
as "the wave's strongest specific win." Two blocking findings, both fixed same-session and
re-verified:
1. **Mobile hierarchy inversion** (real bug, caught by the reviewer's math): the section
   numeral at `--text-stat` (44px fixed) out-sized the h1's 40px floor on every viewport
   ≤800px — the largest glyph on mobile was a decorative aria-hidden numeral. Fixed:
   numerals → `--text-heading` (35px), verified 40px > 35px on the 390px viewport.
2. **Rhythm break**: Experience used `mt-4` after its section mark where every other section
   uses `mt-10`. Fixed.
Non-blocking suggestions also taken: hero stat figures moved off the only non-token size
(`text-2xl` → `--text-lead`); eyebrow tracking consolidated into `--tracking-eyebrow`.
Logged, not taken this wave: a return-to-Warmer affordance on the heat-toy annex for
visitors who scrolled the carousel elsewhere (copy already names Warmer; revisit if field
feedback suggests confusion).

## Verification (all executed, not assumed)

- `npm run typecheck` / `npm run lint` / `npm run build` — clean (final state, post-fixes).
- **axe-core: 0 violations** (`npx @axe-core/cli`, post-fixes; the earlier scan caught the
  carousel role bug — 10 issues — all cleared).
- **Carousel driven in-browser**: arrows, ArrowLeft/Right/Home/End, rapid multi-step, free
  scroll + snap resync, disabled states at both ends, reduced-motion instant path — all
  land on exact slide positions (see bug 1–3 above for what this testing caught).
- **Eager JS budget: 204,618 bytes (199.8 KiB) gzip** vs. 220,160-byte (215 KB) ceiling —
  full chunk enumeration via curl gzip against every chunk in the initial HTML, same
  methodology as prior waves. +2,723 bytes vs. wave 4 (the carousel shell); the heat-toy
  engine and palette UI remain dynamic-import-only.
- **Lighthouse** (CLI, desktop, local prod build — `reports/lighthouse-wave5-2026-07-16.json`):
  Accessibility **100**, SEO **100**, Best Practices 96 (the documented localhost-only
  `/_vercel/*` 404 non-defect), performance 66 / LCP 3.33s — statistically identical to the
  wave-4 accepted framework floor (3.35–3.48s, same methodology,
  `reports/wave4-lcp-investigation-2026-07-16.md`); the redesign adds no LCP regression.
- **Screenshots** (`reports/screenshots/wave5-restraint/`): 01 desktop full page (1440),
  02 mobile full page (390), 03 hero desktop, 04 carousel mid-track. All captured post-fixes.

## Open items

1. **TODO(GG): the two remaining independent-work hero stats** — placeholders render as
   em-dashes until supplied (`content/site.ts`).
2. arXiv flip for the research section (pre-existing, unchanged).
3. Design-reviewer's non-blocking heat-toy-annex affordance suggestion (logged above).
