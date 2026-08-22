import { expect, test } from "@playwright/test";

/**
 * Every results-section metric on a case-study page is wrapped in a
 * source-reveal disclosure (components/metric-provenance.tsx) — click/tap
 * toggles a real APG disclosure (button + aria-expanded/aria-controls), and
 * the same `data-open` state drives the opacity reveal. Opening any one
 * closes every other panel on the page (a shared exclusive store, production
 * audit 2026-08-22) — click/tap is the only way in or out, on desktop and
 * mobile alike, so the mobile Playwright project exercises the same code
 * path as desktop rather than a separate touch affordance.
 */
test.describe("Case-study metric provenance", () => {
  test("opening a second metric's source closes the first — at most one panel open at once (production audit, 2026-08-22)", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");

    // Deliberately the first and last results on the page (not two adjacent
    // ones): on the 390px single-column layout an open panel can overlap the
    // very next row (a separate, pre-existing spatial issue — panels are
    // capped and dismiss on outside-click, but two adjacent metrics can
    // still visually collide), which would make this test about exclusivity
    // flaky for reasons that have nothing to do with what it's checking.
    const first = page.getByRole("button", {
      name: /show source for Component classifier top-3 accuracy \(vscode\)/,
    });
    const second = page.getByRole("button", {
      name: /show source for LLM fabrication rate/,
    });
    const firstPanel = page.getByRole("group", {
      name: /Source for Component classifier top-3 accuracy \(vscode\)/,
    });
    const secondPanel = page.getByRole("group", {
      name: /Source for LLM fabrication rate/,
    });

    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await expect(firstPanel).toHaveCSS("opacity", "1");

    await second.click();
    await expect(second).toHaveAttribute("aria-expanded", "true");
    await expect(secondPanel).toHaveCSS("opacity", "1");
    // The bug this regression-tests: the first panel used to stay open too,
    // each capable of covering unrelated content behind it.
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await expect(firstPanel).toHaveCSS("opacity", "0");
  });

  test("tap reveals a structured source (metrics.json-backed metric, direct GitHub link)", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");

    const trigger = page.getByRole("button", {
      name: /show source for Component classifier top-3 accuracy \(vscode\)/,
    });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    const panel = page.getByRole("group", { name: /Source for Component classifier top-3 accuracy \(vscode\)/ });
    await expect(panel).toHaveCSS("opacity", "1");
    await expect(panel).toContainText("README.md");
    const link = panel.getByRole("link").first();
    await expect(link).toHaveAttribute("href", /github\.com\/gaurav-gandhi-2411\/triage-iq\/blob\//);

    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toHaveCSS("opacity", "0");
  });

  test("a prose-parsed metric (provenance.md-only, no metrics.json entry) shows the row text verbatim, not a synthesized citation link", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");

    // "Resolution-time interval coverage" (triageiq:cqr-coverage) used to be
    // this test's example, but issue #45's sourceRef-split fix gave it its
    // own content/metrics.json entry — it's structured-tier now (see the
    // dedicated regression test below). "Resolution-time predictor MAE"
    // (triageiq:resolution) has no metrics.json entry, so it stays a clean
    // example of the prose-only path.
    const trigger = page.getByRole("button", {
      name: /show source for Resolution-time predictor MAE/,
    });
    await trigger.click();

    const panel = page.getByRole("group", { name: /Source for Resolution-time predictor MAE/ });
    await expect(panel).toHaveCSS("opacity", "1");
    await expect(panel).toContainText("Cited in provenance.md");
    // the raw provenance.md Source cell text, unprocessed — proves this
    // isn't a parser-derived citation
    await expect(panel).toContainText("README.md:91-98");
    // GG's 2026-08-06 call: a prose-tier metric never renders this
    // component's own regex-extracted file citation as a link (a wrong
    // citation next to a real number is worse than no citation). GG's
    // launch-review round three: no link at all for this tier any more,
    // not even to the site's own provenance.md — the source text alone
    // is the citation now.
    await expect(panel.getByRole("link")).toHaveCount(0);
  });

  test("the CQR coverage metric resolves via metrics.json to the shipped figure, not the design-decision ADR's earlier exploratory numbers (regression test, issue #45)", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");

    const trigger = page.getByRole("button", {
      name: /show source for Resolution-time CQR interval coverage \(kubernetes\)/,
    });
    await trigger.click();

    const panel = page.getByRole("group", { name: /Source for Resolution-time CQR interval coverage \(kubernetes\)/ });
    await expect(panel).toHaveCSS("opacity", "1");
    // structured tier, backed by content/metrics.json's own
    // triageiq:cqr-coverage entry — proves this no longer shares sourceRef
    // "triageiq:cqr" with the CQR design-decision text below it, which cites
    // the ADR's earlier, uncalibrated 74.4%/38.2% numbers, not this row's
    // shipped 76.2%/74.6%.
    await expect(panel).toContainText("Verified source");
    await expect(panel).not.toContainText("0010-conformal-quantile-regression");
    const link = panel.getByRole("link").first();
    await expect(link).toHaveAttribute(
      "href",
      /github\.com\/gaurav-gandhi-2411\/triage-iq\/blob\/.*README\.md/
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
    await expect(panel.getByRole("link")).toHaveCount(0);
  });

  test("a metrics.json-backed metric still renders its clean citation link (structured tier is unaffected by the prose fallback's fail-closed handling)", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");

    const trigger = page.getByRole("button", {
      name: /show source for Component classifier top-3 accuracy \(vscode\)/,
    });
    await trigger.click();

    const panel = page.getByRole("group", { name: /Source for Component classifier top-3 accuracy \(vscode\)/ });
    await expect(panel).toHaveCSS("opacity", "1");
    await expect(panel).toContainText("Verified source");
    const link = panel.getByRole("link").first();
    await expect(link).toHaveAttribute("href", /github\.com\/gaurav-gandhi-2411\/triage-iq\/blob\//);
  });
});
