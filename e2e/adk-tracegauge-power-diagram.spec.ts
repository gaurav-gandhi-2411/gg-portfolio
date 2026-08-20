import { expect, test } from "@playwright/test";

import powerGrid from "../content/data/adk-tracegauge-power-grid.json";

/**
 * The power-vs-variance diagram on /work/adk-tracegauge.
 *
 * Written from what the section is supposed to do, per CLAUDE.md's ordering
 * rule, before reading the components closely:
 *
 *   1. Every regime/mode table's full data is in the HTML with no
 *      JavaScript -- a visitor with no JS can read all three tables and the
 *      real-evalset callout, because the tables are the content and the
 *      picker built on top is only a view of them.
 *   2. Once hydrated, a picker replaces the static tables. Choosing a
 *      regime, a mode, a noise level, and a sample size shows the matching
 *      power percentage and confidence interval, looked up from the same
 *      committed data -- never computed fresh.
 *   3. The real-evalset comparison only appears in the one combination it
 *      was actually measured in (proportional-CV noise, paired mode).
 *      Switching to fixed-dollar noise hides it, because showing it there
 *      would misrepresent a measurement made in one regime as applying to
 *      both.
 *
 * Expected values come from the committed data file rather than being typed
 * in, so the page and the test stay two independently derived readings of
 * the same numbers (CHECKS.md 18).
 */

const SECTION = "Power to catch a cost rise, by noise shape and eval-set size";

test.describe("adk-tracegauge power-variance diagram", () => {
  test("every table's real numbers are server-rendered, with no JavaScript", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/work/adk-tracegauge");

    const section = page.getByRole("region", { name: SECTION });
    await expect(section).toBeVisible();

    // Three tables: Regime A, Regime B two-sample, Regime B paired.
    await expect(section.locator("table")).toHaveCount(3);

    // Every row across all three tables renders one cell per n value -- a
    // count derived from the data file, not typed in, so it moves if the
    // grid does.
    const totalRows =
      powerGrid.regimeA.rows.length +
      powerGrid.regimeB.modes.twoSample.rows.length +
      powerGrid.regimeB.modes.paired.rows.length;
    const totalDataCells = totalRows * powerGrid.n_values.length;
    await expect(section.locator("table tbody td:not(:first-child)")).toHaveCount(
      totalDataCells
    );

    // A sample of real cells, at the extremes, so this cannot pass on an
    // empty or all-zero table.
    await expect(section.getByText("100%", { exact: true }).first()).toBeVisible();
    const smallestRegimeB = powerGrid.regimeB.modes.paired.rows.at(-1);
    if (smallestRegimeB) {
      const lowestCell = smallestRegimeB.power.find((p) => p.n === 30);
      if (lowestCell) {
        await expect(section.getByText(`${lowestCell.pct}%`, { exact: true }).first()).toBeVisible();
      }
    }

    // The real-evalset callout's own numbers, unconditionally in the HTML.
    const real10at30 = powerGrid.realMeasured.points.find(
      (p) => p.effectPct === 10 && p.n === 30
    );
    expect(real10at30).toBeTruthy();
    if (real10at30) {
      await expect(section.getByText(new RegExp(`n=30.*${real10at30.power}%`))).toBeVisible();
    }

    await context.close();
  });

  test("picking a regime, mode, row, and n shows the matching looked-up power", async ({
    page,
  }) => {
    await page.goto("/work/adk-tracegauge");
    const section = page.getByRole("region", { name: SECTION });
    await section.scrollIntoViewIfNeeded();

    // Hydrated: the picker's controls replace the static tables.
    await expect(section.getByRole("button", { name: "Fixed-dollar noise" })).toBeVisible();

    await section.getByRole("button", { name: "Fixed-dollar noise" }).click();
    const row = powerGrid.regimeA.rows[3]; // $0.0016 -- a mid-range, non-ceiling cell
    await section.getByRole("button", { name: row.display, exact: true }).click();
    await section.getByRole("button", { name: "n = 50", exact: true }).click();

    const expected = row.power.find((p) => p.n === 50);
    expect(expected).toBeTruthy();
    if (expected) {
      // The same percentage can legitimately also appear in the "power at
      // every n" comparison row below (it repeats the selected n's value),
      // so this is scoped to the one result element rather than to text
      // that happens to be unique today (CHECKS.md 19).
      await expect(page.getByTestId("power-grid-result")).toHaveText(`${expected.pct}%`);
      await expect(
        section.getByText(`[${expected.ci[0]}%, ${expected.ci[1]}%]`, { exact: false })
      ).toBeVisible();
    }
  });

  test("the real-evalset comparison shows only in proportional-CV paired mode", async ({
    page,
  }) => {
    await page.goto("/work/adk-tracegauge");
    const section = page.getByRole("region", { name: SECTION });
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole("button", { name: "Fixed-dollar noise" })).toBeVisible();

    const realCallout = section.getByText("Where one real evalset actually landed");

    // Default state is Regime B / paired, so the callout starts visible.
    await expect(realCallout).toBeVisible();

    await section.getByRole("button", { name: "Fixed-dollar noise" }).click();
    await expect(realCallout).toHaveCount(0);

    await section.getByRole("button", { name: "Cost-proportional noise" }).click();
    await section.getByRole("button", { name: "Two-sample", exact: true }).click();
    await expect(realCallout).toHaveCount(0);

    await section.getByRole("button", { name: "Paired", exact: true }).click();
    await expect(realCallout).toBeVisible();
  });
});
