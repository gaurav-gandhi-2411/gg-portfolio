import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { caseStudySlugs } from "./fixtures/case-study-slugs";

/**
 * Wave 20 — regression coverage for the SEO/social metadata audit. Two real
 * bugs motivated this file, both silent (no build error, no visual symptom):
 *
 * 1. Every /work/[slug] page's og:title/og:description/twitter:title/
 *    twitter:description were the generic homepage identity, never the
 *    project's own. Cause: Next's metadata merging replaces the whole
 *    openGraph/twitter object per route rather than merging individual
 *    fields — generateMetadata only ever set title/description, so with no
 *    openGraph/twitter key present at all, the child route inherited the
 *    ROOT layout's whole object unchanged. Sharing any case-study link on
 *    LinkedIn/X/Slack previewed as "Gaurav Gandhi — Senior Applied AI
 *    Scientist" with the homepage blurb, never the project.
 * 2. 12 of 13 case-study meta descriptions (the raw `dek`) exceeded the
 *    ~155-char budget platforms truncate at (up to 269 chars).
 *
 * The fix for (1) — explicitly setting openGraph/twitter per route — has its
 * own failure mode: naming only title/description in that object silently
 * drops whatever else the root's object carried (twitter:card, og:site_name,
 * og:type), since it's a whole-object replace, not a merge. The
 * `twitterCard`/`ogSiteName`/`ogType`/`ogImageWidth`/`ogImageHeight`
 * assertions below exist specifically to catch that — the regression the fix
 * itself nearly introduced, not the one it was written for.
 */

const TITLE_MAX = 60;
const DESC_MAX = 155;
const TWITTER_TITLE_MAX = 70;

async function getMeta(page: Page, name: string): Promise<string | null> {
  return page.locator(`meta[property="${name}"], meta[name="${name}"]`).first().getAttribute("content");
}

test.describe("social metadata", () => {
  let homeTitle: string;
  let homeDescription: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/");
    homeTitle = await page.title();
    homeDescription = (await getMeta(page, "description")) ?? "";
    await page.close();
  });

  test("homepage metadata respects length budgets and the image/card contract", async ({ page }) => {
    await page.goto("/");
    const title = await page.title();
    const description = await getMeta(page, "description");
    const ogTitle = await getMeta(page, "og:title");
    const ogDescription = await getMeta(page, "og:description");
    const twitterTitle = await getMeta(page, "twitter:title");
    const twitterDescription = await getMeta(page, "twitter:description");

    expect(title.length, "title").toBeLessThanOrEqual(TITLE_MAX);
    expect(description?.length ?? Infinity, "description").toBeLessThanOrEqual(DESC_MAX);
    expect(ogTitle?.length ?? Infinity, "og:title").toBeLessThanOrEqual(TITLE_MAX);
    expect(ogDescription?.length ?? Infinity, "og:description").toBeLessThanOrEqual(DESC_MAX);
    expect(twitterTitle?.length ?? Infinity, "twitter:title").toBeLessThanOrEqual(TWITTER_TITLE_MAX);
    expect(twitterDescription?.length ?? Infinity, "twitter:description").toBeLessThanOrEqual(DESC_MAX);

    expect(await getMeta(page, "twitter:card")).toBe("summary_large_image");
    expect(await getMeta(page, "og:site_name")).toBe("Gaurav Gandhi");
    expect(await getMeta(page, "og:type")).toBe("website");
    expect(await getMeta(page, "og:image:width")).toBe("1200");
    expect(await getMeta(page, "og:image:height")).toBe("630");
  });

  for (const slug of caseStudySlugs) {
    test(`/work/${slug} has project-specific, budget-compliant social metadata`, async ({ page }) => {
      await page.goto(`/work/${slug}`);
      const title = await page.title();
      const description = await getMeta(page, "description");
      const ogTitle = await getMeta(page, "og:title");
      const ogDescription = await getMeta(page, "og:description");
      const twitterTitle = await getMeta(page, "twitter:title");
      const twitterDescription = await getMeta(page, "twitter:description");

      // Length budgets.
      expect(title.length, "title").toBeLessThanOrEqual(TITLE_MAX);
      expect(description?.length ?? Infinity, "description").toBeLessThanOrEqual(DESC_MAX);
      expect(ogTitle?.length ?? Infinity, "og:title").toBeLessThanOrEqual(TITLE_MAX);
      expect(ogDescription?.length ?? Infinity, "og:description").toBeLessThanOrEqual(DESC_MAX);
      expect(twitterTitle?.length ?? Infinity, "twitter:title").toBeLessThanOrEqual(TWITTER_TITLE_MAX);
      expect(twitterDescription?.length ?? Infinity, "twitter:description").toBeLessThanOrEqual(DESC_MAX);

      // Bug (1) regression guard: must not silently be the homepage's identity.
      expect(title, "title must not equal the homepage title").not.toBe(homeTitle);
      expect(description, "description must not equal the homepage description").not.toBe(
        homeDescription
      );
      expect(ogTitle, "og:title must not equal the homepage title").not.toBe(homeTitle);
      expect(ogDescription, "og:description must not equal the homepage description").not.toBe(
        homeDescription
      );

      // The regression the fix itself could have introduced: setting
      // openGraph/twitter at all, without re-declaring these, drops them.
      expect(await getMeta(page, "twitter:card"), "twitter:card").toBe("summary_large_image");
      expect(await getMeta(page, "og:site_name"), "og:site_name").toBe("Gaurav Gandhi");
      expect(await getMeta(page, "og:type"), "og:type").toBe("website");
      expect(await getMeta(page, "og:image:width"), "og:image:width").toBe("1200");
      expect(await getMeta(page, "og:image:height"), "og:image:height").toBe("630");
    });
  }
});
