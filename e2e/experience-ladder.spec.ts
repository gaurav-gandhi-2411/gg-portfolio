import { expect, test } from "@playwright/test";

/**
 * The role ladder (round 3, GG: "The Experience section should read as a
 * journey"). Assertions state what the rail is supposed to do before
 * touching its implementation:
 *
 * - A company with more than one role gets one dot per role and a
 *   connecting line, so the climb reads as a path rather than a list.
 * - The current role's dot is visibly larger than a past role's — "you are
 *   here" has to be legible from size, not only from an aria attribute a
 *   sighted visitor never reads.
 * - A company with exactly one role has nothing to climb, so it renders no
 *   rail at all rather than a line with a single point on it.
 * - The rail is decorative: aria-hidden, and the heading outline (one h4
 *   per role) is unchanged by its presence.
 */
test.describe("experience role ladder", () => {
  test("a multi-role company gets a dot per role, the current one larger", async ({ page }) => {
    await page.goto("/#experience");

    const uberCard = page.locator("article", { hasText: "Uber Technologies" });
    const dots = uberCard.locator(".experience-ladder-dot");
    await expect(dots).toHaveCount(3);

    const currentDot = uberCard.locator('[data-current="true"] .experience-ladder-dot');
    await expect(currentDot).toHaveCount(1);

    const [currentBox, pastBox] = await Promise.all([
      currentDot.boundingBox(),
      dots.nth(2).boundingBox(),
    ]);
    expect(currentBox, "current dot renders").not.toBeNull();
    expect(pastBox, "earliest-role dot renders").not.toBeNull();
    expect(currentBox!.width).toBeGreaterThan(pastBox!.width);
  });

  test("a single-role company renders no ladder", async ({ page }) => {
    await page.goto("/#experience");

    const fedexCard = page.locator("article", { hasText: "FedEx Express" });
    await expect(fedexCard.locator(".experience-ladder-dot")).toHaveCount(0);
    await expect(fedexCard.locator(".experience-ladder-line")).toHaveCount(0);

    const tcsCard = page.locator("article", { hasText: "Tata Consultancy" });
    await expect(tcsCard.locator(".experience-ladder-dot")).toHaveCount(0);
  });

  test("the rail is decorative and does not disturb the role heading outline", async ({
    page,
  }) => {
    await page.goto("/#experience");

    const uberCard = page.locator("article", { hasText: "Uber Technologies" });
    await expect(uberCard.locator(".experience-ladder-dot").first()).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(uberCard.locator(".experience-ladder-line")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    const roleHeadings = uberCard.getByRole("heading", { level: 4 });
    await expect(roleHeadings).toHaveCount(3);
    await expect(roleHeadings.first()).toContainText("Lead Data Scientist");
  });
});
