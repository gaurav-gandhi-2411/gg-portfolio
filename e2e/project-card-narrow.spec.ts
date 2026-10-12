import { expect, test } from "@playwright/test";

/**
 * A card's title and its status pill must never overlap, down to 320px.
 *
 * At 320px the title (a single long word such as "ShelfSense" or "DealHunter")
 * is wider than the room left beside the project mark and the pill, so the
 * word ran underneath the pill. The mark/title/pill boxes do not intersect in
 * layout terms (the title box shrinks, its text does not), so this measures
 * the rendered glyph rects of the title link against the pill instead.
 * Desktop project only: the width is set explicitly.
 */
test.describe("project card header at narrow widths", () => {
  for (const width of [320, 340, 375]) {
    test(`title text never runs under the status pill at ${width}px`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "explicit width is set below");
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/projects");
      await page.waitForTimeout(500);
      const overlaps = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".project-card")]
          .filter((c) => getComputedStyle(c).display !== "none")
          .filter((c) => {
            const link = c.querySelector("h2 a, h3 a");
            const pill = c.querySelector("[data-card-status]");
            if (!link || !pill) return false;
            const range = document.createRange();
            range.selectNodeContents(link);
            const p = pill.getBoundingClientRect();
            return [...range.getClientRects()].some(
              (t) =>
                Math.min(t.right, p.right) - Math.max(t.left, p.left) > 0 &&
                Math.min(t.bottom, p.bottom) - Math.max(t.top, p.top) > 0
            );
          })
          .map((c) => c.dataset.slug)
      );
      expect(overlaps).toEqual([]);

      // The fix hides the decorative mark only where the card is too narrow;
      // an earlier rem threshold hid it on every phone up to ~364px.
      const marks = await page.evaluate(
        () =>
          [...document.querySelectorAll<SVGElement>(".project-card h2 svg, .project-card h3 svg")].filter(
            (s) => getComputedStyle(s).display !== "none"
          ).length
      );
      if (width >= 340) expect(marks).toBeGreaterThan(0);
    });
  }
});
