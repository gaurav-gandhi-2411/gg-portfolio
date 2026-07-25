import { expect, test } from "@playwright/test";

/**
 * Structural presence + well-formedness only (fast, deterministic, safe as
 * a required CI gate). Actual third-party reachability (does GitHub/HF/the
 * live demo respond 200 right now) is a live-network concern — that's
 * scripts/refresh-metrics.mjs's link-health check (report-only, weekly)
 * and this wave's manual production audit
 * (reports/wave14-verification-audit-2026-07-26.md), not something a
 * required merge-blocking check should depend on third-party uptime for.
 */

const EXPECTED_PROFILE_HOSTS = [
  "github.com/gaurav-gandhi-2411",
  "linkedin.com/in/gauravgandhi03",
  "huggingface.co/gauravgandhi2411",
];

test.describe("external links", () => {
  test("home's social/profile links are all present and well-formed", async ({ page }) => {
    await page.goto("/");
    for (const host of EXPECTED_PROFILE_HOSTS) {
      // Appears at least once (hero row + Contact both link it) — count,
      // not toHaveCount(1), since duplication across sections is expected.
      expect(await page.locator(`a[href*="${host}"]`).count(), host).toBeGreaterThan(0);
    }
    const mailto = page.locator('a[href^="mailto:"]').first();
    await expect(mailto).toHaveAttribute("href", /^mailto:[^@]+@[^@]+\.[^@]+$/);
  });

  test("every project card exposes a well-formed Source link, and Live links open in a new tab", async ({
    page,
  }) => {
    await page.goto("/projects");
    const cards = page.locator(".project-grid article");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const source = card.getByRole("link", { name: "Source ↗" });
      if (await source.count()) {
        const href = await source.getAttribute("href");
        expect(href).toMatch(/^https:\/\/(github\.com|pypi\.org)\//);
        await expect(source).toHaveAttribute("target", "_blank");
        await expect(source).toHaveAttribute("rel", /noreferrer/);
      }
      const live = card.getByRole("link", { name: "Live ↗" });
      if (await live.count()) {
        const href = await live.getAttribute("href");
        expect(href).toMatch(/^https:\/\//);
        await expect(live).toHaveAttribute("target", "_blank");
      }
    }
  });

  test("no internal link on the home page 404s (same-origin nav check)", async ({ page }) => {
    await page.goto("/");
    const internalHrefs = await page.$$eval('a[href^="/"]', (as) =>
      Array.from(new Set(as.map((a) => a.getAttribute("href")).filter((h): h is string => !!h)))
    );
    expect(internalHrefs.length).toBeGreaterThan(0);
    for (const href of internalHrefs) {
      const response = await page.request.get(href);
      expect(response.status(), href).toBeLessThan(400);
    }
  });
});
