import { expect, test } from "@playwright/test";

/**
 * Every results-section metric on a case-study page is wrapped in a
 * source-reveal disclosure (components/metric-provenance.tsx) — tap/click
 * toggles a real APG disclosure (button + aria-expanded/aria-controls), and
 * the same `data-open` state drives an opacity reveal a mouse hover also
 * triggers via `group-hover` (untestable headlessly without a hover-capable
 * pointer, so only the click/tap path is exercised here — the mobile
 * Playwright project covers the touch case for free since both use the
 * same click event).
 */
test.describe("Case-study metric provenance", () => {
  test("tap reveals a structured source (metrics.json-backed metric, direct GitHub link)", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");

    const trigger = page.getByRole("button", {
      name: /show source for Component classifier accuracy/,
    });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    const panel = page.getByRole("group", { name: /Source for Component classifier accuracy/ });
    await expect(panel).toHaveCSS("opacity", "1");
    await expect(panel).toContainText("README.md");
    const link = panel.getByRole("link").first();
    await expect(link).toHaveAttribute("href", /github\.com\/gaurav-gandhi-2411\/triage-iq\/blob\//);

    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // A real desktop cursor sits on the trigger right after `.click()` —
    // the hover-preview layer (`group-hover/prov`) legitimately keeps the
    // panel open under a real mouse even though the click-toggle state is
    // now closed. Move away to observe the actual closed state.
    await page.mouse.move(0, 0);
    await expect(panel).toHaveCSS("opacity", "0");
  });

  test("a prose-parsed metric (provenance.md-only, no metrics.json entry) shows the row text verbatim, not a synthesized citation link", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");

    const trigger = page.getByRole("button", {
      name: /show source for Resolution-time interval coverage/,
    });
    await trigger.click();

    const panel = page.getByRole("group", { name: /Source for Resolution-time interval coverage/ });
    await expect(panel).toHaveCSS("opacity", "1");
    await expect(panel).toContainText("Cited in provenance.md");
    // the raw provenance.md Source cell text, unprocessed — proves this
    // isn't a parser-derived citation
    await expect(panel).toContainText("0010-conformal-quantile-regression.md");
    // GG's 2026-08-06 call: a prose-tier metric never renders this
    // component's own regex-extracted file citation as a link (a wrong
    // citation next to a real number is worse than no citation) — the
    // only link is to the site's own provenance.md, never a parsed path.
    const links = panel.getByRole("link");
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveAttribute(
      "href",
      "https://github.com/gaurav-gandhi-2411/gg-portfolio/blob/main/content/provenance.md"
    );
  });

  test("a repo-qualified citation path (`triage-iq/docs/...`) appears verbatim in the raw text but is never turned into a synthesized link", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");

    const trigger = page.getByRole("button", {
      name: /show source for LLM fabrication rate/,
    });
    await trigger.click();

    const panel = page.getByRole("group", { name: /Source for LLM fabrication rate/ });
    await expect(panel).toHaveCSS("opacity", "1");
    await expect(panel).toContainText("docs/architecture/adr/0018-gold-set-train-contamination.md");
    const links = panel.getByRole("link");
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveAttribute(
      "href",
      "https://github.com/gaurav-gandhi-2411/gg-portfolio/blob/main/content/provenance.md"
    );
  });

  test("a metrics.json-backed metric still renders its clean citation link (structured tier is unaffected by the prose fallback's fail-closed handling)", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");

    const trigger = page.getByRole("button", {
      name: /show source for Component classifier accuracy/,
    });
    await trigger.click();

    const panel = page.getByRole("group", { name: /Source for Component classifier accuracy/ });
    await expect(panel).toHaveCSS("opacity", "1");
    await expect(panel).toContainText("Verified source");
    const link = panel.getByRole("link").first();
    await expect(link).toHaveAttribute("href", /github\.com\/gaurav-gandhi-2411\/triage-iq\/blob\//);
  });
});
