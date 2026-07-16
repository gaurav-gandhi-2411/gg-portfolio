# Wave 6 — composition rebuild — 2026-07-17

Branch `feat/wave6-composition-rebuild`. Autonomous wave under GG's standing instruction:
independent audit of the live wave-5 site, rebuild to an external standard, self-verify.
Gap diagnosis (written before any code): `reports/wave6-audit-2026-07-17.md`. Audit + before
+ reference screenshots: `reports/screenshots/wave6/` (+`refs/`).

## What changed (and the principle behind each call)

1. **One grid, one left edge.** Every section (hero included) now shares a `max-w-5xl`
   container; desktop sections compose as a sticky label column + content column
   (paco.me's answer to the same dark canvas). Fixes the audit's hero `max-w-3xl` vs
   `max-w-4xl` 64px misalignment and the "single strip floating in a void" monotony.
2. **Two typographic voices.** Fraunces for name/section heads/product titles/email; Space
   Grotesk for everything else; mono strictly for data. Killed: long italic passages
   (About lead, research abstract block), decorative section numerals, the 10-chip mono
   tag wall (now one prose line), the green status pill (second accent — status is now
   plain indigo text), tracked-caps eyebrows everywhere (one survivor: the Warmer annex).
   Reference basis: every premium reference read with ≤2 voices, hierarchy from
   weight/color (emilkowal.ski, leerob.com).
3. **No boxes.** Outlined cards, pills, chips, and boxed buttons eliminated; links are
   underlined text (`InlineLink` everywhere); the heat-toy input keeps its functional
   field styling. Reference basis: zero drawn boxes across all five references.
4. **Work is flat and scannable.** Carousel deleted (9 products / 5 clicks, visible native
   scrollbar, uneven slide heights — audit finding 6). Three flagship entries with metric
   + engineering story inline, then a six-row index — including tracegauge, promoted out
   of the footer with its live weekly-download count. All of Work scans in ~2 viewports;
   the carousel showed 2 of 9 products per viewport.
5. **About dissolved.** Its lead paragraph (near-duplicate of the hero tagline) IS now the
   hero intro; its day-job paragraph leads Experience. The paragraph's trailing
   50M-docs/$10M clause is no longer displayed there — the identical claim renders 300px
   below as the sourced Data Scientist bullet (duplication, not deletion: sourceRef intact).
6. **Experience tightened.** 7 of 10 bullets shown (`featured` flag — selection, not
   rewriting; all text verbatim with sourceRefs), single-role companies stop repeating
   their dates, tech chips replaced by one prose line, resume link inline. Was ~40% of the
   mobile page; now ~20%.
7. **Interaction layer earns its place or leaves.** Deleted: command palette (+ its ⌘K
   chip that rendered on touch devices), count-up stats, monogram draw-in, reveal-on-scroll.
   Kept: the heat toy (the one signature interaction, still 0 eager bytes until touched),
   now with a per-guess similarity bar; fixed its duplicated intro copy
   (was `products.tsx:74` + `heat-toy.tsx:137`).
8. **Copy de-jargoned for visitors.** Metric labels render in quiet small type (not
   tracked-caps display); provenance-speak ("no placeholder, no guessed date") replaced
   with plain language; footer states the thesis once: "Every number on this page is
   derived from live data or a sourced record."

Constraints honored: living data intact (derived product count, live puzzle number, repo
freshness datelines, tracegauge downloads — all fail-soft); no removed content
reintroduced (Now-strip, shipping log, office-work-in-hero, Uber stats stay out of the
hero); GG's ratified byline hero structure and 40–64px display cap unchanged.

## Verification (all executed on the final state)

- `npm run typecheck` / `lint` / `build` — clean.
- **axe-core: 0 violations** (`npx @axe-core/cli`, final build).
- **Eager JS: 189,608 bytes gzip (185.2 KiB)** vs 220,160 ceiling — **−15,010 bytes vs
  wave 5** (204,618). Full chunk enumeration via gzip fetch of every script in the initial
  HTML, same methodology as waves 3–5. Deletions: palette, carousel shell, count-up,
  reveal, animated monogram; deps removed: `@base-ui/react`, `lucide-react`,
  `class-variance-authority`.
- **Lighthouse** (CLI, desktop preset, local prod build,
  `reports/lighthouse-wave6-2026-07-17.json`): Accessibility **100**, SEO **100**, Best
  Practices 96 (the documented localhost-only `/_vercel/insights` 404 non-defect),
  **Performance 100, LCP 0.6s, CLS 0** — vs wave 5's 79/3.32s with the same methodology.
  The wave-4 "framework floor" conclusion was wrong in hindsight: sections sat at
  `opacity: 0` until the IntersectionObserver reveal fired, so LCP waited on hydration.
  Deleting the reveal layer (a design call, made for composition reasons) also un-stuck
  the metric — and the page is no longer invisible in no-JS/reader/print contexts.
- **Page length**: 5,144px desktop (was 6,090), 6,980px mobile (was ~8,614). See "honest
  shortfalls" below.
- **Screenshots** (`reports/screenshots/wave6/`): after-01 hero 1440, after-02/03/04 full
  pages at 1440/768/390, after-05 heat toy active; before-01…06 (live wave-5 site);
  refs/ (5 reference sites, same day).
- **Driven in-browser**: heat toy (guess flow, single intro copy, similarity bars, focus
  states), sticky section labels, contact email single-line at all 3 breakpoints, links
  keyboard-focusable with visible ring.

## Self-scored teardown — wave 5 live site vs this rebuild vs the reference bar

| Criterion | Wave 5 (live) | Wave 6 (this) | Reference bar |
|---|---|---|---|
| Typography (voices, italic abuse, hierarchy) | 4/10 — 7 voices, long italics, numeral decor | 8/10 — 2 voices + mono-for-data | 9/10 |
| Spacing rhythm (grid, alignment discipline) | 5/10 — hero misaligned 64px, ad-hoc gaps | 8/10 — one container, one edge, sticky rails | 9/10 |
| Color (accent restraint, contrast) | 6/10 — green pill second accent | 8/10 — indigo only, AA everywhere | 9/10 |
| Layout balance (whitespace-to-content, canvas) | 3/10 — 6.8 empty-heavy viewports | 7/10 — composed 2-col, 5.7 dense viewports | 9/10 (refs are shorter) |
| Motion (earns presence?) | 4/10 — count-up, draw-in, reveal decor | 8/10 — hover/focus only + the toy | 8/10 |
| Content density (every section pulling weight) | 5/10 — Experience 40% of mobile page | 8/10 — tightened, de-duplicated | 8/10 |
| Interactive elements (premium or bolted-on) | 3/10 — scrollbar'd carousel, ⌘K on touch, dup copy | 8/10 — one signature toy, fixed | 8/10 |
| Robustness (no-JS, print, capture) | 2/10 — blank below hero without JS | 9/10 — fully static render | 9/10 |
| Copy voice (plain, confident) | 5/10 — jargon caps, provenance-speak | 8/10 | 9/10 |

## Design-reviewer sign-off

Verdict: **approved with suggestions — zero blocking findings.** The reviewer independently
confirmed the composition fix ("genuinely occupies the 1440 canvas at the section level"),
tier legibility without card chrome, the two-voice discipline (grep-verified), and that the
LCP/no-JS fixes are real. All six suggestions were taken same-session and re-verified:

1. Hero status accent was a false affordance (accent-colored non-link) → now a real link
   to `#contact`, underlined like every other link.
2. The Warmer flagship row was the page's worst surviving "void" case (no dateline — private
   repo) → now anchored right with its live puzzle number ("puzzle #N live today",
   fail-soft), a stronger real signal than a commit date.
3. Heat-toy trigger was the page's one boxed element → converted to a text-styled
   underlined trigger; the intro copy above carries the affordance.
4. Contact email's no-underline exception → documented in-component as deliberate.
5. `max-w-[62ch]` ×9 → promoted to a `--container-measure` token (`max-w-measure`).
6. Focus-visible ring claim was self-reported → keyboard focus state captured
   (`after-06-focus-state-1440.png`, indigo ring on the Resume link).

Re-verified after fixes: typecheck/lint/build clean, axe 0 violations, eager JS
189,593 bytes gzip, contact email single-line at 390/768/1440.

## Honest shortfalls

The page is 5,144px at 1440 — denser and composed, but still ~2× the reference sites'
length, because GG's content volume (9 products + 3 employers + a paper, every claim
sourced) is genuinely larger than a design engineer's link list; compressing further means
cutting content, which I judged a worse trade for a recruiter audience. The label-column
composition occupies the canvas structurally, but the right ~200px at 1440 is still
whitespace on text-heavy rows — references solve this with images/artifacts, which this
site deliberately doesn't have (nothing to screenshot for an API service without
fabricating UI). And the heat-toy trigger remains the page's one boxed element pre-click;
I kept it because an input affordance that looks like body text gets missed — but it is a
visible exception to the no-boxes rule. Lighthouse Performance 100 was measured on
localhost (unthrottled network); the production Speed Insights p75 remains the real bar
(instrumented in wave 4, still accumulating traffic).

## Open items

1. arXiv flip (pre-existing, unchanged).
2. Check Speed Insights field p75 LCP once this deploys — expect a large improvement for
   the same reveal-layer reason as the lab number.
