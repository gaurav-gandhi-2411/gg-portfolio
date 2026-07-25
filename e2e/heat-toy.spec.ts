import { expect, test } from "@playwright/test";

test.describe("Warmer heat-toy demo", () => {
  test("a starter-word guess produces real feedback", async ({ page }) => {
    await page.goto("/work/warmer");

    // The real demo is behind an eager text-trigger shell (0 bytes for
    // visitors who never engage) — activate it first.
    await page.getByRole("button", { name: /Guess today's secret word/ }).click();

    const input = page.getByLabel("Guess today's word");
    // The vocab fetch can take a beat on a cold cache — wait for the input
    // to actually be enabled (it's disabled while vocab is null/loading).
    await expect(input).toBeVisible({ timeout: 15_000 });

    // The starter-guess chips are deterministic and guaranteed present
    // until the first guess is made — click one rather than typing a word
    // we'd have to already know is in the 410-word vocab. Scoped to the
    // "Not sure where to start?" hint paragraph so this can't accidentally
    // match an unrelated button elsewhere on the page.
    const starterChip = page
      .locator("p", { hasText: "Not sure where to start?" })
      .getByRole("button")
      .first();
    await expect(starterChip).toBeVisible();
    const guessedWord = (await starterChip.textContent())?.trim();
    await starterChip.click();

    // A history row with the guessed word and a heat-label appears.
    await expect(page.getByText(guessedWord ?? "", { exact: true })).toBeVisible();
    const feedback = page.getByText(/Scorching|Hot|Warm|Cool|Cold|Not in the word list/);
    await expect(feedback.first()).toBeVisible();
  });

  test("typing a guess and submitting via the form also works", async ({ page }) => {
    await page.goto("/work/warmer");
    await page.getByRole("button", { name: /Guess today's secret word/ }).click();
    const input = page.getByLabel("Guess today's word");
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.fill("water");
    await page.getByRole("button", { name: "Guess" }).click();
    await expect(page.getByText(/Scorching|Hot|Warm|Cool|Cold|Not in the word list/).first()).toBeVisible();
  });
});
