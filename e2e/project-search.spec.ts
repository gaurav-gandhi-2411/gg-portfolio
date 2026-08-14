import { expect, test, type Page } from "@playwright/test";

/**
 * BL-9 — /projects search box. Every test in this file (except the no-JS
 * one) blocks the tier-2 model's network requests, so what's under test is
 * exactly the keyword tier — deterministic, no real ~23MB model download in
 * every CI run. e2e/project-search-network.spec.ts covers the OPPOSITE
 * case: a real, unblocked page proving the model genuinely loads and stays
 * lazy. Together the two files cover both required states (Task 3 and
 * Task 4 of BL-9's brief) rather than one file trying to do both.
 */

/** Blocks every request the tier-2 model would make (the ONNX weights file
 * itself, plus any huggingface.co-hosted config/tokenizer asset) so a test
 * exercises the keyword-only tier deterministically, the way a visitor on a
 * blocked/slow connection would experience it. */
async function blockModelNetwork(page: Page): Promise<void> {
  await page.route(
    (url) => /\.onnx(\?|$)/.test(url.pathname) || url.hostname.endsWith("huggingface.co"),
    (route) => route.abort()
  );
}

test.describe("/projects search — keyword tier (model network blocked)", () => {
  test("loads with the input visible and no results panel open", async ({ page }) => {
    await blockModelNetwork(page);
    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("typing a plain-language query ranks the matching project first", async ({ page }) => {
    await blockModelNetwork(page);
    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });
    // Zero literal keyword overlap with TriageIQ's own product name — this
    // is exactly the "plain-language, not a product-name lookup" query the
    // BL-9 brief itself uses as its example.
    await input.fill("reduces on-call issue triage time");

    const listbox = page.getByRole("listbox", { name: /ranked by relevance/i });
    await expect(listbox).toBeVisible();
    const options = listbox.getByRole("option");
    await expect(options.first()).toContainText("TriageIQ");

    // The keyword tier alone is what's under test here — confirms the
    // model never silently rescues a query the tier-1 scorer is supposed
    // to handle on its own.
    await expect(page.getByTestId("project-search-unavailable")).toBeVisible();
    await expect(page.getByTestId("project-search-unavailable")).toContainText(
      "showing keyword matches"
    );
  });

  test("a literal tech-chip substring ranks that project first", async ({ page }) => {
    await blockModelNetwork(page);
    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });
    await input.fill("LangGraph");

    const listbox = page.getByRole("listbox");
    await expect(listbox.getByRole("option").first()).toContainText("Style Maitri");
  });

  test("a query matching nothing still ranks all 13, none hidden", async ({ page }) => {
    await blockModelNetwork(page);
    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });
    await input.fill("quantum spreadsheet nonsense");

    // Ranks, never filters — every project still appears in the listbox.
    await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(13);
  });

  test("keyboard flow: focus, type, ArrowDown, Enter navigates to the top result", async ({
    page,
  }) => {
    await blockModelNetwork(page);
    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });

    await input.focus();
    await expect(input).toBeFocused();
    await input.type("reduces on-call issue triage time");

    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(input).toHaveAttribute("aria-activedescendant", /triageiq/);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/work\/triageiq$/);
  });

  test("Enter with no ArrowDown navigates to the top-ranked (first) result", async ({ page }) => {
    await blockModelNetwork(page);
    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });
    await input.fill("reduces on-call issue triage time");
    await expect(page.getByRole("listbox")).toBeVisible();
    await input.press("Enter");
    await expect(page).toHaveURL(/\/work\/triageiq$/);
  });

  test("Escape clears the query and closes the panel", async ({ page }) => {
    await blockModelNetwork(page);
    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });
    await input.fill("triage");
    await expect(page.getByRole("listbox")).toBeVisible();

    await input.press("Escape");
    await expect(input).toHaveValue("");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("clicking a result navigates via the mouse without keyboard", async ({ page }) => {
    await blockModelNetwork(page);
    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });
    await input.fill("LangGraph");
    const firstOption = page.getByRole("listbox").getByRole("option").first();
    await expect(firstOption).toContainText("Style Maitri");
    await firstOption.click();
    await expect(page).toHaveURL(/\/work\/style-maitri$/);
  });
});

/**
 * Gate (iii) — progressive enhancement. The search INPUT itself must exist
 * and be a real, labeled control in the server-rendered HTML before any
 * client JS runs; the ranked-results panel is a JS-only enhancement (it
 * cannot re-rank/re-render without React state) and is correctly absent
 * here — this test only asserts what the brief actually requires: the
 * input is present and functional (accepts focus/typed text), not that
 * results appear without JS.
 */
test("no-JS: the search input exists, is labeled, and accepts input", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/projects");

  const input = page.getByRole("combobox", { name: /search projects/i });
  await expect(input).toBeVisible();
  await input.fill("triage");
  await expect(input).toHaveValue("triage");

  await context.close();
});
