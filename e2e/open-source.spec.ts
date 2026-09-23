import { expect, test } from "@playwright/test";

/**
 * refresh-2026-09 Phase C, owner decision D2 — the homepage "Open source"
 * section and the dedicated /open-source page.
 *
 * Scoped to `#open-source` on the homepage rather than a bare heading/name
 * locator on purpose: "tracegauge" and "adk-tracegauge" are also product
 * names rendered as project-card headings in the Work section on the same
 * page (content/products.ts), so an unscoped `getByRole("heading", { name:
 * "tracegauge" })` would match both — the exact substring-collision shape
 * this repo's own CLAUDE.md calls out from the Warmer-toggle incident.
 */

test.describe("Open source", () => {
  test("homepage section lists 3 landed fixes, an in-review line, and 3 own packages", async ({
    page,
  }) => {
    await page.goto("/");
    const section = page.locator("#open-source");
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole("heading", { name: "Open source", level: 2 })).toBeVisible();

    // Landed upstream: exactly 3 items, each proven by both a PR link and its
    // own separate landing-commit link (never just the PR — see this repo's
    // own note on why: Copybara-imported PRs show Closed, not Merged).
    await expect(section.getByRole("link", { name: "Pull request ↗", exact: true })).toHaveCount(3);
    await expect(section.getByRole("link", { name: "Landing commit ↗", exact: true })).toHaveCount(3);

    // In review is present and named, but must never inflate "landed".
    await expect(section.getByText(/In review:/)).toBeVisible();
    await expect(section.getByRole("link", { name: "#6739", exact: true })).toBeVisible();
    await expect(section.getByRole("link", { name: "#6740", exact: true })).toBeVisible();
    await expect(section.getByText(/3 fixes landed/)).toBeVisible();

    // Own packages: three, each with a live PyPI link and a repo link.
    for (const name of ["tracegauge", "adk-tracegauge", "agentgauge-harness"]) {
      await expect(section.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    await expect(section.getByRole("link", { name: "PyPI ↗", exact: true })).toHaveCount(3);
    await expect(section.getByRole("link", { name: "Repo ↗", exact: true })).toHaveCount(3);
  });

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
