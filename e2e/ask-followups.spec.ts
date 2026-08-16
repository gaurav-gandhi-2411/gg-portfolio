import { expect, test } from "@playwright/test";

/**
 * The follow-up chips on /ask.
 *
 * The route needs a Groq key, so these stub it. That is the right boundary
 * anyway: what is being asserted here is the panel's contract with the
 * documented response shape, not the model's judgement. Whether a given
 * follow-up is grounded is decided server-side and covered by
 * lib/chatbot/answer.test.ts, which checks that an ungrounded one is
 * dropped before it ever reaches this component.
 */

const ANSWER = "Warmer's Hinglish embedding was retrained after scoring near zero.";

async function stubChat(page: import("@playwright/test").Page, followUps: string[]) {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answer: ANSWER,
        citations: [{ sourceRef: "warmer:results:1", label: "Warmer case study — Results", url: "/work/warmer" }],
        refused: false,
        followUps,
      }),
    });
  });
}

test.describe("ask follow-ups", () => {
  test("three seeded openers greet an empty box", async ({ page }) => {
    await page.goto("/ask");
    const chips = page.getByTestId("ask-suggestion");
    await expect(chips).toHaveCount(3);
  });

  test("an answer offers grounded follow-ups, and tapping one asks it", async ({ page }) => {
    await stubChat(page, [
      "What did the Spearman score reach?",
      "How was the Hinglish model retrained?",
    ]);
    await page.goto("/ask");

    await page.getByRole("textbox").fill("What went wrong with Warmer?");
    await page.getByRole("textbox").press("Enter");

    // The reveal paces the answer in, and the chips deliberately wait for it
    // to finish rather than interrupting a sentence still arriving.
    await expect(page.getByText("Keep digging")).toBeVisible({ timeout: 15_000 });

    const followUp = page.getByRole("button", { name: "What did the Spearman score reach?" });
    await expect(followUp).toBeVisible();

    await followUp.click();

    // Tapping asks outright rather than only loading the composer: the second
    // question should now be its own turn.
    await expect(
      page.getByText("What did the Spearman score reach?", { exact: false }).first()
    ).toBeVisible();
    const turns = page.locator("ol > li");
    await expect(turns).toHaveCount(2, { timeout: 15_000 });
  });

  test("an answer with no grounded follow-ups offers none, rather than filler", async ({
    page,
  }) => {
    await stubChat(page, []);
    await page.goto("/ask");

    await page.getByRole("textbox").fill("What went wrong with Warmer?");
    await page.getByRole("textbox").press("Enter");

    await expect(page.getByText(ANSWER).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Keep digging")).toHaveCount(0);
  });
});
