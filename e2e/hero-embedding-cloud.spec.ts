import { expect, test } from "@playwright/test";

/**
 * The hero background is a server-rendered static SVG scatter, for everyone.
 *
 * It had a WebGL layer for about a day. Three variants were measured on
 * deployed Vercel builds against a 93.00 ±2.00 baseline — rotating (88.17),
 * settling then stopping (89.33), and one static frame (87.00, n=8) — and all
 * three sat at Speed Index ~3100-3900ms against a 1389ms baseline. The canvas
 * cost roughly 6 points no matter what it did, because the cost was WHEN the
 * layer arrived (chunk load, GL context, point upload, large composite, all
 * after first paint), not whether it moved.
 *
 * These tests exist so that is not quietly undone. Reintroducing a canvas here
 * should require deleting an assertion that says why it was removed — not just
 * adding a component.
 */

test.describe("hero embedding cloud", () => {
  test("renders the static scatter, and never a canvas", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");

    await expect(page.locator("header svg[role='presentation']")).toBeVisible();

    // Wait past the point where the old lazy GL layer used to mount (it opted
    // in on the next animation frame, then deferred ~900ms). If a canvas is
    // ever going to appear, it has appeared by now.
    await page.waitForTimeout(2500);
    await expect(page.locator("header canvas")).toHaveCount(0);
  });

  test("the scatter is decorative: aria-hidden, non-interactive, behind the text", async ({
    page,
  }) => {
    await page.goto("/");

    const container = page.locator("header div[aria-hidden='true']").first();
    await expect(container).toHaveCount(1);
    expect(await container.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    expect(await heading.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });

  test("no JavaScript still renders the scatter from server HTML", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("header svg[role='presentation']")).toBeVisible();
    expect(await page.locator("header svg circle").count()).toBeGreaterThan(400);
    await context.close();
  });

  test("reduced-motion visitors get the same static scatter", async ({ page }) => {
    // Previously this asserted the capability gate declined WebGL. There is no
    // gate now, and no branch — every visitor gets one server-rendered SVG.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("header svg[role='presentation']")).toBeVisible();
    await expect(page.locator("header canvas")).toHaveCount(0);
  });
});
