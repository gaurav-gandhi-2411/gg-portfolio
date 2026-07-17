import type { CaseStudy } from "../types";

// Sources: shelfsense-m5 repo (README.md, docs/ARCHITECTURE.md,
// reports/leaderboard.md, PLAN.md) — see provenance.md's ShelfSense section.
export const shelfsense: CaseStudy = {
  slug: "shelfsense",
  title: "ShelfSense",
  dek: "Demand forecasting for 30,490 retail item×store series — and the story of an evaluation harness that lied about which models actually won.",
  depth: "full",
  problem: [
    "Retailers need to forecast how much of each item each store will sell, every day, for thousands of item×store combinations at once — get it wrong and you either run out of stock or waste money on inventory that doesn't move. ShelfSense is a portfolio project built on Kaggle's M5 Forecasting Accuracy competition (the Walmart demand-forecasting dataset), demonstrating production-grade forecasting engineering rather than a one-off notebook.",
    "The dataset is genuinely hard: 30,490 series, and 68% of item-days sell exactly zero units. A model that isn't built for that will systematically over-forecast the long tail of slow-moving items.",
  ],
  approach: [
    "Raw sales, calendar, and price CSVs are first validated against Pandera schemas (a library that checks data against a declared structure — types, ranges, nullability — and fails loudly if it doesn't match) before anything downstream touches them.",
    "From validated data, a 38-feature matrix is built per store — lag features (past sales at fixed offsets), rolling statistics, calendar signals, price signals, and hierarchy features — and written out as per-store parquet batches.",
    "Seven LightGBM model variants are trained on that feature matrix using Tweedie loss (a loss function suited to zero-inflated count data), each tuned with Optuna (automated hyperparameter search). The winning approach trains 28 separate models, one per forecast horizon day, rather than one model that recursively feeds its own predictions back in as input. The seven variants are then ensembled into the final submission.",
    "The whole pipeline is orchestrated by Dagster (22 assets, 20 automated data-quality checks), experiments are tracked in MLflow, configuration is managed with Hydra, and the raw data itself is versioned with DVC — so any run can be reproduced exactly.",
  ],
  architecture: {
    intro:
      "A validated feature pipeline feeds seven independently-trained model variants, each attacking the same 30,490 series from a different angle, ensembled into one submission.",
    stages: [
      {
        label: "Raw M5 data",
        kind: "input",
        detail: "sales, calendar, prices — 30,490 item×store series",
      },
      { label: "Pandera schema validation", detail: "fails loudly on type/range/null violations" },
      {
        label: "Feature engineering",
        detail: "38 features (lags, rolling stats, calendar, price, hierarchy) — per-store parquet",
      },
      { label: "Feature validation", detail: "second Pandera pass on the engineered matrix" },
      {
        label: "7 LightGBM variants",
        detail: "Tweedie loss, Optuna-tuned — 28 direct per-horizon models is the winning variant",
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
    note: "Cross-cutting: Dagster orchestration (22 assets, 20 quality checks), MLflow experiment tracking, Hydra config, DVC data versioning.",
  },
  decisions: [
    {
      title: "Tweedie loss instead of RMSE, because 68% of the data is zero",
      body: "Standard RMSE (root mean squared error) treats every prediction error equally, but with 68% zero-inflated demand it pushes models toward over-forecasting the tail. Tweedie loss is built for exactly this shape of data, and switching to it measured a +0.02 WRMSSE gain — a real number, not a hunch.",
      sourceRef: "shelfsense:tweedie",
    },
    {
      title: "28 direct per-horizon models instead of one recursive model",
      body: "A recursive forecaster predicts day 1, then feeds that prediction back in as input to predict day 2, and so on — so early errors compound forward. Training a separate model per horizon day avoids that compounding entirely, at the cost of more models to train. The measured cost of going recursive instead was 11% worse WRMSSE.",
      sourceRef: "shelfsense:direct-horizon",
    },
    {
      title: "One global model across all series, not one model per series",
      body: "Classical per-series models (like ETS, a smoothing-based method fit separately to each individual series) collapse on sparse categories with little history — the HOBBIES category scored 3.27 WRMSSE that way. A single LightGBM model trained across all series at once can borrow statistical strength from the busier series to help the sparse ones.",
      sourceRef: "shelfsense:global-model",
    },
    {
      title: "Schema validation at every persistence boundary, because it caught a real bug",
      body: "Pandera schemas are enforced everywhere data is written to disk, not just once at ingestion. This isn't theoretical rigor — it caught an actual NaN (missing-value) bug in production data before it silently corrupted downstream features.",
      sourceRef: "shelfsense:pandera",
    },
  ],
  results: [
    {
      label: "Best private-leaderboard WRMSSE",
      value: "0.5693 vs. 0.8956 naive-seasonal baseline",
      detail: "36% reduction",
      sourceRef: "shelfsense:wrmsse",
    },
    {
      label: "HOBBIES category, per-series ETS → global LightGBM",
      value: "3.2663 → 0.6112",
      detail: "roughly a 5x reduction on the sparsest, hardest category",
      sourceRef: "shelfsense:hobbies",
    },
    {
      label: "Honest ceiling",
      value: "competition winner: 0.520 · this repo's realistic ceiling without GPU compute: 0.53–0.55",
      detail: "111 unit tests, 60%+ coverage; SARIMA was abandoned after an out-of-memory crash at series 442 of 1,000",
      sourceRef: "shelfsense:val-divergence",
    },
  ],
  story: {
    title: "When your evaluation harness lies",
    body: [
      "Four new model variants were added late in the project, and every one of them looked like an improvement — on the 28-day validation holdout used to pick a winner before submitting to Kaggle. Then the private leaderboard scores came back, and all four had reversed.",
      "The clearest example: RMSE-MH scored 0.6699 on validation against the baseline's 0.6860 — a clear win on paper. On the private leaderboard, RMSE-MH scored 0.6205 against the baseline's 0.5693 — a clear loss. The direction of the result flipped depending on which window of time you measured it on.",
      "The root cause wasn't a modeling mistake, it was a measurement mistake: the validation window and the private-leaderboard evaluation window aren't statistically exchangeable — they cover different periods with different demand patterns, so a model that fits one doesn't necessarily generalize to the other. The honest conclusion was that the harness itself was the bug, not the models it was rejecting or accepting. Walk-forward cross-validation (evaluating across multiple rolling time windows instead of one fixed split) became the project's top roadmap item as a direct result.",
    ],
    sourceRef: "shelfsense:val-divergence",
  },
  links: [
    { label: "Source on GitHub", href: "https://github.com/gaurav-gandhi-2411/shelfsense-m5" },
  ],
};
