import { expect, test } from "@playwright/test";

// Vercel's CDN sets Content-Disposition: inline for statically-served PDFs
// as a platform behavior — next.config.ts has no headers() rule for it
// (verified: none exists), and Next's local `next start` static file
// server doesn't set this header at all. So this is real, verified
// behavior on the deployed site (confirmed manually this wave against the
// production URL — see reports/wave14-verification-audit-2026-07-26.md),
// but structurally unobservable against the local build CI runs against.
// Assert it only when targeting a real deployment, not localhost.
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000");

test.describe("resume link", () => {
  test("opens the PDF inline in a new tab — never a forced download", async ({ page, context }) => {
    await page.goto("/");
    const resumeLink = page.getByRole("link", { name: "View Resume" });
    await expect(resumeLink).toHaveAttribute("href", "/resume.pdf");
    await expect(resumeLink).toHaveAttribute("target", "_blank");
    await expect(resumeLink).not.toHaveAttribute("download");

    const [newPage] = await Promise.all([context.waitForEvent("page"), resumeLink.click()]);
    // No waitForLoadState at all: a direct PDF navigation has no HTML to
    // parse, so "domcontentloaded" never fires, and Chromium's built-in
    // PDF viewer keeps a long-lived connection open, so "load"/
    // "networkidle" don't reliably resolve either. Poll the URL directly
    // instead — the "new tab" half of the requirement. The "inline,
    // correct content-type" half is verified below via a direct request,
    // sidestepping the fact that the PDF viewer can present the resource
    // under an internal chrome-extension:// URL rather than the original
    // path.
    await expect.poll(() => newPage.url(), { timeout: 10_000 }).not.toBe("about:blank");

    const response = await page.request.get("/resume.pdf");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    // "inline", not "attachment" — the site's explicit requirement that
    // the resume VIEWS rather than force-downloads. Platform-dependent
    // (see the isLocal comment above) — asserted only against a real
    // deployment.
    if (!isLocal) {
      expect(response.headers()["content-disposition"] ?? "").toContain("inline");
    }
  });

  test("the Experience section's resume link matches the hero's", async ({ page }) => {
    await page.goto("/");
    const experienceLink = page.getByRole("link", { name: "View the full resume" });
    await expect(experienceLink).toHaveAttribute("href", "/resume.pdf");
    await expect(experienceLink).toHaveAttribute("target", "_blank");
  });
});
