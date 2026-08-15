import { expect, test } from "@playwright/test";

/**
 * BL-9 — /projects search box. Round 5 removed the client-side MiniLM
 * semantic-reranking tier entirely (see components/project-search.tsx's
 * header for the decision) — keyword/substring matching
 * (lib/search/keyword-score.ts) is now the ONLY ranking tier, so these
 * tests exercise it directly with no model network to block or wait on.
 * (Round 4's e2e/project-search-network.spec.ts, which proved the
 * now-removed tier stayed lazy until focus, is gone with it — there is no
 * model network left for this feature to prove anything about.)
 */

test.describe("/projects search", () => {
  test("loads with the input visible and no results panel open", async ({ page }) => {
    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("typing a plain-language query ranks the matching project first", async ({ page }) => {
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
  });

  test("a literal tech-chip substring ranks that project first", async ({ page }) => {
    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });
    await input.fill("LangGraph");

    const listbox = page.getByRole("listbox");
    await expect(listbox.getByRole("option").first()).toContainText("Style Maitri");
  });

  test("a query matching nothing still ranks all 13, none hidden", async ({ page }) => {
    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });
    await input.fill("quantum spreadsheet nonsense");

    // Ranks, never filters — every project still appears in the listbox.
    await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(13);
  });

  test("keyboard flow: focus, type, ArrowDown, Enter navigates to the top result", async ({
    page,
  }) => {
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
    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });
    await input.fill("reduces on-call issue triage time");
    await expect(page.getByRole("listbox")).toBeVisible();
    await input.press("Enter");
    await expect(page).toHaveURL(/\/work\/triageiq$/);
  });

  test("Escape clears the query and closes the panel", async ({ page }) => {
    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });
    await input.fill("triage");
    await expect(page.getByRole("listbox")).toBeVisible();

    await input.press("Escape");
    await expect(input).toHaveValue("");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("clicking a result navigates via the mouse without keyboard", async ({ page }) => {
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
