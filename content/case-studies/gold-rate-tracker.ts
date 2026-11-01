import type { CaseStudy } from "../types";

// Sources: gold-rate-tracker repo (README.md, docs/adr/005-honest-baseline-reporting.md,
// docs/adr/012, docs/adr/019, docs/DIRECTION_SIGNAL_STATUS.md, data/backtest.json) —
// see provenance.md's Gold Rate Tracker section. Wave 19 (2026-07-31): architecture
// corrected to IBJA-primary per ADR 025 (2026-07-18). Wave refresh-2026-09 (2026-09-23,
// F3/F4): repinned the backtest numbers to commit ad4216086d10a63bb93ed3107c9ccee429cb5fa0
// (209 folds), the exact commit the product repo's own README cites as its frozen
// headline citation — every site surface now agrees with it, not just each other. The
// 165-fold/10.4%/p=0.0089 figure in decisions[0] is a real, distinct, earlier measurement
// (ADR 012, 2026-05-19) — not orphaned, see provenance.md's wave-19 investigation note.
export const goldRateTracker: CaseStudy = {
  slug: "gold-rate-tracker",
  verifiedAt: "2026-09-23", // wave refresh-2026-09 (F3/F4) -- repinned to product repo's frozen SHA citation
  title: "Gold Rate Tracker",
  dek: "A free-tier gold-price PWA, benchmarked honestly enough to publish the case where the naive baseline beat the ML model, and shipped the honest forecast instead of the more exciting one.",
  depth: "full",
  problem: [
    "Indian retail gold buyers want to know today's Tanishq 22K jewelry price and whether now is a good time to buy, without paying for a subscription service, and without trusting a forecast that's really just marketing dressed up as intelligence.",
    "The project's real differentiator isn't a clever model. It's a willingness to refuse shipping a price-prediction feature that doesn't actually beat a trivially simple baseline, even though \"AI predicts gold prices\" is a far more exciting headline than \"tomorrow will probably look like today.\"",
  ],
  approach: [
    "A GitHub Actions cron job, scheduled every three hours, fetches the IBJA (India Bullion and Jewellers Association) benchmark rate, the national reference price, and the primary source since Tanishq's retail site started blocking automated access behind Cloudflare's bot protection. A separate Tanishq scrape runs in its own workflow, at six timed visits a day, on a self-hosted runner (GitHub-hosted runner IPs are blocked by Cloudflare). It tries plain HTTP first, which has succeeded 0 of 37 recent attempts, so in practice it reads the page with a full browser (Playwright). It confirms the IBJA-calibrated estimate against real retail pricing whenever it succeeds; when it doesn't, the IBJA estimate ships on its own. A HuberRegressor (a regression method that's resistant to occasional bad data points) converts the IBJA benchmark into a retail-price estimate, calibrated against historical Tanishq readings.",
    "From launch until 2026-10-02 the headline forecast shown to users was deliberately a naive flat-hold: tomorrow's price is predicted to be whatever today's price is. That's the model that shipped, because measured honestly, nothing more sophisticated had beaten it. On 2026-10-02 a next-day model (ADR 064) took over the headline during its daily window, and on 2026-10-07 another model, P3, became the headline (ADR 069).",
    "A small time-series model, Chronos-Bolt-Tiny, still runs every cycle as a \"directional companion\", but its output is suppressed from the user interface (internally labeled \"DARK\") because it fails a pre-registered statistical bar for being trustworthy enough to show.",
    "Everything renders as an installable static Progressive Web App on GitHub Pages, reading the committed JSON files directly with no backend server, and price-drop alerts go out over ntfy.sh. The entire stack runs for ₹0 a month.",
  ],
  architecture: {
    intro:
      "A scraper feeds a naive baseline that was the headline from 2026-05 to 2026-10 (a different model, P3, has been the headline since 2026-10-07), and a small ML model that runs in parallel but stays dark unless it earns its place.",
    stages: [
      {
        label: "IBJA benchmark rate",
        kind: "input",
        detail: "national reference price, primary source since Tanishq's Cloudflare protection started blocking most automated access",
      },
      {
        label: "IBJA fetch (GitHub Actions, scheduled every 3h)",
        detail: "IBJA benchmark fetch (primary)",
      },
      {
        label: "Tanishq scrape (self-hosted runner, six timed visits a day)",
        detail: "own workflow; plain HTTP first (0 of 37 recent attempts succeeded), Playwright in practice; retail confirmation when it succeeds",
      },
      { label: "prices.json", detail: "committed to the repo, the durable price history" },
      {
        label: "Naive flat-hold forecast",
        detail: "IBJA-calibrated by default, Tanishq-confirmed when fresh; HuberRegressor premium factor; tomorrow = today, the headline shown to users until 2026-10-02, when a next-day model (ADR 064) took over; P3 has been the headline since 2026-10-07 (ADR 069)",
      },
      {
        label: "Chronos-Bolt-Tiny directional probe",
        detail: "runs every cycle as a recorded probe, kept DARK, not shown as a forecast; since ADR 020 it no longer drives alerts",
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
    note: "Total infrastructure cost: ₹0/month. The stack uses GitHub Actions, GitHub Pages, ntfy.sh, a Cloudflare Worker watchdog, GoatCounter and Sentry, plus a self-hosted runner on the owner's laptop for the Tanishq scrape.",
  },
  decisions: [
    {
      title: "Shipped the naive flat-hold as the headline, not the ML model (2026-05 to 2026-10)",
      body: "The original 165-fold walk-forward backtest (2026-05-19, a test that repeatedly trains on the past and checks the very next prediction, sliding forward through time) showed Chronos-Bolt-Tiny performing 10.4% worse than the naive flat-hold on mean absolute error, with the difference statistically significant (p=0.0089), the decision that shipped naive as the headline. Every larger backtest run since (see Results below) has confirmed the same conclusion, not reversed it.",
      // Deliberately its own sourceRef, not gold-rate-tracker:headline: this
      // decision describes the ORIGINAL 165-fold backtest (ADR-012,
      // 2026-05-19), not the current pinned snapshot the headline results
      // row cites. Wave 19 already traced p=0.0089 to ADR-012 (see
      // provenance.md) but never gave it its own citable row — sharing the
      // headline's sourceRef meant the freshness checker looked for a
      // 2026-05-19 p-value inside a 2026-07-26 snapshot and never found it.
      sourceRef: "gold-rate-tracker:original-decision",
    },
    {
      title: "Corrected the direction-signal baseline from a coin flip to the true base rate",
      body: "The project had been comparing its \"predict tomorrow's direction\" accuracy against 50%, the textbook baseline for a binary yes/no signal. But gold's price rises roughly 70% of the time in this data, so \"always predict up\" alone beats 50% for free, the real baseline is 69.7–75.5%, not 50%, and the model has to clear that higher bar to mean anything.",
      sourceRef: "gold:direction-baseline",
    },
    {
      title: "Model promotion is pre-registered and falsifiable",
      body: "Chronos only graduates from \"directional companion\" to a shown forecast if a backtest on at least 250 rows of history beats the naive baseline on mean absolute error with a Wilcoxon signed-rank test p-value under 0.05, a bar written down in advance, not adjusted after seeing the result.",
      sourceRef: "gold:promotion-gate",
    },
    {
      title: "Stop iterating and wait, because the sample size can't currently detect a real edge",
      body: "A Monte Carlo power analysis found that at the sample size of 2026-07-17 (93 folds; the direction harness has since grown to 171 and 165 folds at the two horizons), only an implausibly large ~21 percentage-point accuracy edge would even be detectable at standard statistical power. Rather than keep tuning a model that can't be evaluated yet, the project computed the sample size needed and set a revisit date instead of guessing.",
      sourceRef: "gold:power-analysis",
    },
  ],
  results: [
    {
      label: "Naive flat-hold vs. Chronos-Bolt-Tiny (209-fold backtest, MAE averaged over 1–5 days ahead)",
      value: "249.24 vs. 292.14",
      detail:
        "MAE (₹/g), Chronos is ~17% worse than naive; naive's error is ~14.7% lower (Wilcoxon signed-rank p < 0.001, the naive baseline's advantage is real, not noise)",
      sourceRef: "gold-rate-tracker:headline",
    },
    {
      label: "Chronos direction accuracy",
      value: "51.2%",
      detail: "barely above a coin flip; Chronos was below the always-up base rate on every window ADR 019 tested",
      sourceRef: "gold-rate-tracker:headline",
    },
    {
      label: "ml/direction classifier promotion gate",
      value: "Held DARK at both horizons tested",
      detail: "As of 2026-10-26: h=1: logistic model 49.1% vs. 49.7% always-up (n=171); h=2: 55.8% vs. 56.4% (p=1.00, n=165). The earlier figures on this page (48.5% vs. 50.8%, 60.9% vs. 57.8%) came from a training window that leaked future labels. A separate next-rate model's up/down line passed its own gate and went live 2026-10-02 (ADR 064).",
      sourceRef: "gold:direction-baseline",
      format: "prose",
    },
    {
      label: "Infrastructure cost",
      value: "₹0/month",
      detail: "GitHub Actions, GitHub Pages, ntfy.sh, a Cloudflare Worker watchdog, GoatCounter and Sentry, plus a self-hosted laptop runner; the repo states it costs nothing to run",
      sourceRef: "gold:zero-cost",
    },
  ],
  story: {
    title: "Corrected its own baseline from a 50% coin-flip to gold's real ~70% base rate, and that correction made the model's edge disappear",
    body: [
      "Early on, the project reported directional-accuracy figures of 55.8% and 63.3% as beating \"the 50% naive floor\", the standard textbook baseline for a binary up/down signal. That comparison looked reasonable, and it made the model look genuinely useful.",
      "A review caught the flaw: 50% is only the right baseline when the series is roughly balanced between up and down moves. Gold's price in this data rose roughly 70% of the time, which means a trivial rule, \"always predict up,\" no model required, already beats 50% by a wide margin. Once that true base rate was used as the comparison instead, the model's advantage didn't just shrink. It disappeared: on every window tested, the always-predict-up rule beat the model, which sat below the base rate on every window.",
      "The project wrote this up as an architecture decision record rather than quietly keeping the more flattering 50%-baseline comparison, and turned the directional signal off in the live product. The honest version of the finding is less exciting than \"the model beats a coin flip,\" but it's the one that's actually true, and it's the one that shipped. A different model later passed the same kind of gate on its own out-of-sample record, and the up/down line returned on 2026-10-02 (ADR 064).",
    ],
    sourceRef: "gold:direction-baseline",
  },
  closing: [
    "If you're evaluating whether an ML feature is actually earning its complexity, this is the bar worth holding yourself to: define the promotion gate and the real baseline before you see the result, and if the naive baseline wins, that's the finding to ship, not the one to quietly bury.",
  ],
  links: [
    { label: "Live tracker", href: "https://gaurav-gandhi-2411.github.io/gold-rate-tracker/" },
    { label: "Source on GitHub", href: "https://github.com/gaurav-gandhi-2411/gold-rate-tracker" },
  ],
};
