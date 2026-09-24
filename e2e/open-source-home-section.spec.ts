import { expect, test } from "@playwright/test";

/**
 * refresh-2026-09 Phase C, owner decision D2 — the homepage "Open source"
 * teaser section. The dedicated /open-source page and its own nav/sitemap
 * coverage landed in the previous PR (e2e/open-source.spec.ts); this file
 * covers only the homepage section this PR adds.
 *
 * Scoped to `#open-source` rather than a bare heading/name locator on
 * purpose: "tracegauge" and "adk-tracegauge" are also product names
 * rendered as project-card headings in the Work section on the same page
 * (content/products.ts), so an unscoped `getByRole("heading", { name:
 * "tracegauge" })` would match both — the exact substring-collision shape
 * this repo's own CLAUDE.md calls out from the Warmer-toggle incident.
 */

test.describe("Open source — homepage section", () => {
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

  test("the section's 'More on the open source page' link reaches /open-source", async ({
    page,
  }) => {
    await page.goto("/");
    const section = page.locator("#open-source");
    await section.scrollIntoViewIfNeeded();
    await section.getByRole("link", { name: "More on the open source page →" }).click();
    await expect(page).toHaveURL(/\/open-source$/);
  });
});
