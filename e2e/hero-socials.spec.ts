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
    // Round three called this GPU-contention flake and raised the assertion
    // timeout to 15s; it kept failing on both desktop and mobile (#225, #244,
    // #246, #247, #248, run 36111662959) because that was never the actual
    // mechanism. Instrumented repro (getBoundingClientRect + elementFromPoint
    // polled every 20ms through the hover): .hero-actions's own entrance
    // animation (`hero-rise`, app/hero.css, 620ms + a 240ms delay --
    // ~860ms total) is still sliding the icon row up into place well after
    // page.goto() resolves. Playwright's hover() "stable" actionability
    // check can pass early on this ease-out curve's shallow tail -- two
    // consecutive rAF samples close enough to look settled while the
    // element is still moving -- so hover() fires at a not-yet-final
    // position and the animation keeps carrying the icon the rest of the
    // way, out from under a now-stationary cursor. The browser's :hover
    // then correctly clears (confirmed via `.matches(":hover")`, which goes
    // false mid-slide) and the tooltip's opacity transitions back to 0 --
    // exactly the CSS rule working as written, not a logic defect and not
    // contention. A real mouse user never notices this because their
    // cursor keeps moving, which re-triggers :hover at the icon's current
    // (or final) position; a single static synthetic hover does not get
    // that second chance. Waiting for the entrance animation's own
    // `finished` promise before hovering removes the race at its source,
    // which no timeout on the assertion after the fact could do -- the
    // tooltip was never going to re-open on its own once the one hover
    // event had already landed and been undone.
    await page.goto("/");
    const heroActions = page.locator(".hero-actions");
    const github = page.locator("[data-hero]").getByRole("link", { name: "GitHub", exact: true });
    const tip = github.locator(".hero-social-tip");

    await heroActions.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));

    await expect(tip).toHaveCSS("opacity", "0");
    await github.hover();
    await expect(tip).toHaveCSS("opacity", "1");
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
