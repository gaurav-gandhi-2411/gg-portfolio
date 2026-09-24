import { expect, test } from "@playwright/test";
import { researchPapers } from "../content/research";
import { site } from "../content/site";

/**
 * refresh-2026-09, Phase C — both AgentGauge papers are not submitted
 * anywhere (no arXiv ID, no venue). The site must say so in exactly these
 * words, not imply a submission is pending, and must offer a standalone
 * /research destination reusing the same data as the homepage section.
 *
 * Locators use `exact: true` throughout (repo convention, CLAUDE.md) —
 * "Research" is a substring of "Read the benchmark's case study" only by
 * accident of English, and this section learned that lesson once already
 * (the Warmer toggle collision this file's own CLAUDE.md entry documents).
 */

test.describe("research paper status label", () => {
  test("homepage Research section states the exact working-paper label, never the old preprint copy", async ({
    page,
  }) => {
    await page.goto("/#research");
    const section = page.locator("#research");

    for (const paper of researchPapers) {
      const card = section.locator("article", { hasText: paper.title });
      await expect(card.getByText("Working paper (draft, not yet submitted)", { exact: true })).toBeVisible();
    }

    await expect(page.getByText("Preprint, pending arXiv", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Under submission", { exact: false })).toHaveCount(0);
  });

  test("/research states the same exact label for every paper", async ({ page }) => {
    await page.goto("/research");

    for (const paper of researchPapers) {
      const card = page.locator("main article", { hasText: paper.title });
      await expect(card.getByText("Working paper (draft, not yet submitted)", { exact: true })).toBeVisible();
    }

    await expect(page.getByText("Preprint, pending arXiv", { exact: false })).toHaveCount(0);
  });
});

test.describe("/research page", () => {
  test("renders a page heading, one article per paper, and the benchmark case-study link", async ({
    page,
  }) => {
    await page.goto("/research");

    await expect(page.getByRole("heading", { level: 1, name: "Research", exact: true })).toBeVisible();

    const articles = page.locator("main article");
    await expect(articles).toHaveCount(researchPapers.length);

    for (const paper of researchPapers) {
      await expect(page.getByRole("heading", { level: 2, name: paper.title, exact: true })).toBeVisible();
    }

    await expect(
      page.getByRole("link", { name: "Read the benchmark's case study →", exact: true }).first()
    ).toHaveAttribute("href", "/work/agentgauge");
  });

  test("is reachable from the site nav, and the nav marks it active", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Research", exact: true }).click();
    await expect(page).toHaveURL(/\/research$/);

    const researchLink = page
      .getByRole("navigation", { name: "Site" })
      .getByRole("link", { name: "Research", exact: true });
    await expect(researchLink).toHaveAttribute("aria-current", "page");
  });

  test("is listed in the sitemap", async ({ page }) => {
    const response = await page.request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);
    const body = await response.text();
    // sitemap.ts always emits the canonical production origin (content/site.ts),
    // never the dev/preview server this test itself runs against.
    expect(body).toContain(`${site.url}/research<`);
  });
});
