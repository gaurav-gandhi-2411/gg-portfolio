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
        // without a trace download.
        //
        // Two passes, because a single element scan turned out to be a
        // control with a narrower surface than its own report implied
        // (CLAUDE.md's "write the assertion before you read the
        // implementation" / rule 85a's shape): on the first real CI
        // reproduction of this exact failure this spec's own
        // getBoundingClientRect() element scan came back empty — every
        // element's box fit within innerWidth, yet scrollWidth was still
        // 1px over. Browsers count a run of rendered glyphs ("ink") that
        // overflows its own inline box into scrollWidth even when no
        // element's *box* extends past innerWidth — a fallback-font glyph
        // rendering slightly wider than the primary font it stands in for
        // is exactly this shape, and is consistent with the erroring
        // "Fallback" font-face entries seen in that same failure's
        // document.fonts dump below. Range.getClientRects() on each text
        // node's own contents measures the actual rendered glyphs, not the
        // containing element's laid-out box, and is the only thing here
        // that can see that class of overflow at all.
        const offenderReport =
          measured.documentScrollWidth > measured.innerWidth ||
          measured.bodyScrollWidth > measured.innerWidth
            ? await page.evaluate(() => {
                const innerWidth = window.innerWidth;

                const overflowingElements = [...document.querySelectorAll<HTMLElement>("*")]
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

                // A text run whose own layout geometry sits past innerWidth
                // is only a real contributor to document scrollWidth if
                // nothing between it and the document clips it first — the
                // sr-only technique (position:absolute, a 1px box, and
                // overflow:hidden) deliberately lays out far-off-screen text
                // exactly like this, on purpose, on every route, and its
                // overflow:hidden ancestor is specifically what keeps it
                // from ever counting toward scrollWidth (verified directly:
                // a throwaway page with a 1px/overflow:hidden/nowrap sr-only
                // span containing a 400px-wide sentence measured
                // scrollWidth === innerWidth). Skip any text rect that an
                // ancestor's own clipped box already excludes, so the
                // report doesn't spend its top-5 slots on spans that were
                // never candidates.
                function isClippedByAncestor(node: Node, rect: DOMRect): boolean {
                  let el = node.parentElement;
                  while (el) {
                    const s = getComputedStyle(el);
                    if (s.overflowX === "hidden" || s.overflowX === "clip") {
                      const hostRect = el.getBoundingClientRect();
                      if (rect.right > hostRect.right || rect.left < hostRect.left) return true;
                    }
                    el = el.parentElement;
                  }
                  return false;
                }

                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
                  acceptNode: (node) =>
                    node.textContent && node.textContent.trim().length > 0
                      ? NodeFilter.FILTER_ACCEPT
                      : NodeFilter.FILTER_REJECT,
                });
                const overflowingText: {
                  right: number;
                  text: string;
                  parentTag: string;
                  parentClass: string;
                }[] = [];
                for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                  const range = document.createRange();
                  range.selectNodeContents(node);
                  for (const rect of range.getClientRects()) {
                    if (rect.right > innerWidth && rect.width > 0 && !isClippedByAncestor(node, rect)) {
                      const parent = node.parentElement;
                      overflowingText.push({
                        right: Math.round(rect.right * 100) / 100,
                        text: (node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
                        parentTag: parent ? parent.tagName.toLowerCase() : "(no parent)",
                        parentClass:
                          parent && typeof parent.className === "string" ? parent.className : "",
                      });
                    }
                  }
                }
                overflowingText.sort((a, b) => b.right - a.right);

                // Third tier: CSS generated content. A ::before/::after with
                // real content and its own `position: absolute` establishes
                // a box neither of the two scans above can see at all —
                // element scan #1 only sees real elements' own boxes, and a
                // generated box isn't a text node scan #2's TreeWalker can
                // reach either. getComputedStyle CAN read a pseudo-element's
                // own resolved used-value geometry directly (no live rect
                // API exists for pseudo-elements), which is enough to name
                // a suspect even without an exact right edge.
                const pseudoCandidates = [...document.querySelectorAll<HTMLElement>("*")]
                  .flatMap((el) =>
                    (["::before", "::after"] as const)
                      .map((pseudo) => ({ el, pseudo, style: getComputedStyle(el, pseudo) }))
                      .filter(({ style }) => style.content !== "none" && style.content !== '""')
                  )
                  .slice(0, 5)
                  .map(({ el, pseudo, style }) => {
                    const classAttr =
                      typeof el.className === "string"
                        ? el.className
                        : el.getAttribute("class") || "";
                    return {
                      tag: el.tagName.toLowerCase(),
                      pseudo,
                      class: classAttr,
                      content: style.content.slice(0, 40),
                      position: style.position,
                      left: style.left,
                      width: style.width,
                    };
                  });

                const fonts = [...document.fonts].map((f) => `${f.family}:${f.status}`);
                return {
                  overflowingElements,
                  overflowingText: overflowingText.slice(0, 5),
                  pseudoCandidates,
                  fonts,
                };
              })
            : null;

        const offenderMessage = offenderReport
          ? "\nTop offending elements (right edge > innerWidth, worst first):\n" +
            (offenderReport.overflowingElements.length > 0
              ? offenderReport.overflowingElements
                  .map(
                    (o, i) =>
                      `  ${i + 1}. <${o.tag}${o.id ? `#${o.id}` : ""}${
                        o.class ? ` class="${o.class}"` : ""
                      }> right=${o.right} position=${o.position} transform=${o.transform} text="${o.text}"`
                  )
                  .join("\n")
              : "  (none — no element's own box overflows; see rendered text below)") +
            "\nTop overflowing rendered text runs (ink, via Range.getClientRects — catches " +
            "glyph overflow no element box reflects):\n" +
            (offenderReport.overflowingText.length > 0
              ? offenderReport.overflowingText
                  .map(
                    (o, i) =>
                      `  ${i + 1}. right=${o.right} in <${o.parentTag}${
                        o.parentClass ? ` class="${o.parentClass}"` : ""
                      }> text="${o.text}"`
                  )
                  .join("\n")
              : "  (none)") +
            (offenderReport.overflowingElements.length === 0 && offenderReport.overflowingText.length === 0
              ? "\nCSS generated content present (::before/::after with real content — neither " +
                "scan above can see a pseudo-element's own box; no live rect API exists for one, " +
                "so only its computed geometry is listed):\n" +
                (offenderReport.pseudoCandidates.length > 0
                  ? offenderReport.pseudoCandidates
                      .map(
                        (o, i) =>
                          `  ${i + 1}. <${o.tag}${o.class ? ` class="${o.class}"` : ""}>${o.pseudo} ` +
                            `content="${o.content}" position=${o.position} left=${o.left} width=${o.width}`
                      )
                      .join("\n")
                  : "  (none)")
              : "") +
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
