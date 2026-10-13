import { expect, test } from "@playwright/test";
import { caseStudies } from "../content/case-studies";

/**
 * Intent (written before the fix): in the proof strip a value may wrap onto
 * several lines, but its text must never run into its label. Measured from
 * the text itself (Range rects over the visible text nodes), not from the
 * element boxes, because an element box can be roomy while its glyphs
 * overlap the next line.
 */
const WIDTHS = [320, 360, 375, 390, 414, 480, 768, 1440];
const slugs = Object.keys(caseStudies);

test.describe("Case-study proof strip: value never overlaps its label", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "viewport is set explicitly per test");
  });

  for (const width of WIDTHS) {
    test(`no value/label text overlap at ${width}px, every strip on every case study`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const offenders: string[] = [];
      let checked = 0;
      for (const slug of slugs) {
        await page.goto(`/work/${slug}`);
        const found = await page.evaluate(() => {
          const rectOf = (root: Element, skipSrOnly: boolean) => {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let top = Infinity;
            let bottom = -Infinity;
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
              if (!n.textContent?.trim()) continue;
              if (skipSrOnly && n.parentElement?.closest(".sr-only")) continue;
              const range = document.createRange();
              range.selectNodeContents(n);
              for (const r of Array.from(range.getClientRects())) {
                top = Math.min(top, r.top);
                bottom = Math.max(bottom, r.bottom);
              }
            }
            return { top, bottom };
          };
          return Array.from(document.querySelectorAll("[data-proof-item]")).map((item) => {
            // The button holds the visible value (plus an sr-only suffix); the
            // closed popover panel also sits inside [data-proof-value], so it
            // must not be measured.
            const value = rectOf(item.querySelector("[data-proof-value] button")!, true);
            const label = rectOf(item.querySelector("[data-proof-label]")!, false);
            return {
              text: item.querySelector("[data-proof-value]")!.textContent!.slice(0, 40),
              overlap: value.bottom - label.top,
            };
          });
        });
        for (const f of found) {
          checked++;
          // 0.5px tolerance for sub-pixel rounding only.
          if (f.overlap > 0.5) offenders.push(`${slug}: "${f.text}" overlaps by ${f.overlap.toFixed(1)}px`);
        }
      }
      expect(checked).toBeGreaterThan(20);
      expect(offenders).toEqual([]);
    });
  }
});
