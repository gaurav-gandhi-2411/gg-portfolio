import { expect, test } from "@playwright/test";

/**
 * Direction B hero: token routing, small-text contrast, and the 1440 fold.
 */
test.describe("hero (Direction B)", () => {
  test("the name's size comes from the --text-hero token and keeps its measured sizes", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "explicit widths are set below");
    // 2.35rem floor at phone widths (6.6vw is smaller there), 5.2rem cap at 1440.
    for (const [width, expectedPx] of [
      [375, 37.6],
      [1440, 83.2],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const px = await page
        .locator(".hero-name")
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(px, `font size at ${width}px`).toBeCloseTo(expectedPx, 0);
    }
    const token = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--text-hero").trim()
    );
    expect(token).not.toBe("");
  });

  test("the employer detail line is not dimmed below 4.5:1 (light and dark)", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      const ratio = await page.locator(".hero-role-detail").evaluate((el) => {
        const chan = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const lum = ([r, g, b]: number[]) => {
          const f = [r, g, b].map((v) => {
            const x = v / 255;
            return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
        };
        let opacity = 1;
        for (let e: Element | null = el; e; e = e.parentElement) {
          opacity *= Number(getComputedStyle(e).opacity);
        }
        const fg = chan(getComputedStyle(el).color);
        const bg = chan(getComputedStyle(document.body).backgroundColor);
        const mixed = fg.map((v, i) => v * opacity + bg[i] * (1 - opacity));
        const [hi, lo] = [lum(mixed), lum(bg)].sort((a, b) => b - a);
        return (hi + 0.05) / (lo + 0.05);
      });
      expect(ratio, `${scheme} scheme`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("at 1440x900 the hero content is centred in the fold, not pinned above an empty half", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "explicit width is set below");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForTimeout(1200);
    const { above, below } = await page.evaluate(() => {
      const nav = document.querySelector(".site-nav")!.getBoundingClientRect();
      const split = document.querySelector(".hero-split")!.getBoundingClientRect();
      return { above: split.top - nav.bottom, below: window.innerHeight - split.bottom };
    });
    // Before: ~65px above, ~340px below. Balanced means neither side is more
    // than twice the other.
    expect(below).toBeLessThanOrEqual(above * 2);
    expect(above).toBeLessThanOrEqual(below * 2);
  });
});
