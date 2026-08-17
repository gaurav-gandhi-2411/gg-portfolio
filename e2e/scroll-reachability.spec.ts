import { expect, test } from "@playwright/test";

/**
 * Two defects found while looking for something else, both about a control
 * being visible in the layout and unreachable in practice, and neither of
 * which anything in the suite would have failed on.
 *
 * The keyboard case is the one that matters. The site has a sticky nav
 * pinned to the top and a floating chat launcher pinned to the bottom right.
 * Nothing told the browser they were there, so scrolling any element into
 * view could park it exactly underneath one of them. Tab to a control below
 * the fold and it lands under the nav: focused, announced, and covered. The
 * repo had been patching the top half of this one element at a time with a
 * hand-placed scroll-mt-24 on case-study headings, which is the shape of a
 * fix that only covers the elements somebody remembered to annotate.
 *
 * It first surfaced as a Playwright click landing on whatever had slid under
 * the cursor, which is worth recording: the harness noticed a real
 * accessibility bug before any human did, and the temptation in that moment
 * is to call it a flaky test and retry it.
 *
 * A note on how these are written, because the first draft of this file was
 * useless and passed with the fix reverted. Focusing a series of controls in
 * document order only ever produces small scrolls, and a browser scrolling
 * minimally leaves the element wherever it already nearly was, so nothing
 * ever landed under the nav. The condition only reproduces when the scroll
 * is a real jump to somewhere off screen, which is also the actual keyboard
 * journey: tab from the top of the page down to something far below the
 * fold. Every probe below therefore returns to the top first. Both tests
 * were then checked against a build with the fix reverted, and both fail
 * there, which is the only thing that makes them worth having.
 */

/** How much room the two overlays need, matching the tokens in globals.css. */
const NAV_CLEARANCE_PX = 60;
const FLOATING_UI_CLEARANCE_PX = 96;

test.describe("focused controls stay reachable", () => {
  test("a section scrolled to the top edge never lands under the sticky nav", async ({ page }) => {
    await page.goto("/");

    /* Uses scrollIntoView with block start, which is what in-page anchor
     * navigation and the skip link both do, and what the browser does when
     * it aligns a target to the top of the scrollport.
     *
     * Not focus(). That was the first draft and it never reproduced the bug,
     * because Chromium centres an element that is far off screen rather than
     * aligning it to the top, so every probe landed mid-viewport and nothing
     * ever touched the nav's band. The check looked thorough and tested
     * nothing, which is the exact failure this file exists to catch
     * elsewhere. */
    const results = await page.evaluate(async () => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const targets = [
        ...document.querySelectorAll<HTMLElement>("main section[id], main [id]:not(section)"),
      ]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return el.id && r.height > 40;
        })
        .slice(0, 8);

      const out: { id: string; top: number; covered: boolean; coveredBy: string }[] = [];
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

      for (const el of targets) {
        window.scrollTo(0, 0);
        await wait(700);
        el.scrollIntoView({ block: "start" });
        await wait(900);
        // Only judge targets the page could actually scroll to the top edge.
        if (window.scrollY < 40 || window.scrollY >= maxScroll - 4) continue;
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(Math.max(2, r.left + 8), r.top + 4);
        out.push({
          id: el.id,
          top: Math.round(r.top),
          covered: !!hit && !(hit === el || el.contains(hit)),
          coveredBy: hit ? hit.tagName.toLowerCase() : "null",
        });
      }
      return out;
    });

    expect(results.length, "found sections the page can scroll to the top edge").toBeGreaterThan(0);

    for (const r of results) {
      expect(
        r.top,
        `#${r.id} landed at y=${r.top}, inside the sticky nav's band (covered by ${r.coveredBy})`
      ).toBeGreaterThanOrEqual(NAV_CLEARANCE_PX - 8);
    }
  });

  test("a control scrolled to the bottom edge never lands under the floating launcher", async ({
    page,
  }) => {
    await page.goto("/");

    const results = await page.evaluate(
      async (clearance) => {
        const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const links = [...document.querySelectorAll<HTMLElement>("main a[href]")].filter((a) => {
          const r = a.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        const out: { label: string; bottom: number; viewport: number }[] = [];
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

        for (let i = 2; i < Math.min(links.length, 10); i += 2) {
          const el = links[Math.floor((i / 10) * links.length)];
          window.scrollTo(0, 0);
          await wait(700);
          el.scrollIntoView({ block: "end" });
          await wait(900);
          // Skip anything the page simply cannot scroll far enough to place.
          if (window.scrollY >= maxScroll - 4 || window.scrollY < 40) continue;
          const r = el.getBoundingClientRect();
          out.push({
            label: (el.textContent ?? "").trim().slice(0, 40),
            bottom: Math.round(r.bottom),
            viewport: window.innerHeight,
          });
        }
        return { out, clearance };
      },
      FLOATING_UI_CLEARANCE_PX
    );

    expect(results.out.length, "found scrollable probes").toBeGreaterThan(0);

    for (const r of results.out) {
      expect(
        r.bottom,
        `"${r.label}" bottom at ${r.bottom} of ${r.viewport}, inside the launcher's band`
      ).toBeLessThanOrEqual(r.viewport - FLOATING_UI_CLEARANCE_PX + 12);
    }
  });
});

test.describe("header height tokens", () => {
  /*
   * The clearance number everything else is positioned against is a measured
   * value written into globals.css by hand, not an expression derived from
   * the pill's own padding. This is the check that makes that safe.
   *
   * It now asserts a second, more important thing: that the band's height is
   * the SAME whether the pill is expanded or contracted. The band is sticky
   * but still in flow, so a band that changes height moves every element on
   * the page below it, and the first version of this header did exactly
   * that, sliding the whole document 16px as you scrolled through the
   * contraction. That is a reader-visible defect, and it is also what made
   * the mobile filter test spend seconds per click waiting for a box to stop
   * moving. A test that only checked the token would have let it back in.
   */
  test("the header band keeps one height through the contraction, and matches --nav-h", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForTimeout(1200);

    const measured = await page.evaluate(async () => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Site"]')!;
      const root = getComputedStyle(document.documentElement);

      window.scrollTo(0, 0);
      await wait(900);
      const rest = nav.getBoundingClientRect().height;
      const restShrink = Number(getComputedStyle(nav).getPropertyValue("--nav-shrink"));

      window.scrollTo(0, 600);
      await wait(1600);
      const contracted = nav.getBoundingClientRect().height;
      const contractedShrink = Number(getComputedStyle(nav).getPropertyValue("--nav-shrink"));

      return {
        rest,
        contracted,
        restShrink,
        contractedShrink,
        token: parseFloat(root.getPropertyValue("--nav-h")) * 16,
      };
    });

    expect(measured.restShrink, "the pill really is expanded at the top").toBeLessThan(0.15);
    expect(measured.contractedShrink, "and really is contracted after scrolling").toBeGreaterThan(
      0.85
    );
    expect(
      Math.abs(measured.rest - measured.contracted),
      `band is ${measured.rest}px expanded and ${measured.contracted}px contracted; a band that changes height reflows the whole page below it`
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(measured.rest - measured.token),
      `--nav-h is ${measured.token}px, band is ${measured.rest}px`
    ).toBeLessThanOrEqual(3);
  });
});

test.describe("scroll ownership", () => {
  test("a scroll from outside wins over one the smooth-scroll driver is still animating", async ({
    page,
  }) => {
    await page.goto("/");

    /* The driver initializes in an effect after hydration, so this has to
     * wait for it rather than read the class immediately. The first version
     * of this test checked straight after goto, found no driver, and skipped
     * itself on every run, which is the worst possible outcome for a
     * regression test: permanently green and permanently blind. */
    const smoothScrollActive = await page
      .waitForFunction(() => document.documentElement.classList.contains("lenis"), null, {
        timeout: 5000,
      })
      .then(() => true)
      .catch(() => false);

    test.skip(!smoothScrollActive, "smooth scrolling is off, so there is nothing to arbitrate");

    const target = await page.evaluate(() => {
      // Start a smooth scroll, then immediately scroll somewhere else, the
      // way a browser does when it brings a focused element into view.
      window.dispatchEvent(
        new WheelEvent("wheel", { deltaY: 1200, bubbles: true, cancelable: true })
      );
      const destination = Math.round(document.documentElement.scrollHeight * 0.5);
      window.scrollTo(0, destination);
      return destination;
    });

    // Longer than the driver's own settle time, so a stale target would have
    // had every chance to drag the page back by now.
    await page.waitForTimeout(1800);

    const landed = await page.evaluate(() => Math.round(window.scrollY));
    expect(
      Math.abs(landed - target),
      `asked for ${target}, ended at ${landed}; the smooth scroller pulled it back`
    ).toBeLessThan(60);
  });
});
