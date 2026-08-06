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

  test("tap reveals a prose-derived source (provenance.md-only metric, no metrics.json entry)", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");

    const trigger = page.getByRole("button", {
      name: /show source for Resolution-time interval coverage/,
    });
    await trigger.click();

    const panel = page.getByRole("group", { name: /Source for Resolution-time interval coverage/ });
    await expect(panel).toHaveCSS("opacity", "1");
    await expect(panel).toContainText("cqr_conformal_adjustments.json");
  });

  test("a repo-qualified citation path (`triage-iq/docs/...`) is stripped to a real GitHub blob link", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");

    const trigger = page.getByRole("button", {
      name: /show source for LLM fabrication rate/,
    });
    await trigger.click();

    const panel = page.getByRole("group", { name: /Source for LLM fabrication rate/ });
    await expect(panel).toHaveCSS("opacity", "1");
    const link = panel.getByRole("link").first();
    await expect(link).toHaveAttribute(
      "href",
      "https://github.com/gaurav-gandhi-2411/triage-iq/blob/HEAD/docs/architecture/adr/0018-gold-set-train-contamination.md"
    );
  });
});
