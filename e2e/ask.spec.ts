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

/**
 * The last of the seeded openers, by its rendered text.
 *
 * Copy is a locator target on this site, and this constant is the proof: the
 * opener set went from five questions to three, and four tests in this file
 * broke on a string nobody thought of as code. Kept as one constant so the
 * next copy change is one edit rather than seven, and named for its position
 * rather than its wording so it stays honest when the wording moves again.
 */
const LAST_CHIP = "What roles is Gaurav looking for right now?";

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

  /**
   * Design review caught a real collision the density fix (xl→lg) newly
   * exposed: the fixed bottom-right launcher can land on top of
   * case-study-page.tsx's sticky right rail (on-this-page nav, metric,
   * related-project links) at lg+, making rail links unclickable, not just
   * visually crowded — that rail only renders at lg+ (`hidden lg:block`).
   *
   * GG's launch-review round two found the same root cause below lg, where
   * the rail doesn't exist but ordinary paragraph text does: a 30-route
   * walk at 390px caught the launcher sitting over live body text on
   * /work/triageiq mid-scroll (a fixed corner element and a page long
   * enough to scroll any line of text through that corner — the identical
   * mechanism the rail fix already named, just never checked at this
   * width). The launcher now hides on every /work/[slug] route regardless
   * of viewport (chat-launcher.tsx) rather than only at lg+.
   */
  test("the chat launcher hides on case-study pages at every width", async ({ page }) => {
    await page.goto("/work/triageiq");
    const launcher = page.getByRole("link", { name: "Ask about my work" });

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(launcher).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(launcher).toHaveCount(0);
  });

  /**
   * Production audit (2026-08-22): the same fixed-corner-over-scrolling-
   * content mechanism, found on /projects at 390px — a real-scroll walk
   * caught the launcher sitting over a project card's own description
   * text. /projects has no other persistent path to /ask (no nav-bar
   * link), so unlike /work/[slug] this isn't hidden outright: the project
   * grid is single-column below `lg` (tight stacking, real overlap risk)
   * and two columns with real breathing room at `lg`+, so the hide is
   * scoped to exactly that breakpoint instead.
   */
  test("the chat launcher hides on narrow /projects, but is back at lg+", async ({ page }) => {
    await page.goto("/projects");
    const launcher = page.getByRole("link", { name: "Ask about my work" });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(launcher).toBeHidden();

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(launcher).toBeVisible();
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

  test("follow-up chips exclude a question already asked in this conversation", async ({
    page,
  }) => {
    await page.goto("/ask");
    await page.getByRole("button", { name: LAST_CHIP }).click();
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page.getByText("Thinking…")).toHaveCount(0, { timeout: 20_000 });

    // The turn itself still shows the asked question as its own bubble —
    // this checks specifically the *follow-up chip row* below the
    // transcript, which must not reoffer it.
    await expect(page.getByText("Or ask about:")).toBeVisible();
    await expect(page.getByRole("button", { name: LAST_CHIP })).toHaveCount(0);
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
test("a refusal never shows the reader why it refused", async ({ page }) => {
  // refusalReason is primarily for the canary: it names which of five
  // failures happened, after a retired model spent two days looking
  // exactly like an off-topic question. As of round three it also decides
  // which of two sentences the reader sees (lib/chatbot/answer.ts's
  // refusalAnswer()) -- but the raw reason string, or any of its sibling
  // keys, must still never reach the rendered page itself. Putting a
  // provider's name or an internal enum value in front of a visitor would
  // be noise at best and alarming at worst.
  //
  // Asserted against the rendered text rather than against the component,
  // because the failure this guards is somebody rendering the field later
  // while debugging and leaving it in.
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answer: "I don't have grounded information to answer that.",
        citations: [],
        refused: true,
        followUps: [],
        refusalReason: "provider_unavailable",
      }),
    })
  );

  await page.goto("/ask");
  const input = page.getByRole("textbox").first();
  await input.fill("what is the weather");
  await input.press("Enter");

  await expect(page.getByText(/grounded information/i).first()).toBeVisible();
  const body = await page.locator("body").innerText();
  for (const reason of [
    "provider_unavailable",
    "no_grounding",
    "unvalidated_citations",
    "embeddings_unavailable",
    "server_error",
    "refusalReason",
  ]) {
    expect(body, `"${reason}" must never reach the page`).not.toContain(reason);
  }
});

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
