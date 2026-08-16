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
 *
 * That technique has a failure mode this file did not cover for months, and
 * the size assertions below cannot see it. A negative margin makes a
 * control's box larger than its visible ink, which is the point; it also
 * makes that box overlap its neighbours', which is invisible while the row
 * stays on one line. The moment a flex-wrap row wraps, and every one of
 * these does at 375px, rows whose gap is smaller than the cancelled margin
 * overlap, and the browser hit-tests the overlap to whichever element
 * paints last. A tap near the edge of one control silently activates
 * another.
 *
 * Two live instances were found this way: the project filter pills (10px of
 * margin against an 8px gap, seven overlapping pairs) and the contact link
 * row (24px against 8px, 16px of overlap). Both passed every size assertion
 * here the entire time, because a 44px box that overlaps its neighbour is
 * still a 44px box. See CHECKS.md instance 17.
 *
 * So the overlap test below is the other half of this file, not an extra.
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

/**
 * The other half of tap-target correctness: a control has to be the thing
 * that receives a tap aimed at it, not merely large enough to aim at.
 *
 * The floating chat launcher is deliberately excluded. It is a fixed
 * overlay, so overlapping the content it floats over is what it is for; the
 * assertion that matters for it is clearance, which globals.css handles with
 * scroll-padding and e2e/scroll-reachability.spec.ts covers. Every other
 * overlap between two interactive controls is a defect.
 */
test.describe("Tap target overlap (375px)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  const PAGES = ["/", "/projects", "/work/aetherart"];

  for (const path of PAGES) {
    test(`no two controls overlap on ${path}, and each receives its own tap`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(1200);

      const result = await page.evaluate(() => {
        const isFloatingOverlay = (el: Element) =>
          Boolean(el.closest('nav[aria-label="Ask AI assistant"]'));

        const controls = [...document.querySelectorAll<HTMLElement>("a[href], button")].filter(
          (el) => {
            const b = el.getBoundingClientRect();
            return (
              b.width > 0 &&
              b.height > 0 &&
              getComputedStyle(el).visibility !== "hidden" &&
              !isFloatingOverlay(el)
            );
          }
        );

        const describe = (el: HTMLElement) =>
          (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 28);

        const overlaps: string[] = [];
        for (let i = 0; i < controls.length; i++) {
          for (let j = i + 1; j < controls.length; j++) {
            const a = controls[i];
            const b = controls[j];
            // A control nested inside another is not an overlap.
            if (a.contains(b) || b.contains(a)) continue;
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
            const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
            if (ox > 0.5 && oy > 0.5) {
              overlaps.push(
                `"${describe(a)}" and "${describe(b)}" overlap by ${ox.toFixed(1)}x${oy.toFixed(1)}px`
              );
            }
          }
        }

        const unreachable: string[] = [];
        for (const el of controls) {
          const r = el.getBoundingClientRect();
          // Only judge what is actually on screen to be tapped.
          if (r.top < 0 || r.bottom > window.innerHeight) continue;
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const ok = hit && (hit === el || el.contains(hit) || hit.contains(el));
          if (!ok) unreachable.push(`"${describe(el)}" is covered at its own centre`);
        }

        return { count: controls.length, overlaps, unreachable };
      });

      expect(result.count, `${path} has controls to check`).toBeGreaterThan(3);
      expect(result.overlaps, result.overlaps.join("; ")).toEqual([]);
      expect(result.unreachable, result.unreachable.join("; ")).toEqual([]);
    });
  }
});
