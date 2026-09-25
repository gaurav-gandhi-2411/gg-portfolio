# refresh-2026-09 — after-screenshots index

Captured: 2026-09-25, 08:14:49–08:16:14 UTC.
Production SHA: `de8ddaac98ec2d8d9683057631721917cdf28253` (== `origin/main` HEAD;
confirmed via `gh api repos/.../deployments?environment=Production`).

## Tooling

- Playwright `1.63.0`, Chromium `153.0.8010.12` (Chrome for Testing, revision 1243).
- Node `v24.15.0`.

## Capture settings

- Viewport widths: 375, 768, 1440 (height 900, content scrolls for full-page capture).
- `deviceScaleFactor: 1`, `colorScheme: light|dark` set per context.
- Wait: `waitUntil: 'networkidle'` on `page.goto`, then `document.fonts.ready`, then a
  fixed 1000 ms settle, then `page.screenshot({ fullPage: true })`.
- Pages: `/`, `/projects`, `/work/triageiq` → `home-*`, `projects-*`, `work-triageiq-*`.
- Profile README: `https://github.com/gaurav-gandhi-2411`, logged out, viewport 1280×900.

## Light/dark observation

Every light/dark pair on gaurav-gandhi.vercel.app has a **different md5** (see file
sizes above), but side-by-side inspection shows the two images are visually
identical — same dark palette, same layout, in both "light" and "dark"
`colorScheme` contexts. A control capture (two `light`-only runs of `/` at
1440px, 60s apart) also produced two different md5s despite the identical
`colorScheme`. This confirms the byte differences come from a non-deterministic
render (an animated canvas/particle background on the hero), not from the site
responding to `colorScheme` — consistent with Phase A's finding that the site
has no dark mode.

The GitHub profile README pair (`profile-readme-{light,dark}.png`) genuinely
differs: GitHub's own dark theme renders (dark chrome, dark code blocks,
dark contribution graph). All six README sections (Shipped & live, Open
source, How I work, Research, Journey, Stack) render correctly in both, and
both generated cards (top-stats card, contribution graph) render. Nothing
broken observed.
