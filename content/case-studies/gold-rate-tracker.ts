import type { CaseStudy } from "../types";

// Sources: gold-rate-tracker repo (README.md, docs/adr/005-honest-baseline-reporting.md,
// docs/adr/012, docs/adr/019, docs/DIRECTION_SIGNAL_STATUS.md, data/backtest.json) —
// see provenance.md's Gold Rate Tracker section.
export const goldRateTracker: CaseStudy = {
  slug: "gold-rate-tracker",
  title: "Gold Rate Tracker",
  dek: "A free-tier gold-price PWA that refused to ship an \"AI predicts prices\" feature once the honest baseline beat it.",
  depth: "full",
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
        detail: "runs every cycle, feeds only notification triggers — kept DARK, not shown as a forecast",
      },
      {
        label: "ntfy.sh alerts",
        detail: "price-move, daily digest, and data-staleness notifications",
      },
      {
        label: "GitHub Pages PWA",
        kind: "output",
        detail: "static site reads data/*.json directly, no server in the loop",
      },
    ],
    note: "Total infrastructure cost: ₹0/month, running entirely on GitHub Actions, GitHub Pages, and ntfy.sh free tiers.",
  },
  decisions: [
    {
      title: "Ship the naive flat-hold as the headline, not the ML model",
      body: "A 165-fold walk-forward backtest (a test that repeatedly trains on the past and checks the very next prediction, sliding forward through time) showed Chronos-Bolt-Tiny performing 10.4% worse than the naive flat-hold on mean absolute error, with the difference statistically significant (p=0.0089). Shipping the model anyway as the headline number would violate the project's own honest-baseline-reporting rule, so the naive forecast ships instead.",
      sourceRef: "gold-rate-tracker:headline",
    },
    {
      title: "Corrected the direction-signal baseline from a coin flip to the true base rate",
      body: "The project had been comparing its \"predict tomorrow's direction\" accuracy against 50%, the textbook baseline for a binary yes/no signal. But gold's price rises roughly 70% of the time in this data, so \"always predict up\" alone beats 50% for free — the real baseline is 69.7–75.5%, not 50%, and the model has to clear that higher bar to mean anything.",
      sourceRef: "gold:direction-baseline",
    },
    {
      title: "Model promotion is pre-registered and falsifiable",
      body: "Chronos only graduates from \"directional companion\" to a shown forecast if a backtest of at least 250 folds beats the naive baseline on mean absolute error with a Wilcoxon signed-rank test p-value under 0.05 — a bar written down in advance, not adjusted after seeing the result.",
      sourceRef: "gold:promotion-gate",
    },
    {
      title: "Stop iterating and wait — because the sample size can't currently detect a real edge",
      body: "A Monte Carlo power analysis found that at the current sample size (93 folds), only an implausibly large ~21 percentage-point accuracy edge would even be detectable at standard statistical power. Rather than keep tuning a model that can't be evaluated yet, the project computed the sample size needed and set a revisit date instead of guessing.",
      sourceRef: "gold:power-analysis",
    },
  ],
  results: [
    {
      label: "Naive flat-hold vs. Chronos-Bolt-Tiny (194-fold backtest, horizon 5 days)",
      value: "MAE 258.28 vs. 297.19 — naive wins by ~15%",
      detail: "Wilcoxon signed-rank p=0.0003 — the naive baseline's advantage is real, not noise",
      sourceRef: "gold-rate-tracker:headline",
    },
    {
      label: "Chronos direction accuracy",
      value: "52.06%",
      detail: "barely above a coin flip, and below the true ~70% regime base rate",
      sourceRef: "gold:direction-baseline",
    },
    {
      label: "Direction-signal promotion gate",
      value: "DARK at both horizons tested",
      detail: "h=1: logistic model 49.5% vs. 53.8% base rate (p=0.42, n=93); h=2: 60.9% vs. 62.0% base rate (p=1.0, n=92)",
      sourceRef: "gold:direction-baseline",
    },
    {
      label: "Infrastructure cost",
      value: "₹0/month",
      detail: "GitHub Actions + GitHub Pages + ntfy.sh, all free tiers",
      sourceRef: "gold:zero-cost",
    },
  ],
  story: {
    title: "A baseline correction flipped \"the model works\" into \"the model has zero verified edge\" — and shipped anyway",
    body: [
      "Early on, the project reported directional-accuracy figures of 55.8% and 63.3% as beating \"the 50% naive floor\" — the standard textbook baseline for a binary up/down signal. That comparison looked reasonable, and it made the model look genuinely useful.",
      "A review caught the flaw: 50% is only the right baseline when the series is roughly balanced between up and down moves. Gold's price in this data rose roughly 70% of the time, which means a trivial rule — \"always predict up,\" no model required — already beats 50% by a wide margin. Once that true base rate was used as the comparison instead, the model's advantage didn't just shrink. It disappeared: on every window tested, the always-predict-up rule matched or beat the trained model.",
      "The project wrote this up as an architecture decision record rather than quietly keeping the more flattering 50%-baseline comparison, and turned the directional signal off in the live product. The honest version of the finding is less exciting than \"the model beats a coin flip,\" but it's the one that's actually true, and it's the one that shipped.",
    ],
    sourceRef: "gold:direction-baseline",
  },
  links: [
    { label: "Live tracker", href: "https://gaurav-gandhi-2411.github.io/gold-rate-tracker/" },
    { label: "Source on GitHub", href: "https://github.com/gaurav-gandhi-2411/gold-rate-tracker" },
  ],
};
