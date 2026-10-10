import { expect, test, type Page } from "@playwright/test";

/**
 * The metric slot is one place on every project card.
 *
 * Design review follow-up: the proof number sat in a right-hand rail on some
 * cards, below the links on others, as a text line on a third group, and
 * nowhere on DealHunter, and the status pill wrapped below the title on some
 * cards and not others -- so nothing in a grid row lined up. This asserts the
 * property on the rendered page rather than any one class name: within a grid
 * row the metric slot starts at the same offset from the card top and has the
 * same height (an empty slot counts, so a project with no published metric
 * does not leave a hole), and on every card the pill is the same size at the
 * same right-aligned spot.
 *
 * Below lg the grid is one column, so there is no row to align with; there
 * the slot must still sit at the same distance above the card bottom (it is
 * directly above the links, which are pinned there).
 */

const TOLERANCE_PX = 1;

interface CardBox {
  slug: string;
  top: number;
  height: number;
  metricTop: number | null;
  metricHeight: number | null;
  metricBottomGap: number | null;
  pillTop: number | null;
  pillRight: number | null;
  pillHeight: number | null;
}

async function measureCards(page: Page): Promise<CardBox[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".project-card")]
      .filter((c) => getComputedStyle(c).display !== "none")
      .map((c) => {
        const card = c.getBoundingClientRect();
        const metric = c.querySelector("[data-card-metric]")?.getBoundingClientRect() ?? null;
        const pill = c.querySelector("[data-card-status]")?.getBoundingClientRect() ?? null;
        return {
          slug: c.dataset.slug ?? "?",
          top: card.top + window.scrollY,
          height: card.height,
          metricTop: metric ? metric.top - card.top : null,
          metricHeight: metric ? metric.height : null,
          metricBottomGap: metric ? card.bottom - metric.bottom : null,
          pillTop: pill ? pill.top - card.top : null,
          pillRight: pill ? card.right - pill.right : null,
          pillHeight: pill ? pill.height : null,
        };
      }),
  );
}

function spread(values: (number | null)[]): number {
  const nums = values.filter((v): v is number => v !== null);
  return nums.length === values.length && nums.length > 0
    ? Math.max(...nums) - Math.min(...nums)
    : NaN;
}

// Explicit viewports on the desktop project only, so 375 and 1440 are each
// asserted once rather than once per Playwright project.
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 375, height: 800 },
] as const;

for (const viewport of VIEWPORTS)
  for (const path of ["/projects", "/"]) {
    test.describe(`project card metric slot on ${path} at ${viewport.width}`, () => {
      test.use({ viewport });
      test.beforeEach(async ({ page }, info) => {
        test.skip(info.project.name !== "desktop", "viewport is set explicitly; run once");
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(path, { waitUntil: "networkidle" });
        await expect(page.locator(".project-card").first()).toBeVisible();
      });

      test("every card has a metric slot and an identical status pill", async ({ page }) => {
        const cards = await measureCards(page);
        expect(cards.length).toBeGreaterThan(1);
        for (const c of cards) {
          expect(c.metricTop, `${c.slug} has no [data-card-metric] slot`).not.toBeNull();
          expect(c.pillTop, `${c.slug} has no [data-card-status] pill`).not.toBeNull();
        }
        // Same spot, same size: the pill used to be 34px tall and wrap below the
        // title on cards with a long name.
        expect(spread(cards.map((c) => c.pillTop)), "pill top offset").toBeLessThanOrEqual(
          TOLERANCE_PX,
        );
        expect(spread(cards.map((c) => c.pillRight)), "pill right offset").toBeLessThanOrEqual(
          TOLERANCE_PX,
        );
        expect(spread(cards.map((c) => c.pillHeight)), "pill height").toBeLessThanOrEqual(
          TOLERANCE_PX,
        );
        expect(
          Math.max(...cards.map((c) => c.pillHeight ?? 0)),
          "pill is compact",
        ).toBeLessThanOrEqual(24);
      });

      test("the metric slot sits the same distance above the card bottom", async ({ page }) => {
        const cards = await measureCards(page);
        expect(
          spread(cards.map((c) => c.metricBottomGap)),
          "metric bottom gap",
        ).toBeLessThanOrEqual(TOLERANCE_PX);
      });

      test("cards in one grid row share a metric offset, height and card height", async ({
        page,
      }) => {
        const cards = await measureCards(page);
        const rows: CardBox[][] = [];
        for (const c of cards) {
          const row = rows.find((r) => Math.abs(r[0].top - c.top) < 12);
          if (row) row.push(c);
          else rows.push([c]);
        }
        const multi = rows.filter((r) => r.length > 1);
        // One column (phones, tablets) has no rows to compare; the desktop
        // project covers the real assertion.
        test.skip(multi.length === 0, `single-column layout at ${viewport.width}px`);
        for (const row of multi) {
          const names = row.map((c) => c.slug).join(" + ");
          expect(
            spread(row.map((c) => c.metricTop)),
            `metric top offset in row ${names}`,
          ).toBeLessThanOrEqual(TOLERANCE_PX);
          expect(
            spread(row.map((c) => c.metricHeight)),
            `metric height in row ${names}`,
          ).toBeLessThanOrEqual(TOLERANCE_PX);
          expect(
            spread(row.map((c) => c.height)),
            `card height in row ${names}`,
          ).toBeLessThanOrEqual(TOLERANCE_PX);
        }
      });
    });
  }
