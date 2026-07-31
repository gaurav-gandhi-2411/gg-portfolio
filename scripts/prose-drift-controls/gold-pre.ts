import type { CaseStudy } from "../../content/types";

// Real text this site shipped before wave 19's correction (source: git commit
// 24a258d, content/case-studies/gold-rate-tracker.ts) — the inverted Tanishq/
// IBJA data-source architecture. Trimmed to only the fields
// scripts/check-prose-drift.mjs's buildProseBundle() reads (problem, approach,
// architecture, closing) — see scripts/prose-drift-controls/README.md.
type ProseFixture = Pick<CaseStudy, "problem" | "approach" | "architecture" | "closing">;

export const goldRateTracker: ProseFixture = {
  problem: [
    "Indian retail gold buyers want to know today's Tanishq 22K jewelry price and whether now is a good time to buy — without paying for a subscription service, and without trusting a forecast that's really just marketing dressed up as intelligence.",
    "The project's real differentiator isn't a clever model. It's a willingness to refuse shipping a price-prediction feature that doesn't actually beat a trivially simple baseline — even though \"AI predicts gold prices\" is a far more exciting headline than \"tomorrow will probably look like today.\"",
  ],
  approach: [
    "A GitHub Actions cron job scrapes Tanishq's live 22K/24K/18K gold rates every three hours — a plain HTTP fetch first, falling back to a full browser (Playwright) only if that fails — and appends the reading to a committed prices.json file. Those raw retail prices are calibrated against the IBJA benchmark rate using a HuberRegressor (a regression method that's resistant to occasional bad data points), producing a consistent premium factor.",
    "The headline forecast shown to users is deliberately a naive flat-hold: tomorrow's price is predicted to be whatever today's price is. That's the model that ships, because measured honestly, nothing more sophisticated has beaten it yet.",
    "A small time-series model, Chronos-Bolt-Tiny, still runs every cycle as a \"directional companion\" — but its output is suppressed from the user interface (internally labeled \"DARK\") because it fails a pre-registered statistical bar for being trustworthy enough to show.",
    "Everything renders as an installable static Progressive Web App on GitHub Pages, reading the committed JSON files directly with no backend server, and price-drop alerts go out over ntfy.sh. The entire stack runs for ₹0 a month.",
  ],
  architecture: {
    intro:
      "A scraper feeds a naive baseline that ships, and a small ML model that runs in parallel but stays dark unless it earns its place.",
    stages: [
      { label: "Tanishq price page", kind: "input", detail: "22K/24K/18K retail gold rates" },
      {
        label: "Scraper (GitHub Actions, every 3h)",
        detail: "plain HTTP fetch, Playwright browser fallback",
      },
      { label: "prices.json", detail: "committed to the repo — the durable price history" },
      {
        label: "IBJA-calibrated naive flat-hold forecast",
        detail: "HuberRegressor premium factor; tomorrow = today — the headline shown to users",
      },
      {
        label: "Chronos-Bolt-Tiny directional probe",
        detail:
          "runs every cycle, feeds only notification triggers — kept DARK, not shown as a forecast",
      },
      { label: "ntfy.sh alerts", detail: "price-move, daily digest, and data-staleness notifications" },
      {
        label: "GitHub Pages PWA",
        kind: "output",
        detail: "static site reads data/*.json directly, no server in the loop",
      },
    ],
    note:
      "Total infrastructure cost: ₹0/month, running entirely on GitHub Actions, GitHub Pages, and ntfy.sh free tiers.",
  },
  closing: [
    "If you're evaluating whether an ML feature is actually earning its complexity, this is the bar worth holding yourself to: define the promotion gate and the real baseline before you see the result, and if the naive baseline wins, that's the finding to ship — not the one to quietly bury.",
  ],
};
