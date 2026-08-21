import { expect, test } from "@playwright/test";

/**
 * GG's launch-review round three: "On a project card only the title opens
 * the case study. The whole card should be clickable, with the inner Live
 * and Source links still working independently." Same complaint on
 * Research. See components/project-card.tsx / components/sections/
 * research.tsx's own comments (the stretched-link pattern, app/globals.css)
 * for the mechanism.
 */
test.describe("project card click target", () => {
  test("clicking empty space in the card (the tagline, not the title) opens the case study", async ({
    page,
  }) => {
    // .project-card:hover tilts the card (perspective + rotateX/rotateY,
    // app/work.css) — a coordinate computed from the pre-hover
    // boundingBox() can drift off target once the mouse arrives and the
    // transition starts moving the actual content underneath it. Reduced
    // motion suppresses that transform entirely (`transform: none` under
    // this exact media query in work.css), which is what makes a
    // raw-coordinate click reliable here, the same reason this repo's own
    // gotoSettled() helper emulates it for equivalent geometry-sensitive
    // cases.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/projects");
    const card = page.locator('[data-slug="aetherart"]');
    await card.scrollIntoViewIfNeeded();
    // A raw coordinate click, deliberately not a locator-targeted
    // `.click()` on the tagline: Playwright's actionability check refuses
    // to click an element it detects is obscured by a *different* element
    // at that point (the stretch-link overlay) -- which is exactly the
    // point of this fix, so a locator click on the tagline text itself
    // times out rather than proving anything. This is what a real mouse
    // click does: land at a pixel and let whatever's on top receive it.
    const box = await card.boundingBox();
    if (!box) throw new Error("card not found");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.35);
    await expect(page).toHaveURL(/\/work\/aetherart$/);
  });

  test("Live and Source still navigate to their own targets, not the case study", async ({ page }) => {
    await page.goto("/projects");
    const card = page.locator('[data-slug="aetherart"]');
    await card.scrollIntoViewIfNeeded();

    const live = card.getByRole("link", { name: /^Live/ });
    await expect(live).toHaveAttribute("href", "https://gaurav-gandhi.vercel.app/warmup/aetherart");
    await expect(live).toHaveAttribute("target", "_blank");

    const source = card.getByRole("link", { name: /^Source/ });
    await expect(source).toHaveAttribute("href", "https://github.com/gaurav-gandhi-2411/AetherArt");
    await expect(source).toHaveAttribute("target", "_blank");
  });
});

test.describe("research card click target", () => {
  test("clicking empty space in the card (the abstract, not a link) opens the benchmark's case study", async ({
    page,
  }) => {
    // .section-card:hover tilts too (app/sections-motion.css) -- see the
    // project-card test above for why this needs reduced motion.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#research");
    const card = page.locator("#research article").first();
    await card.scrollIntoViewIfNeeded();
    // Raw coordinate click -- see the project-card test above for why a
    // locator-targeted click on the abstract paragraph itself times out.
    const box = await card.boundingBox();
    if (!box) throw new Error("card not found");
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.75);
    await expect(page).toHaveURL(/\/work\/agentgauge$/);
  });

  test("Repo still navigates to its own target, not the case study", async ({ page }) => {
    await page.goto("/#research");
    const card = page.locator("#research article").first();
    await card.scrollIntoViewIfNeeded();
    const repo = card.getByRole("link", { name: /^Repo/ });
    await expect(repo).toHaveAttribute("href", "https://github.com/gaurav-gandhi-2411/agentgauge");
  });
});
