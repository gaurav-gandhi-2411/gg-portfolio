import { expect, test } from "@playwright/test";

/**
 * F13: the "N live" stat drifted from the number of cards actually showing
 * a "Live ↗" link — liveProductCount() counted `liveUrl OR pypi`, but
 * components/project-card.tsx only renders "Live ↗" for a set `liveUrl`.
 * Once a second and third pypi-only package shipped (tracegauge,
 * adk-tracegauge) the site said "12 live" against 9 real links.
 *
 * The assertion: the displayed "N live" count on /projects equals the
 * number of rendered project cards that show a "Live ↗" link. /projects is
 * the uncapped view (home teases to 4 per filter), so it's the one place
 * every card is on the page at once and this is checkable directly against
 * the DOM rather than re-deriving the expected number from content data.
 */
test("displayed live count equals the number of cards with a Live link", async ({ page }) => {
  await page.goto("/projects");

  const caption = await page.getByText(/\d+ projects · \d+ live/).textContent();
  const displayedLiveCount = Number(caption?.match(/(\d+)\s*live/)?.[1]);
  expect(displayedLiveCount, "caption must match the expected format").not.toBeNaN();

  const liveLinkCount = await page
    .locator(".project-grid article")
    .evaluateAll(
      (cards) =>
        cards.filter((card) =>
          [...card.querySelectorAll("a")].some((a) => a.textContent?.trim() === "Live ↗")
        ).length
    );

  expect(displayedLiveCount).toBe(liveLinkCount);
});
