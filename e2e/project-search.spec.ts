import { expect, test } from "@playwright/test";
import { products } from "../content/products";
import { CATEGORIES } from "../content/types";
import { keywordScore } from "../lib/search/keyword-score";
import { buildSearchableText } from "../lib/search/searchable-text";

/**
 * BL-9 — /projects search box. Round 5 removed the client-side MiniLM
 * semantic-reranking tier entirely (see components/project-search.tsx's
 * header for the decision) — keyword/substring matching
 * (lib/search/keyword-score.ts) is now the ONLY ranking tier, so these
 * tests exercise it directly with no model network to block or wait on.
 * (Round 4's e2e/project-search-network.spec.ts, which proved the
 * now-removed tier stayed lazy until focus, is gone with it — there is no
 * model network left for this feature to prove anything about.)
 *
 * Round 6 (GG's launch review) dropped the "ranks, never filters" test below
 * and replaced it with the opposite assertion: the panel must now filter to
 * matches, because "ranks everything, filters nothing" is exactly what
 * shipped as a search box that looked broken on production (see
 * components/project-search.tsx's header for the full incident).
 */

const CATEGORY_LABEL_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c.label]));

/** Same scoring the component runs client-side, so the expected result set
 * is derived from the real algorithm rather than hand-typed against it
 * (CHECKS.md 18 — a check is only safe when its two sides are independently
 * derived; hand-typing "3 results" here would just restate the component's
 * own arithmetic back at it). */
function matchingProductNames(query: string): string[] {
  return products
    .map((product) => ({
      product,
      score: keywordScore(
        query,
        buildSearchableText({
          name: product.name,
          tagline: product.tagline,
          techChips: product.techChips,
          categoryLabels: product.categories.map((id) => CATEGORY_LABEL_BY_ID.get(id) ?? id),
        })
      ),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.product.name);
}

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

  test("typing a query narrows the result set, not just its order", async ({ page }) => {
    // The literal repro from production: GG typed "red" and the search
    // "did not work". It actually matched two projects — Samidha Reviews
    // (via the tech chip "Tiered routing") and Gold Rate Tracker and
    // Expense Tracker (via "predicts" in both taglines) — but because the
    // old behaviour re-ranked without filtering, the visible panel still
    // showed all 14 projects with no rendered signal anything had matched.
    const query = "red";
    const expected = matchingProductNames(query);
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(products.length);

    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });
    await input.fill(query);

    const options = page.getByRole("listbox").getByRole("option");
    await expect(options).toHaveCount(expected.length);
    await expect(options).toHaveText(expected.map((name) => new RegExp(`^${name}`)));
  });

  test("typing a query narrows the visible grid, not just the dropdown", async ({ page }) => {
    // Round 7 repro: the dropdown already filtered correctly (round 6), but
    // ProjectFilter's grid underneath it had no idea a search existed —
    // typing "tria" narrowed the dropdown to TriageIQ while the grid still
    // read "Showing 14 of 14" with all 14 cards visible. This asserts the
    // GRID specifically (.project-grid article:visible, the same locator
    // e2e/a11y.spec.ts already uses for "how many cards actually render"),
    // never the listbox — a test that only checked the dropdown again would
    // reproduce the exact gap this round exists to close.
    const query = "tria";
    const expected = matchingProductNames(query);
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(products.length);

    await page.goto("/projects");
    const grid = page.locator(".project-grid article:visible");
    await expect(grid).toHaveCount(products.length);

    const input = page.getByRole("combobox", { name: /search projects/i });
    await input.fill(query);

    await expect(grid).toHaveCount(expected.length);
    await expect(page.getByText(`Showing ${expected.length} of ${expected.length} projects`)).toBeVisible();

    // Escape (the box's own existing clear affordance) restores the full grid.
    await input.press("Escape");
    await expect(grid).toHaveCount(products.length);
    await expect(page.getByText(`Showing ${products.length} of ${products.length} projects`)).toBeVisible();
  });

  test("a query matching nothing shows an explicit no-results message, not the full list", async ({
    page,
  }) => {
    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });
    await input.fill("quantum spreadsheet nonsense");

    expect(matchingProductNames("quantum spreadsheet nonsense")).toHaveLength(0);
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(
      /no projects match .quantum spreadsheet nonsense./i
    );
  });

  test("a query matching nothing also empties the grid, with a search-specific reset", async ({
    page,
  }) => {
    await page.goto("/projects");
    const input = page.getByRole("combobox", { name: /search projects/i });
    await input.fill("quantum spreadsheet nonsense");

    const grid = page.locator(".project-grid article:visible");
    await expect(grid).toHaveCount(0);
    await expect(page.getByText("No projects match your search.")).toBeVisible();

    const clear = page.getByRole("button", { name: "Clear search" });
    await expect(clear).toBeVisible();
    await clear.click();

    await expect(input).toHaveValue("");
    await expect(grid).toHaveCount(products.length);
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
