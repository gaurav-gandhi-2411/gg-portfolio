import { expect, test } from "@playwright/test";

test.describe("site navigation", () => {
  test("every nav link lands on the right destination", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Projects", exact: true }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("All projects");

    await page.getByRole("link", { name: "Gaurav Gandhi, home" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole("link", { name: "About", exact: true }).click();
    await expect(page).toHaveURL(/#about$/);
    await expect(page.getByRole("heading", { name: "About me" })).toBeInViewport();

    await page.getByRole("link", { name: "Experience", exact: true }).click();
    await expect(page).toHaveURL(/#experience$/);
    await expect(page.getByRole("heading", { name: "Experience", level: 2 })).toBeInViewport();

    await page.getByRole("link", { name: "Contact", exact: true }).click();
    await expect(page).toHaveURL(/#contact$/);
    await expect(page.getByRole("heading", { name: "Contact", level: 2 })).toBeInViewport();
  });

  test("skip-to-content link is the first focus stop and works", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await expect(skipLink).toBeFocused();
    await skipLink.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("nav shows an active state on /projects", async ({ page }) => {
    await page.goto("/projects");
    const projectsLink = page.getByRole("navigation", { name: "Site" }).getByRole("link", {
      name: "Projects",
      exact: true,
    });
    await expect(projectsLink).toHaveAttribute("aria-current", "page");
  });

  test("nav shows an active state on a case study route too", async ({ page }) => {
    await page.goto("/work/triageiq");
    const projectsLink = page.getByRole("navigation", { name: "Site" }).getByRole("link", {
      name: "Projects",
      exact: true,
    });
    await expect(projectsLink).toHaveAttribute("aria-current", "page");
  });
});
