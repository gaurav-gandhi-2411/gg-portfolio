import { expect, test } from "@playwright/test";
import { forceWebGLCapability } from "./fixtures/force-webgl";

/**
 * Behaviour of the /work/warmer embedding viewer's two layers.
 *
 * The thing worth testing here is not "the canvas draws" (a screenshot proves
 * that better) — it is the GATING: which visitors get WebGL, which get the
 * static SVG, and that nobody gets neither. Each of these is a condition that
 * silently changes what ships, so each gets a test that would fail if the
 * condition stopped being honoured.
 */

test.describe("Warmer embedding viewer — WebGL layer", () => {
  test("mounts the GL canvas and swaps out the static pair", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await forceWebGLCapability(page);
    await page.goto("/work/warmer");
    // Scroll the SECTION, which is present in the server-rendered HTML. The
    // GL testid does not exist until that section intersects, so waiting on
    // it first would deadlock against the very observer that creates it.
    await page.getByRole("region", { name: "The fix, made visible" }).scrollIntoViewIfNeeded();
    await expect(page.getByTestId("warmer-embedding-gl").locator("canvas")).toBeVisible();

    // The static before/after figures are replaced, not stacked underneath.
    await expect(page.getByText("— base model (paraphrase-multilingual")).toHaveCount(0);
  });

  test("the toggle switches models and reports the change to assistive tech", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await forceWebGLCapability(page);
    await page.goto("/work/warmer");
    // Scroll the SECTION, which is present in the server-rendered HTML. The
    // GL testid does not exist until that section intersects, so waiting on
    // it first would deadlock against the very observer that creates it.
    await page.getByRole("region", { name: "The fix, made visible" }).scrollIntoViewIfNeeded();
    await expect(page.getByTestId("warmer-embedding-gl").locator("canvas")).toBeVisible();

    const base = page.getByRole("button", { name: "Base model" });
    const finetuned = page.getByRole("button", { name: "Fine-tuned" });

    // Fine-tuned is the default — the case study's point is the fine-tune.
    await expect(finetuned).toHaveAttribute("aria-pressed", "true");
    await expect(base).toHaveAttribute("aria-pressed", "false");

    await base.click();
    await expect(base).toHaveAttribute("aria-pressed", "true");
    await expect(finetuned).toHaveAttribute("aria-pressed", "false");

    // The live region is the non-visual equivalent of the field changing
    // shape, so what matters is that it names the model now on screen.
    // Matched loosely on purpose: an earlier version asserted one exact
    // sentence and broke the moment that sentence was corrected for accuracy,
    // which is a test coupled to copy rather than to behaviour.
    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion).toContainText(/Base model/);
    await finetuned.click();
    await expect(liveRegion).toContainText(/Fine-tuned/);
  });

  test("both toggle controls are reachable and operable by keyboard", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await forceWebGLCapability(page);
    await page.goto("/work/warmer");
    // Scroll the SECTION, which is present in the server-rendered HTML. The
    // GL testid does not exist until that section intersects, so waiting on
    // it first would deadlock against the very observer that creates it.
    await page.getByRole("region", { name: "The fix, made visible" }).scrollIntoViewIfNeeded();
    await expect(page.getByTestId("warmer-embedding-gl").locator("canvas")).toBeVisible();

    const base = page.getByRole("button", { name: "Base model" });
    await base.focus();
    await expect(base).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(base).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("Warmer embedding viewer — static fallback", () => {
  test("reduced-motion visitors keep the static before/after pair and get no canvas", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/work/warmer");
    await expect(page.getByText("— base model (paraphrase-multilingual")).toBeVisible();
    await expect(page.getByText("the same terms now cluster by meaning")).toBeVisible();
    // No GL context is created at all for these visitors — not created-then-idled.
    await expect(page.getByTestId("warmer-embedding-gl")).toHaveCount(0);
  });
});

test.describe("Warmer embedding viewer — low-end device gate", () => {
  /**
   * Exercises the heuristic itself rather than trusting it. The dev machine
   * this was written on reports 16 cores, so without spoofing the signal the
   * low-end branch is never taken locally — and CI reports <= 4 cores, so
   * there it is ALWAYS taken. Neither environment tests both directions on
   * its own.
   */
  test("a device reporting 2 cores gets the static pair and no GL context", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 2 });
    });
    await page.goto("/work/warmer");
    await page.getByRole("region", { name: "The fix, made visible" }).scrollIntoViewIfNeeded();

    await expect(page.getByText("— base model (paraphrase-multilingual")).toBeVisible();
    await expect(page.getByTestId("warmer-embedding-gl")).toHaveCount(0);
  });

  /**
   * This is exactly the CI scenario — a runner reporting <= 4 cores with the
   * seam enabled — so it is what proves the WebGL tests above actually run
   * there rather than silently timing out, which is how they first failed.
   */
  test("the seam lets a 2-core device reach the GL layer (the CI case)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await forceWebGLCapability(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 2 });
    });
    await page.goto("/work/warmer");
    await page.getByRole("region", { name: "The fix, made visible" }).scrollIntoViewIfNeeded();
    await expect(page.getByTestId("warmer-embedding-gl").locator("canvas")).toBeVisible();
  });

  test("the test seam overrides the core count but never reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await forceWebGLCapability(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 2 });
    });
    await page.goto("/work/warmer");
    // Reduced motion still wins — otherwise the fallback tests above would be
    // testing nothing.
    await expect(page.getByTestId("warmer-embedding-gl")).toHaveCount(0);
  });
});

test.describe("Warmer embedding viewer — no JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still ships the full before/after comparison in the server-rendered HTML", async ({
    page,
  }) => {
    await page.goto("/work/warmer");
    await expect(page.getByText("— base model (paraphrase-multilingual")).toBeVisible();
    await expect(page.getByText("the same terms now cluster by meaning")).toBeVisible();
    // Both scatters are real SSR'd SVG content, not an empty shell.
    const circles = page.locator("section[aria-label='The fix, made visible'] circle");
    await expect(circles.first()).toBeAttached();
    expect(await circles.count()).toBeGreaterThan(400);
  });
});
