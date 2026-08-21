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

/**
 * A category click is a synchronous CSS `display:none` swap (no transition
 * to wait out), but `getBoundingClientRect()` right after it can still land
 * mid-layout under CI's contended main thread — a fixed 500ms passed most
 * runs and then flaked twice on the exact same category/card pair
 * (round 3, 2026-08-21), which is the signature of a measurement racing
 * layout rather than a real rhythm bug: a genuine gap would reproduce every
 * time, not intermittently. Polls until two reads in a row agree instead of
 * trusting a single one taken after an arbitrary delay.
 */
async function stableGridRows(page: import("@playwright/test").Page) {
  let previous = JSON.stringify(await gridRows(page));
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(100);
    const next = JSON.stringify(await gridRows(page));
    if (next === previous) return JSON.parse(next) as Awaited<ReturnType<typeof gridRows>>;
    previous = next;
  }
  return JSON.parse(previous) as Awaited<ReturnType<typeof gridRows>>;
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

      const result = await stableGridRows(page);
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

  test("keyboard focus reveals the same thing a pointer does", async ({ page }, testInfo) => {
    // Where there is no hover, the chips are simply shown from the start
    // (see the touch test below), so there is no reveal to trigger.
    test.skip(testInfo.project.name === "mobile", "no hover, so the stack is already shown");
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

  test("touch gets the stack outright instead of a gesture it cannot perform", async ({
    page,
  }, testInfo) => {
    await page.goto("/projects");
    await page.waitForTimeout(1200);

    const card = page.locator('[data-slug="aetherart"]');
    // Whatever the pointer, the card is fully readable on its own: the
    // reveal is additive and never holds anything a visitor needs.
    await expect(card.getByRole("heading")).toBeVisible();
    await expect(card.getByRole("link", { name: /Case study/ })).toBeVisible();

    const chips = card.locator(".project-card-chips");
    if (testInfo.project.name === "mobile") {
      // A coarse pointer has no hover, so gating the stack behind one would
      // mean phone visitors never see it. The honest equivalent is not a
      // gesture to discover, it is showing the thing.
      await expect(chips, "touch sees the stack without hovering").toBeVisible();
    } else {
      await expect(chips, "with a fine pointer it waits for hover").toBeHidden();
    }
  });
});

test.describe("filter pill tap targets", () => {
  /*
   * No two pills may overlap.
   *
   * The pills carry a negative vertical margin so a 44px tap target does not
   * bulk out the row. On one line that is invisible. The moment the row
   * wraps, which it does on any phone, it made adjacent rows overlap by 2px,
   * and Chromium hit-tests an overlap to whichever element paints last, so a
   * tap near the edge of one pill could apply a different filter.
   *
   * It surfaced as Playwright retrying a click for three and a half seconds
   * and reporting that another pill "intercepts pointer events". That was
   * the harness describing a real defect accurately, and the tempting read
   * was that the test was slow.
   */
  test("no two filter pills overlap, so a tap always hits the one you aimed at", async ({
    page,
  }) => {
    await page.goto("/projects");
    await page.waitForTimeout(900);

    const overlaps = await page.evaluate(() => {
      const pills = [
        ...document.querySelectorAll<HTMLElement>(
          '[aria-label="Filter projects by category"] button'
        ),
      ];
      const boxes = pills.map((p) => ({
        label: (p.textContent ?? "").trim().slice(0, 24),
        r: p.getBoundingClientRect(),
      }));
      const hits: string[] = [];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].r;
          const b = boxes[j].r;
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapX > 0.5 && overlapY > 0.5) {
            hits.push(
              `"${boxes[i].label}" and "${boxes[j].label}" overlap by ${overlapX.toFixed(1)}x${overlapY.toFixed(1)}px`
            );
          }
        }
      }
      return { pillCount: pills.length, hits };
    });

    expect(overlaps.pillCount, "pills are present").toBeGreaterThan(3);
    expect(overlaps.hits, overlaps.hits.join("; ")).toEqual([]);
  });

  test("every pill is the one that receives a tap at its own centre", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForTimeout(900);

    const wrong = await page.evaluate(() => {
      const pills = [
        ...document.querySelectorAll<HTMLElement>(
          '[aria-label="Filter projects by category"] button'
        ),
      ];
      const bad: string[] = [];
      for (const pill of pills) {
        const r = pill.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!hit || !(hit === pill || pill.contains(hit))) {
          bad.push(
            `"${(pill.textContent ?? "").trim().slice(0, 24)}" is covered by ${
              hit ? (hit.textContent ?? hit.tagName).trim().slice(0, 24) : "nothing"
            }`
          );
        }
      }
      return bad;
    });

    expect(wrong, wrong.join("; ")).toEqual([]);
  });
});
