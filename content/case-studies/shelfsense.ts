import type { CaseStudy } from "../types";

// Sources: shelfsense-m5 repo (README.md, docs/ARCHITECTURE.md,
// reports/leaderboard.md, PLAN.md) — see provenance.md's ShelfSense section.
export const shelfsense: CaseStudy = {
  slug: "shelfsense",
  verifiedAt: "2026-10-10", // issue #123 -- re-checked against source 2026-10-10 (date bump only; no numbers or wording changed)
  title: "ShelfSense",
  dek: "Demand forecasting for 30,490 retail item×store series, 36% lower private-leaderboard WRMSSE than the seasonal-naive baseline, reached partly by catching an evaluation harness that had been silently flipping which models actually won.",
  depth: "full",
  problem: [
    "Retailers need to forecast how much of each item each store will sell, every day, for thousands of item×store combinations at once, get it wrong and you either run out of stock or waste money on inventory that doesn't move. ShelfSense is a portfolio project built on Kaggle's M5 Forecasting Accuracy competition (the Walmart demand-forecasting dataset), demonstrating production-grade forecasting engineering rather than a one-off notebook.",
    "The dataset is genuinely hard: 30,490 series, and 68% of item-days sell exactly zero units. Per-series models that aren't built for that collapse on it: on the sparsest HOBBIES items they have no signal and fall back to forecasting zero.",
  ],
  approach: [
    "Raw sales, calendar, and price CSVs are first validated against Pandera schemas (a library that checks data against a declared structure, types, ranges, nullability, and fails loudly if it doesn't match) before anything downstream touches them.",
    "From validated data, a 42-feature matrix (38 numeric plus 4 hierarchy categoricals) is built per store, lag features (past sales at fixed offsets), rolling statistics, calendar signals, price signals, and hierarchy features, and written out as per-store parquet batches.",
    "Seven LightGBM model variants are trained on that feature matrix (the ylags variant adds three annual lags, lag_91/182/364, for 45 features). Six use Tweedie loss (a loss function suited to zero-inflated count data) and one, rmse_mh, is an RMSE control. Hyperparameters come from Optuna (automated hyperparameter search); tvp_17 and rmse_mh reuse tvp_13's search. The winning approach trains 28 separate models, one per forecast horizon day, rather than one model that recursively feeds its own predictions back in as input. The pipeline's ensemble step can blend all seven with Optuna-searched weights, but the best submitted score (0.5693) came from the single tvp=1.3 variant; the store×dept + tvp=1.3 ensemble scored 0.5748.",
    "The whole pipeline is orchestrated by Dagster (22 assets, 26 automated asset checks), experiments are tracked in MLflow, configuration is managed with Hydra, and the raw data itself is versioned with DVC, so any run can be reproduced exactly.",
  ],
  architecture: {
    intro:
      "A validated feature pipeline feeds seven independently-trained model variants, each attacking the same 30,490 series from a different angle, which an Optuna-weighted ensemble step can blend; the best submission came from one of them, tvp=1.3.",
    stages: [
      {
        label: "Raw M5 data",
        kind: "input",
        detail: "sales, calendar, prices, 30,490 item×store series",
      },
      { label: "Pandera schema validation", detail: "fails loudly on type/range/null violations" },
      {
        label: "Feature engineering",
        detail: "42 features: 38 numeric (lags, rolling stats, calendar, price) + 4 hierarchy categoricals, per-store parquet",
      },
      { label: "Feature validation", detail: "second Pandera pass on the engineered matrix" },
      {
        label: "7 LightGBM variants",
        detail: "Tweedie loss (rmse_mh is an RMSE control), Optuna-searched params, 28 direct per-horizon models in the winning variant",
        parallel: [
          { label: "tvp_13 / tvp_17" },
          { label: "rmse_mh" },
          { label: "store_dept" },
          { label: "ylags" },
          { label: "per_store / per_dept" },
        ],
      },
      { label: "Ensemble", detail: "combines per-variant predictions" },
      { label: "Kaggle submission", kind: "output", detail: "scored against private leaderboard WRMSSE" },
    ],
    note: "Cross-cutting: Dagster orchestration (22 assets, 26 asset checks), MLflow experiment tracking, Hydra config, DVC data versioning.",
  },
  decisions: [
    {
      title: "Tweedie loss instead of RMSE, because 68% of the data is zero",
      body: "Standard RMSE (root mean squared error) treats every prediction error equally, but with 68% zero-inflated demand it penalises zero predictions on intermittent series as regression errors. Tweedie loss rewards them instead and is built for exactly this shape of data, and switching to it measured a +0.02 WRMSSE gain, a real number, not a hunch.",
      sourceRef: "shelfsense:tweedie",
    },
    {
      title: "28 direct per-horizon models instead of one recursive model",
      body: "A recursive forecaster predicts day 1, then feeds that prediction back in as input to predict day 2, and so on, so early errors compound forward. Training a separate model per horizon day avoids that compounding entirely, at the cost of more models to train. The measured cost of going recursive: on the private leaderboard the global LightGBM approach scored 0.8138 forecasting recursively against 0.6095 with 28 direct per-horizon models.",
      sourceRef: "shelfsense:direct-horizon",
    },
    {
      title: "One global model across all series, not one model per series",
      body: "Classical per-series models (like ETS, a smoothing-based method fit separately to each individual series) collapse on sparse series with little history: on the 333 lowest-selling HOBBIES series in the classical sample, ETS scored 3.27 WRMSSE. A single LightGBM model trained across all series at once can borrow statistical strength from the busier series to help the sparse ones. Exploratory analysis predicted this before any model was trained: 68% of item-days are zero and 55% of series are lumpy or erratic. Classical methods ran only on a stratified 1,000-series sample, since all 30,490 would take about 7 hours for ETS and 33 for ARIMA; the best, ETS, reached 0.6541 WRMSSE there, but its Kaggle submission only matched the seasonal-naive baseline (0.8377), as 1,000 series carry too little revenue weight to move the full-catalogue score.",
      sourceRef: "shelfsense:global-model",
    },
    {
      title: "Schema validation at every persistence boundary, because it caught a real bug",
      body: "Pandera schemas are enforced everywhere data is written to disk, not just once at ingestion. This isn't theoretical rigor, it caught an actual NaN (missing-value) bug in the d_num day-index column during feature generation before it silently corrupted downstream features.",
      sourceRef: "shelfsense:pandera",
    },
  ],
  results: [
    {
      label: "Best private-leaderboard WRMSSE",
      headline: true,
      value: "0.5693",
      detail: "a 36% reduction against the naive-seasonal baseline below, that percentage is derived from the two, not printed in the leaderboard",
      sourceRef: "shelfsense:wrmsse",
    },
    {
      label: "Naive-seasonal (Seasonal Naive 28) reference baseline",
      headline: true,
      value: "0.8956",
      detail: "the reference the model is measured against, same leaderboard, same commit",
      sourceRef: "shelfsense:wrmsse-baseline",
    },
    {
      label: "HOBBIES: per-series ETS on the sparsest-HOBBIES sample vs global LightGBM on all HOBBIES",
      headline: true,
      value: "3.2663 → 0.6112",
      detail: "different series sets and re-normalised weights, so not like-for-like; on the same sample, seasonal naive scored 1.5949, so per-series ETS was worse than naive there",
      sourceRef: "shelfsense:hobbies",
    },
    {
      label: "Honest ceiling",
      value: "competition winner: 0.520 · this repo's realistic ceiling without GPU compute: 0.53–0.55",
      detail: "111 unit tests, 60%+ coverage; SARIMA was abandoned after its parallel worker processes were killed (most likely out of memory) at series 442 of 1,000, three hours in",
      sourceRef: "shelfsense:val-divergence",
    },
  ],
  story: {
    title: "Caught an evaluation harness reporting the wrong winner, four models that looked better on validation had actually gotten worse",
    body: [
      "Four new model variants were added late in the project, and every one of them looked like an improvement, on the 28-day validation holdout used to pick a winner before submitting to Kaggle. Then the private leaderboard scores came back, and all four had reversed.",
      "The clearest example: RMSE-MH scored 0.6699 on validation against the tvp=1.3 champion's 0.6860, a clear win on paper. On the private leaderboard, RMSE-MH scored 0.6205 against the champion's 0.5693, a clear loss. The direction of the result flipped depending on which window of time you measured it on.",
      "The root cause wasn't a modeling mistake, it was a measurement mistake: the validation window and the private-leaderboard evaluation window aren't statistically exchangeable, they cover different periods with different demand patterns, so a model that fits one doesn't necessarily generalize to the other. The honest conclusion was that the harness itself was the bug, not the models it was rejecting or accepting. Walk-forward cross-validation (evaluating across multiple rolling time windows instead of one fixed split) became the project's top roadmap item as a direct result.",
    ],
    sourceRef: "shelfsense:val-divergence",
  },
  closing: [
    "If you're choosing between models based on a validation split, this is the check worth running before you trust it: confirm the validation window and the real evaluation window are actually statistically exchangeable, because a harness that silently disagrees with itself is worse than no harness at all.",
  ],
  links: [
    { label: "Source on GitHub", href: "https://github.com/gaurav-gandhi-2411/shelfsense-m5" },
  ],
};
