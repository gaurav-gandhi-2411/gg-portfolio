import { expect, test } from "@playwright/test";

/**
 * Gating for the hero's ambient background layer. As with the Warmer viewer,
 * the interesting property is not that the canvas draws — it is which
 * visitors get it, and that the static scatter is never simply missing.
 */

test.describe("hero embedding cloud — WebGL layer", () => {
  test("swaps the static scatter for a canvas on a capable device", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await expect(page.locator("header canvas")).toBeVisible();
  });

  test("never covers the headline — the h1 stays fully opaque and on top", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await expect(page.locator("header canvas")).toBeVisible();

    // The background container is aria-hidden and non-interactive, and the
    // heading must remain clickable-through-free and at full opacity — the
    // brief's "noticing the animation before the text is a failure".
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    expect(await heading.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");

    const container = page.locator("header div[aria-hidden='true']").first();
    expect(await container.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  });
});

test.describe("hero embedding cloud — static fallback", () => {
  test("reduced-motion visitors get the static scatter and no canvas", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("header svg[role='presentation']")).toBeVisible();
    await expect(page.locator("header canvas")).toHaveCount(0);
  });
});

test.describe("hero embedding cloud — no JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still renders the static scatter from server-rendered HTML", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header svg[role='presentation']")).toBeVisible();
    expect(await page.locator("header svg circle").count()).toBeGreaterThan(400);
  });
});
