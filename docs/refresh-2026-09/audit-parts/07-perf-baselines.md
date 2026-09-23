## 7. Performance & accessibility baselines

Phase A read-only audit. Target: production site `https://gaurav-gandhi.vercel.app`
(no login, no live-data mutation). Local checkout: `gg-portfolio-wt-refresh-audit`
worktree, branch `chore/refresh-2026-09-phase-a`. All numbers below are freshly
measured this session (2026-09-23) — none carried over from memory or a prior run.

### Tooling and environment

- Lighthouse CLI `13.4.1` (repo devDependency, `npx lighthouse --version`), driven
  against system-installed Chrome at
  `C:\Program Files\Google\Chrome\Application\chrome.exe` (`CHROME_PATH` env var) —
  the repo's Playwright-managed Chromium build exists but is not registered where
  `chrome-launcher` auto-detects it, so the real installed Chrome was used instead.
- Playwright `@playwright/test` `1.62.1` per `package.json` (installed via `npm ci`
  into a fresh `node_modules` for this worktree — it had none before this session).
- `node -v` → `v24.15.0`; `npm -v` → `11.13.0`.
- Exact commands (repeated per URL/preset):
  `npx lighthouse "<url>" --output=json --output-path=<path> [--preset=desktop] --chrome-flags="--headless=new" --quiet`
  (desktop preset run once per page; the flag omitted is Lighthouse's mobile default).
- Throttling method: Lighthouse's default, `simulate` (CPU/network throttling
  simulated from an unthrottled trace, not a real 4G/CPU-slowdown pass) — this is
  the standard Lighthouse CLI default and was not overridden. Scores below should
  be read as Lighthouse-simulated, not lab-throttled or field (CrUX) data.
- Known harmless tool quirk: every `npx lighthouse` invocation printed an `EPERM`
  stack trace from `chrome-launcher`'s `destroyTmp()` (`rmSync` on its own
  `%TEMP%\lighthouse.<pid>` scratch dir) after the report had already been written
  to disk. Confirmed non-fatal each time — the JSON output file was present,
  valid, and fully populated (`categories`, `audits`, `finalUrl` all correct)
  despite the trailing error and `exit 0`. Reported here rather than silently
  suppressed, per the "no invented numbers" rule.
- Raw Lighthouse JSON reports (all 6) were written to a session scratch directory,
  not committed to the repo — only this summary and the screenshots below are
  checked-in artifacts, per the task's single-output-path instruction. Available
  on request if the orchestrator wants the full JSON for provenance.

### Lighthouse scores

All scores are Lighthouse's own 0–1 category score, reported ×100 (Lighthouse's
own convention). CLS is the raw `cumulative-layout-shift` numeric value.

#### `/` (home)

| Form factor | Performance | Accessibility | Best Practices | SEO | CLS |
|---|---|---|---|---|---|
| Mobile  | 82 | 100 | 100 | 100 | 0 |
| Desktop | 92 | 100 | 100 | 100 | 0 |

#### `/projects`

| Form factor | Performance | Accessibility | Best Practices | SEO | CLS |
|---|---|---|---|---|---|
| Mobile  | 87 | 100 | 100 | 100 | 0 |
| Desktop | 99 | 100 | 100 | 100 | 0 |

#### `/work/triageiq` (chosen `/work/*` page — verified as a real slug via
`https://gaurav-gandhi.vercel.app/sitemap.xml` before use, not guessed)

| Form factor | Performance | Accessibility | Best Practices | SEO | CLS |
|---|---|---|---|---|---|
| Mobile  | 83 | 100 | 100 | 100 | 0 |
| Desktop | 99 | 100 | 100 | 100 | 0 |

**Against acceptance criteria #6** (mobile Performance ≥ 90, Accessibility ≥ 95,
Best Practices ≥ 95, SEO ≥ 95, CLS ≤ 0.05): mobile Accessibility, Best Practices,
SEO, and CLS pass on all three pages today. Mobile **Performance fails the ≥ 90
bar on all three pages as measured** (82 / 87 / 83) — this is a Phase A finding,
not a regression (there is no prior baseline to regress against yet; this run
*is* the baseline). Desktop is not gated by criterion #6 (mobile-only threshold)
but is reported above for completeness and as the Phase D regression baseline.

### axe-core accessibility violations

The repo already has a Playwright + `@axe-core/playwright` suite
(`e2e/a11y.spec.ts`) with per-route zero-violation tests, and
`playwright.config.ts` supports a `PLAYWRIGHT_BASE_URL` override with no local
`webServer` started when it's set — so the existing tests were run directly
against production rather than writing new tooling, per the task's preference
for existing conventions.

Command:
```
PLAYWRIGHT_BASE_URL=https://gaurav-gandhi.vercel.app \
  npx playwright test e2e/a11y.spec.ts \
  --grep 'axe: zero violations on (/|/projects|/work/triageiq)$' \
  --reporter=list
```
This grep isolates the three base-route scans (`on /`, `on /projects`,
`on /work/triageiq`) from the file's other, more specific scans in the same
file (filtered views, hover states, open disclosures, `/ask` answered state,
WebGL layers) that don't apply to this baseline's three plain-route scope.
Both Playwright projects (`desktop`, `mobile`) ran, so this is 6 test
executions (3 pages × 2 viewports/device profiles).

Result: **6/6 passed** — `expect(results.violations).toEqual([])` requires a
literal empty array to pass, so a pass is direct evidence of zero violations of
any severity, not just zero *reported* ones.

| Page | Viewport | Serious | Critical | Other | Total |
|---|---|---|---|---|---|
| `/` | desktop | 0 | 0 | 0 | 0 |
| `/` | mobile | 0 | 0 | 0 | 0 |
| `/projects` | desktop | 0 | 0 | 0 | 0 |
| `/projects` | mobile | 0 | 0 | 0 | 0 |
| `/work/triageiq` | desktop | 0 | 0 | 0 | 0 |
| `/work/triageiq` | mobile | 0 | 0 | 0 | 0 |

**Against acceptance criteria #7** (0 serious/critical violations on audited
pages): **passes**, 0 across the board, on both viewports, for all three pages.

Scope note (rule 85b): this covers only the three plain base-route scans in
scope for this baseline (closed/default page state). It does **not** re-verify
the file's other scans (open search results, hovered cards, open provenance
disclosures, `/ask` post-answer state, the homepage/Warmer WebGL layers) against
production — those are covered by CI running against `main`'s own deploys, not
by this baseline task, and are out of scope for the 3-page/375-768-1440 spec
this section was asked to produce.

### Screenshots

18 screenshots (3 pages × 3 widths × 2 color schemes) written via a standalone
Playwright script (not part of the checked-in `e2e/` suite — kept in this
session's scratch directory, not the repo). Full page (`fullPage: true`),
`deviceScaleFactor: 1`, `reducedMotion: "reduce"` emulated (same rationale as
`e2e/a11y.spec.ts`'s `gotoSettled()`: deterministic settled state, no risk of
capturing a mid-entrance-fade frame).

All 18 files, confirmed written and non-empty (`ls -la`, sizes 674 KB–2.4 MB):

```
docs/refresh-2026-09/before/home-375-light.png
docs/refresh-2026-09/before/home-375-dark.png
docs/refresh-2026-09/before/home-768-light.png
docs/refresh-2026-09/before/home-768-dark.png
docs/refresh-2026-09/before/home-1440-light.png
docs/refresh-2026-09/before/home-1440-dark.png
docs/refresh-2026-09/before/projects-375-light.png
docs/refresh-2026-09/before/projects-375-dark.png
docs/refresh-2026-09/before/projects-768-light.png
docs/refresh-2026-09/before/projects-768-dark.png
docs/refresh-2026-09/before/projects-1440-light.png
docs/refresh-2026-09/before/projects-1440-dark.png
docs/refresh-2026-09/before/work-triageiq-375-light.png
docs/refresh-2026-09/before/work-triageiq-375-dark.png
docs/refresh-2026-09/before/work-triageiq-768-light.png
docs/refresh-2026-09/before/work-triageiq-768-dark.png
docs/refresh-2026-09/before/work-triageiq-1440-light.png
docs/refresh-2026-09/before/work-triageiq-1440-dark.png
```

**Finding, not a script bug:** the light and dark screenshot for every
page/width pair are **byte-identical** (verified via `md5sum` on the 375px set;
all three light/dark pairs matched exactly). Confirmed this is real: the site
has **no dark-mode implementation at all** — `grep -r "dark:" app components`
returns 0 matches, and there is no `prefers-color-scheme` CSS, `ThemeProvider`,
`next-themes`, or theme-related `localStorage` key anywhere in the codebase.
`page.emulateMedia({ colorScheme: "dark" })` was applied correctly (confirmed
by re-checking the script) but the site renders one fixed theme regardless of
the requested color scheme. This is a real Phase A/D input: acceptance
criterion #9 ("README renders correctly in GitHub light and dark") is about the
README's generated SVG cards, not the site, so it's unaffected — but Phase D's
"before" screenshots for the site itself only usefully exist in one visual
state today, not two, until dark mode (if any) is built.

**Against acceptance criteria #8** (before/after screenshots at 3 widths × 2
themes committed to `docs/refresh-2026-09/`): the "before" half is satisfied —
all 18 files exist at the required widths/theme labels in the required path.
The "after" half is Phase D's responsibility once the UI changes exist; not
in scope for this Phase A baseline.

### Summary against acceptance criteria #6–#8

| # | Criterion | Status |
|---|---|---|
| 6 | Mobile Perf ≥90 / A11y ≥95 / BP ≥95 / SEO ≥95, CLS ≤0.05, no >3pt regression | **Partial** — A11y/BP/SEO/CLS pass on all 3 pages; mobile Performance fails (82/87/83 vs 90) on all 3. No regression check possible yet (this run is the baseline). |
| 7 | 0 serious/critical axe violations | **Pass** — 0/0 on all 3 pages, both viewports. |
| 8 | Before/after screenshots, 3 widths × 2 themes, committed | **Before: done** (18 files). After: pending Phase D. |
