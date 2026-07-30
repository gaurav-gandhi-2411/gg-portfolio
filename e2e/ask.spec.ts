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

/**
 * The bug this suite exists to prevent regressing: production /api/chat
 * crashed (missing onnxruntime-node native binary — see next.config.ts's
 * outputFileTracingIncludes), and every visitor saw "Something went wrong
 * reaching the assistant. Please check your connection and try again" —
 * blaming their connection for a server fault. ask-panel.tsx now
 * distinguishes four real failure modes with honest, specific messages
 * (lib/chatbot/answer.ts's serverErrorAnswer() backs the "server" case
 * server-side). Each test here forces one specific failure via route
 * interception — not a real network condition — so it's deterministic and
 * fast in CI.
 */
test.describe("/ask error handling", () => {
  async function submitAnyQuestion(page: import("@playwright/test").Page): Promise<void> {
    await page.goto("/ask");
    const input = page.getByLabel("Ask a question about Gaurav's work");
    await input.fill("Any question");
    await page.getByRole("button", { name: "Ask" }).click();
  }

  test("a well-formed 5xx from the route shows the server-fault message, not a connection message", async ({
    page,
  }) => {
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          answer: "Something went wrong on our end handling that question.",
          citations: [],
          refused: true,
        }),
      })
    );
    await submitAnyQuestion(page);
    await expect(page.locator('p[role="alert"]')).toHaveText(
      /went wrong on our end reaching the assistant/i
    );
  });

  test("a crashed response that doesn't parse (Next's own HTML error page) shows the server-fault message", async ({
    page,
  }) => {
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        status: 500,
        contentType: "text/html",
        body: "<html><body>Internal Server Error</body></html>",
      })
    );
    await submitAnyQuestion(page);
    await expect(page.locator('p[role="alert"]')).toHaveText(
      /went wrong on our end reaching the assistant/i
    );
  });

  test("a hung request past the client timeout shows the timeout message", async ({ page }) => {
    await page.route(
      "**/api/chat",
      () =>
        // Never resolves — the AbortController's own 30s bound (ask-panel.tsx's
        // REQUEST_TIMEOUT_MS) is what ends this, not a real network timeout.
        new Promise(() => {})
    );
    await page.goto("/ask");
    // Installed after goto (before the timer is created at submit-time) so
    // the page's initial render is unaffected by the mocked clock.
    await page.clock.install();
    const input = page.getByLabel("Ask a question about Gaurav's work");
    await input.fill("Any question");
    await page.getByRole("button", { name: "Ask" }).click();
    await page.clock.fastForward(31_000);
    await expect(page.locator('p[role="alert"]')).toHaveText(/taking longer than expected/i);
  });

  test("being offline shows the offline-specific message", async ({ page, context }) => {
    await page.goto("/ask");
    await context.setOffline(true);
    const input = page.getByLabel("Ask a question about Gaurav's work");
    await input.fill("Any question");
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText(/you appear to be offline/i);
    await context.setOffline(false);
  });
});
