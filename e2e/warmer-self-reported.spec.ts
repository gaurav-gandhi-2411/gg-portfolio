import { expect, test } from "@playwright/test";

/**
 * Warmer's source repo (mindmeld) is private, so some of its numbers cannot be checked by a
 * reader. Those claims say so on the page; claims backed by the public mindmeld-payloads repo or
 * the public Hugging Face model card must NOT carry the label (it would understate them).
 * Contract mirrors scripts/self-reported.test.mjs (content) at the rendered level.
 */
const LABEL = "self-reported (private repo)";

test.describe("Warmer self-reported labels", () => {
  test("exactly the six unverifiable claims carry the label", async ({ page }) => {
    await page.goto("/work/warmer");
    await expect(page.getByText(LABEL, { exact: false })).toHaveCount(6);
  });

  test("the label sits inside the claim it qualifies", async ({ page }) => {
    await page.goto("/work/warmer");

    // Results: label is in the same <dt> as the metric's own label text.
    for (const name of [
      "Test suite",
      "Web perf (tracked budget)",
      "Cross-language consistency (translation pairs landing in the right band)",
    ]) {
      const row = page.locator("dt", { hasText: name });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(LABEL);
    }

    // Decisions: label is inside the decision's own list item.
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
      "Public Hinglish relatedness benchmark vs. 7 off-the-shelf alternatives",
    ]) {
      const row = page.locator("dt", { hasText: name });
      await expect(row).toHaveCount(1);
      await expect(row).not.toContainText(LABEL);
    }
  });
});
