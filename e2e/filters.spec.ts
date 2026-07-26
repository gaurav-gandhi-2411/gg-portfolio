import { expect, test } from "@playwright/test";

/**
 * The bug this suite exists to catch: wave 13 shipped category filters that
 * were never driven by a real click. Every assertion here reads the actual
 * rendered DOM state after a real click/keypress — never "the code looks
 * right." Expected counts come from each pill's own rendered label (real
 * server data), not a hardcoded fixture, so this stays correct as
 * content/products.ts changes.
 *
 * Wave 15 — progressive disclosure: home caps every view (including "All")
 * to 4 cards + "See all N" to the matching /projects or /projects/[category]
 * page; /projects itself stays uncapped for "All" (it IS the see-all
 * destination) but its own category filters still cap, same as home. The
 * TEASE_LIMIT (4) is duplicated here deliberately — it's the same
 * intentional constant as components/project-filter.tsx's TEASE_LIMIT, not
 * a coincidence to dedupe away.
 */

const TEASE_LIMIT = 4;

async function visibleCardCount(page: import("@playwright/test").Page) {
  return page
    .locator(".project-grid article")
    .evaluateAll((cards) => cards.filter((c) => getComputedStyle(c).display !== "none").length);
}

const PATHS: { path: string; capsAll: boolean }[] = [
  { path: "/", capsAll: true },
  { path: "/projects", capsAll: false },
];

for (const { path, capsAll } of PATHS) {
  test.describe(`filters on ${path}`, () => {
    test(`clicking each category pill caps to ${TEASE_LIMIT} when the category has more (${path})`, async ({
      page,
    }) => {
      await page.goto(path);
      const filterGroup = page.getByRole("group", { name: "Filter projects by category" });
      const totalCards = await page.locator(".project-grid article").count();
      const pills = filterGroup.getByRole("button");
      const pillCount = await pills.count();
      expect(pillCount).toBeGreaterThan(1); // "All" + at least one category

      // Skip index 0 ("All" — covered separately below, it behaves
      // differently per-path).
      for (let i = 1; i < pillCount; i++) {
        const pill = pills.nth(i);
        const label = (await pill.textContent())?.trim() ?? "";
        const categoryTotal = Number(label.match(/(\d+)\s*$/)?.[1]);
        const expectedVisible = Math.min(categoryTotal, TEASE_LIMIT);

        await pill.click();

        const visible = await visibleCardCount(page);
        expect(visible, `after clicking "${label}"`).toBe(expectedVisible);
        expect(visible, `"${label}" must actually narrow the set`).toBeLessThan(totalCards);
        await expect(page).toHaveURL(/[?&]category=/);
        await expect(pill).toHaveAttribute("aria-pressed", "true");

        // Wave-14 fix, still true: the result count must be VISIBLE, not
        // sr-only. Wave 15: the denominator is now the category's own total,
        // not the site-wide total (more informative once a view can cap).
        const counterText = page.getByText(/^Showing \d+ of \d+ projects$/);
        await expect(counterText).toBeVisible();
        await expect(counterText).toHaveText(`Showing ${expectedVisible} of ${categoryTotal} projects`);
        const box = await counterText.boundingBox();
        expect(box?.width ?? 0, "counter must be visually perceivable, not sr-only-clipped").toBeGreaterThan(20);
        expect(box?.height ?? 0, "counter must be visually perceivable, not sr-only-clipped").toBeGreaterThan(4);

        const seeAllLink = page.getByRole("link", { name: /^See all \d+ in / });
        if (categoryTotal > TEASE_LIMIT) {
          await expect(seeAllLink).toBeVisible();
          await expect(seeAllLink).toHaveText(new RegExp(`^See all ${categoryTotal} in `));
        } else {
          await expect(seeAllLink).toHaveCount(0);
        }
      }

      // Reset via "All".
      await pills.first().click();
      await expect(page).not.toHaveURL(/[?&]category=/);
      const allVisible = await visibleCardCount(page);
      expect(allVisible).toBe(capsAll ? Math.min(totalCards, TEASE_LIMIT) : totalCards);
    });

    test(`"All" ${capsAll ? "caps to " + TEASE_LIMIT + " with a See all link" : "shows every card uncapped"} on load (${path})`, async ({
      page,
    }) => {
      await page.goto(path);
      const totalCards = await page.locator(".project-grid article").count();
      const visible = await visibleCardCount(page);
      const seeAllLink = page.getByRole("link", { name: /^See all \d+ →$/ });

      if (capsAll) {
        expect(visible).toBe(Math.min(totalCards, TEASE_LIMIT));
        await expect(seeAllLink).toBeVisible();
        await expect(seeAllLink).toHaveText(`See all ${totalCards} →`);
        await expect(seeAllLink).toHaveAttribute("href", "/projects");
      } else {
        expect(visible).toBe(totalCards);
        await expect(seeAllLink).toHaveCount(0);
      }
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

    test(`no-JS: every card renders, pills are inert, and no capping applies (${path})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(path);
      const cardCount = await page.locator(".project-grid article").count();
      expect(cardCount).toBeGreaterThan(0);
      // Every card must be present in the no-JS DOM — filtering AND the
      // wave-15 progressive-disclosure cap are both enhancements, never a
      // gate on content. This is the exact assertion that would catch a
      // regression where the <noscript> override (project-filter.tsx) stops
      // working and the "All" tease silently becomes a permanent 4-card cap
      // for visitors without JS.
      const hiddenCount = await page
        .locator(".project-grid article")
        .evaluateAll((cards) => cards.filter((c) => getComputedStyle(c).display === "none").length);
      expect(hiddenCount).toBe(0);
      await context.close();
    });
  });
}
