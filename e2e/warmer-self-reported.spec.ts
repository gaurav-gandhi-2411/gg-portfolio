import { expect, test } from "@playwright/test";

/**
 * Warmer's source repo (mindmeld) is private. Only claims whose SOLE source is that repo say
 * "self-reported (private repo)"; claims also published in the public mindmeld-payloads repo or the
 * public Hugging Face cards must NOT carry it (it would understate them). Mirrors
 * scripts/self-reported.test.mjs (content) at the rendered level.
 */
const LABEL = "self-reported (private repo)";

test.describe("Warmer self-reported labels", () => {
  test("exactly the four private-only claims carry the label", async ({ page }) => {
    await page.goto("/work/warmer");
    await expect(page.getByText(LABEL, { exact: false })).toHaveCount(4);
  });

  test("the label sits inside the claim it qualifies", async ({ page }) => {
    await page.goto("/work/warmer");
    for (const name of ["Test suite", "Web perf (tracked budget)"]) {
      const row = page.locator("dt", { hasText: name });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(LABEL);
    }
    for (const title of [
      "Compile Dart to WebAssembly, decided by measurement",
      "When fine-tuning failed twice, change the method, not the data",
    ]) {
      const item = page.locator("li.case-block", { hasText: title });
      await expect(item).toHaveCount(1);
      await expect(item).toContainText(LABEL);
    }
  });

  test("public-backed claims are not labelled", async ({ page }) => {
    await page.goto("/work/warmer");
    for (const name of [
      "Hinglish semantic accuracy after the fine-tune (Spearman vs. human judgments)",
      "The same metric before the fine-tune",
      "Cluster separation, base vs fine-tuned (mean silhouette, raw embeddings)",
      "Cross-language consistency (translation pairs landing in the right band)",
      "Public Hinglish relatedness benchmark vs. 7 off-the-shelf alternatives",
    ]) {
      const row = page.locator("dt", { hasText: name });
      await expect(row).toHaveCount(1);
      await expect(row).not.toContainText(LABEL);
    }
  });

  // The 4.5:1 ratio itself is computed from the tokens in scripts/self-reported.test.mjs. Here we
  // only pin that the rendered text colour is the solid token: a `/80` alpha (4.23:1 in light mode)
  // computes to a colour string with an alpha channel ("... / 0.8").
  test("the label's text colour has no alpha channel", async ({ page }) => {
    await page.goto("/work/warmer");
    const tag = page.getByText(LABEL, { exact: false }).first();
    const color = await tag.evaluate((el) => getComputedStyle(el).color);
    expect(color).not.toContain("/");
  });
});
