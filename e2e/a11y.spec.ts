import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { caseStudySlugs } from "./fixtures/case-study-slugs";
import { categoryIds } from "./fixtures/category-ids";

const ROUTES = [
  "/",
  "/projects",
  "/ask",
  ...categoryIds.map((id) => `/projects/${id}`),
  ...caseStudySlugs.map((slug) => `/work/${slug}`),
];

/**
 * components/reveal-group.tsx fades each section's children in via
 * Element.animate() the moment IntersectionObserver confirms they're in
 * view — deliberate, documented site behavior (wave 9's "axe race" note:
 * onload animation raced axe's contrast check on genuinely-compliant
 * settled-state colors). On /projects the card grid sits inside the
 * initial viewport, so this is the first route where a scan run
 * immediately after goto() can sample a mid-fade frame (measured: opacity
 * 0.21 at ~60ms, 1.0 by ~400ms) and flag a contrast "violation" that is a
 * paint-timing artifact, not a real defect — axe should assess the
 * settled page, same as every prior manual `npx axe-core/cli` run in this
 * repo's history implicitly did (those always had enough incidental delay
 * for animations to finish before the scan actually ran).
 */
async function waitForAnimationsToSettle(page: Page) {
  // Not document.getAnimations()-polling: the hero halo (28s linear
  // infinite) and the case-study reading-progress bar (a scroll()-timeline
  // animation, "running" for as long as it's attached — it has no natural
  // end) are deliberately continuous, so a "wait until nothing reports
  // running" poll never resolves on those routes. A fixed wait comfortably
  // past the worst-case entrance sequence (12 staggered cards: 12×55ms
  // stepMs + 450ms duration ≈ 1.11s) is the robust choice given the site
  // has animations by design that never finish.
  await page.waitForTimeout(1300);
}

for (const route of ROUTES) {
  test(`axe: zero violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    await waitForAnimationsToSettle(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

test("axe: zero violations on a filtered /projects view", async ({ page }) => {
  await page.goto("/projects");
  await waitForAnimationsToSettle(page);
  const filterGroup = page.getByRole("group", { name: "Filter projects by category" });
  await filterGroup.getByRole("button").nth(1).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
