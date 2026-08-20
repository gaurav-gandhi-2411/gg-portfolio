import { expect, test } from "@playwright/test";

import projection from "../content/data/mmfr-projection.json";

/**
 * The item-space section on /work/multimodal-fashion-recommender.
 *
 * Written from what the section is supposed to do rather than from what the
 * components happen to render, per CLAUDE.md's ordering rule. The two
 * sentences these are written from, at this stage:
 *
 *   1. Every anchor's real result is in the HTML, because the list is the
 *      content and any picture added later is a view of it.
 *   2. How many of the five neighbors share the anchor's own category is
 *      stated honestly, not just implied by which rows happen to be
 *      highlighted, because a section that only ever shows agreement is an
 *      advert.
 *
 * The expected values come from the committed projection rather than being
 * typed in, so the page and the data stay two independently derived sides of
 * the same question. A literal would have to be re-typed on every rebuild,
 * which is the edit most likely to be made by changing the number until the
 * test passes (CHECKS.md 18).
 */

const SECTION = "Items landing near each other in the shared space";

test.describe("MMFR item space", () => {
  test("every anchor's real result is server-rendered, with no JavaScript", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/work/multimodal-fashion-recommender");

    const section = page.getByRole("region", { name: SECTION });
    await expect(section).toBeVisible();

    for (const anchor of projection.anchors) {
      await expect(section.getByText(anchor.title, { exact: false }).first()).toBeVisible();
    }

    // The list, not any picture, carries the data: every anchor contributes
    // its five neighbor rows, so the whole result set is readable with no
    // JS at all.
    const expectedRows = projection.anchors.reduce((sum, a) => sum + a.neighbors.length, 0);
    await expect(section.locator("ol > li")).toHaveCount(expectedRows);

    await context.close();
  });

  test("the same-category count is stated honestly for every anchor", async ({ page }) => {
    await page.goto("/work/multimodal-fashion-recommender");
    const section = page.getByRole("region", { name: SECTION });

    // Several anchors in this data legitimately land on the identical "N of 5
    // neighbors share" string (four of six are 5/5), so this is scoped to
    // each anchor's own container rather than searched section-wide -- an
    // unscoped text match collided across anchors on the first run of this
    // test (CHECKS.md 19's exact shape).
    for (const anchor of projection.anchors) {
      const sameCategoryCount = anchor.neighbors.filter((n) => n.same_category).length;
      const block = section.locator(`[data-anchor-id="${anchor.id}"]`);
      await expect(
        block.getByText(`${sameCategoryCount} of ${anchor.neighbors.length} neighbors share`, {
          exact: false,
        })
      ).toBeVisible();
    }

    // Marked by data attribute rather than by the row's wording, so a copy
    // edit cannot silently turn this into a test of nothing.
    const sameCategoryRows = section.locator('ol > li[data-same-category="true"]');
    const expectedSameCategory = projection.anchors.reduce(
      (sum, a) => sum + a.neighbors.filter((n) => n.same_category).length,
      0
    );
    await expect(sameCategoryRows).toHaveCount(expectedSameCategory);
  });

  test("a real, meaningfully-clustered space -- not every neighbor matches, not none do", async ({
    page,
  }) => {
    // This is the strongest single guard against the data itself: if the
    // committed projection ever degenerated to all-match or all-miss (a
    // broken checkpoint, a shuffled catalogue, an untrained tower), this
    // fails and says so, rather than passing on data that no longer proves
    // the claim it's shown to support.
    const totalNeighbors = projection.anchors.reduce((sum, a) => sum + a.neighbors.length, 0);
    const totalSameCategory = projection.anchors.reduce(
      (sum, a) => sum + a.neighbors.filter((n) => n.same_category).length,
      0
    );
    expect(totalSameCategory).toBeGreaterThan(0);
    expect(totalSameCategory).toBeLessThan(totalNeighbors);

    await page.goto("/work/multimodal-fashion-recommender");
    const section = page.getByRole("region", { name: SECTION });
    await expect(section).toBeVisible();
  });

  test("picking an anchor shows that anchor's result, in place", async ({ page }) => {
    await page.goto("/work/multimodal-fashion-recommender");
    const section = page.getByRole("region", { name: SECTION });
    await section.scrollIntoViewIfNeeded();

    // Hydrated: one anchor at a time now, with a control per anchor,
    // labelled by category (each of the six anchors sits in a distinct
    // category, since the offline script samples without replacement).
    const buttons = section.getByRole("button", {
      name: new RegExp(`^(${projection.categories.join("|")})$`),
    });
    await expect(buttons).toHaveCount(projection.anchors.length);
    await expect(section.locator("ol > li")).toHaveCount(projection.anchors[0].neighbors.length);

    const second = projection.anchors[1];
    await section.getByRole("button", { name: second.category, exact: true }).click();

    await expect(section.getByText(second.title, { exact: false }).first()).toBeVisible();
    for (const hit of second.neighbors) {
      await expect(section.getByText(hit.title, { exact: false }).first()).toBeVisible();
    }
  });

  test("the picture is a still of the same catalogue, not an empty box", async ({ page }) => {
    await page.goto("/work/multimodal-fashion-recommender");
    const section = page.getByRole("region", { name: SECTION });
    await section.scrollIntoViewIfNeeded();
    // Hydration has to have happened for the count to mean anything: without
    // it, a low circle count would prove only that the island had not loaded.
    await expect(
      section.getByRole("button", {
        name: new RegExp(`^(${projection.categories.join("|")})$`),
      }).first()
    ).toBeVisible();

    const circles = section.locator("svg circle");
    await expect(circles.first()).toBeVisible();
    // Every catalogue point is drawn, either dimmed in the field or
    // emphasised on top, so the total is the catalogue itself rather than a
    // sample of it.
    expect(await circles.count()).toBeGreaterThanOrEqual(projection.points.length);
  });
});
