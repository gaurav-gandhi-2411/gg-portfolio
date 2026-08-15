import { expect, test } from "@playwright/test";

test.describe("TriageIQ illustrative classifier", () => {
  test("expand → classify a sample issue → real result bars appear", async ({ page }) => {
    await page.goto("/work/triageiq");

    // The button's own accessible name flips "Try" ↔ "Hide" when toggled —
    // match on the stable part so the locator still resolves post-click.
    const disclosureButton = page.getByRole("button", {
      name: /live illustrative classifier/,
    });
    await expect(disclosureButton).toHaveAttribute("aria-expanded", "false");
    await disclosureButton.click();
    await expect(disclosureButton).toHaveAttribute("aria-expanded", "true");

    const panel = page.locator("#triageiq-classify-panel");
    await expect(panel).toBeVisible();

    // Classify a real sample issue via its button (repo #number chips).
    const sampleButton = panel.locator("button[title]").first();
    await expect(sampleButton).toBeVisible();
    await sampleButton.click();

    // Both repo score bars render with a numeric score.
    await expect(panel.getByText("k8s", { exact: true })).toBeVisible();
    await expect(panel.getByText("vscode", { exact: true })).toBeVisible();
    // BL-2 renamed text-xs -> text-caption (components/triageiq-classify-toy.tsx)
    // as part of the modular type-scale codemod; the locator follows the rename.
    const scoreText = await panel
      .locator("span.font-mono.text-caption.text-foreground")
      .allTextContents();
    expect(scoreText.length).toBeGreaterThanOrEqual(2);
    for (const s of scoreText) expect(Number(s)).not.toBeNaN();

    // Collapsing works too.
    await disclosureButton.click();
    await expect(disclosureButton).toHaveAttribute("aria-expanded", "false");
  });

  test("typing a custom title and submitting also classifies", async ({ page }) => {
    await page.goto("/work/triageiq");
    await page.getByRole("button", { name: /live illustrative classifier/ }).click();
    const panel = page.locator("#triageiq-classify-panel");
    const input = panel.getByLabel("Bug title to classify");
    await input.fill("Pod scheduling fails under high memory pressure");
    await panel.getByRole("button", { name: "Classify" }).click();
    await expect(panel.getByText("k8s", { exact: true })).toBeVisible();
  });
});
