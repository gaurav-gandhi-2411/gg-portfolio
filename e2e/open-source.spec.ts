import { expect, test } from "@playwright/test";

/**
 * refresh-2026-09 Phase C, owner decision D2 — the dedicated /open-source
 * page. The homepage "Open source" section and its own coverage land in a
 * follow-up PR (kept separate to stay under the reviewable-diff gate);
 * this file covers the page, nav, and sitemap wiring only.
 *
 * Scoped to `#open-source` rather than a bare heading/name locator where it
 * matters on purpose: "tracegauge" and "adk-tracegauge" are also product
 * names rendered as project-card headings in the Work section on the same
 * page (content/products.ts), so an unscoped `getByRole("heading", { name:
 * "tracegauge" })` would match both — the exact substring-collision shape
 * this repo's own CLAUDE.md calls out from the Warmer-toggle incident.
 */

test.describe("Open source", () => {
  test("/open-source page carries the same three groups under its own h1", async ({ page }) => {
    await page.goto("/open-source");
    await expect(page.getByRole("heading", { level: 1, name: "Open source", exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Landed upstream", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "In review", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Own packages", exact: true })).toBeVisible();

    await expect(page.getByRole("link", { name: "Pull request ↗", exact: true })).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Landing commit ↗", exact: true })).toHaveCount(3);
    await expect(page.getByRole("link", { name: "PyPI ↗", exact: true })).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Repo ↗", exact: true })).toHaveCount(3);
  });

  test("/open-source is reachable from the site nav and the nav marks it active", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Site" })
      .getByRole("link", { name: "Open source", exact: true })
      .click();
    await expect(page).toHaveURL(/\/open-source$/);
    const navLink = page
      .getByRole("navigation", { name: "Site" })
      .getByRole("link", { name: "Open source", exact: true });
    await expect(navLink).toHaveAttribute("aria-current", "page");
  });

  test("/open-source is listed in the sitemap", async ({ page }) => {
    const response = await page.request.get("/sitemap.xml");
    expect(response.status()).toBeLessThan(400);
    const body = await response.text();
    expect(body).toContain("/open-source");
  });

  test("every pull-request and landing-commit link on /open-source is well-formed and opens in a new tab", async ({
    page,
  }) => {
    await page.goto("/open-source");
    const links = page.getByRole("link", { name: /Pull request ↗|Landing commit ↗/ });
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute("href");
      expect(href).toMatch(/^https:\/\/github\.com\//);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noreferrer/);
    }
  });
});
