import { expect, test } from "@playwright/test";
import { categoryIds } from "./fixtures/category-ids";

/**
 * Wave 15 — /projects/[category], the progressive-disclosure destination.
 * Covers: direct navigation renders every matching project uncapped, the
 * "See all" link from home/`/projects` actually lands here, and the
 * back-link returns to the unfiltered index.
 */

for (const id of categoryIds) {
  test(`/projects/${id} renders every matching project, uncapped`, async ({ page }) => {
    await page.goto(`/projects/${id}`);
    const cardCount = await page.locator(".project-grid article").count();
    expect(cardCount).toBeGreaterThan(0);
    const hiddenCount = await page
      .locator(".project-grid article")
      .evaluateAll((cards) => cards.filter((c) => getComputedStyle(c).display === "none").length);
    expect(hiddenCount).toBe(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

test("clicking See all on a capped home category lands on its /projects/[category] page with the full set", async ({
  page,
}) => {
  await page.goto("/");
  const filterGroup = page.getByRole("group", { name: "Filter projects by category" });
  const pills = filterGroup.getByRole("button");
  const pillCount = await pills.count();

  // Find the first category pill whose total exceeds the tease limit (4) —
  // that's the only state where a "See all in [Label]" link exists to click.
  let clicked = false;
  for (let i = 1; i < pillCount; i++) {
    const pill = pills.nth(i);
    const label = (await pill.textContent())?.trim() ?? "";
    const total = Number(label.match(/(\d+)\s*$/)?.[1]);
    if (total > 4) {
      await pill.click();
      const seeAllLink = page.getByRole("link", { name: /^See all \d+ in / });
      await expect(seeAllLink).toBeVisible();
      const href = await seeAllLink.getAttribute("href");
      await seeAllLink.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      const cardCount = await page.locator(".project-grid article").count();
      expect(cardCount).toBe(total);
      clicked = true;
      break;
    }
  }
  expect(clicked, "expected at least one category with more than 4 projects").toBe(true);
});

test("clicking See all N on home's All view lands on /projects with the full set", async ({
  page,
}) => {
  await page.goto("/");
  const seeAllLink = page.getByRole("link", { name: /^See all \d+ →$/ });
  await expect(seeAllLink).toBeVisible();
  await seeAllLink.click();
  await expect(page).toHaveURL(/\/projects$/);
  const cardCount = await page.locator(".project-grid article").count();
  const hiddenCount = await page
    .locator(".project-grid article")
    .evaluateAll((cards) => cards.filter((c) => getComputedStyle(c).display === "none").length);
  expect(hiddenCount).toBe(0);
  expect(cardCount).toBeGreaterThan(0);
});

test("← Back to all projects on a category page returns to /projects", async ({ page }) => {
  await page.goto(`/projects/${categoryIds[0]}`);
  await page.getByRole("link", { name: "← Back to all projects" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("heading", { level: 1, name: "All projects" })).toBeVisible();
});

test("an unknown category slug 404s", async ({ page }) => {
  const response = await page.goto("/projects/not-a-real-category");
  expect(response?.status()).toBe(404);
});
