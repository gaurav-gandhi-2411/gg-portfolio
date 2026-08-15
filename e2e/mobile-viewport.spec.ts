import { expect, test } from "@playwright/test";

/**
 * 2026-08-10 mobile audit regression: MetricProvenance panels are
 * position:absolute + opacity-0 when closed (not display:none), so they
 * stay in normal layout flow. On a 375px viewport with no overflow-x
 * containment, a panel anchored near a trigger far enough right in the
 * text was wide enough to expand the page's own layout viewport — every
 * mobile visitor got a horizontally-scrollable, zoomed-out page without
 * ever opening a disclosure. Verified live: hiding the panels snapped the
 * measured viewport back to exactly 375px on every case-study page tested
 * (aetherart 386->375, style-maitri 498->375, warmer 383->375). The
 * homepage's decorative .hero-halo (width:42rem, max-width:100vw) hit the
 * same missing containment, intermittently (~4/5 loads): 100vw is
 * self-reinforcing once the viewport has already been nudged wider by
 * anything else without containment.
 *
 * The fix (`overflow-x: clip` on `html`, plus `.hero-halo` switching from
 * the self-reinforcing `max-width:100vw` to `width:min(42rem,100%)` — see
 * app/globals.css) makes `document.documentElement.clientWidth` correct,
 * which is what actually governs rendering (percentage/vw resolution,
 * whether content visibly overflows) and is the same signal Lighthouse's
 * "content sized correctly for viewport" audit checks.
 * `window.innerWidth`/`scrollWidth` can still under-report a clipped
 * element's pre-clip extent — a documented Chromium quirk in how the
 * mobile layout viewport is sized before `overflow:clip` applies — so
 * those aren't reliable evidence of a live overflow bug on their own and
 * are deliberately not asserted here.
 */
test.describe("Mobile viewport containment (375px)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(clientWidth).toBe(375);
  }

  test("home has no horizontal overflow, including the embedding-cloud hero background", async ({
    page,
  }) => {
    // .hero-halo (the fixed-width circle this regression was originally
    // about) is gone — replaced by components/hero/embedding-cloud.tsx,
    // an inset-0 layer that can't reproduce the same self-reinforcing
    // width bug by construction. Kept as a live regression guard anyway
    // rather than assumed safe from the CSS alone.
    await page.goto("/");
    await assertNoHorizontalOverflow(page);
  });

  test("projects grid has no horizontal overflow", async ({ page }) => {
    await page.goto("/projects");
    await assertNoHorizontalOverflow(page);
  });

  test("a case-study page has no horizontal overflow with every provenance panel closed", async ({
    page,
  }) => {
    await page.goto("/work/style-maitri");
    await assertNoHorizontalOverflow(page);
  });

  test("opening a provenance disclosure near the right edge does not expand the page beyond the viewport", async ({
    page,
  }) => {
    await page.goto("/work/aetherart");
    const triggers = page.locator("button[aria-expanded]");
    const count = await triggers.count();
    for (let i = 0; i < count; i++) {
      // Open one at a time: an already-open panel is pointer-events-auto
      // and can visually sit over a later trigger, which is a test-harness
      // ordering issue, not something a real single-tap visitor hits.
      await triggers.nth(i).click();
      await assertNoHorizontalOverflow(page);
      await triggers.nth(i).click();
    }
  });
});

/**
 * Tap-target sizing regression (2026-08-10 mobile audit): every provenance
 * disclosure trigger measured 24px tall site-wide (dozens of instances
 * across all 13 case studies), and the primary nav, breadcrumb "back"
 * links, and category filter chips were all under the 44px bar too. Each
 * fix uses the same technique — inline-flex + min-h-11 (and min-w-11 where
 * the target's own width was also short) with a matching negative margin
 * so the surrounding layout doesn't visually shift.
 */
test.describe("Tap target sizing (375px)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  async function assertAtLeast44(locator: import("@playwright/test").Locator) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  test("primary nav links meet the 44px tap-target minimum", async ({ page }) => {
    await page.goto("/");
    for (const name of ["About", "Experience", "Projects", "Contact"]) {
      await assertAtLeast44(page.getByRole("navigation", { name: "Site" }).getByRole("link", { name }));
    }
  });

  test("case-study breadcrumb and footer back-links meet the 44px minimum", async ({ page }) => {
    await page.goto("/work/aetherart");
    await assertAtLeast44(page.getByRole("link", { name: "← All projects" }));
    await assertAtLeast44(page.getByRole("link", { name: "← Back to all projects" }));
  });

  test("category filter chips meet the 44px minimum", async ({ page }) => {
    await page.goto("/projects");
    await assertAtLeast44(page.getByRole("button", { name: /^All \d+$/ }));
  });

  test("project card footer links (Case study / Live / Source) meet the 44px minimum", async ({
    page,
  }) => {
    await page.goto("/projects");
    const card = page.locator('article[data-slug="aetherart"]');
    await assertAtLeast44(card.getByRole("link", { name: "Case study →" }));
  });

  test("provenance disclosure triggers meet the 44px minimum", async ({ page }) => {
    await page.goto("/work/aetherart");
    const trigger = page.locator("button[aria-expanded]").first();
    const box = await trigger.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  });
});
