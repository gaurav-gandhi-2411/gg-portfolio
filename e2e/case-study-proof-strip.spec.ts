import { expect, test } from "@playwright/test";
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
 * numeral rather than a sentence (not format "prose", value <= 30 chars). A
 * page with fewer than two such rows gets no strip rather than a lonely one.
 */
const MAX_ITEMS = 3;
const MAX_VALUE_LENGTH = 30;

function expectedRows(slug: string) {
  const eligible = (caseStudies[slug].results ?? []).filter(
    (r) => r.format !== "prose" && r.value.length <= MAX_VALUE_LENGTH
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

  test("a strip adds no horizontal overflow", async ({ page }) => {
    for (const slug of ["triageiq", "style-maitri", "warmer"]) {
      await page.goto(`/work/${slug}`);
      await expect(page.locator("[data-proof-strip]")).toHaveCount(1);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBe(0);
    }
  });
});
