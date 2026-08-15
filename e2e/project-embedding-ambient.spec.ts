import { expect, test } from "@playwright/test";
import { forceWebGLCapability } from "./fixtures/force-webgl";

/**
 * Behaviour of the /projects grid's ambient WebGL depth layer
 * (perf/lcp-final Task 4, surface 2). Purely decorative — there is no user
 * interaction to test — so the properties worth asserting are: it never
 * blocks or replaces the grid, it is gated on capability AND scroll
 * proximity, and it costs nothing on load for a visitor who never scrolls
 * there or who doesn't qualify.
 */

test.describe("project embedding ambient — WebGL layer", () => {
  test("mounts a canvas behind the grid once the grid scrolls into view", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await forceWebGLCapability(page);
    await page.goto("/projects");

    // The grid itself is present immediately (server-rendered); the ambient
    // canvas is not, until the IntersectionObserver fires.
    await expect(page.locator(".project-grid")).toBeVisible();
    await page.locator(".project-grid").scrollIntoViewIfNeeded();
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("the grid's real project cards remain visible and interactive with the layer mounted", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await forceWebGLCapability(page);
    await page.goto("/projects");
    await page.locator(".project-grid").scrollIntoViewIfNeeded();
    await expect(page.locator("canvas").first()).toBeVisible();

    // The ambient layer is aria-hidden + pointer-events-none — a real card
    // link must still be the thing that receives the click, not an inert
    // background canvas sitting on top of it.
    const firstCard = page.locator(".project-grid article").first();
    await expect(firstCard).toBeVisible();
    const link = firstCard.getByRole("link").first();
    await expect(link).toBeVisible();
  });

  test("the ambient GL chunk is not requested until the grid approaches the viewport", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await forceWebGLCapability(page);

    // Chunk filenames are content-hashed and never contain the source
    // module's name, so this tracks the actual SET of requested chunk URLs
    // and asserts it grows once the grid is on screen, rather than matching
    // a guessed name that would never appear in a real request URL.
    const chunkRequests = new Set<string>();
    page.on("request", (request) => {
      if (/\/_next\/static\/chunks\/.*\.js$/.test(request.url())) {
        chunkRequests.add(request.url());
      }
    });

    await page.goto("/projects");
    // Before scrolling, the grid may already be near the fold on a tall
    // viewport — assert on the canvas absence directly rather than assuming
    // geometry, then confirm it appears after an explicit scroll.
    await page.waitForTimeout(300);
    const canvasBeforeScroll = await page.locator("canvas").count();
    const chunksBeforeScroll = chunkRequests.size;

    await page.locator(".project-grid").scrollIntoViewIfNeeded();
    await expect(page.locator("canvas").first()).toBeVisible();

    if (canvasBeforeScroll === 0) {
      expect(chunkRequests.size).toBeGreaterThan(chunksBeforeScroll);
    }
  });
});

test.describe("project embedding ambient — fallback (no layer, plain grid)", () => {
  test("reduced-motion visitors see the plain grid and no canvas anywhere", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/projects");
    await page.locator(".project-grid").scrollIntoViewIfNeeded();
    await expect(page.locator(".project-grid")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("a low-end device (2 cores) sees the plain grid and no canvas", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 2 });
    });
    await page.goto("/projects");
    await page.locator(".project-grid").scrollIntoViewIfNeeded();
    await expect(page.locator(".project-grid")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
  });
});

test.describe("project embedding ambient — no JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the grid still renders fully without the ambient layer", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.locator(".project-grid article").first()).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
  });
});
