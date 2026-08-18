import { expect, test } from "@playwright/test";

import projection from "../content/data/triageiq-retrieval-projection.json";

/**
 * The retrieval-space section on /work/triageiq.
 *
 * Written from what the section is supposed to do rather than from what the
 * components happen to render, per CLAUDE.md's ordering rule. The two
 * sentences these are written from, at this stage:
 *
 *   1. Every query's real result is in the HTML, because the list is the
 *      content and any picture added later is a view of it.
 *   2. A query whose answer was missed says so, with the rank it actually
 *      got, because a section that only ever shows hits is an advert.
 *   3. Picking a query shows that query, in place, and the picture beside it
 *      is a still of the same corpus rather than an empty box.
 *
 * The expected values come from the committed projection rather than being
 * typed in, so the page and the data stay two independently derived sides of
 * the same question. A literal would have to be re-typed on every rebuild,
 * which is the edit most likely to be made by changing the number until the
 * test passes (CHECKS.md 18).
 */

const SECTION = "Which already-solved issues look like this one";

test.describe("TriageIQ retrieval space", () => {
  test("every query's real result is server-rendered, with no JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/work/triageiq");

    const section = page.getByRole("region", { name: SECTION });
    await expect(section).toBeVisible();

    for (const query of projection.queries) {
      await expect(section.getByText(`#${query.n}`, { exact: false }).first()).toBeVisible();
    }

    // The list, not any picture, carries the data: every query contributes its
    // top-k rows, so the whole result set is readable with no JS at all.
    await expect(section.locator("ol > li")).toHaveCount(
      projection.queries.length * projection.top_k
    );

    await context.close();
  });

  test("a query whose answer was missed says so, with the rank it actually got", async ({
    page,
  }) => {
    const missed = projection.queries.find((q) => !q.gold_in_top_k);
    test.skip(!missed, "no missed query in the committed projection");
    if (!missed) return;

    await page.goto("/work/triageiq");
    const section = page.getByRole("region", { name: SECTION });

    // The whole reason this section is trustworthy: the miss is stated, with
    // the real rank, rather than the query being quietly left out.
    await expect(section.getByText(/^Missed\./).first()).toBeVisible();
    await expect(section.getByText(new RegExp(`rank ${missed.gold_rank}`)).first()).toBeVisible();
    await expect(section.getByText(`#${missed.gold}`).first()).toBeVisible();
  });

  test("picking a query shows that query's result, in place", async ({ page }) => {
    await page.goto("/work/triageiq");
    const section = page.getByRole("region", { name: SECTION });
    await section.scrollIntoViewIfNeeded();

    // Hydrated: one query at a time now, with a control per query.
    const buttons = section.getByRole("button", { name: /^#\d+$/ });
    await expect(buttons).toHaveCount(projection.queries.length);
    await expect(section.locator("ol > li")).toHaveCount(projection.top_k);

    const second = projection.queries[1];
    await section.getByRole("button", { name: `#${second.n}`, exact: true }).click();

    await expect(section.getByText(second.title, { exact: false }).first()).toBeVisible();
    for (const hit of second.retrieved) {
      await expect(section.getByText(hit.title, { exact: false }).first()).toBeVisible();
    }
  });

  test("the picture is a still of the same corpus, not an empty box", async ({ page }) => {
    await page.goto("/work/triageiq");
    const section = page.getByRole("region", { name: SECTION });
    await section.scrollIntoViewIfNeeded();
    // Hydration has to have happened for the count to mean anything: without
    // it, a low circle count would prove only that the island had not loaded.
    await expect(section.getByRole("button", { name: /^#\d+$/ }).first()).toBeVisible();

    const circles = section.locator("svg circle");
    await expect(circles.first()).toBeVisible();
    // Every corpus point is drawn, either dimmed in the field or emphasised on
    // top, so the total is the corpus itself rather than a sample of it.
    expect(await circles.count()).toBeGreaterThanOrEqual(projection.points.length);
  });

  test("the gold answer is marked wherever it landed inside the shown results", async ({
    page,
  }) => {
    const hit = projection.queries.find((q) => q.gold_in_top_k);
    test.skip(!hit, "no query with its gold answer inside top-k");
    if (!hit) return;

    await page.goto("/work/triageiq");
    const section = page.getByRole("region", { name: SECTION });
    await section.scrollIntoViewIfNeeded();
    await section.getByRole("button", { name: `#${hit.n}`, exact: true }).click();

    // Marked by data attribute rather than by the label's wording, so a copy
    // edit cannot silently turn this into a test of nothing.
    const goldRow = section.locator('ol > li[data-gold="true"]');
    await expect(goldRow).toHaveCount(1);
    await expect(goldRow).toContainText(`#${hit.gold}`);
  });
});
