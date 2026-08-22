import { expect, test } from "@playwright/test";

/**
 * Round 3 (GG): "scroll and transition feel dated." The site's bespoke
 * motion (hero parallax, card tilt, the reveal-on-view curve) was already
 * tuned to --dur-fast/--dur-base/--ease-out-soft; the components a visitor's
 * cursor actually touches on every page — buttons, filter pills, the
 * chatbot launcher, inline links — were animating on Tailwind's bare
 * defaults instead. These assert the computed transition timing actually
 * carries the site's own tokens rather than the Tailwind fallback, since a
 * class-name change with no visible static-state difference is invisible to
 * every other check in the suite.
 */
test.describe("shared interactive components use the site's motion tokens", () => {
  test("the resume LinkButton transitions on --dur-fast / --ease-out-soft", async ({ page }) => {
    await page.goto("/#experience");
    const button = page.getByRole("link", { name: "View the full resume" });
    const timing = await button.evaluate((el) => {
      const style = getComputedStyle(el);
      return { duration: style.transitionDuration, easing: style.transitionTimingFunction };
    });
    expect(timing.duration).toContain("0.18s");
    expect(timing.easing).toContain("cubic-bezier(0.22, 1, 0.36, 1)");
  });

  test("a category filter pill transitions on --dur-fast / --ease-out-soft", async ({ page }) => {
    await page.goto("/projects");
    const pill = page.getByRole("group", { name: "Filter projects by category" }).getByRole("button").first();
    const timing = await pill.evaluate((el) => {
      const style = getComputedStyle(el);
      return { duration: style.transitionDuration, easing: style.transitionTimingFunction };
    });
    expect(timing.duration).toContain("0.18s");
    expect(timing.easing).toContain("cubic-bezier(0.22, 1, 0.36, 1)");
  });

  test("the chatbot launcher transitions on --dur-fast / --ease-out-soft", async ({ page }) => {
    await page.goto("/");
    const launcher = page.getByRole("link", { name: "Ask about my work" });
    const timing = await launcher.evaluate((el) => {
      const style = getComputedStyle(el);
      return { duration: style.transitionDuration, easing: style.transitionTimingFunction };
    });
    expect(timing.duration).toContain("0.18s");
    expect(timing.easing).toContain("cubic-bezier(0.22, 1, 0.36, 1)");
  });

  test("an inline prose link transitions on --dur-base / --ease-out-soft", async ({ page }) => {
    // Concept C (2026-08-22) moved every case-study action link (top row,
    // footer row, "Related projects") onto LinkButton pills -- InlineLink no
    // longer renders anywhere on /work/[slug]. It still renders on /projects
    // (ProjectCard's "Live ↗"/"Source ↗" links), which is where this now
    // points. InlineLink's own decoration-border class (components/inline-
    // link.tsx) is unique to it sitewide, so no arrow-text disambiguation
    // against LinkButton is needed here the way it was on the old page.
    await page.goto("/projects");
    const link = page.locator("a.decoration-border").first();
    const timing = await link.evaluate((el) => {
      const style = getComputedStyle(el);
      return { duration: style.transitionDuration, easing: style.transitionTimingFunction };
    });
    expect(timing.duration).toContain("0.32s");
    expect(timing.easing).toContain("cubic-bezier(0.22, 1, 0.36, 1)");
  });
});
