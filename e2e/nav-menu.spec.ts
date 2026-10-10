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

  test("focus is never dropped to <body> after choosing a link (route or hash)", async ({ page }) => {
    const activeIsMenuButton = () =>
      page.evaluate(() => document.activeElement?.textContent?.trim() === "Menu");
    for (const [name, url] of [
      ["Contact", /#contact$/],
      ["Projects", /\/projects$/],
    ] as const) {
      await toggleOf(page).click();
      await page.getByRole("link", { name, exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(url);
      await expect(toggleOf(page)).toHaveAttribute("aria-expanded", "false");
      expect(await activeIsMenuButton(), `focus after choosing ${name}`).toBe(true);
    }
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

  test("a scrim covers the page behind the open menu, under the pill, and swallows the dismissing click", async ({
    page,
  }) => {
    const scrim = page.locator(".site-nav-scrim");
    await expect(scrim).toHaveCount(0);
    await toggleOf(page).click();
    await expect(scrim).toBeVisible();
    const box = (await scrim.boundingBox())!;
    expect(box.width).toBe(375);
    expect(box.height).toBe(800);
    const topmost = (x: number, y: number) =>
      page.evaluate(
        ([px, py]) => document.elementFromPoint(px, py)?.className?.toString() ?? "",
        [x, y]
      );
    expect(await topmost(190, 600)).toContain("site-nav-scrim");
    // the pill and menu stay above it, so they remain operable
    const t = (await toggleOf(page).boundingBox())!;
    expect(await topmost(t.x + t.width / 2, t.y + t.height / 2)).not.toContain("site-nav-scrim");
    // clicking the scrim closes the menu and does not activate anything under it
    const url = page.url();
    await page.mouse.click(190, 600);
    await expect(toggleOf(page)).toHaveAttribute("aria-expanded", "false");
    await expect(scrim).toHaveCount(0);
    expect(page.url()).toBe(url);
  });

  test("the current page is marked in the open menu by more than colour", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForTimeout(400);
    await toggleOf(page).click();
    const current = page.locator('#site-nav-menu a[aria-current="page"]');
    await expect(current).toHaveText("Projects");
    const shadow = (el: Element) => getComputedStyle(el).boxShadow;
    expect(await current.evaluate(shadow)).not.toBe("none");
    const other = page.locator("#site-nav-menu a:not([aria-current])").first();
    expect(await other.evaluate(shadow)).toBe("none");
    // marking it must not move the rows: still six 44px+ links
    for (const link of await menuLinks(page).all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`axe: zero violations with the menu open (${scheme} scheme)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await toggleOf(page).click();
      await expect(menuLinks(page).first()).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }
});
