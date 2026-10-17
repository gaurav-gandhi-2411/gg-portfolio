import { expect, test } from "@playwright/test";
test("OLD FLOW forced race: goto, click, expect", async ({ page }) => {
  await page.route("**/_next/static/chunks/**", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const pill = page.getByRole("group", { name: "Filter projects by category" }).getByRole("button").nth(1);
  await pill.click();
  await expect(page).toHaveURL(/[?&]category=/, { timeout: 8000 });
  await expect(pill).toHaveAttribute("aria-pressed", "true");
});
