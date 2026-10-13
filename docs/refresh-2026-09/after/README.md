# refresh-2026-09 — after-screenshots index

Captured: 2026-10-13 (recapture; supersedes the 2026-09-25 set).
Production SHA: `ea10774528b8fd3194316b71c6cabd3532119cd2` (`main` HEAD, read from
`<meta name="build-sha">` on https://gaurav-gandhi.vercel.app at capture time).

Why recaptured: the 2026-09-25 set (SHA `de8ddaa`) predates the light theme, so its
"light" shots were identical to "dark" (the site then had no light mode). Production now
ships a distinct light theme (Direction B); these shots show both.

## Tooling

- Playwright `1.62.1`, Chromium `151.0.7922.34`.

## Capture settings

- Viewport widths: 375, 768, 1440 (height 900, content scrolls for full-page capture).
- `deviceScaleFactor: 1`, `colorScheme: light|dark` set per context, plus `reducedMotion: 'reduce'`.
- Wait: `waitUntil: 'networkidle'` on `page.goto`, then `document.fonts.ready`, then a
  fixed 1500 ms settle, then `page.screenshot({ fullPage: true })`.
- Pages: `/`, `/projects`, `/work/triageiq` → `home-*`, `projects-*`, `work-triageiq-*`.
- Profile README: `https://github.com/gaurav-gandhi-2411`, logged out, viewport 1280×900.

## Light/dark observation

Light and dark now differ: computed `<body>` background is `rgb(247, 247, 249)` under
`colorScheme: light` and `rgb(10, 11, 13)` under `dark` on all three pages at all three
widths. The previous capture's note (light shots identical to dark, no light mode) applies
only to the superseded 2026-09-25 set.

The GitHub profile README pair (`profile-readme-{light,dark}.png`) renders GitHub's own
light and dark themes (logged out, viewport 1280x900, full page).
