# Wave 11 — calm base, concentrated wow

Branch `feat/wave11-calm-base-wow` off `main@befa5c1`. GG's direction, reconciling the
"calm/centered like maninder.vercel.app" and "modern/impressive" feedback that pulled
previous waves in opposite directions: the FOUNDATION stays restrained and centered; the
ENERGY concentrates in exactly three deliberately-placed moments. Full design authority,
no mid-build option gates.

## Reference study (maninder.vercel.app, loaded and measured in-browser)

Principles extracted (feel, not pixels — same rule as wave 5's study):

- One symmetric center axis; the hero is fully centered (eyebrow → headline → subline →
  actions). Nothing anchors left.
- Centered section headers; sections separated by whitespace, not hairline rules.
- Depth comes from one soft glow + gradient numerals, not borders or boxes.
- Vertical rhythm roughly 2× what our wave-10 page used.

Against that, production (wave 10) hugged the left edge of a max-w-5xl grid with a sticky
label rail — at 1440px the right half of the viewport was empty. That asymmetry was the
single biggest source of the "not there yet" reads.

## The foundation (the calm 90%)

- One centered column: `max-w-2xl` for prose sections, `max-w-3xl` for Work's cards and
  the hero (components/section.tsx `wide` prop). The wave-6 sticky label column is gone.
- Centered section headers (`h2` at text-title + mono note + optional lede paragraph).
- Hairline section separators removed — `py-16 md:py-24` whitespace does the separation.
- Contact fully centered (the page's closing note); footer centered.
- Voice and content: wave-10-approved copy carried verbatim. The one structural change:
  the approved intro paragraph is split at its natural seam — sentence 1 is the hero's
  one-line intro; sentences 2–3 (the product list + honest-numbers line) open the Work
  section they describe (content/about.ts documents the split).

## The three wow moments (the concentrated 10%)

### 1. Boot loader (components/boot-loader.tsx + globals.css timeline)

Full-viewport curtain in the page's own background token: the GG monogram draws itself
(pathLength-normalized strokes, 80–300ms staggers, 500ms draw), a hairline fills beneath
it (550ms), and at 620ms the curtain clip-path wipes upward (380ms,
`cubic-bezier(0.83,0,0.17,1)`) revealing the hero top-down. Visually complete at ~1.0s.

Safety design (this is where waves 6 and 9 got burned, so it's structural, not tuned):

| Risk | Mechanism |
|---|---|
| axe contrast race (wave 9) | Content NEVER renders below full opacity — the overlay covers it, painted in the exact `--background` token, `aria-hidden`, `pointer-events:none`. A mid-animation axe pass computes identical contrast. Verified: **5/5 axe runs, 0 violations**. |
| No-JS blank page (wave 6 class) | Overlay is `display:none` by default; a pre-paint inline head script opts IN via `html[data-boot]`. No JS → attribute never set → overlay can never display. Verified on SSR HTML: overlay present, `data-boot` absent, full content server-rendered. |
| Reduced motion | The same gate script checks `prefers-reduced-motion` before opting in, plus a CSS belt-and-braces `display:none` media rule. Verified via matchMedia-stub differential: attribute never set, node cleaned up immediately. |
| Hydration lag | The exit is pure CSS with fixed delays — the reveal does not wait for React. The effect only removes the dead node afterward (~1.15s). |
| LCP | Local Lighthouse: **perf 100, LCP 0.7s, CLS 0** — identical to wave 9/10's baseline; the overlay costs nothing measurable. |

### 2. Hero (components/sections/hero.tsx)

Centered stack: monogram → name → role/location/status → one-line intro → links → stats.
Two touches, calm around them:

- `.hero-halo` — one blurred conic disc of the single ratified accent (alpha-only
  variation), 28s transform-only rotation, static under reduced motion, `z-index:-1`
  behind the header content.
- `.stat-figure` — gradient numerals on the stats row (maninder's one "rich" texture),
  `--text-hi` → `--indigo`; both endpoints independently pass AA on this background
  (16.96:1 / 6.60:1 — globals.css token table), so no point of the gradient can dip
  below 4.5:1.

Stats stay the wave-10 GG-ratified set (two derived, one verbatim resume claim — same
sourceRefs, unchanged).

### 3. Work (components/sections/work.tsx — the slider is retired)

Third pass on this section (wave 9 "can't slide it"; wave 10 fixed the mechanics, GG:
"classy modern is not there"). Eleven heterogeneous cards fought the slider pattern
twice; the wave-11 brief's own bar — usability + beauty over the slider concept — points
at a crafted static presentation:

- **3 flagship showcase cards**: full-column soft cards (`bg-card/60`, radius-xl), title +
  live dateline, tagline, storyline, links, and the eval figure as a vertically-centered
  right rail on md+. Hover: indigo border + tokenized `--shadow-card-hover` lift
  (300ms ease-out, suppressed under reduced motion).
- **8-card index grid** (2-col ≥sm): same card language, quieter — name, tagline, metric
  line, links; tracegauge keeps `pip install` + live weekly downloads.
- **TriageIQ disclosure moved inline**: with no `overflow-x` scroller, the panel finally
  renders adjacent to its button (plain APG disclosure; the waves-9/10 remote-panel
  workaround and its scroll-into-view choreography are deleted).
- Heat-toy annex unchanged (centered), zero eager bytes until interaction.

Consequences: the slider's whole client bundle is gone. **Eager JS 201,535 → 191,179 B
gzip** (−10,356 B; ceiling 220,160 B, headroom now 28,981 B). Measured by fetching every
`<script src>` chunk on `/` from the local prod build and gzip-9 summing
(scratchpad script; same enumeration style as the wave-3 corrected method).

## Verification — local prod build @ f7703d3

| Check | Result |
|---|---|
| lint / typecheck / build | clean |
| axe-core 4.12.1 | **0 violations, 5/5 consecutive runs** (loader-race differential) |
| No-JS | SSR HTML: full content present; overlay `display:none` default, gate attr absent |
| Reduced motion | matchMedia-stub differential: loader never opts in; halo/reveal static via CSS media rules |
| Lighthouse (desktop, localhost) | perf **100** · a11y **100** · SEO **100** · BP 96 (known localhost-only `/_vercel` 404 non-defect) · LCP 0.7s · CLS 0 — `reports/lighthouse-wave11-2026-07-17.json` is the preview run below |
| JS budget | **191,179 B gzip vs 220,160 ceiling** (−10,356 vs wave 10) |
| Loader frames | scrubbed deterministically via paused WAAPI `currentTime` (disclosed technique, same as wave 8's recordings) |

## Verification — deployed preview (PR #19)

Run against the branch-alias preview
(`gaurav-gandhi-git-feat-wave-11d6be-…vercel.app`, deployment READY @ `f7703d3`;
re-verified spot checks after the review-fix push `cbf3a6b`):

| Check | Result |
|---|---|
| Wave 11 build live | loader ran + node cleaned up, halo present, 11 work cards, header text-align center |
| axe-core 4.12.1 (preview) | **0 violations** |
| Lighthouse (desktop, preview) | perf **100** · a11y **100** · BP **100** · LCP **0.6s** · CLS **0** — `reports/lighthouse-wave11-2026-07-17.json`. SEO 63 is the documented preview-only `X-Robots-Tag: noindex` artifact (wave 4 finding); production stays 100. |
| TriageIQ disclosure | opens inline in-card on the preview, panel adjacent to its button (screenshot `triageiq-disclosure-inline-1440.png`) |
| Heat toy | vocab loads on preview; "jungle" guess plots reference + guess dots with Cold (0.06) feedback |
| Live data | puzzle #36, per-repo "shipped Nd ago" datelines, 32 tracegauge weekly downloads all rendering |
| Fail-soft degradation | dateline span DOM-removed (reproduces the exact conditional-render-omitted markup a failed fetch produces): card height and title position shift **0px / 0px** — `failsoft-no-dateline-1440.png` (technique disclosed; requested by design review) |
| Responsive matrix | `reports/screenshots/wave11/full-{1440,768,390}.jpeg` (preview, not localhost) |
| Recordings | `loader-entrance.gif` (8 frames), `hero-halo-drift.gif` (quarter-rotation scrub), `work-hover.gif` (rest → Warmer hover → Style Maitri hover). Frames captured on the deployed preview by pausing the CSS/WAAPI animations and scrubbing `currentTime` — disclosed technique, same as wave 8's recordings; not real-time video. |

## Design-review sign-off

**Approved with suggestions, zero blocking** (lens: "calm foundation + a few genuinely
beautiful moments — is the base restrained AND do the highlights actually wow?").
Reviewer's scores: base restraint 8.5/10 · loader 9/10 ("genuinely wow, the strongest
moment") · Work 8.5/10 ("convincingly resolves a twice-rejected pattern; static ≠ boring
is achievable") · hero halo 6.5/10 — the one substantive finding: at opacity 0.17 the
drift "risks reading as inert rather than wow" on a normal hero dwell.

Suggestions taken (commit `cbf3a6b`):
1. **Halo presence** — opacity 0.17 → 0.26 with stronger conic alpha stops; axe re-run
   3/3 clean after the bump (the halo sits behind hero text, so contrast was re-checked,
   not assumed).
2. **Focus-ring parity** — TriageIQ classifier input now uses heat-toy's stronger
   `ring-2` treatment (it became newly prominent when the disclosure moved inline).
3. **Lazy-panel loading fallback** typography matched to the card's caption style.
4. **Fail-soft evidence** — captured (table above), was code-reading-only before.

Deferred, logged honestly: `eval-figure.tsx`'s `W = 208` / work.tsx `13rem` /
`w-[13rem]` three-file sync could become one exported constant (not a token violation —
SVG geometry can't consume rem — but drift-prone; candidate for a later cleanup pass).
Reviewer also noted their pass was screenshots+code (no live keyboard-only walk);
keyboard focus visibility was spot-checked this wave via the focus-ring parity fix, but
a full live SR/keyboard pass remains the standing honest gap from wave 7's note.

## Self-score (the brief's own bar)

- **Base genuinely calm/centered:** yes. One axis end to end; the wave-10 page's empty
  right half at 1440 is gone; hierarchy is quiet (text-title section heads, mono notes).
- **Loader:** genuinely beautiful — the monogram two-color draw into a top-down curtain
  reveal is the page's premium moment, and it costs 0 measurable LCP.
- **Hero:** composed and now *felt* — the halo bump was the right call; gradient
  numerals give the stats row one rich texture without adding a second accent hue.
- **Work:** the honest trade — a third slider attempt was the higher-variance path; the
  static showcase is unambiguously usable on every input device (nothing to drag, so
  nothing to break) and carries its craft in the figures, datelines, and hover. The
  reviewer's 8.5 matches my own read: refined, if the least theatrical of the three.
- **Both past failure modes avoided:** the page is neither loud everywhere (effects are
  in exactly three places) nor flat (each moment is real motion/depth, not decoration).
