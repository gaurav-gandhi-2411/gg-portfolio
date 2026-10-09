import { expect, test, type Page } from "@playwright/test";

/**
 * The header must never present items that overlap or run together.
 *
 * At 375/390px the six links once rendered as "AboutExperienceProjects..."
 * (padding and gap zeroed to fit one row) while every existing check passed:
 * each link was on screen, 44px tall and hit-testable. So this measures what a
 * reader sees, the item boxes and the glyph rects, closed and (where the
 * header collapses) open. Touching boxes share an edge rather than intersect,
 * so an overlap-only check would pass the broken layout; neighbours on a row
 * need real clearance. Desktop project only: widths are set explicitly.
 */

const WIDTHS = [375, 390, 412, 768, 1440] as const;
/** Menu pattern below this; inline row at and above. Mirrors hero.css. */
const COLLAPSE_BELOW_PX = 768;
/** Neighbouring words on one row need at least this much air between glyphs. */
const MIN_TEXT_GAP_PX = 8;

interface Rect {
  label: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Bounding box and text-glyph rects of every visible item in the pill. */
async function measureItems(page: Page): Promise<{ boxes: Rect[]; texts: Rect[]; vw: number }> {
  return page.evaluate(() => {
    const pill = document.querySelector(".site-nav-pill")!;
    const items = [...pill.querySelectorAll<HTMLElement>("a[href], button")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const boxes: Rect[] = [];
    const texts: Rect[] = [];
    for (const el of items) {
      const label = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30);
      const b = el.getBoundingClientRect();
      boxes.push({ label, left: b.left, top: b.top, right: b.right, bottom: b.bottom });
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) {
          if (r.width > 0 && r.height > 0) {
            texts.push({ label, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
          }
        }
      }
    }
    return { boxes, texts, vw: window.innerWidth };
  });
}

function intersects(a: Rect, b: Rect, tolerance = 0.5): boolean {
  return (
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > tolerance &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > tolerance
  );
}

/** Horizontal clearance between two rects that share a row (negative if overlapping). */
function rowGap(a: Rect, b: Rect): number | null {
  const sharesRow = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
  if (!sharesRow) return null;
  return a.left < b.left ? b.left - a.right : a.left - b.right;
}

function assertClean(m: { boxes: Rect[]; texts: Rect[]; vw: number }, where: string): void {
  for (let i = 0; i < m.boxes.length; i++) {
    const a = m.boxes[i];
    expect(a.left, `${where}: "${a.label}" starts off-screen`).toBeGreaterThanOrEqual(0);
    expect(a.right, `${where}: "${a.label}" runs past the viewport`).toBeLessThanOrEqual(m.vw);
    for (let j = i + 1; j < m.boxes.length; j++) {
      const b = m.boxes[j];
      expect(intersects(a, b), `${where}: boxes of "${a.label}" and "${b.label}" overlap`).toBe(false);
    }
  }
  for (let i = 0; i < m.texts.length; i++) {
    for (let j = i + 1; j < m.texts.length; j++) {
      const a = m.texts[i];
      const b = m.texts[j];
      if (a.label === b.label) continue; // wrapped lines of one item
      expect(intersects(a, b, 0), `${where}: text of "${a.label}" and "${b.label}" intersects`).toBe(
        false
      );
      const gap = rowGap(a, b);
      if (gap !== null) {
        expect(
          gap,
          `${where}: "${a.label}" and "${b.label}" are ${gap.toFixed(1)}px apart on one row, ` +
            `they read as one run-on word below ${MIN_TEXT_GAP_PX}px`
        ).toBeGreaterThanOrEqual(MIN_TEXT_GAP_PX);
      }
    }
  }
}

test.describe("header layout never overlaps or runs items together", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "explicit widths are set below");
  });

  for (const width of WIDTHS) {
    test(`${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await page.waitForTimeout(600);

      // Geometry first, so a run-on row fails on what the reader sees rather
      // than on which pattern was chosen.
      assertClean(await measureItems(page), `${width}px closed`);

      const collapsed = width < COLLAPSE_BELOW_PX;
      const toggle = page.locator(".site-nav-toggle");
      expect(
        await toggle.isVisible(),
        collapsed ? "narrow widths use the menu button" : "wide widths keep the inline row"
      ).toBe(collapsed);

      if (collapsed) {
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        const open = await measureItems(page);
        // Brand + button + the six links.
        expect(open.boxes.length, "open menu shows all six links").toBe(8);
        assertClean(open, `${width}px open`);
      } else {
        expect((await measureItems(page)).boxes.length, "brand + six links").toBe(7);
      }
    });
  }
});

test.describe("without JavaScript the six links are visible, not behind an inert button", () => {
  test.use({ javaScriptEnabled: false });

  for (const width of [375, 390] as const) {
    test(`${width}px`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "explicit widths are set below");
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");

      const links = page.getByRole("navigation", { name: "Site" }).getByRole("link");
      await expect(links.filter({ hasText: /^(About|Experience|Projects|Open source|Research|Contact)$/ })).toHaveCount(6);
      await expect(page.locator(".site-nav-toggle")).toBeHidden();
      for (const link of await links.all()) await expect(link).toBeVisible();
      assertClean(await measureItems(page), `${width}px no-JS`);
    });
  }
});
