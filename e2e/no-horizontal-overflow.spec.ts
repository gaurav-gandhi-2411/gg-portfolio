import { expect, test } from "@playwright/test";
import { caseStudySlugs } from "./fixtures/case-study-slugs";
import { categoryIds } from "./fixtures/category-ids";

/**
 * refresh-2026-09 direction review — the nav overflows horizontally at
 * 375px on both exploratory directions (~60px reported). Both directions
 * independently added an "Open source" fifth nav link on top of
 * About/Experience/Projects/Contact, the same shape as the overflow fixed
 * upstream on feat/open-source-section (see `git log --grep "fit five nav"`)
 * — but neither direction branch carries that fix, and each direction may
 * have reworked the hero/nav CSS on its own terms, so this spec is written
 * against every real route the site has rather than assumed fixed by that
 * prior art.
 *
 * "Written before the fix" per CLAUDE.md's "write the assertion before you
 * read the implementation": this file exists to state what should be true
 * (no page's document is ever wider than its own viewport, and every nav
 * link is fully on-screen and tappable at the narrowest supported width)
 * before diagnosing which element causes the violation.
 *
 * Route inventory, derived from the real registries rather than hardcoded
 * lists that go stale (same convention as e2e/fixtures/*.ts):
 *   - static pages that exist in app/ and are indexed/linked from the nav
 *     or a real page (/, /projects, /open-source, /ask)
 *   - every /projects/[category] route (content/types.ts CATEGORIES)
 *   - every /work/[slug] case study (content/case-studies/index.ts)
 *   - a definitely-missing route, to cover the not-found page (it renders
 *     through the same root layout and carries the same nav)
 *
 * /warmup/[service] is deliberately excluded: those are noindex bridge
 * pages that make a real outbound call to wake a Cloud Run service and then
 * self-navigate to an external origin (`window.location.href =
 * config.destinationUrl`) — not a page a visitor lands on and reads, and
 * exercising it here would mean a live network call with a real, if small,
 * cost on every e2e run.
 */

const STATIC_ROUTES = ["/", "/projects", "/open-source", "/ask"];
const CATEGORY_ROUTES = categoryIds.map((id) => `/projects/${id}`);
const CASE_STUDY_ROUTES = caseStudySlugs.map((slug) => `/work/${slug}`);
const NOT_FOUND_ROUTE = "/no-horizontal-overflow-spec-does-not-exist";

const ALL_ROUTES = [...STATIC_ROUTES, ...CATEGORY_ROUTES, ...CASE_STUDY_ROUTES, NOT_FOUND_ROUTE];

const WIDTHS = [375, 768, 1440] as const;
const HEIGHT = 900;

for (const width of WIDTHS) {
  test.describe(`document is never wider than the viewport at ${width}px`, () => {
    test.use({ viewport: { width, height: HEIGHT } });

    for (const path of ALL_ROUTES) {
      test(`${path}`, async ({ page }) => {
        await page.goto(path);
        const measured = await page.evaluate(() => ({
          documentScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(
          measured.documentScrollWidth,
          `document.documentElement.scrollWidth (${measured.documentScrollWidth}) exceeds ` +
            `window.innerWidth (${measured.innerWidth}) on ${path} at ${width}px`
        ).toBeLessThanOrEqual(measured.innerWidth);
        expect(
          measured.bodyScrollWidth,
          `document.body.scrollWidth (${measured.bodyScrollWidth}) exceeds ` +
            `window.innerWidth (${measured.innerWidth}) on ${path} at ${width}px`
        ).toBeLessThanOrEqual(measured.innerWidth);
      });
    }
  });
}

test.describe("primary nav links stay fully on-screen and tappable at 375px", () => {
  test.use({ viewport: { width: 375, height: HEIGHT } });

  for (const path of ALL_ROUTES) {
    test(`${path}`, async ({ page }) => {
      await page.goto(path);

      const result = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Site"]');
        if (!nav) return { present: false, failures: [] as string[] };

        // .site-nav-link only — not .site-nav-skip (a WCAG 2.4.1 skip link,
        // intentionally translateY(-200%) off-screen until :focus-visible;
        // failing to reach it while unfocused is correct, not a bug) and not
        // .site-nav-brand (the monogram/wordmark, not a nav item this spec
        // is about).
        const links = [...nav.querySelectorAll("a.site-nav-link")];
        const failures: string[] = [];

        for (const link of links) {
          const box = link.getBoundingClientRect();
          const label = (link.textContent || link.getAttribute("aria-label") || link.tagName)
            .trim()
            .slice(0, 40);

          if (box.width === 0 || box.height === 0) continue; // not actually visible

          if (box.left < 0 || box.right > window.innerWidth) {
            failures.push(
              `"${label}" box [${box.left.toFixed(1)}, ${box.right.toFixed(1)}] is outside ` +
                `[0, ${window.innerWidth}]`
            );
            continue;
          }

          const cx = box.left + box.width / 2;
          const cy = box.top + box.height / 2;
          const hit = document.elementFromPoint(cx, cy);
          const reachable = Boolean(hit) && (hit === link || link.contains(hit) || hit!.contains(link));
          if (!reachable) {
            failures.push(`"${label}" is not hit-testable at its own centre (${cx.toFixed(1)}, ${cy.toFixed(1)})`);
          }
        }

        return { present: true, failures };
      });

      expect(result.present, `${path} renders the Site nav`).toBe(true);
      expect(result.failures, result.failures.join("; ")).toEqual([]);
    });
  }
});
