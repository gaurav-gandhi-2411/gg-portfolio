import { expect, test } from "@playwright/test";

/**
 * BL-9 round 5 — "Search methodology" disclosure
 * (components/search-methodology.tsx), rendered on /projects directly
 * under the search box. Collapsed by default (see that component's own
 * header for why); these tests exercise the open/close toggle and confirm
 * the content a visitor is meant to actually find is reachable both by
 * mouse and by keyboard alone.
 *
 * Round 6 (GG's launch review) shortened the trigger's own label from "How
 * this search was built, and the fancier option lost (show the numbers)" to
 * "Search methodology" — the disclosure was already collapsed by default,
 * so the material was never the problem; the label editorializing about its
 * own rigor was.
 */

test.describe("/projects search-methodology disclosure", () => {
  test("collapsed by default, expands on click, and reveals the sourced comparison", async ({
    page,
  }) => {
    await page.goto("/projects");
    const trigger = page.getByRole("button", { name: "Search methodology", exact: true });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText(/every tier's 95% wilson confidence interval/i)).toBeHidden();

    await trigger.click();

    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/every tier's 95% wilson confidence interval/i)).toBeVisible();
    // The four measured tiers, each with a sourced value/label row. exact:
    // true throughout — the plain label text is a substring of its own
    // MetricProvenance trigger's sr-only "show source for {label}" text,
    // so the default substring match is ambiguous (found by running this
    // test: a real strict-mode violation, not a hypothetical one).
    await expect(page.getByText("Keyword-only, shipped", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Self-built static-embedding matrix, built but not shipped", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("potion-base-8M (third-party), evaluated but not shipped", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("MiniLM, the original tier, removed", { exact: true })
    ).toBeVisible();

    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("keyboard-only: tab to the trigger and activate with Enter", async ({ page }) => {
    await page.goto("/projects");
    const trigger = page.getByRole("button", { name: "Search methodology", exact: true });
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/every tier's 95% wilson confidence interval/i)).toBeVisible();
  });

  test("a cited claim's source-provenance disclosure opens, shows the report citation, and links to provenance.md", async ({
    page,
  }) => {
    // These sourceRefs are prose-tier (a content/provenance.md row, no
    // content/metrics.json entry) — MetricProvenance's own documented rule
    // (components/metric-provenance.tsx) renders the raw source text
    // verbatim and links only to provenance.md itself, never to a file
    // this parser picked out of the prose (a wrong citation next to a real
    // number is worse than no citation). So this test checks the report
    // filename appears as plain cited text, not as a synthesized link —
    // scoped to this ONE claim's own provenance group: MetricProvenance's
    // opacity-based reveal (components/metric-provenance.tsx's own comment
    // on why — it must stay on under prefers-reduced-motion) means every
    // claim's panel is already in the DOM and Playwright-"visible"
    // regardless of its `data-open` state, so an unscoped locator matches
    // all four claims' panels at once (found by running this test).
    await page.goto("/projects");
    await page.getByRole("button", { name: "Search methodology", exact: true }).click();
    const claim = page.getByRole("button", { name: /show source for keyword-only, shipped/i });
    await claim.click();
    const group = page.getByRole("group", { name: "Source for Keyword-only, shipped" });
    await expect(group.getByText(/BL-9-round5-static-embedding-and-decision\.md/i)).toBeVisible();
    await expect(group.getByRole("link", { name: /View in content\/provenance\.md/i })).toBeVisible();
  });
});
