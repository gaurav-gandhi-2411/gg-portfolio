import { expect, test } from "@playwright/test";

/**
 * The project grid's rhythm and its hover reveal.
 *
 * The rhythm test is the one worth having. Card sizes are computed
 * (lib/project-rhythm.ts) rather than listed, because a spread has to start
 * a row or it strands the half card beside it and punches a hole in the
 * grid, and whether a given project starts a row depends on everything
 * before it in the list. That is exactly the sort of rule that stays correct
 * until someone inserts a project in the middle, at which point the grid
 * quietly grows a gap that no build step notices. So this asserts the
 * property the rule exists to guarantee, on the rendered page, rather than
 * asserting the sizes the rule currently happens to produce.
 */

/** Rows narrower than the grid by more than this are holes, not rounding. */
const HOLE_TOLERANCE_PX = 60;

async function gridRows(page: import("@playwright/test").Page) {
  return page.evaluate((tolerance) => {
    const grid = document.querySelector<HTMLElement>(".project-grid");
    if (!grid) return null;
    const gridWidth = grid.getBoundingClientRect().width;
    const cards = [...grid.querySelectorAll<HTMLElement>(".project-card")].filter(
      (c) => getComputedStyle(c).display !== "none"
    );

    // Group by row. Cards in a row share a top edge to within a few pixels,
    // but not exactly, because they can differ in height.
    const rows: { top: number; width: number; slugs: string[] }[] = [];
    for (const card of cards) {
      const box = card.getBoundingClientRect();
      const row = rows.find((r) => Math.abs(r.top - box.top) < 12);
      if (row) {
        row.width += box.width;
        row.slugs.push(card.dataset.slug ?? "?");
      } else {
        rows.push({ top: box.top, width: box.width, slugs: [card.dataset.slug ?? "?"] });
      }
    }

    return {
      gridWidth,
      cardCount: cards.length,
      rows,
      // The last row is allowed to be short: an odd number of half cards has
      // to end somewhere. Any earlier short row is a hole.
      holes: rows
        .slice(0, -1)
        .filter((r) => r.width < gridWidth - tolerance)
        .map((r) => r.slugs.join(" + ")),
    };
  }, HOLE_TOLERANCE_PX);
}

test.describe("project grid rhythm", () => {
  test("every full row is filled, so the varied card sizes leave no holes", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForTimeout(1200);

    const result = await gridRows(page);
    expect(result, "grid is present").not.toBeNull();
    expect(result!.cardCount, "all projects render").toBeGreaterThan(8);
    expect(result!.holes, `rows with a gap: ${result!.holes.join(" | ")}`).toEqual([]);
  });

  test("the rhythm survives every category filter, which shows a different subset", async ({
    page,
  }) => {
    await page.goto("/projects");
    await page.waitForTimeout(1200);

    const pills = page.getByRole("group", { name: "Filter projects by category" }).getByRole("button");
    const count = await pills.count();

    for (let i = 1; i < count; i++) {
      const label = (await pills.nth(i).textContent())?.trim() ?? "";
      await pills.nth(i).click();
      await page.waitForTimeout(500);

      const result = await gridRows(page);
      expect(result!.cardCount, `"${label}" shows cards`).toBeGreaterThan(0);
      expect(
        result!.holes,
        `"${label}" left a gap mid-grid: ${result!.holes.join(" | ")}`
      ).toEqual([]);
    }
  });

  test("a mix of card sizes is actually being rendered", async ({ page }, testInfo) => {
    // Two columns only exist from lg up. Below that every card is full width
    // by design and the rhythm comes from the content, so there is no mix to
    // assert and this would be testing the wrong thing rather than nothing.
    test.skip(testInfo.project.name === "mobile", "the grid is single-column below lg");
    await page.goto("/projects");
    await page.waitForTimeout(1200);

    const sizes = await page.evaluate(() => {
      const cards = [...document.querySelectorAll<HTMLElement>(".project-card")];
      const widths = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().width)));
      return { distinctWidths: widths.size, sizes: cards.map((c) => c.dataset.size) };
    });

    // Guards against the rule silently degrading to "everything is standard",
    // which would pass the no-holes test perfectly and defeat the point.
    expect(sizes.sizes, "some cards are spreads").toContain("spread");
    expect(sizes.sizes, "some cards are standard").toContain("standard");
    expect(sizes.distinctWidths, "two rendered widths, not one").toBeGreaterThan(1);
  });
});

test.describe("project card reveal", () => {
  test("hovering a card shows its stack and lights it in its own hue", async ({ page }, testInfo) => {
    // A coarse pointer has no hover state to test. That is not a gap in
    // coverage: the reveal is additive, the keyboard case below covers the
    // same markup, and the "readable without the reveal" test covers what a
    // touch visitor actually gets.
    test.skip(testInfo.project.name === "mobile", "no hover on a coarse pointer");
    await page.goto("/projects");
    await page.waitForTimeout(1200);

    const card = page.locator('[data-slug="aetherart"]');
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const chips = card.locator(".project-card-chips");
    await expect(chips, "the stack is hidden at rest").toBeHidden();

    await card.hover();
    await page.waitForTimeout(700);

    await expect(chips, "hovering reveals the stack").toBeVisible();

    const lit = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-slug="aetherart"] .project-card-light');
      return el ? Number(getComputedStyle(el).opacity) : 0;
    });
    expect(lit, "the cursor light comes up").toBeGreaterThan(0.5);
  });

  test("keyboard focus reveals the same thing a pointer does", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForTimeout(1200);

    const card = page.locator('[data-slug="aetherart"]');
    const chips = card.locator(".project-card-chips");
    await expect(chips).toBeHidden();

    // Focus a link inside the card, which is what tabbing to it does.
    await page.evaluate(() => {
      document
        .querySelector<HTMLElement>('[data-slug="aetherart"] a')
        ?.focus();
    });
    await page.waitForTimeout(600);

    await expect(chips, "focus-within reveals the stack for keyboard users").toBeVisible();
  });

  test("every card is fully readable without the reveal, which is what touch gets", async ({
    page,
  }) => {
    // The reveal is additive: everything a card needs to be understood is
    // readable without it, which is what makes it safe to gate on hover.
    await page.goto("/projects");
    await page.waitForTimeout(1200);

    const card = page.locator('[data-slug="aetherart"]');
    await expect(card.getByRole("heading")).toBeVisible();
    await expect(card.getByRole("link", { name: /Case study/ })).toBeVisible();
    await expect(card.locator(".project-card-chips")).toBeHidden();
  });
});
