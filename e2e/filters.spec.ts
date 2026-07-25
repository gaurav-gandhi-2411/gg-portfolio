import { expect, test } from "@playwright/test";

/**
 * The bug this suite exists to catch: wave 13 shipped category filters that
 * were never driven by a real click. Every assertion here reads the actual
 * rendered DOM state after a real click/keypress — never "the code looks
 * right." Expected counts come from each pill's own rendered label (real
 * server data), not a hardcoded fixture, so this stays correct as
 * content/products.ts changes.
 */

async function visibleCardCount(page: import("@playwright/test").Page) {
  return page
    .locator(".project-grid article")
    .evaluateAll((cards) => cards.filter((c) => getComputedStyle(c).display !== "none").length);
}

for (const path of ["/", "/projects"]) {
  test.describe(`filters on ${path}`, () => {
    test(`clicking each pill actually changes the visible card count (${path})`, async ({ page }) => {
      await page.goto(path);
      const filterGroup = page.getByRole("group", { name: "Filter projects by category" });
      const totalCards = await page.locator(".project-grid article").count();
      const pills = filterGroup.getByRole("button");
      const pillCount = await pills.count();
      expect(pillCount).toBeGreaterThan(1); // "All" + at least one category

      // Skip index 0 ("All" — already the default, clicking it first
      // wouldn't prove anything moved).
      for (let i = 1; i < pillCount; i++) {
        const pill = pills.nth(i);
        const label = (await pill.textContent())?.trim() ?? "";
        const expectedFromLabel = Number(label.match(/(\d+)\s*$/)?.[1]);

        await pill.click();

        const visible = await visibleCardCount(page);
        expect(visible, `after clicking "${label}"`).toBe(expectedFromLabel);
        expect(visible, `"${label}" must actually narrow the set`).toBeLessThan(totalCards);
        await expect(page).toHaveURL(/[?&]category=/);
        await expect(pill).toHaveAttribute("aria-pressed", "true");

        // Wave-14 fix: the result count is now VISIBLE, not sr-only — this
        // is the exact assertion that would have caught the original bug
        // report ("I clicked and nothing happened"): a real user must be
        // able to SEE confirmation, not just have it in the accessibility
        // tree. NOTE: toBeVisible() alone does NOT prove this — Tailwind's
        // sr-only trick (1×1px + clip-rect) still has a non-zero bounding
        // box and no display:none/visibility:hidden, so Playwright reports
        // it "visible" even though no sighted user can read it. Checking
        // real pixel dimensions is what actually distinguishes "visible
        // counter" from "the exact sr-only bug this fixes."
        const counterText = page.getByText(/^Showing \d+ of \d+ projects$/);
        await expect(counterText).toBeVisible();
        await expect(counterText).toHaveText(`Showing ${visible} of ${totalCards} projects`);
        const box = await counterText.boundingBox();
        expect(box?.width ?? 0, "counter must be visually perceivable, not sr-only-clipped").toBeGreaterThan(20);
        expect(box?.height ?? 0, "counter must be visually perceivable, not sr-only-clipped").toBeGreaterThan(4);
      }

      // Reset via "All" and confirm everything comes back.
      await pills.first().click();
      expect(await visibleCardCount(page)).toBe(totalCards);
      await expect(page).not.toHaveURL(/[?&]category=/);
    });

    test(`keyboard activation filters identically to a click (${path})`, async ({ page }) => {
      await page.goto(path);
      const filterGroup = page.getByRole("group", { name: "Filter projects by category" });
      const secondPill = filterGroup.getByRole("button").nth(1);
      await secondPill.focus();
      await expect(secondPill).toBeFocused();
      await secondPill.press("Enter");

      await expect(page).toHaveURL(/[?&]category=/);
      await expect(secondPill).toHaveAttribute("aria-pressed", "true");
      expect(await visibleCardCount(page)).toBeGreaterThan(0);
    });

    test(`a deep link with ?category= applies the filter on load (${path})`, async ({ page }) => {
      await page.goto(`${path}?category=vision`);
      const filterGroup = page.getByRole("group", { name: "Filter projects by category" });
      const visionPill = filterGroup.getByRole("button", { name: /Vision & Generative/ });
      await expect(visionPill).toHaveAttribute("aria-pressed", "true");

      const totalCards = await page.locator(".project-grid article").count();
      const visible = await visibleCardCount(page);
      expect(visible).toBeGreaterThan(0);
      expect(visible).toBeLessThan(totalCards);
    });

    test(`no-JS: every card renders and pills are present but inert (${path})`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(path);
      const cardCount = await page.locator(".project-grid article").count();
      expect(cardCount).toBeGreaterThan(0);
      // Every card must be present in the no-JS DOM (filtering is an
      // enhancement, never a gate on content).
      const hiddenCount = await page
        .locator(".project-grid article")
        .evaluateAll((cards) => cards.filter((c) => getComputedStyle(c).display === "none").length);
      expect(hiddenCount).toBe(0);
      await context.close();
    });
  });
}
