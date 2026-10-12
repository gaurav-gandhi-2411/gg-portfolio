import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { caseStudies } from "../content/case-studies";

/**
 * Intent (written before the component exists): each case-study page opens
 * with a compact strip of that study's own headline results. Every number in
 * the strip is a number the Results section below already carries, with its
 * provenance disclosure, and nothing in the strip is a second copy of the
 * data — so the strip's text must equal the source content value, character
 * for character, and removing the strip must not remove any content.
 *
 * Eligibility, stated here from the intent rather than read from the
 * implementation: the first (up to) three results rows that are a short
 * numeral rather than a sentence (not format "prose", value contains a digit,
 * value <= 30 chars, not opted out with `headline: false`). A
 * page with fewer than two such rows gets no strip rather than a lonely one.
 */
const MAX_ITEMS = 3;
const MAX_VALUE_LENGTH = 30;

function expectedRows(slug: string) {
  const eligible = (caseStudies[slug].results ?? []).filter(
    (r) =>
      r.format !== "prose" &&
      r.headline !== false &&
      /\d/.test(r.value) &&
      r.value.length <= MAX_VALUE_LENGTH
  );
  return eligible.length >= 2 ? eligible.slice(0, MAX_ITEMS) : [];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, (ch) => "\\" + ch);
}

const slugs = Object.keys(caseStudies);

test.describe("Case-study proof strip", () => {
  test("fixture sanity: most studies qualify, some do not", () => {
    const withStrip = slugs.filter((s) => expectedRows(s).length > 0);
    expect(withStrip.length).toBeGreaterThanOrEqual(10);
    expect(withStrip.length).toBeLessThan(slugs.length);
  });

  for (const slug of slugs) {
    test(`${slug}: strip numbers equal the source results rows, each with provenance`, async ({
      page,
    }) => {
      await page.goto(`/work/${slug}`);
      const rows = expectedRows(slug);
      const strip = page.locator("[data-proof-strip]");

      if (rows.length === 0) {
        await expect(strip).toHaveCount(0);
        return;
      }

      await expect(strip).toHaveCount(1);
      await expect(strip).toHaveAttribute("aria-label", "Headline results");
      const items = strip.locator("[data-proof-item]");
      await expect(items).toHaveCount(rows.length);

      for (let i = 0; i < rows.length; i++) {
        const item = items.nth(i);
        // Value: the exact string the results row holds (one source of truth).
        await expect(item.locator("[data-proof-value]")).toHaveText(
          new RegExp("^" + escapeRegExp(rows[i].value) + "(, show source for .*)?$")
        );
        await expect(item.locator("[data-proof-label]")).toContainText(rows[i].label);
        // Provenance: a real disclosure trigger, named for the metric.
        const trigger = item.getByRole("button", { name: /show source for/ });
        await expect(trigger).toHaveCount(1);
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
      }

      // The strip sits above the first content section, and the Results
      // section still carries the same rows (nothing removed).
      const stripBox = await strip.boundingBox();
      const firstHeading = await page.locator("[data-case-heading]").first().boundingBox();
      expect(stripBox!.y).toBeLessThan(firstHeading!.y);
      const resultsRow = page.locator("[data-case-article] dl .case-chip");
      await expect(resultsRow).toHaveCount(caseStudies[slug].results!.length);
    });
  }

  test("opening a strip item reveals its structured source, keyboard-operable", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");
    const trigger = page
      .locator("[data-proof-strip]")
      .getByRole("button", { name: /show source for .*Component classifier top-3 accuracy \(vscode\)/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panel = page.getByRole("group", { name: /Source for .*Component classifier top-3 accuracy \(vscode\)/ }).first();
    await expect(panel).toContainText("Verified source");
    await expect(panel.getByRole("link").first()).toHaveAttribute(
      "href",
      /github\.com\/gaurav-gandhi-2411\/triage-iq\/blob\//
    );
  });

  test("warmer's pre-fine-tune baseline is opted out of the strip but still in Results", async ({
    page,
  }) => {
    await page.goto("/work/warmer");
    await expect(page.locator("[data-proof-strip]")).toHaveCount(1);
    await expect(page.locator("[data-proof-strip]")).not.toContainText("−0.003");
    await expect(page.locator("[data-case-article] dl")).toContainText("−0.003");
  });

  test("text-only values never appear in a strip", async ({ page }) => {
    await page.goto("/work/tracegauge");
    await expect(page.locator("[data-proof-strip]")).toHaveCount(0);
    await page.goto("/work/adk-tracegauge");
    await expect(page.locator("[data-proof-strip]")).not.toContainText("PyPI");
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`axe: no serious/critical violations in the strip, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      for (const slug of ["triageiq", "warmer", "shelfsense"]) {
        await page.goto(`/work/${slug}`);
        // Scope must match, or a clean result proves nothing.
        await expect(page.locator("[data-proof-strip]")).toHaveCount(1);
        const results = await new AxeBuilder({ page }).include("[data-proof-strip]").analyze();
        const bad = results.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical"
        );
        expect(bad.map((v) => v.id)).toEqual([]);
      }
    });

    test(`strip text contrast is at least 4.5:1, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto("/work/triageiq");
      const ratios = await page.evaluate(() => {
        // Resolve any CSS colour (oklab etc.) to sRGB through a canvas pixel.
        const rgba = (c: string) => {
          const cv = document.createElement("canvas");
          cv.width = cv.height = 1;
          const ctx = cv.getContext("2d")!;
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = c;
          ctx.fillRect(0, 0, 1, 1);
          return Array.from(ctx.getImageData(0, 0, 1, 1).data);
        };
        const lum = ([r, g, b]: number[]) => {
          const f = (v: number) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const solidBg = (start: Element | null): number[] => {
          for (let el = start; el; el = el.parentElement) {
            const px = rgba(getComputedStyle(el).backgroundColor);
            if (px[3] === 255) return px;
          }
          return rgba(getComputedStyle(document.body).backgroundColor);
        };
        return [...document.querySelectorAll("[data-proof-value], [data-proof-label]")].map((el) => {
          const a = lum(rgba(getComputedStyle(el).color));
          const b = lum(solidBg(el));
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
      });
      expect(ratios.length).toBe(6);
      for (const r of ratios) expect(r).toBeGreaterThanOrEqual(4.5);
    });
  }

  const overflowOf = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  for (const width of [320, 375, 768, 1440]) {
    test(`no horizontal overflow at ${width}px, popover closed and open`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const slug of ["triageiq", "warmer", "shelfsense"]) {
        await page.goto(`/work/${slug}`);
        const trigger = page.locator("[data-proof-item]").last().getByRole("button");
        expect(await overflowOf(page)).toBe(0);
        // The last item's popover is the one most likely to overrun the right edge.
        await trigger.click();
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        expect(await overflowOf(page)).toBe(0);
        const box = await page.locator("[data-proof-item]").last().getByRole("group").boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(-0.5);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 0.5);
      }
    });
  }

  test("phone strip is compact and clips no text (390px)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/work/triageiq");
    const box = await page.locator("[data-proof-strip]").boundingBox();
    expect(box!.height).toBeLessThan(150);
    const clipped = await page.evaluate(
      () =>
        [...document.querySelectorAll("[data-proof-value], [data-proof-label]")].filter(
          (el) => el.scrollWidth > el.clientWidth + 1
        ).length
    );
    expect(clipped).toBe(0);
  });
});
