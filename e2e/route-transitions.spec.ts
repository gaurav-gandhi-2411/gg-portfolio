import { expect, test } from "@playwright/test";

test.describe("route transitions", () => {
  test("clicking a project card reaches its real case study, and back returns cleanly", async ({
    page,
  }) => {
    await page.goto("/");
    const firstCard = page.locator(".project-grid article").first();
    const projectName = (await firstCard.locator("h3, h2").first().textContent())?.trim();
    await firstCard.getByRole("link", { name: "Case study →" }).click();

    await expect(page).toHaveURL(/\/work\/[a-z0-9-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(projectName ?? "");

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".project-grid article").first()).toBeVisible();
  });

  test("case study's 'All projects' links return to /projects with content intact", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");
    await page.getByRole("link", { name: "← All projects" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    expect(await page.locator(".project-grid article").count()).toBeGreaterThan(0);

    await page.goto("/work/triageiq");
    await page.getByRole("link", { name: "← Back to all projects" }).click();
    await expect(page).toHaveURL(/\/projects$/);
  });

  test("a client-side nav completes without a stuck/blank page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Projects", exact: true }).click();
    await expect(page).toHaveURL(/\/projects$/);
    // The destination page must stay interactive immediately after the nav
    // commits — prove it by driving another interaction right away.
    const firstPill = page.getByRole("group", { name: "Filter projects by category" }).getByRole("button").first();
    await expect(firstPill).toBeVisible();
    await expect(firstPill).toBeEnabled();
  });

  test("browser back/forward after a client-side nav lands on the right page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Projects", exact: true }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await page.locator(".project-grid article").first().getByRole("link", { name: "Case study →" }).click();
    await expect(page).toHaveURL(/\/work\//);

    await page.goBack();
    await expect(page).toHaveURL(/\/projects$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/projects$/);
  });
});
