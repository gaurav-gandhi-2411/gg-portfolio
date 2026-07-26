import { expect, test } from "@playwright/test";

/**
 * Wave 16 — the flagship RAG chatbot demo (app/ask, components/chatbot/ask-panel.tsx).
 *
 * No GROQ_API_KEY secret is configured for this repo's CI e2e job (see
 * .github/workflows/ci.yml's `e2e` job) or in this local dev environment
 * either, so every real submission here exercises route.ts's documented
 * fail-soft path: groqProvider.complete() returns null for a missing key,
 * and the route downgrades to its honest "I don't have grounded information"
 * refusal (lib/chatbot/answer.ts's refusalAnswer()) — a normal, expected
 * assistant turn, not an error state. This suite therefore asserts that
 * submitting a question renders SOME assistant answer bubble, never
 * specific answer content or a citation link (those only appear with a
 * live key) — the same reasoning wave 14's e2e-verification rule applies to
 * every interactive feature: drive it in a real browser, don't assert
 * behavior nobody actually observed.
 */

const LAST_CHIP = "Which project's evaluation numbers are the most interesting?";

test.describe("/ask", () => {
  test("loads with the intro copy and the panel visible", async ({ page }) => {
    await page.goto("/ask");
    await expect(page.getByRole("heading", { level: 1, name: "Ask about my work" })).toBeVisible();
    await expect(page.getByLabel("Ask a question about Gaurav's work")).toBeVisible();
  });

  test("the chat launcher is visible on / and absent on /ask", async ({ page }) => {
    await page.goto("/");
    const launcher = page.getByRole("link", { name: "Ask about my work" });
    await expect(launcher).toBeVisible();

    await page.goto("/ask");
    await expect(page.getByRole("link", { name: "Ask about my work" })).toHaveCount(0);
  });

  test("suggested-question chips are visible, clickable, and populate the input", async ({
    page,
  }) => {
    await page.goto("/ask");
    const chip = page.getByRole("button", { name: LAST_CHIP });
    await expect(chip).toBeVisible();

    const input = page.getByLabel("Ask a question about Gaurav's work");
    await chip.click();
    await expect(input).toHaveValue(LAST_CHIP);
    await expect(input).toBeFocused();
  });

  test("submitting a question renders a rendered answer bubble (fail-soft, no live key here)", async ({
    page,
  }) => {
    await page.goto("/ask");
    const input = page.getByLabel("Ask a question about Gaurav's work");
    await input.fill("What Hinglish bug did Warmer have?");
    await page.getByRole("button", { name: "Ask" }).click();

    // The question bubble renders immediately (optimistic local state) as
    // part of the same <li> the assistant's answer lands in once the
    // request resolves — ask-panel.tsx renders one turn (question + answer)
    // per <li>, plus a separate, sibling "Thinking…" <li> only while
    // loading. A generous timeout accounts for the local ONNX retrieval
    // model's cold-start load (lib/chatbot/embed.mjs), which the fail-soft
    // refusal path still runs before it can answer.
    await expect(page.getByText("What Hinglish bug did Warmer have?")).toBeVisible();
    await expect(page.getByText("Thinking…")).toHaveCount(0, { timeout: 20_000 });

    const chatLog = page.locator('[aria-live="polite"]');
    const turn = chatLog.locator("ol > li").first();
    await expect(chatLog.locator("ol > li")).toHaveCount(1);
    await expect(turn).not.toBeEmpty();
  });

  test("keyboard-only flow: tab to input, type, press Enter to submit", async ({ page }) => {
    await page.goto("/ask");
    const lastChip = page.getByRole("button", { name: LAST_CHIP });
    await lastChip.focus();
    await expect(lastChip).toBeFocused();

    await page.keyboard.press("Tab");
    const input = page.getByLabel("Ask a question about Gaurav's work");
    await expect(input).toBeFocused();

    await page.keyboard.type("What roles is Gaurav looking for?");
    await page.keyboard.press("Enter");

    await expect(page.getByText("Thinking…")).toHaveCount(0, { timeout: 20_000 });
    const chatLog = page.locator('[aria-live="polite"]');
    await expect(chatLog.locator("ol > li")).toHaveCount(1);
  });

  test("reduced motion doesn't break the page or the ask flow", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/ask");
    await expect(page.getByRole("heading", { level: 1, name: "Ask about my work" })).toBeVisible();

    const chip = page.getByRole("button", { name: LAST_CHIP });
    await chip.click();
    const input = page.getByLabel("Ask a question about Gaurav's work");
    await expect(input).toHaveValue(LAST_CHIP);
  });
});
