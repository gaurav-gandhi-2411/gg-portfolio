import { expect, test } from "@playwright/test";
import sitemap from "../app/sitemap";
import { site } from "../content/site";

/**
 * refresh-2026-09 direction review — the nav overflows horizontally at
 * 375px on both exploratory directions (~60px reported). Both directions
 * independently added an "Open source" fifth nav link on top of
 * About/Experience/Projects/Contact, the same shape as the overflow fixed
 * upstream on feat/open-source-section (see `git log --grep "fit five nav"`)
 * — but neither direction branch carries that fix, and each direction may
 * have reworked the hero/nav CSS on its own terms, so this spec is written
 * against every real route the site has rather than assumed fixed by that
 * prior art.
 *
 * "Written before the fix" per CLAUDE.md's "write the assertion before you
 * read the implementation": this file exists to state what should be true
 * (no page's document is ever wider than its own viewport, at all, and
 * every nav link is fully on-screen and tappable at the narrowest supported
 * width) before diagnosing which element causes the violation.
 *
 * The criterion has no exceptions: document.documentElement.scrollWidth and
 * document.body.scrollWidth are each <= window.innerWidth on every route at
 * every width, full stop — and forcing window.scrollTo(10000, 0) never
 * moves window.scrollX, which is the real, load-bearing signal. An earlier
 * version of this spec pinned two routes to a clientWidth-based exception
 * on the theory that a closed/clipped element's contribution to scrollWidth
 * was a measurement artifact with no live effect — that was wrong, caught
 * on direct verification: window.scrollTo(10000, 0) measurably moved
 * window.scrollX on both routes, meaning the overflow was real and
 * scrollable, not a phantom reading. Both were root-caused and fixed
 * instead (see the fix commits this spec's own history sits next to).
 *
 * Route inventory: every URL in the site's real sitemap.ts (never a
 * hardcoded list that goes stale — same convention as e2e/fixtures/*.ts),
 * plus two the sitemap doesn't carry but are still real, indexed pages a
 * visitor lands on: /ask (has its own canonical, deliberately left out of
 * the sitemap for reasons unrelated to this spec) and a definitely-missing
 * route, to cover the not-found page (it renders through the same root
 * layout and carries the same nav).
 *
 * /warmup/[service] is deliberately excluded, sitemap or not: those are
 * noindex bridge pages that make a real outbound call to wake a Cloud Run
 * service and then self-navigate to an external origin
 * (`window.location.href = config.destinationUrl`) — not a page a visitor
 * lands on and reads, and exercising it here would mean a live network
 * call with a real, if small, cost on every e2e run.
 */

const SITEMAP_ROUTES = sitemap().map((entry) => {
  const url = typeof entry.url === "string" ? entry.url : String(entry.url);
  const path = url.startsWith(site.url) ? url.slice(site.url.length) : url;
  return path === "" ? "/" : path;
});

const NOT_FOUND_ROUTE = "/no-horizontal-overflow-spec-does-not-exist";

const ALL_ROUTES = [...new Set([...SITEMAP_ROUTES, "/ask", NOT_FOUND_ROUTE])];

const WIDTHS = [375, 768, 1440] as const;
const HEIGHT = 900;

for (const width of WIDTHS) {
  test.describe(`document is never wider than the viewport at ${width}px`, () => {
    test.use({ viewport: { width, height: HEIGHT } });

    for (const path of ALL_ROUTES) {
      test(`${path}`, async ({ page }) => {
        await page.goto(path);
        // Measure the settled state, not a transient pre-font-load frame.
        // `goto` resolves on the load event, which can fire before web
        // fonts finish swapping in — components that re-measure their own
        // geometry once fonts are ready (MetricProvenance's viewport
        // clamp, site-nav's indicator alignment) haven't necessarily run
        // yet at that point. Caught as a real, reproducible failure here:
        // omitting this wait made /work/multimodal-fashion-recommender at
        // 375px fail 3/3 runs even with the component fix landed.
        await page.evaluate(() => document.fonts.ready);
        const measured = await page.evaluate(() => ({
          documentScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          innerWidth: window.innerWidth,
        }));

        // This gate previously reported only the two widths, which is
        // useless for tracking down an intermittent 1px CI-only failure —
        // it names the symptom, never the element causing it. When either
        // measurement is already over budget, name the actual offenders
        // before asserting, so a CI failure log is diagnosable on its own,
        // without a trace download: every element whose right edge sits
        // past innerWidth, sorted worst-first, plus the font-load status
        // this spec already waits on, since a still-loading/failed font can
        // change measured text width between runs on the same markup.
        const offenderReport =
          measured.documentScrollWidth > measured.innerWidth ||
          measured.bodyScrollWidth > measured.innerWidth
            ? await page.evaluate(() => {
                const innerWidth = window.innerWidth;
                const overflowing = [...document.querySelectorAll<HTMLElement>("*")]
                  .map((el) => ({ el, rect: el.getBoundingClientRect() }))
                  .filter(({ rect }) => rect.right > innerWidth)
                  .sort((a, b) => b.rect.right - a.rect.right)
                  .slice(0, 5)
                  .map(({ el, rect }) => {
                    const style = getComputedStyle(el);
                    const classAttr =
                      typeof el.className === "string"
                        ? el.className
                        : el.getAttribute("class") || "";
                    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
                    return {
                      tag: el.tagName.toLowerCase(),
                      id: el.id || null,
                      class: classAttr,
                      text,
                      right: Math.round(rect.right * 100) / 100,
                      position: style.position,
                      transform: style.transform,
                    };
                  });
                const fonts = [...document.fonts].map((f) => `${f.family}:${f.status}`);
                return { overflowing, fonts };
              })
            : null;

        const offenderMessage = offenderReport
          ? "\nTop offending elements (right edge > innerWidth, worst first):\n" +
            (offenderReport.overflowing.length > 0
              ? offenderReport.overflowing
                  .map(
                    (o, i) =>
                      `  ${i + 1}. <${o.tag}${o.id ? `#${o.id}` : ""}${
                        o.class ? ` class="${o.class}"` : ""
                      }> right=${o.right} position=${o.position} transform=${o.transform} text="${o.text}"`
                  )
                  .join("\n")
              : "  (none — overflow may come from a pseudo-element, scrollbar, or a zero-size " +
                "container's own box, none of which getBoundingClientRect() on real elements sees)") +
            `\ndocument.fonts: ${offenderReport.fonts.join(", ") || "(none reported)"}`
          : "";

        expect(
          measured.documentScrollWidth,
          `document.documentElement.scrollWidth (${measured.documentScrollWidth}) exceeds ` +
            `window.innerWidth (${measured.innerWidth}) on ${path} at ${width}px${offenderMessage}`
        ).toBeLessThanOrEqual(measured.innerWidth);
        expect(
          measured.bodyScrollWidth,
          `document.body.scrollWidth (${measured.bodyScrollWidth}) exceeds ` +
            `window.innerWidth (${measured.innerWidth}) on ${path} at ${width}px${offenderMessage}`
        ).toBeLessThanOrEqual(measured.innerWidth);

        // The real, load-bearing check: force the browser to actually try
        // to scroll to the overflow, rather than trusting a measurement
        // that a clip/margin quirk can make read clean while content is
        // still genuinely reachable by scrolling. See header comment.
        await page.evaluate(() => window.scrollTo(10000, 0));
        const scrollX = await page.evaluate(() => window.scrollX);
        expect(
          scrollX,
          `window.scrollTo(10000, 0) moved window.scrollX to ${scrollX} on ${path} at ${width}px — ` +
            `there is real, scrollable horizontal overflow`
        ).toBe(0);
      });
    }
  });
}

test.describe("primary nav links stay fully on-screen and tappable at 375px", () => {
  test.use({ viewport: { width: 375, height: HEIGHT } });

  for (const path of ALL_ROUTES) {
    test(`${path}`, async ({ page }) => {
      await page.goto(path);

      const result = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Site"]');
        if (!nav) return { present: false, failures: [] as string[] };

        // .site-nav-link only — not .site-nav-skip (a WCAG 2.4.1 skip link,
        // intentionally translateY(-200%) off-screen until :focus-visible;
        // failing to reach it while unfocused is correct, not a bug) and not
        // .site-nav-brand (the monogram/wordmark, not a nav item this spec
        // is about).
        const links = [...nav.querySelectorAll("a.site-nav-link")];
        const failures: string[] = [];

        for (const link of links) {
          const box = link.getBoundingClientRect();
          const label = (link.textContent || link.getAttribute("aria-label") || link.tagName)
            .trim()
            .slice(0, 40);

          if (box.width === 0 || box.height === 0) continue; // not actually visible

          if (box.left < 0 || box.right > window.innerWidth) {
            failures.push(
              `"${label}" box [${box.left.toFixed(1)}, ${box.right.toFixed(1)}] is outside ` +
                `[0, ${window.innerWidth}]`
            );
            continue;
          }

          const cx = box.left + box.width / 2;
          const cy = box.top + box.height / 2;
          const hit = document.elementFromPoint(cx, cy);
          const reachable = Boolean(hit) && (hit === link || link.contains(hit) || hit!.contains(link));
          if (!reachable) {
            failures.push(`"${label}" is not hit-testable at its own centre (${cx.toFixed(1)}, ${cy.toFixed(1)})`);
          }
        }

        return { present: true, failures };
      });

      expect(result.present, `${path} renders the Site nav`).toBe(true);
      expect(result.failures, result.failures.join("; ")).toEqual([]);
    });
  }
});
