import { expect, test } from "@playwright/test";

import { unavailableAnswer } from "../lib/chatbot/answer";

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
// Built by the real production helper rather than hand-copied. The copy in
// this file had already drifted: it still carried the em dash the source
// string dropped, and every assertion below kept passing because they match
// on "temporarily unavailable", which both spellings contain. A stub that
// quietly stops resembling what the server sends is a test of a response
// nobody serves.
const UNAVAILABLE_BODY = unavailableAnswer();

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

    // Capture the real chip texts BEFORE asking, so the assertion is about the
    // chips themselves rather than about one container's copy. The first
    // version of this test asserted only on "Or ask about:" — the post-turn
    // block's heading — and sailed past five visible chips in the EMPTY-state
    // block, which is what a 503 visitor actually sees (a 503 adds no turn, so
    // isEmpty stays true). A screenshot caught what this test did not.
    const chipTexts = await page.getByTestId("ask-suggestion").allInnerTexts();
    expect(chipTexts.length).toBeGreaterThan(0);

    await page.getByRole("textbox", { name: /Ask a question/i }).fill("What does TriageIQ do?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByTestId("ask-unavailable")).toBeVisible();

    // Absent, not present-and-disabled: a visible prompt that cannot be
    // answered is the "appears to work, returns nothing" failure mode.
    await expect(page.getByTestId("ask-suggestion")).toHaveCount(0);
    await expect(page.getByText("Or ask about:")).toHaveCount(0);
    await expect(page.getByText("try one of these")).toHaveCount(0);
    for (const text of chipTexts) {
      await expect(page.getByRole("button", { name: text, exact: true })).toHaveCount(0);
    }
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
