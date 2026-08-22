import { expect, test } from "@playwright/test";
import { products } from "../content/products";
import { CATEGORIES } from "../content/types";
import { warmupConfigs } from "../content/warmup";

/**
 * Champion-challenger for pixels (production audit, 2026-08-22): GG asked
 * for a visual regression gate at 390px and 1440px across every route,
 * approved baselines committed, unintended diffs fail the build. This is
 * that gate.
 *
 * WHY ONLY THE "desktop" PROJECT: the width is varied explicitly per test
 * below (390 and 1440), not via Playwright's device-profile system — the
 * "mobile" project's own Pixel 7 emulation (touch, its own UA string, a
 * 2.625 device-scale-factor) would still apply underneath an overridden
 * viewport size and produce a genuinely different render at the "same"
 * nominal width, which is not the two states GG asked for. One consistent
 * non-touch browser context, two explicit widths, is the actual ask.
 *
 * WHAT'S MASKED, and why: `canvas` (the hero point cloud, and every case
 * study's WebGL embedding/retrieval viewer) — headless CI renders WebGL
 * through software rasterization (SwiftShader), which does not produce
 * pixel-identical output to a local GPU even for the exact same scene, so
 * comparing canvas pixels here would fail on the renderer, not on a real
 * regression. `[data-live-value]` — ISR-refreshed data (PyPI stats, a
 * per-product freshness dateline, Warmer's live puzzle number) that is
 * correct to show and wrong to gate a LAYOUT check on, since it changes on
 * its own 6h revalidation schedule with no code change involved.
 * `prefers-reduced-motion: reduce` is emulated on every capture, both
 * because it's the deterministic, settled state (no mid-transition frame
 * to get unlucky on) and because it exercises the still composition this
 * site's own motion design already commits to providing.
 *
 * Baselines were generated inside the same Playwright Docker image this
 * repo's CI resolves to (mcr.microsoft.com/playwright:v1.62.1-jammy) rather
 * than on a local machine — Playwright's own screenshot comparison is
 * sensitive to OS-level font rasterization, and a Windows-generated
 * baseline does not match an Ubuntu CI runner's actual pixels, gate or no
 * gate. Regenerate the same way after any intentional visual change:
 *   docker run --rm -v "$PWD:/work" -w /work \
 *     mcr.microsoft.com/playwright:v1.62.1-jammy \
 *     sh -c "npm ci && npm run build && npx playwright test \
 *       e2e/visual-regression.spec.ts --project=desktop --update-snapshots"
 */

const WIDTHS = [
  { label: "390", width: 390, height: 844 },
  { label: "1440", width: 1440, height: 900 },
];

const STATIC_ROUTES = [
  { name: "home", path: "/" },
  { name: "projects", path: "/projects" },
  { name: "ask", path: "/ask" },
];

const CATEGORY_ROUTES = CATEGORIES.map((c) => ({ name: `projects-${c.id}`, path: `/projects/${c.id}` }));
const WORK_ROUTES = products.map((p) => ({ name: `work-${p.slug}`, path: `/work/${p.slug}` }));
const WARMUP_ROUTES = Object.keys(warmupConfigs).map((slug) => ({
  name: `warmup-${slug}`,
  path: `/warmup/${slug}`,
}));

const ALL_ROUTES = [...STATIC_ROUTES, ...CATEGORY_ROUTES, ...WORK_ROUTES, ...WARMUP_ROUTES];

// Fail closed, not silently: a route list derived wrong (an empty import, a
// broken path) must not read as "every route passed" because there were no
// routes to fail. 20 is comfortably under the current real count (3 static +
// 6 categories + 14 case studies + 3 warmup = 26) with room for either list
// to grow or shrink a little without this tripping on noise.
if (ALL_ROUTES.length < 20) {
  throw new Error(
    `visual-regression: only resolved ${ALL_ROUTES.length} route(s) — the route lists are wrong, not the site.`
  );
}

test.describe("Visual regression baselines (390px / 1440px)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "width is varied explicitly per test below; running under the mobile device profile too would compare a different browser context, not just a different width"
    );
    // Baselines are Linux-rendered (committed with a -linux suffix, matching
    // CI's ubuntu-latest runner) — Playwright's screenshot comparison is
    // sensitive to OS-level font rasterization, so a local run on macOS or
    // Windows (this repo's actual primary dev OS) would either compare
    // against nothing (writing a parallel -win32/-darwin baseline no one
    // asked for) or fail on a font-rendering difference that was never a
    // real regression. `npm run test:e2e` locally should stay fast and
    // meaningful for everything else; CI (which always sets CI=1) is where
    // this spec's baselines are the real gate. To run it deliberately
    // (e.g. regenerating baselines) see this file's own header for the
    // Docker command that matches CI exactly.
    test.skip(!process.env.CI, "Linux-rendered baselines only mean something in CI — see this file's header");
  });

  for (const route of ALL_ROUTES) {
    for (const { label, width, height } of WIDTHS) {
      test(`${route.name} @ ${label}px`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.setViewportSize({ width, height });
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");
        // Production audit follow-up (2026-08-22): `mask` only paints over a
        // region's PIXELS — it does nothing about the region's SIZE. These
        // are ISR-refreshed strings (a freshness dateline, PyPI download
        // counts) that legitimately change length over time ("shipped 2
        // days ago" vs "shipped 3 weeks ago"), which can shift a flex-wrap
        // point and change the page's total height — a real, reproduced CI
        // failure (1440x1107 baseline vs 1440x1154 actual on /projects and
        // three category views) that `mask` alone could never catch, since
        // it hides content, not layout. Removing the element from flow
        // entirely, before the screenshot, freezes both.
        await page.addStyleTag({ content: "[data-live-value]{display:none!important}" });
        await expect(page).toHaveScreenshot(`${route.name}-${label}.png`, {
          fullPage: true,
          animations: "disabled",
          mask: [page.locator("canvas")],
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
});
