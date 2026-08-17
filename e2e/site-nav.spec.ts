import { expect, test } from "@playwright/test";

/**
 * The header pill: it contracts on scroll and carries an indicator that
 * slides to whichever section you are reading.
 *
 * The alignment test below exists because of a bug that shipped in the first
 * build of this and was only visible on a phone. The indicator is positioned
 * by measuring the active item, and it was re-measured on window resize and
 * font load, but not when the pill contracts on scroll. Contracting changes
 * the pill's padding, which shifts every item left, so the underline stayed
 * where the item used to be, sitting off-centre under a word it no longer
 * matched. Nothing failed; it just looked slightly wrong, which is the kind
 * of defect that survives forever.
 *
 * So this asserts the relationship (indicator sits exactly on its item)
 * rather than any particular coordinate, and it asserts it after the
 * contraction rather than before, which is the state the bug lived in.
 */

const SECTION_FOR_LABEL: Record<string, string> = {
  About: "about",
  Experience: "experience",
  Contact: "contact",
};

interface IndicatorState {
  present: boolean;
  hasActive: boolean;
  label: string;
  opacity: number;
  /* Zero when nothing is active, which the callers only read after asserting
   * that something is. A single uniform shape rather than a union, because a
   * union here buys nothing and costs every call site a narrowing dance. */
  leftError: number;
  widthError: number;
}

async function indicatorAlignment(
  page: import("@playwright/test").Page
): Promise<IndicatorState> {
  return page.evaluate(() => {
    const list = document.querySelector<HTMLElement>(".site-nav-links");
    const indicator = document.querySelector<HTMLElement>(".site-nav-indicator");
    const active = document.querySelector<HTMLElement>('[aria-current="page"]');
    const empty = { present: false, hasActive: false, label: "", opacity: 0, leftError: 0, widthError: 0 };
    if (!list || !indicator) return empty;
    const opacity = Number(getComputedStyle(indicator).opacity);
    if (!active) return { ...empty, present: true, opacity };
    const listBox = list.getBoundingClientRect();
    const indicatorBox = indicator.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    return {
      present: true,
      hasActive: true,
      label: active.textContent?.trim() ?? "",
      opacity,
      leftError: Math.abs(activeBox.left - listBox.left - (indicatorBox.left - listBox.left)),
      widthError: Math.abs(activeBox.width - indicatorBox.width),
    };
  });
}

test.describe("header pill", () => {
  test("contracts as the page scrolls and settles at its compact size", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1400);

    const read = () =>
      page.evaluate(() => {
        const nav = document.querySelector<HTMLElement>('nav[aria-label="Site"]')!;
        const pill = document.querySelector<HTMLElement>(".site-nav-pill")!;
        return {
          shrink: Number(getComputedStyle(nav).getPropertyValue("--nav-shrink")),
          height: Math.round(nav.getBoundingClientRect().height),
          pillHeight: Math.round(pill.getBoundingClientRect().height),
        };
      });

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(900);
    const atTop = await read();

    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(1600);
    const scrolled = await read();

    expect(atTop.shrink, "pill starts expanded").toBeLessThan(0.15);
    expect(scrolled.shrink, "pill ends contracted").toBeGreaterThan(0.85);

    /* The pill shrinks and the band does not, and both halves matter.
     *
     * This assertion used to be the opposite way round: the band was
     * expected to shrink with the pill, because that is how it was first
     * built. It was wrong. The band is sticky but still in flow, so a band
     * that changes height moves every element on the page below it, and
     * the whole document slid 16px as you scrolled through the
     * contraction. The pill now contracts inside a fixed-height band. */
    expect(scrolled.pillHeight, "the pill itself contracts").toBeLessThan(atTop.pillHeight);
    expect(
      Math.abs(scrolled.height - atTop.height),
      `band was ${atTop.height}px and became ${scrolled.height}px; a band that resizes reflows the page below it`
    ).toBeLessThanOrEqual(1);
  });

  test("the indicator follows the section being read, and clears at the top", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1400);

    for (const [label, id] of Object.entries(SECTION_FOR_LABEL)) {
      await page.evaluate((sectionId) => {
        document.getElementById(sectionId)?.scrollIntoView({ block: "center" });
      }, id);
      await page.waitForTimeout(1500);

      const state = await indicatorAlignment(page);
      expect(state.present, "nav is present").toBe(true);
      expect(state.hasActive, `something is marked current while reading #${id}`).toBe(true);
      expect(state.label, `#${id} lights its own nav item`).toBe(label);
      expect(state.opacity, "indicator is visible when an item is active").toBeGreaterThan(0.9);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1600);
    const top = await indicatorAlignment(page);
    expect(top.hasActive, "nothing is marked current at the top of the page").toBe(false);
    expect(top.opacity, "indicator is hidden rather than stranded").toBeLessThan(0.1);
  });

  test("the indicator re-aligns when the pill's geometry changes under it", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1400);

    await page.evaluate(() => {
      document.getElementById("experience")?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(1800);

    const before = await indicatorAlignment(page);
    expect(before.hasActive, "a section is being read").toBe(true);
    expect(before.leftError, "aligned to start with").toBeLessThanOrEqual(1.5);

    /*
     * Change the pill's size while the active item stays put, and check the
     * indicator follows.
     *
     * Honest about what this is: a structural guard, not a regression test
     * for a bug that happened. It was written believing the indicator went
     * stale when the pill contracted, on the strength of a screenshot that
     * had actually caught the indicator mid-slide. It does not, because it is
     * absolutely positioned inside the links row and measured relative to it,
     * so the row moving takes the indicator along. The check is kept because
     * that is a property worth pinning: position the indicator against the
     * viewport or the pill instead of the row, and this fails immediately
     * rather than shipping as a subtle drift nobody files.
     */
    await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Site"]');
      nav?.style.setProperty("--nav-shrink", "0");
    });
    await page.waitForTimeout(700);

    const after = await indicatorAlignment(page);
    expect(after.hasActive, "still reading the same section").toBe(true);
    expect(
      after.leftError,
      `after the pill resized, the indicator is ${after.leftError.toFixed(1)}px off its item`
    ).toBeLessThanOrEqual(1.5);
    expect(
      after.widthError,
      `after the pill resized, the indicator is ${after.widthError.toFixed(1)}px off in width`
    ).toBeLessThanOrEqual(1.5);
  });
});

test.describe("header pill, reduced motion", () => {
  test("gets the composed compact pill and a placed indicator, not a frozen expanded one", async ({
    page,
  }) => {
    /* emulateMedia rather than test.use({ reducedMotion }): the fixture form
     * runs fine but does not typecheck against this version of Playwright,
     * and a spec that only passes with the typecheck skipped is not a spec
     * this repo can keep. Set before navigating, because the component reads
     * the preference once, in an effect after hydration. */
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForTimeout(1400);

    const shrink = await page.evaluate(() =>
      Number(
        getComputedStyle(document.querySelector('nav[aria-label="Site"]')!).getPropertyValue(
          "--nav-shrink"
        )
      )
    );
    expect(shrink, "reduced motion rests at the contracted size rather than the expanded one").toBe(
      1
    );

    await page.evaluate(() => {
      document.getElementById("about")?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(1200);

    const state = await indicatorAlignment(page);
    expect(state.hasActive, "the indicator still tracks the section, it just does not slide").toBe(
      true
    );
    expect(state.leftError).toBeLessThanOrEqual(1.5);
  });
});
