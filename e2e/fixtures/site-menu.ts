import type { Page } from "@playwright/test";

/**
 * Below 768px the header links live in a menu closed until "Menu" is pressed
 * (components/site-nav.tsx); at desktop widths this does nothing. The menu
 * closes on every link press and route change, so call it right before each
 * header-link interaction rather than once per test.
 */
export async function openSiteMenu(page: Page): Promise<void> {
  const toggle = page.locator("nav[aria-label='Site'] .site-nav-toggle");
  if (!(await toggle.isVisible())) return;
  if ((await toggle.getAttribute("aria-expanded")) === "true") return;
  await toggle.click();
  await page.locator("#site-nav-menu[data-open='true']").waitFor({ state: "visible" });
}
