import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * The AetherArt HF download counts are generated (scripts/refresh-hf-downloads.mjs) into
 * content/generated/hf-downloads.json. The page must show exactly that snapshot, labelled as a
 * rolling 30-day figure with its fetch date, so a committed-snapshot fallback is never presented
 * as a fresh count.
 */
const snapshot = JSON.parse(
  readFileSync(join(process.cwd(), "content", "generated", "hf-downloads.json"), "utf8")
) as { fetchedAt: string; models: { id: string; downloads: number }[] };

test("AetherArt HF downloads row renders the committed snapshot with its as-of date", async ({
  page,
}) => {
  await page.goto("/work/aetherart");
  const row = page.locator("dt", { hasText: "HF LoRA adapters, 3 live" });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("last 30 days");
  await expect(row).toContainText(`as of ${snapshot.fetchedAt}`);
  const counts = snapshot.models.map((m) => m.downloads).join(" · ");
  await expect(page.getByText(counts, { exact: true })).toBeVisible();
  // The stale hand-typed figure must be gone.
  await expect(page.getByText("124 · 14 · 0", { exact: true })).toHaveCount(0);
});
