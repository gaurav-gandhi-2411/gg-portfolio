import { expect, test } from "@playwright/test";
import { forceWebGLCapability } from "./fixtures/force-webgl";

/**
 * Behaviour of the TriageIQ case study's "explore in 3D" toggle
 * (perf/lcp-final Task 4, surface 1). Same gating shape as the Warmer/hero
 * WebGL layers: what matters is which visitors get the offer, that the
 * static chart is never simply missing, and — unique to this surface — that
 * the GL chunk is only ever requested after an explicit click, never on load.
 */

test.describe("project embedding toggle — WebGL layer", () => {
  test("mounts the GL canvas on click and swaps out the static SVG", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await forceWebGLCapability(page);
    await page.goto("/work/triageiq");

    const toggle = page.getByRole("button", { name: "Explore in 3D" });
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toBeVisible();

    // Static SVG is present before the click.
    await expect(
      page.locator("svg[aria-label*='2D scatter showing this project']")
    ).toBeVisible();
    await expect(page.getByTestId("project-embedding-gl")).toHaveCount(0);

    await toggle.click();
    await expect(page.getByTestId("project-embedding-gl").locator("canvas")).toBeVisible();
    // The static SVG is replaced, not stacked underneath.
    await expect(page.locator("svg[aria-label*='2D scatter showing this project']")).toHaveCount(0);

    await expect(page.getByRole("button", { name: "Back to 2D view" })).toBeVisible();
  });

  test("toggling back to 2D unmounts the canvas and restores the static SVG", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await forceWebGLCapability(page);
    await page.goto("/work/triageiq");

    const toggle = page.getByRole("button", { name: "Explore in 3D" });
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await expect(page.getByTestId("project-embedding-gl").locator("canvas")).toBeVisible();

    await page.getByRole("button", { name: "Back to 2D view" }).click();
    await expect(page.getByTestId("project-embedding-gl")).toHaveCount(0);
    await expect(
      page.locator("svg[aria-label*='2D scatter showing this project']")
    ).toBeVisible();
  });

  test("the case study's own project is pre-labeled once the field settles", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await forceWebGLCapability(page);
    await page.goto("/work/triageiq");

    const toggle = page.getByRole("button", { name: "Explore in 3D" });
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    const canvas = page.getByTestId("project-embedding-gl").locator("canvas");
    await expect(canvas).toBeVisible();

    // TriageIQ is pre-labeled on mount (this case study's own point).
    await expect(page.getByText("triageiq", { exact: true })).toBeVisible();
  });

  test("the toggle button is reachable and operable by keyboard", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await forceWebGLCapability(page);
    await page.goto("/work/triageiq");

    const toggle = page.getByRole("button", { name: "Explore in 3D" });
    await toggle.scrollIntoViewIfNeeded();
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("project-embedding-gl").locator("canvas")).toBeVisible();
  });

  test("the GL chunk is not requested until the toggle is clicked", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await forceWebGLCapability(page);

    // Chunk filenames are content-hashed (e.g. "3ayak_mr1zmt9.js") and never
    // contain the source module's name, so matching request URLs against a
    // guessed name would silently always report zero — tracking the actual
    // SET of requested chunk URLs and asserting it grows after the click is
    // what genuinely proves the GL chunk wasn't fetched until interaction.
    const chunkRequests = new Set<string>();
    page.on("request", (request) => {
      if (/\/_next\/static\/chunks\/.*\.js$/.test(request.url())) {
        chunkRequests.add(request.url());
      }
    });

    await page.goto("/work/triageiq");
    const toggle = page.getByRole("button", { name: "Explore in 3D" });
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toBeVisible();
    // Give any load-time prefetch a moment to fire before taking the baseline.
    await page.waitForTimeout(300);
    const chunksBeforeClick = chunkRequests.size;

    await toggle.click();
    await expect(page.getByTestId("project-embedding-gl").locator("canvas")).toBeVisible();
    expect(chunkRequests.size).toBeGreaterThan(chunksBeforeClick);
  });
});

test.describe("project embedding toggle — static fallback", () => {
  test("reduced-motion visitors get the static SVG and no toggle button", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/work/triageiq");
    await expect(
      page.locator("svg[aria-label*='2D scatter showing this project']")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Explore in 3D" })).toHaveCount(0);
    await expect(page.getByTestId("project-embedding-gl")).toHaveCount(0);
  });

  test("a low-end device (2 cores) gets the static SVG and no toggle button", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 2 });
    });
    await page.goto("/work/triageiq");
    await expect(
      page.locator("svg[aria-label*='2D scatter showing this project']")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Explore in 3D" })).toHaveCount(0);
  });
});

test.describe("project embedding toggle — no JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still renders the static SVG scatter from server-rendered HTML", async ({ page }) => {
    await page.goto("/work/triageiq");
    const svg = page.locator("svg[aria-label*='2D scatter showing this project']");
    await expect(svg).toBeVisible();
    expect(await svg.locator("circle").count()).toBe(13);
  });
});
