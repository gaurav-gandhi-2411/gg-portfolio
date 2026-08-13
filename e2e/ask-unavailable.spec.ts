import { expect, test } from "@playwright/test";

/**
 * The degraded state for /ask when @huggingface/transformers is absent.
 *
 * This exists because a degraded state that is never exercised is exactly the
 * class of untested claim CHECKS.md is about: it looks handled in the code,
 * and nobody finds out it isn't until the day it fires. The dependency became
 * optional on 2026-08-13 precisely so this path is REACHABLE in production —
 * which makes leaving it unverified worse, not better.
 *
 * The route's 503 is simulated at the network layer rather than by actually
 * uninstalling the package: the contract under test is "given a 503 with
 * unavailable:true, the UI closes rather than inviting a retry", and that
 * contract is what the reader experiences. The server half — that a missing
 * import produces exactly this response — is covered by embed.test.ts's
 * EmbeddingUnavailableError assertions and the route's name-matched branch.
 */
const UNAVAILABLE_BODY = {
  answer:
    "Ask is temporarily unavailable — the local search model didn't load. " +
    "Everything it can tell you is on this page and in the case studies.",
  citations: [],
  refused: true,
  unavailable: true,
};

async function stubUnavailable(page: import("@playwright/test").Page) {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify(UNAVAILABLE_BODY),
    });
  });
}

test.describe("/ask degraded state (embedding dependency absent)", () => {
  test("renders the unavailable notice, not the error state", async ({ page }) => {
    await stubUnavailable(page);
    await page.goto("/ask");

    await page.getByRole("textbox", { name: /Ask a question/i }).fill("What does TriageIQ do?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();

    const notice = page.getByTestId("ask-unavailable");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("temporarily unavailable");

    // The retry-flavoured error copy must NOT appear — that is the distinction
    // this whole state exists to draw.
    await expect(page.getByText("please try again shortly")).toHaveCount(0);
    await expect(page.getByText("Check your connection")).toHaveCount(0);
  });

  test("closes the composer instead of accepting input it cannot serve", async ({ page }) => {
    await stubUnavailable(page);
    await page.goto("/ask");

    const input = page.getByRole("textbox", { name: /Ask a question/i });
    const submit = page.getByRole("button", { name: "Ask", exact: true });

    await input.fill("What does TriageIQ do?");
    await submit.click();
    await expect(page.getByTestId("ask-unavailable")).toBeVisible();

    await expect(input).toBeDisabled();
    await expect(submit).toBeDisabled();
    await expect(input).toHaveAttribute("placeholder", /unavailable/i);
  });

  test("hides the suggested-question chips rather than disabling them", async ({ page }) => {
    await stubUnavailable(page);
    await page.goto("/ask");

    await page.getByRole("textbox", { name: /Ask a question/i }).fill("What does TriageIQ do?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByTestId("ask-unavailable")).toBeVisible();

    // Absent, not present-and-disabled: a visible prompt that cannot be
    // answered is the "appears to work, returns nothing" failure mode.
    await expect(page.getByText("Or ask about:")).toHaveCount(0);
  });

  test("a healthy response still renders normally (the stub is what degrades, not the page)", async ({
    page,
  }) => {
    // Guards against the degraded path leaking into the normal one — without
    // this, a bug that renders "unavailable" unconditionally would pass every
    // test above.
    await page.goto("/ask");
    const input = page.getByRole("textbox", { name: /Ask a question/i });
    await expect(input).toBeEnabled();
    await expect(page.getByTestId("ask-unavailable")).toHaveCount(0);
  });
});
