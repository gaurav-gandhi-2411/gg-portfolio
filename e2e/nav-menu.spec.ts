import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The header's mobile menu (components/site-nav.tsx), driven the way a
 * keyboard and a pointer user would. Layout is in nav-layout.spec.ts. Desktop
 * project only: the width is set explicitly below.
 */

test.describe("mobile menu behaviour", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "explicit width is set below");
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await page.waitForTimeout(600);
  });

  const toggleOf = (page: Page) => page.getByRole("button", { name: "Menu" });
  const menuLinks = (page: Page) => page.locator("#site-nav-menu a");

  test("closed by default: links are out of the tab order and the tree", async ({ page }) => {
    const toggle = toggleOf(page);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAttribute("aria-controls", "site-nav-menu");
    await expect(menuLinks(page).first()).toBeHidden();
    await expect(
      page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Projects" })
    ).toHaveCount(0);
  });

  test("opens with aria-expanded, shows six 44px links, keeps the home link", async ({ page }) => {
    const toggle = toggleOf(page);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(menuLinks(page)).toHaveText([
      "About",
      "Experience",
      "Projects",
      "Open source",
      "Research",
      "Contact",
    ]);
    for (const link of await menuLinks(page).all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("link", { name: "Gaurav Gandhi, home" })).toBeVisible();
  });

  test("Escape closes it and returns focus to the button", async ({ page }) => {
    const toggle = toggleOf(page);
    await toggle.click();
    await menuLinks(page).nth(2).focus();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    await expect(menuLinks(page).first()).toBeHidden();
  });

  test("a press outside closes it", async ({ page }) => {
    const toggle = toggleOf(page);
    await toggle.click();
    await page.mouse.click(190, 600);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("choosing a link navigates and closes it", async ({ page }) => {
    const toggle = toggleOf(page);
    await toggle.click();
    await page.getByRole("link", { name: "Projects", exact: true }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(toggleOf(page)).toHaveAttribute("aria-expanded", "false");
    await toggleOf(page).click();
    await page.getByRole("link", { name: "Contact", exact: true }).click();
    await expect(page).toHaveURL(/#contact$/);
    await expect(toggleOf(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("focus is trapped while open and Tab order is brand, button, six links", async ({ page }) => {
    const toggle = toggleOf(page);
    const brand = page.getByRole("link", { name: "Gaurav Gandhi, home" });
    await toggle.click();
    await brand.focus();
    const order: string[] = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      order.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          return (el.getAttribute("aria-label") || el.textContent || "").trim();
        })
      );
    }
    expect(order).toEqual([
      "Menu",
      "About",
      "Experience",
      "Projects",
      "Open source",
      "Research",
      "Contact",
      "Gaurav Gandhi, home", // wrapped back to the start, never reached the page behind
    ]);
    await page.keyboard.press("Shift+Tab");
    await expect(menuLinks(page).last()).toBeFocused();
  });

  test("axe: zero violations with the menu open", async ({ page }) => {
    await toggleOf(page).click();
    await expect(menuLinks(page).first()).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
