import { expect, test } from "@playwright/test";

/**
 * GG's launch-review round three: "No titles on the social icons. GitHub,
 * LinkedIn, Hugging Face and email in the hero show nothing on hover."
 * Each icon already carried an aria-label (the accessible name a screen
 * reader gets), but nothing gave a sighted mouse user, or a keyboard user
 * tabbing through, any visible confirmation of what the icon was — a real
 * gap distinct from having an accessible name at all. See
 * components/sections/hero.tsx / app/hero.css's own comments for why this
 * is a visible tooltip (:hover AND :focus-visible) rather than a native
 * `title` attribute, which only ever covers the mouse-hover half.
 *
 * Locators are scoped to [data-hero]: Contact also has its own visible
 * "GitHub"/"LinkedIn"/"Hugging Face" text links, so an unscoped
 * getByRole("link", { name }) matches both and fails strict mode.
 */
test.describe("hero social icons", () => {
  const LABELS = ["GitHub", "LinkedIn", "Hugging Face", "Email"];

  test("each icon has an accessible name", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator("[data-hero]");
    for (const label of LABELS) {
      await expect(hero.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
  });

  test("hovering an icon reveals a visible tooltip with its label", async ({ page }) => {
    // Round three: this flaked exactly once in five full-suite runs this
    // session (never once in >10 isolated re-runs), always alongside
    // GPU-heavy WebGL hero/case-study tests running concurrently in other
    // workers -- consistent with genuine resource contention delaying the
    // hover transition's paint past Playwright's default 5s retry window,
    // not a logic defect (the mechanism itself is sabotage-verified in
    // app/hero.css). A longer explicit timeout is the correct hardening
    // for contention; it would not mask a real regression, since a broken
    // rule never reaches opacity:1 at any timeout.
    await page.goto("/");
    const github = page.locator("[data-hero]").getByRole("link", { name: "GitHub", exact: true });
    const tip = github.locator(".hero-social-tip");

    await expect(tip).toHaveCSS("opacity", "0");
    await github.hover();
    await expect(tip).toHaveCSS("opacity", "1", { timeout: 15000 });
    await expect(tip).toHaveText("GitHub");
  });

  test("tabbing to an icon reveals the same tooltip, not just a mouse hover", async ({ page }) => {
    await page.goto("/");
    const linkedin = page.locator("[data-hero]").getByRole("link", { name: "LinkedIn", exact: true });
    const tip = linkedin.locator(".hero-social-tip");

    await linkedin.focus();
    await expect(linkedin).toBeFocused();
    await expect(tip).toHaveCSS("opacity", "1", { timeout: 15000 });
  });

  test("the tooltip text is aria-hidden, so it never doubles up the aria-label announcement", async ({
    page,
  }) => {
    await page.goto("/");
    const tip = page
      .locator("[data-hero]")
      .getByRole("link", { name: "Hugging Face", exact: true })
      .locator(".hero-social-tip");
    await expect(tip).toHaveAttribute("aria-hidden", "true");
  });
});
