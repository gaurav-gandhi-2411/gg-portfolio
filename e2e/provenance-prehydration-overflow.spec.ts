import { expect, test } from "@playwright/test";

/**
 * Root cause of the intermittent ~1-2px horizontal overflow on
 * /work/multimodal-fashion-recommender at 375px (no-horizontal-overflow.spec.ts
 * flaked on it in CI): a CLOSED MetricProvenance panel is `absolute left-0
 * w-72` and invisible, but still a real box in layout, and the only thing that
 * keeps it inside the viewport is a JS clamp (useLayoutEffect) that only runs
 * after hydration. Before hydration the box hangs 1.75px past the right edge
 * once the real web fonts have swapped in (the fallback-font metrics happen to
 * fit, which is why it was intermittent: it depended on whether the measurement
 * landed after font swap but before hydration).
 *
 * Disabling JS removes the hydration half of that race entirely, and waiting
 * for fonts to finish loading removes the other half, so this is the
 * deterministic form of the failure: the page must not overflow even with the
 * SSR-only layout.
 */
test.describe("closed provenance panels never overflow before hydration", () => {
  test.use({ viewport: { width: 375, height: 900 }, javaScriptEnabled: false });

  test("/work/multimodal-fashion-recommender at 375px, no JS, fonts loaded", async ({
    page,
  }, testInfo) => {
    // The Pixel 7 project's mobile emulation passes on the unfixed build too, so only the
    // desktop project (explicit 375px viewport above) discriminates.
    test.skip(testInfo.project.name === "mobile", "not a discriminating run on mobile emulation");
    await page.goto("/work/multimodal-fashion-recommender");
    await page.waitForFunction(() => document.fonts.status === "loaded");

    const measured = await page.evaluate(() => ({
      documentScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      closedPanelRights: [...document.querySelectorAll<HTMLElement>('[role="group"][data-open="false"]')]
        .map((el) => Math.round(el.getBoundingClientRect().right * 100) / 100)
        .filter((right) => right > window.innerWidth),
    }));

    expect(measured.closedPanelRights, "closed panel right edges past innerWidth").toEqual([]);
    expect(measured.documentScrollWidth).toBeLessThanOrEqual(measured.innerWidth);
  });
});
