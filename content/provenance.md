# Content Provenance Manifest

Every number, metric, or factual claim rendered on the site carries a `sourceRef` in
`content/*.ts` that matches an ID (`#`) in this file. No source, no ship — claims without a
verifiable citation were omitted, not softened (rule 65b). Built by reading the actual repos on
**2026-07-12**, not from memory and not by trusting the June-12 project inventory without a
spot-check — several numbers had already drifted by a month; corrections are logged below.

**Pinned refs (issue #45):** a Source cell's backtick-quoted path may carry a trailing
`@<sha>` (e.g. `` `data/backtest.json@d41372a` ``), checked by
`scripts/check-metric-freshness.mjs`. Use it ONLY for a file a source repo's own automation
rewrites on a schedule (a bot-refreshed data file, not a human-committed README/report) —
fetching such a file at `HEAD` checks "does the bot's current output still say this," a
moving target that reflags as drift every time the bot runs, instead of "did the site
correctly report what its cited source said." A human-committed file stays unpinned and
fetched at `HEAD` on purpose, so a real future edit still gets caught. See the Gold Rate
Tracker section below for the one citation this currently applies to.

**A file's git-commit date is not evidence its claims were re-verified (wave 19 rule).** Every
`CaseStudy` carries a `verifiedAt` field (`content/types.ts`) separate from git mtime, bumped
ONLY when a human or an explicit audit pass has gone back to the cited source repo(s) and
confirmed the numbers still hold — never by an edit for copy, framing, typos, or anything else
that leaves the numbers untouched. This exists because wave 15's commit `24a258d` touched every
case study's dek/title in a site-wide framing pass ("every number [is] unchanged," per that
commit's own message) two days after triageiq's cited source had already superseded the numbers
the page still showed — the file looked fresh by git-mtime; it wasn't. `scripts/check-metric-
freshness.mjs`'s weekly `metric-freshness` job flags any case study whose `verifiedAt` exceeds 30
days, independent of whether it also finds numeric drift — see that field's doc comment for the
full incident.

**Reconciliation note:** an earlier version of this file (and a `content/provenance-audit.md`)
was produced by a separate session working on this repo concurrently, now closed. Its research
was audited against this pass: most claims matched independently (Warmer, ShelfSense,
Multimodal Fashion Recommender, tracegauge, AgentGauge, TriageIQ's fabrication-rate correction).
Two of its claims were superseded here with fresher/more-precise sourcing — see the ReviewIQ and
DealHunter entries below for what changed and why. `provenance-audit.md` was deleted as
redundant once reconciled into this single file.

Canonical resume: `.assets/resume-sources/canonical-resume.pdf` (gitignored raw copy; the
git-tracked public copy is `public/resume.pdf`), MD5 `6aec7861c1e5cf8c1ba4bece5e3beed8`,
file-dated 2026-06-12. Confirmed identical to the file GG most recently placed in
`C:\Users\gaura\Downloads\Gaurav_Gandhi_Resume.pdf` by MD5 hash.

**Wave 10 resume rework (2026-07-17):** `public/resume.pdf` now serves the reworked two-page
resume (MD5 `f37fc9454ac3360dddfb34036221bd6b`, built from
`.assets/resume-sources/Gaurav_Gandhi_Resume_2026.docx`, gitignored master). The canonical
2026-06-12 PDF above is **unchanged** and remains the sole source of career facts (roles,
dates, titles, education, contact) — the rework changed presentation and project content
only; project metrics come from this file's own sourced entries. Full change log + metric
sources: `reports/resume-rework-2026-07-17.md`.

## Contact / identity

| ID | Claim | Source |
|---|---|---|
| `resume:contact-email` | `gauravgandhi429@gmail.com` | Resume PDF p.1 header; GG's explicit choice over the account email `gg5678g@gmail.com` (2026-07-12 conversation) |
| `resume:contact-linkedin` | `https://www.linkedin.com/in/gauravgandhi03/` | Resume PDF p.1 header hyperlink annotation, extracted via PDF `/Annots` `/URI` (anchor text alone was not machine-readable as plain text) |
| `resume:contact-github` | `https://github.com/gaurav-gandhi-2411` | Resume PDF p.1 header hyperlink annotation, same extraction method |

## Hero stats

| ID | Claim | Source |
|---|---|---|
| `resume:indium-ds-docunderstanding` | "50M+ documents", "144 A100 GPUs", "$10M+ in annual cost savings", "95%+ field accuracy" | Resume PDF p.1, Indium Software → Data Scientist (Jun 2024–May 2025), bullet "Document-Understanding Transformer at Production Scale" |
| `derived:products-live-count` | "N live AI products" (currently 9) | Mechanically derived as of 2026-07-16 — was previously a hand-typed `"9"` string in `content/site.ts` that could silently drift from the actual product list (a wave-4 review found a design exploration computing "10" from a naive `products.length`, which is what surfaced this). Now computed at build time via `liveProductCount()` in `content/products.ts`: entries with a set `liveUrl` OR `pypi` field (8 live web demos + 1 published PyPI package = 9; ShelfSense is repo-only and excluded, though still shown as a card). One function is the single source of truth — the number can never drift from the array again. |
| `derived:warmer-puzzle-count` | "N+ daily Warmer puzzles shipped" (wave 5, replaces the retired 50M+/$10M+ employer-derived hero stats) | Live server fetch, not a hand-typed number: `getWarmerPuzzleNumber()` (`lib/live-data.ts`) reads the public `mindmeld-payloads` manifest (`raw.githubusercontent.com/gaurav-gandhi-2411/mindmeld-payloads/main/manifest.json`), same source and function already used and verified in wave 3 (`reports/wave3-live-stats-budget-2026-07-12.md` — confirmed Puzzle #31 on 2026-07-12). ISR-revalidated every 6h, fails soft to `"—"` in `components/sections/hero.tsx` if the manifest is unreachable — never a stale or fabricated number. |
| `derived:research-paper-count` | "1 research paper in progress" | `researchPaperCount(researchPapers)` in `content/research.ts` — `researchPapers.length` against the single array already sourced in this file (the AgentGauge paper, `agentgauge:paper-md`, status `preprint-pending`). Mirrors `liveProductCount`'s pattern: one function, one array, can't drift. **Retired from the hero in wave 10** (GG's feedback on the stat set) — the count function remains for potential reuse. |
| `derived:career-years` | "N years in data science & ML" (currently 5) | Computed at build/ISR time in `components/sections/hero.tsx` `careerYears()`: whole years elapsed since Jul 2021, the start of the first data-science role on the resume (TCS Data Engineer, "Jul 2021 – Jul 2022" — `content/experience.ts` dateRange, itself resume-sourced via `resume:tcs-pipelines`). Same drift-proofing rationale as `derived:products-live-count`: a computed floor, never a hand-typed number that ages. |

## About / skills

| ID | Claim | Source |
|---|---|---|
| `resume:skills` | Skill chip list (LoRA/QLoRA, RAG, LangGraph, Transformers, Diffusion, Two-Tower/Contrastive, Ray/DeepSpeed, LLM-as-Judge, NL2SQL, FastAPI/GCP) | Resume PDF p.2, "Key Technical Skills" section — curated down to 10 chips from ~30 listed skills |

## Experience bullets

All Experience bullets are verbatim/near-verbatim from the resume, cited individually in
`content/experience.ts` via `sourceRef`. Single source for all: Resume PDF p.1, "Professional
Experience" section.

| ID | Company / role |
|---|---|
| `resume:indium-senior-lead` | Indium — Senior Data Scientist, team-lead bullet |
| `resume:indium-senior-finetune` | Indium — Senior Data Scientist, LoRA/QLoRA fine-tuning bullet |
| `resume:indium-senior-vit` | Indium — Senior Data Scientist, ViT document-quality-gate bullet |
| `resume:indium-senior-copilot` | Indium — Senior Data Scientist, multi-agent RAG+NL2SQL copilot bullet |
| `resume:indium-ds-docunderstanding` | Indium — Data Scientist, document-understanding transformer bullet |
| `resume:indium-ds-recommender` | Indium — Data Scientist, session-aware recommender bullet |
| `resume:fedex-anomaly` | FedEx — Decision Scientist, anomaly-detection bullet |
| `resume:fedex-forecasting` | FedEx — Decision Scientist, SARIMA forecasting bullet |
| `resume:tcs-pipelines` | TCS — Data Engineer, GCP ETL pipelines bullet |

## Research

| ID | Claim | Source |
|---|---|---|
| `agentgauge:paper-md` | Paper title + abstract, "Tool-Description Quality Is Not One Axis" | `agentgauge/docs/paper/paper.md` lines 1, 7–13 (full draft + compiled LaTeX/PDF exist; arXiv ID is an explicit `TO FILL after upload` placeholder in `README.md:16` — ships as `preprint-pending`; no Tier-2 paper found anywhere in the repo) |

## Products

### Warmer

| ID | Claim | Source |
|---|---|---|
| `warmer:hinglish-fix` | Hinglish Spearman correlation -0.003 → 0.639 | `mindmeld/PLAN.md:265-273` (before/after table), root cause + fix in `mindmeld/spec-hinglish-fix.md:4,6-7`, reproduced in `mindmeld/generator/evals/reports/baseline_report.md:19-26` |

Live URL `https://playwarmer.vercel.app/` — `mindmeld/README.md:78-79`. Repo confirmed via
`git remote -v` → `github.com/gaurav-gandhi-2411/mindmeld`. Product renamed from "Mindmeld" to
"Warmer"; repo folder/Firebase project ID keep the legacy name deliberately
(`mindmeld/README.md:1,7-8`).

**Wave 2 link-check finding (2026-07-12):** the `mindmeld` GitHub repo is **private**
(`gh repo view` succeeds authenticated; unauthenticated `curl` gets 404 — confirmed via
`gh repo view gaurav-gandhi-2411/mindmeld --json visibility` → `PRIVATE`, the only private repo
among all products referenced on this site). The repo link was removed from Warmer's card —
shipping a link that 404s for every visitor is worse than no link. Flagged to GG as an open
decision (make it public, or leave it link-less) rather than assumed.

`warmer:hinglish-fix` also backs the flagship-card story line: the root cause was a
script-mismatch (the swapped-out model was trained on Devanagari Hindi, not romanized/Latin-script
Hinglish) — `mindmeld/spec-hinglish-fix.md:6-7`.

### Style Maitri

| ID | Claim | Source |
|---|---|---|
| `style-maitri:intent-accuracy` | **SUPERSEDED, reverted 2026-08-05 — see Wave 19's evidentiary-audit section below.** 93.8% intent-parsing accuracy (n=211), not 94.4%/n=378. | ~~**Wave 19 correction (2026-07-31):** `agentic-shopping-assistant/reports/model_eval_20260731T060759Z.md:7` (gitignored/regenerated report, verified live: `n=378 all-fields-exact=94.4%`).~~ Both this row's number and its own `wave 20` caveat below confirmed it was never git-verifiable; the shipped site value is back to the git-committed `reports/final_scorecard_2026-07-12.txt` (commit `57e7e60`) figure, 93.8%/n=211. **UNVERIFIABLE by automated check, wave 20 (2026-07-31):** searched every git-tracked file in `agentic-shopping-assistant` (`git ls-files \| xargs grep`) for "94.4" or "378" in an eval-accuracy context — no committed artifact contains this figure. The eval reports directory is entirely gitignored (regenerated per-run, never committed); no test asserts an accuracy floor. This number can only be re-confirmed by a human re-running the eval locally, or by GG committing the report (or a summary of it) going forward — until then, the metric-freshness checker will report this ID `UNVERIFIABLE` every run, correctly, not a bug in the checker. |
| `style-maitri:catalogue-size` | **SUPERSEDED, reverted 2026-08-05 — see Wave 19's evidentiary-audit section below.** 52,494 items across 8 stores, not 112,425/42. | ~~**Wave 19 correction (2026-07-31):** `agentic-shopping-assistant/data/processed/unified/catalogue.parquet` (gitignored, verified live via pandas: 112,425 rows, 42 unique stores).~~ The 112,425-item figure was never git-verifiable (see this row's own `wave 20` caveat below); the shipped site value reverted to the git-committed `reports/final_scorecard_2026-07-12.txt` (commit `57e7e60`) figure, 52,494 items/8 stores. The store *list* itself (which brands) did stay corrected to the 8-store roster below — that correction traces to the same committed report as the count, so it's independent of the reverted 42-store figure. **Partially verifiable from a committed artifact, wave 20 (2026-07-31):** the **42-store** count independently corroborated by a committed, live-run regression test — `agentic-shopping-assistant/tests/test_unified_index.py::test_store_roster_matches_expected` asserts `set(unified_df["store"].unique()) == _VALID_STORES` (42 entries) and would fail CI if the roster changed. The **112,425-item** count has NO committed source anywhere (`git ls-files \| xargs grep` for "112,425"/"112425" across the repo: no hits) — the parquet itself is gitignored and regenerated, and no test asserts a row-count floor. the metric-freshness checker currently reports this whole claim `UNVERIFIABLE` (its one cited path is the gitignored parquet); that's accurate for the item count but understates the store count, which a human could verify from the test file today. Not fixed in the checker itself — true per-token source attribution (as opposed to per-claim) is more machinery than this finding warranted; flagged here instead. **Open tension not resolved here:** the 42-store count has a real committed regression test behind it (unlike the item count), so it sits in a different evidentiary tier than the fully-gitignored item count — GG's 2026-08-05 revert treated both as one claim and reverted together; a future pass could split them if the store count alone is ever needed. |

**Correction vs. spec.md:** the spec's brand name "StyleMaitri" and figure "52–68K items" don't
match the repo. Live branding (frontend metadata, live domain) is **"Style Maitri"** (two
words) — `frontend/app/layout.tsx:25-36`, `brands/unified.yaml:1,9`. No "68K" figure exists
anywhere in the repo; the historical high was 61,883 (now superseded). The spec's eval numbers
(96.9%/87.5%) are from a 2026-05-15 harness, superseded by the 2026-07-12 numbers above.

**Superseded from the earlier concurrent-session pass:** that pass used `BRANDS.md`'s "~51K
items" figure — `BRANDS.md` is itself flagged stale in my research (last touched 2026-06-07,
pre-dates the 2026-07-12 sold-out-filter rebuild). Used the fresher, dated
`soldout_filter_fix_2026-07-12.txt` figure (52,494) instead, plus the intent-accuracy metric
(93.8%) which the earlier pass didn't surface at all. Live URL `https://stylemaitri.vercel.app`
confirmed 200 in `reports/prelaunch_hardening_2026-07-12.md:63`.

| ID | Claim | Source |
|---|---|---|
| `style-maitri:garment-normalizer` | Deterministic, rule-based garment-type normalizer resolving inconsistent product titles across store catalogues into one canonical taxonomy (garment type + category + confidence score), no LLM | `agentic-shopping-assistant/src/catalogue/normalizer.py` — module docstring lines 1–19 labels it "GarmentNormalizer"; actual callable is the function `normalize_garment_type()` at line 155 (there is no `class GarmentNormalizer` — verified via grep, zero hits — "GarmentNormalizer" is the module's informal/doc name, not a literal identifier, so the card copy describes what it does rather than naming a class that doesn't exist) |

### TriageIQ

| ID | Claim | Source |
|---|---|---|
| `triageiq:classifier-top3` | Component classifier top-3/top-1 accuracy: k8s 87.1%/60.5%, vscode 89.8%/76.5% | **Wave 19 correction (2026-07-31):** retrained via a one-vs-rest multi-label supervision fix, landed 2026-07-24 — `triage-iq/README.md:78-82`, `docs/architecture/adr/0036-classifier-multilabel-supervision-fix.md`. Prior value (82.5%/90.4% top-3) is superseded, was current at the case study's 2026-07-26 writing but the fix had already shipped by then — see the wave-19 provenance-failure note below. |
| `triageiq:cqr-coverage` | Resolution-time interval coverage after Conformal Quantile Regression: 76.2% (k8s) / 74.6% (vscode) vs. an 80% nominal target, matching the live-serving artifact | `triage-iq/README.md:94,98`; `triage-iq/data/models/cqr_conformal_adjustments.json:11,40` — issue #45 fix: this results row previously shared `sourceRef: "triageiq:cqr"` with the CQR *design-decision* text below, which cites the ADR's earlier exploratory numbers (76.6%/74.1% for a different calibration split), not this shipped, README-matching figure — a wrong-sourceRef bug of the same shape already fixed once for `gold-rate-tracker:headline` (see the wave-20 correction note under "The metrics.json layer" below). This row already existed as a `content/metrics.json` entry with this exact source; it just never had a matching parseable provenance.md row for the case-study claim checker to resolve against. |

**Correction vs. spec.md:** spec claimed "fabrication-gated CI (3.1% measured, hard gate)" — wrong
on every count. Actual grounding-verified fabrication rates are **1.9% (k8s) / 9.1% (vscode)**
(not a blended 3.1%), per `triage-iq/README.md:103-104`; per
`triage-iq/docs/architecture/adr/0028-per-model-eval-audit.md:156-160` it is explicitly
"informational-only... pending an observation window before any promotion to a hard gate" —
**not currently a hard gate**. (This matches the earlier concurrent-session pass's independent
finding — cross-confirmed by two separate reads.) Also corrected in the same 2026-07-11/12 audit:
the previously-quoted retriever Recall@5 (36.7% vscode) was inflated by a proxy-task measurement
bug; the honest product-task number is 22.4% (vscode) / 23.5% (k8s) — see
`triage-iq/docs/architecture/adr/0030-phaseC-product-task-feasibility.md`. Used the classifier
metric instead as a clean, current, positive, fully-corrected number.

| ID | Claim | Source |
|---|---|---|
| `triageiq:contamination-adr0018` | Disjointness guard caught 3 months of silent train/eval contamination in the gold judge set (54/60 cases affected, two independent root causes), fixed the split-loading logic, declined to fabricate an inflation-magnitude estimate | `triage-iq/docs/architecture/adr/0018-gold-set-train-contamination.md` — root causes lines 22–55, blast radius lines 61–69, fix lines 98–108 |

This is a genuine continuous "eval-integrity arc," not three unrelated fixes strung together:
ADR-0028 (the fabrication-rate audit) opens by naming ADR-0018 as the pattern that motivated a
systematic audit (`0028-per-model-eval-audit.md:9-23`) and says it found "2 new contamination
leaks... that ADR-0018 doesn't cover" (line 19); ADR-0030 explicitly corrects/completes an
ADR-0028 finding (retrieval-recall measurement). Full chain verified by an independent research
pass before use in card copy.

### DealHunter (agentic-travel-booking-system)

| ID | Claim | Source |
|---|---|---|
| `dealhunter:test-coverage` | 727 tests collected (live `pytest --collect-only`, re-confirmed 2026-07-31 — identical to the 2026-07-12 count, no test-affecting commits landed between) | **Wave 19 correction (2026-07-31):** this row already recorded the 727 figure as of 2026-07-12 (below), but the shipped case-study `.ts` file was never updated to match — caught by this pass. `agentic-travel-booking-system/CURRENT_STATE.md:645` still pins the superseded 597 (579 passed, 3 skipped, 15 Docker-blocked pre-existing) as a frozen 2026-06-09 snapshot; `:135` (87.65% coverage figure, not re-measured at the new count). The repo's own `.portfolio/metrics.json` (added 2026-07-25, meant to auto-refresh this exact number) still hard-codes 597 too — see PR4. |

**Correction, two rounds:** spec/inventory's original "demo-haiku: 24/24 completion, coherence
4.625" describes an LLM profile removed from the live product on 2026-06-19 (commit `464e004`,
"remove Haiku [DEMO]") and was itself superseded same-day even before removal — see
`docs/evals/baselines/README.md:10-22`. My first replacement candidate ("Wave 2 canonical
baseline: 100% (31/31)") was accurate but n=31 is small enough that a bare 100% risks reading as
cherry-picked (rule 93: n<50 needs care). The earlier concurrent-session pass flagged this exact
risk and proposed swapping to a test-coverage metric instead — but sourced it to
`README.md:118`'s **"249 tests, ~90% coverage,"` which is itself a stale line (confirmed stale
independently in my June-12 inventory read, and reconfirmed here directly against
`CURRENT_STATE.md` and a live pytest collection). Kept their metric-type instinct (avoid a
small-n percentage), swapped in the actually-current number.

### ShelfSense

| ID | Claim | Source |
|---|---|---|
| `shelfsense:wrmsse` | WRMSSE 0.8956 → 0.5693, 36% reduction | `shelfsense-m5/README.md:7`, `reports/leaderboard.md:233`. No commits since 2026-05-17 — unchanged, re-confirmed 2026-07-12 |

No live deployment exists for this project (batch/local pipeline only per
`shelfsense-m5/README.md` "Live Path (Local CLI)") — card shows repo link only, no live-link
claim made.

### ReviewIQ

| ID | Claim | Source |
|---|---|---|
| `reviewiq:extraction-eval` | 83.8% overall extraction accuracy (threshold 83%, PASS) | `review-iq/eval/report.md:5,11-13`, generated 2026-07-06 |

**Correction, including a disagreement with the earlier concurrent-session pass:** that pass
kept 85.8% as "verified as originally drafted, no correction needed," sourced to
`README.md:135-147`'s versioned results table. That table's 85.8% row is labeled `v0.4.0` —
a **historical, superseded row in the same table** (the newest row, `v0.5.0`, shows 84.4%). The
live, dated eval artifact (`eval/report.md`, generated 2026-07-06) shows the current number is
83.8%, against a gate threshold **deliberately lowered from 85% to 83%** in commit `13a4422`
(2026-07-06) — documented rationale in `review-iq/eval/runner.py:23-28` ("free-tier reality...
every per-language gate still holds ≥80%"). Used the current, live-eval-sourced 83.8% figure,
not the superseded table row.

**Wave 2 link-check finding:** the card's live URL previously pointed at the bare API root
(`https://review-iq-ajjrytb3na-el.a.run.app`), which 404s — the FastAPI service has no root
route handler. `/docs` (interactive Swagger UI) returns 200 and is genuinely browsable/
demonstrable, so the card now links there instead. Same service, better landing page — not a
claims change.

### Multimodal Fashion Recommender

| ID | Claim | Source |
|---|---|---|
| `mmfr:recall10` | Recall@10 lift 3.06× vs. popularity baseline (0.0328 vs. 0.0107) | `multimodal-fashion-recommender/README.md:113,119-126`; locked-gate cross-check `PROJECT_MEMORY.md:375-386` ("Δ = 0.000000 vs baseline, identical"). Re-confirmed unchanged 2026-07-12 (matches the earlier concurrent-session pass exactly) |

Live entry point is the Hugging Face Space (H&M-only demo); Cloud Run deploy is not yet live —
used the HF Space URL as the card's live link, not an aspirational Cloud Run URL.

### Gold Rate Tracker

| ID | Claim | Source |
|---|---|---|
| `gold-rate-tracker:headline` | Naive flat-hold beats the ML model (Chronos-Bolt-Tiny) — MAE 251.99 vs. 293.10 (naive wins by ~16%), Wilcoxon p=0.0001, direction accuracy 51.96%, 204-fold backtest | `gold-rate-tracker/data/backtest.json@d41372a` — pinned per this file's "Pinned refs" note above: `data/backtest.json` is bot-refreshed continuously (`weekly-backtest.yml`) and had already moved to 209 folds/different numbers by the time issue #45 was filed, causing a false POSSIBLE_DRIFT against the pinned claim's actual numbers. Commit `d41372a` (2026-07-26T05:26:23Z, `chore: update backtest results [skip ci] (#436)`): `mae_5d_avg_naive: 251.99` vs `mae_5d_avg_chronos: 293.1`, `wilcoxon_signed_rank_p: 0.0001`, `dir_acc_5d_chronos: 0.5196` |

This project's own design principle is to ship the honest baseline over a model that loses to
it (direction signal is still flagged "DARK" at both horizons in
`data/direction_baseline.json` — not statistically significant) — the headline metric reflects
that honestly. More precise than the earlier concurrent-session pass's fallback phrasing ("none
have beaten it yet") — used the live-data-file numbers instead of the static README prose, which
is itself stale relative to the live JSON ("~14% worse, p≈0.003" in the hand-edited README vs.
the current "~15.1% worse, p=0.0003" in the bot-refreshed data file).

### AetherArt

| ID | Claim | Source |
|---|---|---|
| `aetherart:vram` | 6.2GB peak VRAM for the full SDXL + Ukiyo-e LoRA production pipeline (8GB consumer-GPU budget); NF4 4-bit quantization gets a single pipeline to 2.6GB | `AetherArt/README.md:40-46,87`, GCP L4 eval run 2026-06-01 per `docs/lab_notebook.md` line 266 |

The CLIP-score number (0.3177, SD 2.1 only) is unchanged but the repo's own README deliberately
de-emphasizes it as "comparison-only" (`README.md:71`) since a 2026-06-07 rewrite replaced the
CLIP-led hero with a VRAM/CLIP-blindness framing. Used the VRAM framing — specifically the
full-pipeline 6.2GB figure (what's actually served in production), which is more complete than
the earlier concurrent-session pass's citation of only the 2.6GB single-component number.

### AgentGauge (added wave 10)

| ID | Claim | Source |
|---|---|---|
| `agentgauge:scoring-dimensions` | 8 scoring dimensions (all marked **Implemented**), 10-server pilot sample | `agentgauge/README.md` "Scoring dimensions" table (8 rows, weights sum to 100%); "10-server pilot sample" in the scope note near line 62, which also says "pilot-scale research artifact… not a validated product claim" — the card's metric is therefore descriptive (dimension count + pilot size), not a performance number. Verified directly against the README 2026-07-17, not from the inventory-agent relay. Repo public via `git remote -v` → `github.com/gaurav-gandhi-2411/agentgauge`. No liveUrl and no PyPI package → correctly excluded from `liveProductCount`. |

### tracegauge

| Claim | Source |
|---|---|
| PyPI package `tracegauge`, current version 0.10.0, `pip install tracegauge` | `token-efficiency-scorer/pyproject.toml` (`name = "tracegauge"`, `version = "0.10.0"`), confirmed live via `pip index versions tracegauge` (2026-07-12), badges in `README.md:6-7` |

Note: the PyPI package name (`tracegauge`) differs from the GitHub repo name
(`token-efficiency-scorer`) — the card's repo link points to the actual repo; package
name/install command reference the PyPI name.

## Wave 2 link-check summary (2026-07-12)

Every external link referenced in `content/*.ts` was curl-checked against the deployed site's
link set. Two real breaks found and fixed (Warmer's repo link removed — private repo; ReviewIQ's
live link repointed to `/docs`, see product sections above for both). Two apparent failures were
false positives, left as-is:
- **AetherArt** (`aetherart-demo-...run.app`) timed out at 15s but returned 200 on a 90s retry —
  known Cloud Run cold-start behavior (~5–7 min after idle, documented in the project's own
  README). The lychee CI job below is configured with a generous timeout/retry to avoid flagging
  this as broken on every run.
- **LinkedIn** (`linkedin.com/in/gauravgandhi03`) returns HTTP 999 to unauthenticated/non-browser
  requests — LinkedIn's known anti-scraping response, not a real break (the profile loads fine in
  a browser). Excluded from the strict-200 CI check via an accept-list.

## Wave 3 Tier 1: live-data provenance pattern

Every number in this section is **fetched at build/ISR time from the real source, not
claimed** — this is a structurally different provenance mechanism than the rest of this file
(which cites a specific file+line snapshot). Live stats instead cite *the endpoint*, because
the endpoint IS the source of truth and re-verifies itself every revalidation cycle. All
fetches live in `lib/live-data.ts`, revalidate every 6h (`next.revalidate`), and fail soft
(return `null`/`[]`, never throw) — a flaky third-party API degrades to "no live badge shown"
for that one stat, never a broken build or a stale number presented as current.

| Live stat | Source | Verified behavior |
|---|---|---|
| Warmer "Puzzle #N live today" | `raw.githubusercontent.com/gaurav-gandhi-2411/mindmeld-payloads/main/manifest.json` — 1-indexed position of today's UTC date in the `en.days` array | Confirmed 2026-07-12: manifest shows 60 precomputed days from 2026-06-12; today's index computes to **Puzzle #31**, matching the launch-date math (30 days elapsed + 1) |
| tracegauge "N PyPI downloads this week" | `pypistats.org/api/packages/tracegauge/recent` — `data.last_week` | Confirmed 2026-07-12: API returned `last_week: 32`, matches the number rendered in the build |
| Per-product "shipped Nd/mo/y ago" freshness badge | `api.github.com/repos/{owner}/{repo}/commits?per_page=1` — latest commit's `commit.committer.date`, per public repo referenced in `content/products.ts` | Only computed for products with a public `repoUrl` (Warmer excluded — private repo, uses its puzzle number as the live signal instead) |
| Shipping log (merged PRs across public repos) | `api.github.com/users/gaurav-gandhi-2411/events/public` — `PullRequestEvent` entries with `payload.action === "merged"` | **Correction during build-testing:** the events API's `PushEvent` payload has no commit-message array in this response shape (just refs/SHAs), and a merged PR's signal is `payload.action === "merged"`, not a `pull_request.merged` boolean as the docs might suggest — verified against the actual live payload, not assumed. Restricted to merged-PR entries only, matching "notable merges" rather than raw pushes |

**Why unauthenticated GitHub API calls, not a token:** ISR revalidation means these fetches run
in the background roughly every 6h, not per-visitor — call volume is a handful of requests per
revalidation cycle, comfortably inside the unauthenticated 60/hr rate limit. Avoids provisioning
and rotating a PAT/secret for a read-only public-data need (rule 96, least privilege).

## Wave 12 — case-study provenance (2026-07-18)

The multi-page rebuild adds a `/work/[slug]` case study per project
(`content/case-studies/*.ts`). Every new claim below was sourced by reading the actual repos
on 2026-07-18 (4 parallel research passes, file+line cites). Existing IDs above are reused
unchanged where they already covered a claim. Paths are relative to
`C:\Users\gaura\ml-projects\<repo>`.

### Warmer (mindmeld)

| ID | Claim | Source |
|---|---|---|
| `warmer:precompute-design` | Puzzles fully precomputed offline; runtime is a rank-table lookup, ~$0 marginal serving cost | `mindmeld/README.md:31-37`, `mindmeld/spec-hinglish-fix.md:10` |
| `warmer:wasm-decision` | `--wasm` adopted on measurement: TBT 221ms→13.5ms, −417KB page weight | `mindmeld/reports/renderer-decision-2026-07-12.md:43-53` |
| `warmer:finetune-failures` | Two Hinglish fine-tune attempts both regressed held-out Spearman (0.435 → 0.376 → 0.324); shipped the off-the-shelf model | `mindmeld/docs/known-limitations.md:38-81` |
| `warmer:lora-reframe` | Full-parameter fine-tunes v1/v2 both regressed (v2 worse with 43% more data); a 13-config LoRA capacity sweep holding data fixed beat baseline on every config, 3 CI-significantly; shipped `gauravgandhi2411/hinglish-relatedness-sbert`, leading 7 comparators; held-out honest number 0.4350 → 0.7044 alongside the full-set 0.813 | `mindmeld/PLAN.md:590-600,560-572,1634-1667,706-710` — **wave-20 note:** this claim previously existed only as narrative prose (wave-13 section below), never a formal table row, so it never resolved for any automated check; converted to a row here for that reason, no change to the claim itself |
| `warmer:tests` | 160/160 generator + 94/94 app + 2/2 emulator integration tests | `mindmeld/README.md:175-176` |
| `warmer:perf-budget` | FCP 992ms (≤1800ms), TBT 26ms (≤200ms), CLS 0 (≤0.1) — all passing; LCP deliberately unbudgeted (zero LCP entries ever fire on this CanvasKit-rendered page — confirmed via live `PerformanceObserver`, not a measurement gap) | **Wave 19 correction (2026-07-31):** `mindmeld/README.md:178-190`, commit `e8d03c7` (2026-07-30, "fix(docs): re-measure and correct stale performance budgets in README"). Superseded the "LCP 3,082ms, fails its own 3,000ms ceiling by 82ms" framing, which was accurate when originally sourced but replaced 5 days later. **Known cross-repo inconsistency, not fixed here (out of scope — a different repo):** `mindmeld/docs/known-limitations.md:383-402` still asserts the old LCP-ceiling framing as of its own last edit (commit `62b3ce9`, 2026-07-30 19:41 — *after* `e8d03c7`, but that commit touched an unrelated section of the file and never reconciled this one). `README.md` is treated as the more authoritative source here since it was the explicit, deliberate subject of the fix commit; `known-limitations.md` needs a matching correction in the `mindmeld` repo itself. |

### Style Maitri (agentic-shopping-assistant)

| ID | Claim | Source |
|---|---|---|
| `style-maitri:hybrid-retrieval` | Hybrid FAISS+BM25 via RRF handles both vibe and exact-keyword queries | `README.md:15,167-172` |
| `style-maitri:router-decision` | Router experiment: LLM 100% pass/~2100ms/~$0.10 per 1k vs DistilBERT 75%/31ms/$0 vs cascade 94%; kept LLM router + deterministic code guard | `reports/router_comparison.md:6-20`, `src/agents/graph.py:3345` |
| `style-maitri:flywheel-ranking` | Transparent outfit-ranking boost: final_score = coherence × (1 + 0.25 × positive_rate), ≥10-signal cold-start gate | `docs/architecture/adr/0005-flywheel-ranking-blend.md:6-14,32-34` |
| `style-maitri:retrieval-eval` | **SUPERSEDED, reverted 2026-08-05 — see Wave 19's evidentiary-audit section below.** 96–99% occasion/search, 67% adversarial (n=92), not the 96/88/68 split. | ~~**Wave 19 correction (2026-07-31):** `agentic-shopping-assistant/reports/model_eval_20260731T060759Z.md:21-25` (gitignored/regenerated, verified live).~~ Both the pre- and post-correction numbers here trace only to gitignored reports (`model_eval_20260712T091248Z.md` and `model_eval_20260731T060759Z.md`, neither git-tracked) — with neither side verifiable, the 2026-08-05 revert kept the earlier baseline rather than swap one unverifiable number for another. |
| `style-maitri:live-audit` | Adversarial live audit: 15/32 skeptical-shopper queries disappointing; 2 trust-destroying bugs; outfit-board honest vs plain-search confabulating on identical missing inventory | `reports/deep_diagnosis_2026-07-12.md:3-9,125-138` |

### TriageIQ (triage-iq)

| ID | Claim | Source |
|---|---|---|
| `triageiq:classifier-bakeoff` | DistilBERT +1.2pp on vscode (needed +11pp for 20x latency), −5.1pp on kubernetes; TF-IDF wins at this data scale | `reports/03_classifier_comparison.md:257-260,395-412` |
| `triageiq:cqr` | Raw quantile coverage unreliable (74.4%/38.2%); CQR gives distribution-free guaranteed coverage | `docs/architecture/adr/0010-conformal-quantile-regression.md:14-38` |
| `triageiq:split-fix` | closed_at split leaked (train median 1.0d vs test 677d); created_at re-split dropped MAE 693→87 days; has_priority feature leak (corr 0.595, applied during triage) | `docs/architecture/adr/0009-resolution-predictor-diagnosis.md:60-93,184` |
| `triageiq:retrieval` | k8s Recall@5 18.0% (related-issue task); vscode Recall@5 50.5% (duplicate-issue task, via the `dup_comment` channel) — both corrected upward from earlier, lower measurements; 3 zero-training fixes (BM25 fusion, cross-encoder reranking, a stronger embedder) still fail to clear the bar on the corrected baseline | **Wave 19 correction (2026-07-31):** `triage-iq/README.md:107-136` headline-finding blockquote — full correction chain: 23.5% (uncorrected, contaminated gold set) → 9.3%/vscode-retired (ADR-0033, clean eval) → 18.0%/50.5% (ADR-0035, harness-bug fix: eval was querying title-only against a title+body production index). Prior page text ("vscode retired, gold pairs ~80% noise") described the ADR-0032/pre-0033 state and was already superseded before the case study's 2026-07-26 writing. |
| `triageiq:wave19-provenance-note` | The classifier retrain (ADR-0036) and retrieval harness fix (ADR-0035) both landed in `triage-iq` on **2026-07-24** — two days *before* this case study's own last edit (2026-07-26, commit `24a258d`). The page shipped already behind its own cited source, not merely overtaken by later work. Root cause: the wave-12/13 provenance pass read the repo once and cited specific README line ranges; nothing in this site's process re-reads a source repo at case-study-edit time, so a source that changed between "provenance last verified" and "case study last touched" isn't caught by construction. See PR4 (`.portfolio/metrics.json` pipeline / scheduled drift-check) for the systemic fix under discussion. | investigation this wave — `git log` timestamps on both repos, no code changed by this note |
| `triageiq:resolution` | Resolution MAE: k8s 104.05d vs 106.29d naive (+2.1%); vscode 6.02d vs 3.53d naive (70.5% worse, served with transparency badge) | `README.md:91-98` |

### DealHunter (agentic-travel-booking-system)

| ID | Claim | Source |
|---|---|---|
| `dealhunter:window-searcher` | Deterministic WindowSearcher coordinator (not an LLM agent) for testability + hard call budget | `docs/architecture/adr/0005-hierarchical-window-search.md:52-71,211-231` |
| `dealhunter:pareto-archetypes` | Exactly 2 Pareto archetypes with guaranteed-distinct trade-offs, not a ranked list | `docs/architecture/adr/0006-pareto-frontier-archetypes.md:39-77,175-190` |
| `dealhunter:llm-judge` | LLM-judge eval: single judge, cross-family, median-of-3 | `docs/architecture/adr/0016-llm-judge-design.md:29-66` |
| `dealhunter:multi-provider` | Multi-provider fallback chain built after repeated free-tier Groq daily-quota outages | `spec.md:1-9,30-36` |
| `dealhunter:planner-baseline` | Planner baseline 31/31 archetype selection | `CURRENT_STATE.md:377-385` |
| `dealhunter:optimizer-baseline` | Optimizer baseline: demo-haiku 24/24, coherence 5.0/5; demo-llama 21/24 (quota-constrained), 4.881 | `apps/api/docs/evals/baselines/README.md:19-27` |
| `dealhunter:audit` | Early self-audit: 6/10 prototype-to-production score | `AUDIT_REPORT.md:9-15` |
| `dealhunter:silent-outage` | Two-week silent outage: stale Cloud Run tag + empty-string env vars bypassing `??`; fixed with canary/soak gates + staleness cron | `docs/architecture/adr/0023`, `0024-production-frontend-alignment.md:1-153` |

### ShelfSense (shelfsense-m5)

| ID | Claim | Source |
|---|---|---|
| `shelfsense:tweedie` | Tweedie loss over RMSE for 68% zero-inflated demand; +0.02 WRMSSE | `README.md:266,31-43` |
| `shelfsense:direct-horizon` | 28 direct per-horizon models; recursion measured at 11% WRMSSE cost | `README.md:186-203,271` |
| `shelfsense:global-model` | Global cross-series LightGBM; per-series ETS collapsed on HOBBIES (3.27 WRMSSE) | `README.md:148,166-172` |
| `shelfsense:pandera` | Pandera schema enforcement at persistence boundaries caught a real NaN bug | `README.md:276` |
| `shelfsense:hobbies` | HOBBIES 3.2663 (ETS) → 0.6112 (LightGBM), 5x | `README.md:158-164` |
| `shelfsense:val-divergence` | 4 variants improved on validation but lost on private LB (harness failure, documented); winner 0.520 vs realistic ceiling 0.53–0.55; SARIMA OOM at 442/1000; 111 tests | `README.md:234-256,389-393,15,405,111,375` |

### ReviewIQ (review-iq)

| ID | Claim | Source |
|---|---|---|
| `reviewiq:privacy-routing` | Groq-only client-data path; Gemini dev-only, enforced via `assert_privacy_safe()` | `review-iq-closeout-roadmap.md:27`, `README.md:304-305` |
| `reviewiq:tiered-routing` | Tiered routing cut token cost 27.9% at a published 1.4pp accuracy cost | `README.md:139-147` |
| `reviewiq:cassette-ci` | Cassette-replay CI keyed on sha256(model+prompts); zero live LLM calls | `eval/README.md:5-16,52-57` |
| `reviewiq:urgency-rubric` | Urgency rewritten tone→signal-based; "poor fit" pattern-match bug diagnosed via cassette replay | `PROMPTS.md:162-192,79-128,7-56,248-251` |
| `reviewiq:authenticity` | Authenticity on 40 fixtures: P/R/F1 = 1.000, labeled "a starting calibration" | `README.md:151-157`, `docs/compliance.md:74-87` |
| `reviewiq:gold-label-caveat` | hi/hi-en gold labels LLM-generated, "not published-credible"; gap mostly benchmark-label noise | `spec.md:11-13`, `PROMPTS.md:38-43` |

### Multimodal Fashion Recommender

| ID | Claim | Source |
|---|---|---|
| `mmfr:frozen-fusion` | Frozen CLIP+SBERT fusion transfers to new catalogues without retraining encoders | `README.md:82,178-180` |
| `mmfr:collapse-fix` | Original config caused total representation collapse; τ=0.1 + LR 3e-4 + 500-step warmup fixed it (warmup most critical) | `README.md:103,207-208` |
| `mmfr:faiss-adr` | FAISS IndexFlatIP over managed vector DB for ≤4 brands; scaling math + 4-phase migration path documented | `docs/architecture/adr/0001-multi-brand-scaling.md:30-36,96-156` |
| `mmfr:ndcg` | NDCG@10 0.0208, MRR 0.0172 (active pool) | `README.md:113-124` |
| `mmfr:cost` | ≈$0.001–$0.004 per 1,000 recommendations with warm cache | `COST.md:26-27,64` |
| `mmfr:brand-caveat` | New-brand /recommend is illustrative-only (synthetic users); /similar is the validated day-one capability | `README.md:178-190` |

**Wave 19 correction (2026-07-31):** the brand-catalogue enumeration in `content/case-studies/multimodal-fashion-recommender.ts` ("Snitch, Fashor, Powerlook") was missing **Virgio**, live since 2026-07-11 (`README.md:7`: "Snitch, Fashor, Powerlook, Virgio"). All numeric claims above (`mmfr:recall10`, `:ndcg`, `:cost`) were re-checked and are unchanged. `mmfr:faiss-adr`'s "≤4 brands" framing is still accurate — Virgio brings the count to exactly 4.

### Gold Rate Tracker

| ID | Claim | Source |
|---|---|---|
| `gold:direction-baseline` | Direction baseline corrected 50% → true base rate 69.7–75.5% ("always predict up" in a bull regime); model loses on every window; signal kept DARK | `docs/adr/019-direction-signal-below-base-rate.md:16-35,62-72`, `docs/DIRECTION_SIGNAL_STATUS.md:15-20@fa9dfb6` — pinned per this file's "Pinned refs" note above: `DIRECTION_SIGNAL_STATUS.md` is bot-refreshed weekly (`eval-direction.yml`) and had already moved past the results-row's previously-cited n=93/92 figures (a stale 8-week-old snapshot, per a data-accumulation bug that repair commit `fa9dfb6` fixed) by the time this was checked. Commit `fa9dfb6` (2026-08-05, "docs: correct DIRECTION_SIGNAL_STATUS.md revisit dates, record the capture-timing bug (#623)"): h=1 N=130, base rate 50.8%, logistic OOS accuracy 48.5% (p=0.63); h=2 N=128, base rate 57.8%, logistic OOS accuracy 60.9% (p=0.45) — both still DARK, no gate change |
| `gold:promotion-gate` | Pre-registered promotion gate: ≥250-fold backtest, MAE beat, Wilcoxon p<0.05 | `docs/adr/012-naive-headline-chronos-companion.md:50-58` |
| `gold:power-analysis` | Monte Carlo power analysis: at n=93 only ~21pp edge detectable at 80% power; revisit dates computed | `docs/DIRECTION_SIGNAL_STATUS.md:52-63,82-96` |
| `gold:zero-cost` | ₹0/month infra (GitHub Actions + Pages + ntfy.sh free tiers) | `README.md:11` |

### AetherArt

| ID | Claim | Source |
|---|---|---|
| `aetherart:clip-blindness` | CLIP structurally blind to rendering-level changes across 9 experiments (SD 2.1 + SDXL); own claim revised 9/9 → 4/9 under a stricter 1-SE threshold | `README.md:71,91-105,111-123,199-211` |
| `aetherart:checkpoint` | Checkpoint 1000 over 500/1500 via multi-scorer + human review, not lowest loss | `README.md:236-242` |
| `aetherart:lora-quality` | Ukiyo-e LoRA: HPS 0.239, ImageReward 1.479, CLIP 0.359 comparison-only (GCP L4, seed 42) | `docs/lab_notebook.md:258-266` |
| `aetherart:360-sweep` | 360-run benchmark: prompt moves CLIP 18× more than scheduler (range 0.130 vs 0.007) | `README.md:248-252` |
| `aetherart:tests` | 229 tests, ~60s, no GPU required | `README.md:283` |
| `aetherart:caveats` | Underfitting paradox (CLIP rewards keyword matching); unresolved calligraphy-cartouche artifact | `README.md:256-260`, `reports/what_didnt_work.md:93-95` |
| `aetherart:int8-surprise` | INT8 increased peak VRAM vs FP16 under CPU offload (2210 vs 1803MB); pipeline-cache eviction bug fixed with single-slot cache | `README.md:305-313`, `reports/what_didnt_work.md:9-19` |

### AgentGauge

| ID | Claim | Source |
|---|---|---|
| `agentgauge:frozen-protocol` | Frozen pre-registered protocol: one judge (llama3.1:8b, seed 42), generator always a different family, nulls first-class | `docs/research/frozen_protocol.md:1-27` |
| `agentgauge:mock-provider` | Provider protocol + deterministic MockProvider CI default — no network/cost/credentials | `README.md:162-172` |
| `agentgauge:regime-framing` | Regime-bounded framing; two-condition practitioner test instead of a blanket claim | `README.md:25-37`, `docs/paper/paper.md:591-627` |
| `agentgauge:governance` | Judge/scorer/rubric changes require human-reviewed draft PRs; nothing auto-merges | `docs/paper/paper.md:725-729` |
| `agentgauge:t18` | Synthetic 60-tool catalog: oracle descriptions +34.5pp (62.9→97.4%, p<0.0001); +40.8pp on Llama-3.3-70B (different harness, not apples-to-apples) | `docs/paper/paper.md:251-256,300-310` |
| `agentgauge:prevalence-null` | Pre-registered N=10 pilot: 0/9 real servers showed the in-regime effect | `docs/paper/paper.md:471` |
| `agentgauge:localizer` | Localizer recall 1.00 but precision 0.167 under two framings | `docs/paper/paper.md:527-547` |
| `agentgauge:seed-bug` | Seed bug reversed two findings; false-positive/false-negative asymmetry stated as an epistemic bound | `docs/paper/paper.md:478-492,645-662` |

### tracegauge (token-efficiency-scorer)

| ID | Claim | Source |
|---|---|---|
| `tracegauge:pointwise-judge` | Reference-based pointwise judge over pairwise (35% vs 9% flip rate under perturbation) | `research/05-architecture-pivot.md:19-21,253-258` |
| `tracegauge:heuristic-pivot` | 3 of 4 heuristics failed inter-annotator κ (0.15/0.43/0.19 vs 0.60 bar; winner 0.825) → full pivot to 3-layer hybrid | `research/05-architecture-pivot.md:33-38,56-102` |
| `tracegauge:judge-independence` | Judge deliberately non-Anthropic (Qwen) — structural self-enhancement-bias prevention | `research/05-architecture-pivot.md:383-388` |
| `tracegauge:no-composite` | No composite score by design; three labeled signals with per-axis caveats | `README.md:19,81,167-168` |
| `tracegauge:local-first` | Localhost-only bind by construction; redaction at ingestion; opt-in-only egress | `README.md:73-76,143-155` |
| `tracegauge:tests` | 643/643 tests; baselines from 75 quality-gated sessions, 5 task types | **Wave 19 correction (2026-07-31):** `CHANGELOG.md:92` ("643/643 tests green, up from 601 in 0.9.0; 43 new tests"), confirmed live via `pytest --collect-only` (643 collected). The prior 601 figure came from `README.md:20` — a scope-limited claim ("The code, the content-free guard, the consent flow, and `tes corpus withdraw` are all built and tested (601 tests green)") describing only the 0.9.0-era community-corpus feature, not the whole suite; it was misread as a whole-suite result. Baselines citation (`README.md:207`) unchanged. |
| `tracegauge:judge-validation` | Judge corroboration 84% strict / 96% top-2, ρ≈0.79 — no human gold labels (stated) | `README.md:67,208` |
| `tracegauge:generalization` | 172 devs / 1,053 sessions: repeated-failed-retry generalizes at ~1.4% vs 6.6% calibration pool (pool labeled a high-waste outlier) | `README.md:65,126,210` |
| `tracegauge:pypi` | Live on PyPI v0.10.0 | `pyproject.toml`; `pip index versions tracegauge` (2026-07-12, above) |
| `tracegauge:held-features` | Community corpus built but dormant; habit coach built then deliberately unshipped | `CURRENT_STATE.md` 0.9.0/0.10.0 sections |

### Expense Tracker (added wave 12)

Overturns the wave-10 skip, which was made against the repo's stale top-level README;
`CURRENT_STATE.md` (post-Phase-3b.1) shows the actual state. Repo confirmed **public** via
`gh repo view` 2026-07-18.

| ID | Claim | Source |
|---|---|---|
| `expense-tracker:state` | Built + deployed: FastAPI on Cloud Run + Next.js 16 on Vercel; Supabase Auth (ES256/HS256 dual JWT), per-user isolation (cross-user → 404), Alembic migrations; 9/9 Playwright auth E2E. **Correction 2026-07-18 (caught by this repo's lychee CI on PR #20):** the documented demo deployment is currently DOWN — frontend `expense-tracker-tawny-eight-98.vercel.app` returns 404, backend `expense-tracker-242393598566.us-central1.run.app` returns 500 (curl-verified). Site treats the project as repo-only (no liveUrl, excluded from `liveProductCount`); the case-study page states the outage explicitly. **Root-caused 2026-07-26 (wave 14, read-only diagnosis — no GCP config/billing touched):** `gcloud run services describe`/`revisions describe` show the latest revision (`expense-tracker-00006-d4c`) reporting Ready, but `gcloud logging read` shows every cold start's Alembic-migration startup step crashing with `sqlalchemy.exc.OperationalError: could not translate host name "db.ckedawgfjwzefayhcybe.supabase.co" to address: Name or service not known` — DNS NXDOMAIN for the Supabase Postgres host, consistent with a paused (free-tier inactivity) or deleted Supabase project, not an application defect; the crashed startup fails Cloud Run's TCP probe, which is what serves the 500/503 to any request. Separately, `curl -I` on the frontend now returns `X-Vercel-Error: DEPLOYMENT_NOT_FOUND` — the Vercel project/deployment backing that domain no longer exists. Neither half is fixable from this session: no Vercel project access to `expense-tracker` (confirmed via `list_projects` against the accessible team — not present), and GCP deploy/billing actions on a separate project are outside this repo's standing exclusion. Numbered recovery steps for GG in `reports/wave14-verification-audit-2026-07-26.md`. **Backend fixed, frontend re-broke (wave 19, 2026-07-31):** the backend half of this outage was fixed the same day it was root-caused — `expense-tracker` commit `7f1e15c` (2026-07-26) migrated the app off the dead Supabase project onto a dedicated schema on a shared one (the same project `review-iq` already uses); live-verified this wave via `curl https://expense-tracker-242393598566.us-central1.run.app/health` → `{"status":"ok"}`, HTTP 200. The migration count grew to 3 in the same commit (`003_app_profiles.py`). The frontend is a **separate** outage: `curl -I https://expense-tracker-tawny-eight-98.vercel.app` → 404, `X-Vercel-Error: DEPLOYMENT_NOT_FOUND`, live-verified this wave — and this is a *second* frontend outage, distinct from the original: wave 16 (2026-07-26, same day) confirmed this exact URL returned HTTP 200 with a live login page (see the wave-16 `expense-tracker:liveurl-correction` entry below), so the Vercel deployment went down again sometime between 2026-07-26 and 2026-07-31. No frontend-redeploy commit exists in the repo to explain it — root cause not investigated this wave (out of scope; flagged for a future pass). `content/products.ts`'s `liveUrl` field was removed rather than left pointing at a 404. | `expense-tracker/CURRENT_STATE.md:6-26,233-236`; outage: curl checks 2026-07-18; root cause: `gcloud logging read` + `gcloud run services/revisions describe`, `curl -I`, 2026-07-26; wave-19 fix verification: `git log` on `expense-tracker` + live `curl` checks, 2026-07-31 |
| `expense-tracker:tests` | 143/143 backend tests, ruff clean, mypy clean | `expense-tracker/CURRENT_STATE.md:228-231` |
| `expense-tracker:ml-features` | Groq NL parsing + 3 local ML features (embedding categorizer, IsolationForest anomaly, Prophet forecast), documented fallbacks, manual non-CI evals | `expense-tracker/CURRENT_STATE.md:69-71,76-77` |

**Not added — reclaim:** the wave-12 inventory re-check found `reclaim` substantially more
complete than its README suggests (all 7 build stages done, real sign-off-gated runs), but the
repo has **no git remote** (local-only, verified `git remote -v` 2026-07-18) — nothing public a
visitor could open or verify, so it stays off the site until GG publishes it. **Update, Wave 14:**
GG made the repo public; see the Wave 14 section below for the full case study now shipped.

### HuggingFace account (wave 12 verification)

Fetched https://huggingface.co/gauravgandhi2411 on 2026-07-18: profile exists ("Gaurav
Gandhi"), 2 public models (`aetherart-ukiyo-sd21`: 6 downloads; `aetherart-ukiyo-sdxl`: 106
downloads), 4 public Spaces (ReviewIQ, AetherArt, Agentic Shopping Assistant, Multimodal
Fashion Recommender), 0 followers. **Decision per the wave-12 brief:** profile linked in the
hero button row and Contact; NO download stat shown anywhere — 112 cumulative downloads is
real but too small to present as a headline number.

## Wave 13 (2026-07-25) — machine metric layer + drift corrections

### The metrics.json layer

Every product-card metric now lives in `content/metrics.json`, keyed by the provenance IDs
in this file, with per-entry `source_file`, `source_line`, `commit_sha`, and `measured_at`
mirroring a `.portfolio/metrics.json` manifest committed to each source repo (11 PRs opened
this wave, one per repo; the Warmer manifest lives in the public `mindmeld-payloads` repo
because `mindmeld` is private). A weekly workflow diffs the store against those manifests
and opens a reviewed PR — this file remains the narrative record; metrics.json is the
machine layer. Verification of every initial value was done against each repo's artifact at
HEAD on 2026-07-25 (three executor passes + orchestrator spot-checks); three real drifts
were found and corrected on the site:

| ID | Change | Source |
|---|---|---|
| `warmer:hinglish-fix` | hi-en Spearman 0.639 → **0.813** (a LoRA fine-tune took 0.639 → 0.800 — `mindmeld/PLAN.md:706` — and an eval-harness RNG fix took 0.800 → 0.813, EN 0.837 → 0.842 — `mindmeld/PLAN.md:1624`); current table read directly from `mindmeld/generator/evals/reports/baseline_report.md:24` @ `16f35d16`. Cross-language pass rate 54.2% → **78.0%** (`baseline_report.md:31`) |
| `gold-rate-tracker:headline` | backtest grew 194 → **199 folds**; naive still wins (MAE 255.28 vs 297.84, Wilcoxon p≈0, run 2026-07-19) — `gold-rate-tracker/data/backtest.json` @ `a4d892c` |
| `agentgauge:scoring-dimensions` | **retired** — see below |

**Wave 19 continuation (2026-07-31):** backtest grew again, 199 → **204 folds** (naive still wins:
MAE 251.99 vs 293.10, Wilcoxon p=0.0001) — `gold-rate-tracker/data/backtest.json` @ `d41372a`
(run 2026-07-26T05:22:51Z, tracked, not gitignored). **Architecture also corrected:** the
case-study's data-source description had Tanishq as primary with IBJA as calibration —
inverted since `docs/adr/025-ibja-primary-source-decision.md` (2026-07-18): Tanishq's
Cloudflare protection now blocks most automated access, so IBJA (the national benchmark) is
primary and Tanishq is opportunistic confirmation. **Investigated: the "165-fold, 10.4% worse,
p=0.0089" figure in `decisions[0]`, initially flagged by an audit as matching no known backtest
snapshot.** It is NOT orphaned — it traces cleanly to `docs/adr/012-naive-headline-chronos-companion.md`
(committed, main tree, `3ec3660d`, 2026-05-19), the *original* decision-triggering backtest, run
before the 194/199/204-fold series existed. The earlier audit's "no known snapshot" conclusion
was a search-depth miss (the ADR file wasn't checked), not a real provenance failure — this repo
also has a stray, gitignored `.claude/worktrees/` directory containing duplicate copies of these
same docs, which can make a shallow repo-wide grep look more ambiguous than the actual git
history is. The case-study text now explicitly dates this as the original 2026-05-19 backtest,
distinct from the current 204-fold figure in Results, to prevent the same "orphaned-looking"
confusion recurring.

**Wave 20 correction (2026-07-31), caught by the extended claim-coverage check:** the "Chronos
direction accuracy" results row still said 52.06% after the 204-fold backtest refresh above —
missed in that same pass because it wasn't re-checked at the time. Live `data/backtest.json`
(`dir_acc_5d_chronos`) is 0.5196 (51.96%), not 0.5206. Corrected, and the row's `sourceRef`
changed from `gold:direction-baseline` (which cites the ADR/STATUS docs, not backtest.json) to
`gold-rate-tracker:headline` (which does) — the wrong sourceRef is very likely why this
specific number wasn't re-checked when the fold count was updated in wave 19.

New ID `warmer:lora-reframe` (case-study decision + story): full-parameter fine-tunes v1/v2
both regressed (v2 worse with 43% more data); a 13-config capacity sweep holding data fixed
showed every LoRA config beating baseline, 3 CI-significantly; shipped model is
`gauravgandhi2411/hinglish-relatedness-sbert` with a public benchmark, leading 7 comparators
— `mindmeld/PLAN.md:590-600` ("The reframe: method was the fault, not data"), `:560-572`,
`:1634-1667`. Held-out honest number 0.4350 → 0.7044 reported alongside the full-set 0.813
(`PLAN.md:706-710` states the distinction; the case study carries both).

### AgentGauge — stale claim caught and replaced

The wave-10 card claim ("8 scoring dimensions, all implemented",
`agentgauge:scoring-dimensions`) went stale: the repo's own predictive-validity study
(`agentgauge/reports/predictive_validity_study.md`) found none of the 8 axes predicts real
task success after multiple-comparison correction and length control, and the project
rebuilt as a statistical regression harness (v2–v2.5). Caught by this wave's
manifest-verification pass — exactly the drift class the weekly pipeline exists for. All
claims below verified against `agentgauge` README.md @ `939abbf` (2026-07-25), which cites
the named report files:

| ID | Claim | Source |
|---|---|---|
| `agentgauge:predictive-validity` | v1's 8-axis LLM-judged score does not predict task success (survives neither multiple-comparison correction nor length control) | `reports/predictive_validity_study.md`; README v2.2 note |
| `agentgauge:icc-mde` | ICC 0.793 across trial repeats → reallocate to 1 trial/task × 100 tasks/arm; MDE 8.5pp at 80% power, ship target (10pp) met | `reports/v2_1_estimator_rebuild.md`, `reports/v2_2_optimal_allocation.md` |
| `agentgauge:blocking-causal` | one BLOCKING defect (type/enum contradiction) causes −13.3 to −28.9pp task success, CI excludes zero in 3 model families | `reports/v2_4_task1_blast_radius_audit.md` @ `78fff2f` (re-verified on a rebuilt instance) |
| `agentgauge:false-alarm` | false-alarm <5% in every cluster-count stratum; 21.6% abstention under the null | `reports/v2_2_few_clusters_correction.md`, `reports/v2_1_estimator_rebuild.md` |
| `agentgauge:judge-baseline` | single-prompt LLM-judge baseline: 97.1% false-alarm rate | `reports/v2_1_cross_model_validation.md` §Task 2e |
| `agentgauge:retiering` | severity tiers re-set by measured causal impact; `required_references_missing_property` demoted BLOCKING→INFO on a measured null | `reports/v2_3_task2_retiering.md` |
| `agentgauge:audit-gate` | `agentgauge audit` — standing pre-report gate (leakage/ceiling/degenerate/scoring-consistency), wired into diff/eval | `agentgauge/README.md:132` — wave-20 fix: previously cited as "README v2.4 note" with no extractable path, so it never resolved for any automated check |
| `agentgauge:v23-scoring-artifact` | the reported −76.7 to −80.0pp ADVISORY effect was a scoring bug (pre-rename param looked up against post-rename args); corrected = clean null for gemma2:9b (+0.0pp), CI includes zero for llama3.1:8b (−13.3pp) and qwen2.5:7b (+6.7pp) — **wave-18 correction:** the wave-13 text here read "clean null in all 3 models," which does not match the source table (`v2_3_task1_advisory_audit.md:109-111` labels only gemma2:9b "clean null"); blast radius audited — the 5,535-trial calibration corpus untouched | `reports/v2_3_task1_advisory_audit.md`, `reports/v2_4_task1_blast_radius_audit.md` |
| task pool | 62 → 253 gold-constraint tasks across 10 real-API domains | README v2.4 note, `reports/v2_4_task4_corpus_expansion.md` |

The paper-layer refs from wave 12 (`agentgauge:frozen-protocol`, `:t18`,
`:prevalence-null`, `:localizer`, `:seed-bug`, `:regime-framing`, `:mock-provider`,
`:governance`) remain valid for the paper, which is unchanged; the case study now leads
with the v2 harness and keeps the paper connection.

### HuggingFace re-check (wave-13 brief item 6)

Fetched via API 2026-07-25: **3** public models now — `hinglish-relatedness-sbert` is new
(459 all-time; it's Warmer's shipped LoRA fine-tune) + `aetherart-ukiyo-sdxl` (249) +
`aetherart-ukiyo-sd21` (31) = **739 cumulative downloads** (was 112 on 2026-07-18).
**Decision:** still below the low-thousands bar → still no download stat on the site. The
count is tracked in `metrics.json`'s informational block; the weekly PR flags it if it
crosses 1,000.

## Wave 14 (2026-07-26) — reclaim added

GG made the `reclaim` repo public (confirmed via `git remote -v` and `git tag -l` this session:
`origin` is `https://github.com/gaurav-gandhi-2411/reclaim.git`, real tags `v1.0.0`–`v1.3.0`,
`pyproject.toml` at `version = "1.3.0"`). Reads in full this session:
`reclaim/README.md`, `reclaim/docs/CASE_STUDY.md` (776 lines, read start to end), `reclaim/PLAN.md`,
`reclaim/reclaim-spec.md`, `reclaim/reclaim-ai-features-spec.md`,
`reclaim/docs/architecture/adr/0001-category-tiered-retention.md`,
`0002-sql-pushdown-candidate-generation.md`,
`0006-hardlink-aware-reclaimable-size-estimate.md`,
`0008-model-cache-and-environment-exclusion-from-exact-duplicate.md`,
`0009-standalone-python-installation-exclusion.md`,
`0010-structural-python-environment-detection.md`,
`0023-stage2-safe-mode-safety-boundary.md`, `0024-stage2-installer-and-ai-bundle-size.md`,
`reclaim/evals/test_safe_mode_gate.py`, `reclaim/tests/frontend/xss.test.mjs`. All paths below
are relative to `C:\Users\gaura\ml-projects\reclaim`.

### reclaim

| ID | Claim | Source |
|---|---|---|
| `reclaim:architecture` | Rules-first, no ML in the deletion path; SafetyValidator deny-first gate (protected roots, git repos, protected extensions, DB/VM files, Docker/WSL roots, cloud-sync placeholders — BLOCKED excludes, never downgrades); dry-run by default; retention is a per-category property (rebuild-recoverable caches delete permanently, everything else vault-/Recycle-Bin-recoverable) | `docs/CASE_STUDY.md:31-58`; `docs/architecture/adr/0001-category-tiered-retention.md:28-51` |
| `reclaim:honesty-arc` | exact_duplicate reclaimable estimate corrected downward 3 times, never up: ~48GB (unexamined logical size) → 23.09GB (hardlink-aware accounting) → 4.26GB (model-cache/environment exclusion) → 3.92GB (net of 186 restored files, post-incident) | `docs/CASE_STUDY.md:60-76` (honesty-arc table); `docs/architecture/adr/0006-hardlink-aware-reclaimable-size-estimate.md`, `0008-model-cache-and-environment-exclusion-from-exact-duplicate.md`, `0009-standalone-python-installation-exclusion.md` |
| `reclaim:bug-trail` | 11-bug trail across observability/scalability/selectivity/honesty themes; capstone incident 11 — exact_duplicate apply recycle-binned 186 files across 3 shared Python installs (none recognized as an "environment" — no `conda-meta/`, no `pyvenv.cfg`), breaking the project's own `.venv` (`import socket` failed); first keyword-driven recovery pass found 71/186; systematic re-audit against all 10,134 applied files found the true 186; all recovered by parsing the Windows Recycle Bin's own `$I`/`$R` index format directly; fixed twice — marker-based check (ADR-0009), then structural detection by default (ADR-0010) after finding Windows venvs put `python.exe` in `Scripts/`, not the venv root | `docs/CASE_STUDY.md:78-171` |
| `reclaim:xss-finding` | Filename-driven XSS in `renderClusterTable` (`src/reclaim/api/static/app.js`) — a file/directory literally named `<img src=x onerror=...>` was interpolated into `.innerHTML`, reachable because the dashboard's CSRF token sits in the same page's DOM; fixed by rewriting to `textContent` (0 `innerHTML` assignments carry a path field anywhere in the codebase today); regression test feeds the exact function an `<img onerror>` and `<script>` payload and asserts the DOM contains zero parsed `<img>`/`<script>` elements | `docs/CASE_STUDY.md:173-205`; `tests/frontend/xss.test.mjs:1-60`; `README.md:268-271` |
| `reclaim:security-audit` | Same audit pass: `--host` hard-gated to `127.0.0.1`/`::1` at argparse parse time; per-process CSRF token + Host/Origin check against the exact loopback authority (DNS-rebinding defense); `restore_batch` refuses any manifest entry whose vault path doesn't resolve inside the configured vault dir or whose original path is a protected root; every mutating command refuses to run under an elevated token; `pip-audit` added to CI | `docs/CASE_STUDY.md:207-215`; `README.md:252-272` |
| `reclaim:ai-layer-boundary` | AI layer's `AICluster`/`AIClusterMember` share zero field names with the deterministic engine's `Candidate` — `apply_batch` accesses `candidate.safety_verdict` unconditionally, so an AI object raises `AttributeError` before any filesystem call; a static AST scan re-checks every `src/reclaim/ai/` file on every CI run for an import of the executor/delete library; `pydantic` `extra="forbid"` rejects any config-injected AI-named category | `docs/CASE_STUDY.md:217-240` |
| `reclaim:phash-measurement` | Feature 1a (pHash near-dup images) measured on INRIA Copydays' `strong` (adversarial) split: precision 0.9600, recall 0.0764 at Hamming distance 14 — real but answering the wrong question. Remeasured on a realistic distribution (5 deterministic transforms — light resave, moderate resize+recompress, PNG round-trip, WhatsApp/Instagram-style resave — applied to Copydays' own 157 real photos): recall 1.0000, precision 0.9987 across 785 pairs, at the identical threshold | `docs/CASE_STUDY.md:309-321,345-384` |
| `reclaim:track-b-clip` | Track B (semantic image grouping): OpenCLIP ViT-B/32 (`"ViT-B-32-quickgelu"` checkpoint variant), MIT end-to-end, chosen over Apple MobileCLIP (non-commercial ToS on pretrained weights); measured BCubed precision 0.7897, recall 0.7143 at similarity threshold 0.82, across 98 real images; gated on precision ≥0.70 AND recall ≥0.20, both cleared | `docs/CASE_STUDY.md:628-658`; `reclaim-ai-features-spec.md:55,72` |
| `reclaim:ranker-consensus` | Generic clutter-likelihood ranker: labels from 3 independent local LLMs via Ollama (`qwen3:8b`, `llama3.1:8b`, `gemma2:9b`), zero paid API calls; Fleiss' κ=0.6768 (N=120, "substantial agreement"); trained on the 79/120 (65.8%) unanimous-only subset (41 non-unanimous records excluded from training, not majority-voted); LightGBM LambdaMART on a grouped (no-leakage) split scored NDCG@5=0.9763 (floor 0.70) / precision@3=1.0000 (floor 0.50) on held-out batches; `_DISTRIBUTION.is_synthetic_only=True` — `assert_safe_to_promote_to_measured` raises by construction, permanently PROVISIONAL | `docs/CASE_STUDY.md:582-626` |
| `reclaim:pooling-bug` | Templated-document remeasurement: pooling a large prose tier (7,140 negatives) with a small templated tier (459 negatives) reported 0.9524 precision; the templated tier alone at the same threshold was actually 0.8634 precision — a real 71% false-positive rate the pooled number hid. Fixed with `select_operating_point_per_tier`/`select_joint_operating_point_per_tier`, which have no code path capable of concatenating counts across tiers before computing a ratio; the incident became a permanent regression test | `docs/CASE_STUDY.md:421-459` |
| `reclaim:safe-mode-installer` | Public installer safe mode: 3 independent structural guarantees — (1) permanent-delete unreachable when `mode=SAFE` (proven by monkeypatching `os.unlink`/`shutil.rmtree` to raise if called, then running a real `apply=True` batch); (2) `duplicates`/`model_caches`/`dev_artifacts` force-disabled regardless of `config.toml`; (3) every apply requires explicit human-picked paths, no blanket tier/category apply. Proven twice against the compiled `reclaim.exe` (raw Nuitka `--standalone` build + real silent install→run→uninstall cycle), not just the source tree. Core-only installer: 13.6MB installed / 18.2MB installer vs. the `[ai]` extra's 1,041.8MB (`torch` alone 464.3MB, shared by document-dedup and CLIP features) | `docs/CASE_STUDY.md:660-719`; `docs/architecture/adr/0023-stage2-safe-mode-safety-boundary.md`; `docs/architecture/adr/0024-stage2-installer-and-ai-bundle-size.md`; `evals/test_safe_mode_gate.py:1-44`; `README.md:278-306` |
| `reclaim:honest-metrics` | Real disk-free reclaimed (measured `shutil.disk_usage` before/after, 3 real applies, independently cross-checked byte-for-byte against the filesystem): 36,216,430,592 bytes = 33.73GB. exact_duplicate candidates applied: 10,134 succeeded / 10,247 selected / 113 failed (all explained: access-denied, file-in-use, long-path, vanished-in-race) | `docs/CASE_STUDY.md:753-767` (honest-metrics table) |
| `reclaim:releases` | Public repo confirmed (`git remote -v`); real GitHub Releases `v1.0.0`–`v1.3.0` (`reclaim-setup.exe`), matching `pyproject.toml`'s `version = "1.3.0"` | `git tag -l`, `git remote -v` (this session); `README.md`'s Download section |

**Metric-store deviation, resolved same-wave:** the executor agent that wrote this section
correctly flagged that `reclaim`'s product-card metric was hand-typed rather than routed through
`refreshableMetric()`, since adding `.portfolio/metrics.json` sat outside its assigned file
scope. Closed before this wave shipped: `reclaim:honesty-arc` now has a `content/metrics.json`
entry (source `docs/CASE_STUDY.md:761`, commit `b7d1aa4`) and the product card reads it via
`refreshableMetric("reclaim:honesty-arc")`, same as every other product; a `.portfolio/
metrics.json` manifest PR is open on the reclaim repo (gaurav-gandhi-2411/reclaim#29, GG
merges) so the weekly refresh picks it up from here on — no exception remains. The honesty-arc
value itself was also corrected to include the missing intermediate step (23.09GB, ADR-0006)
that the case study's first draft had compressed out — the source table has four values across
three corrections, not three.

**Categories:** tagged `tooling` (primary — an end-user Windows desktop tool, the same precedent
as tracegauge), `vision` (Track B's OpenCLIP semantic grouping), `retrieval` (MinHash + sentence-
embedding document near-dup, the closest fit to "Retrieval & Embeddings" among the fixed six).
`evals-research` was considered — the safety-testing rigor is the strongest in the whole
portfolio — but left off to keep the tag count at 3 and because rigorous testing is present
across every project on this site rather than being reclaim's distinguishing *category* signal;
GG can add it back if the judgment call should go the other way.

**Depth-ordering placement:** scored against the wave-13 four-axis rubric (A model/representation,
B eval rigor, C applied-AI system depth, D novel technique) from `reports/wave13-autonomy-density-2026-07-25.md`
— not re-scoring the other 12 products, just placing reclaim among them: A=1 (a real trained
LightGBM LambdaMART ranker, but on 79 labeled records, and every image/doc-similarity model used
is off-the-shelf, not trained from scratch), B=3 (the strongest eval-rigor story on the site:
distribution-trust gating, per-tier pooling prevention, real dataset sourcing across 3 license
audits, a 3.1M-file real-disk validation), C=2 (a genuine multi-stage applied-AI system — 4
features plus a ranker — but deliberately decoupled from the core product as recommend-only,
never in the public installer, weighed honestly per the wave-14 brief rather than scored as if it
were load-bearing), D=1 (no published research, but the self-invented distribution-trust/
per-tier-gating infrastructure has real methodological originality). Σ=7, tying ShelfSense/
AetherArt/AgentGauge — placed last in that tied group (after AgentGauge, before ReviewIQ) because
its A axis is the weakest of the four ties and its C axis is capped by the AI layer's own
recommend-only, not-in-the-installer framing.

**Not verified, left out:** the case study's `.portfolio/`-style dataset-hunt narrative (Copydays
mirror history, AVA rejection) is real but not load-bearing enough to cite as a numbered claim on
the portfolio site — mentioned only in passing in the case-study prose, not as a sourced result
row. No number from `docs/CASE_STUDY.md` was used without a direct line-range read; nothing was
rounded beyond what the source document itself already rounds to (e.g. "~48GB" is the source's own
approximation, not this pass's).

## Wave 16 (2026-07-26) — ReviewIQ rebrand + expense-tracker liveUrl correction

### ReviewIQ → "Samidha Reviews"

| ID | Claim | Source |
|---|---|---|
| `reviewiq:rebrand` | Product's live display name is now "Samidha Reviews" (repo/slug/URLs unchanged) | Live Swagger UI title at the existing `liveUrl` (`https://review-iq-ajjrytb3na-el.a.run.app/docs`) reads "Samidha Reviews API - Swagger UI"; `review-iq/.env.example` sets `RESEND_FROM_NAME=Samidha Reviews` — both confirmed live 2026-07-26 |

**Correction:** `content/products.ts`'s `reviewiq` entry and `content/case-studies/reviewiq.ts`'s
`title` field both said "ReviewIQ" — stale against the live product's own rebrand. Renamed both
to "Samidha Reviews." Explicitly **not** changed: no custom domain exists (`homepageUrl` is empty,
no CNAME file in the repo — verified this wave), so no domain claim was added; the existing
`liveUrl` is unchanged (still the correct, live Swagger UI URL); no "demo retired" language was
added — the repo's own README states "v1 remains live for demo purposes." Repo path, slug, and
GitHub links stay `review-iq`/`reviewiq` throughout (technical identifiers, not the product's
display name) — only the product-facing name changed.

### Expense Tracker — liveUrl corrected

| ID | Claim | Source |
|---|---|---|
| `expense-tracker:liveurl-correction` | Live URL is `https://expense-tracker-tawny-eight-98.vercel.app` — confirmed HTTP 200, live login page | Matches the repo's own registered `homepageUrl`; HTTP 200 check performed this wave (2026-07-26) |

**Correction:** wave 15's report (see `expense-tracker:state` above, dated 2026-07-18) cited
`https://expense-tracker-eight-xi-93.vercel.app` as the (then-down) demo deployment. That URL is
now confirmed **dead (404)** — it is not the project's real deployment. The correct, live
deployment is `expense-tracker-tawny-eight-98.vercel.app`, which matches the repo's own
`homepageUrl` field and returns a working login page (200). `content/products.ts`'s
`expense-tracker` entry now carries this `liveUrl`, and the stale "found down on 2026-07-18 /
no liveUrl" comment (which pointed at the wrong URL's outage, not this one) was replaced with a
short note citing this correction.

**Superseded, wave 19 (2026-07-31):** this same URL 404s again as of this wave — see the
`expense-tracker:state` addendum above. `liveUrl` was removed from `content/products.ts`.

## Wave 17 (2026-07-30) — AetherArt: HF models live, weight-sweep reversal, measurement-defect methodology

AetherArt's cross-family model-verdict audit (`AetherArt/docs/MODEL_VERDICT.md`, HEAD
`eeb5f3a` as of this wave) closed since wave 12's case-study entries were written. Five new
sourced claims added to `content/case-studies/aetherart.ts`; the existing wave-12 rows
(`aetherart:clip-blindness`, `:checkpoint`, `:lora-quality`, `:360-sweep`, `:tests`,
`:caveats`, `:int8-surprise`) are untouched and remain valid — this is the SDXL-era LoRA audit,
a separate (later) body of work from the SD 2.1 CLIP-blindness project those rows describe.

| ID | Claim | Source |
|---|---|---|
| `aetherart:validated-recipe` | Recipe: curated dataset → rank-8 LoRA → pre-registered A/B → adapter-weight sweep, sweep not optional — evaluating only at the library-default weight would have ended the Pattachitra adapter's evaluation with a "loses to base" verdict | `AetherArt/docs/MODEL_VERDICT.md` §7 (827-834), §7.4 (1298-1347); `AetherArt/docs/WEIGHT_SWEEP_PREREGISTRATION.md` |
| `aetherart:pattachitra-weight-sweep` | At `weight=1.0` both checkpoints regress figure_preservation −5.5 to −7.8×SEM vs. `sdxl_base`, no style lift; at `weight=0.3–0.5` (4 operating points, both checkpoints) style_adherence lifts up to +3.622×SEM (ckpt-500/0.3) and +3.482×SEM (ckpt-1000/0.5), figure_preservation improves up to +2.080×SEM (ckpt-500/0.5), no regression | `AetherArt/docs/MODEL_VERDICT.md` §7.3 (1227-1297, table incl. −7.768 row), §7.4 (1298-1332) |
| `aetherart:ukiyo-promotion-withdrawn` | Curated-retrain promotion (+0.0400, 3.182×SEM under correlated single-call judging) withdrawn once independent-axis scoring reran the same n=90 paired comparison (+0.0078, 0.583×SEM) — below the pre-registered 2×SEM bar. 95% CI [−0.0184, +0.0339]; MDE 0.0374 at 80% power; resolving the observed effect to that precision would need ≈1,963 paired samples (~22× n=90) | `AetherArt/docs/MODEL_VERDICT.md` §4.6 (443-541, table at 487-491), §4.7 (542-576, MDE table at 549-555) |
| `aetherart:measurement-defects` | 5 silent measurement-validity defects found and fixed over the project's life (judge context-window truncation, phantom VRAM counter, CUDA context corruption, hardcoded judge question, stale reused reference arm); 3 caught only by re-auditing an already-accepted conclusion; the 4th invisible to every automated check built after the first 3. Standalone writeup drafted, not submitted anywhere | `AetherArt/docs/MODEL_VERDICT.md` §7.7 (1419-1483); `AetherArt/docs/paper/measurement_defects.md` (full draft, commit `eeb5f3a`) |
| `aetherart:hf-models` | 3 published, live HF LoRA adapters: `gauravgandhi2411/aetherart-ukiyo-sdxl`, `gauravgandhi2411/aetherart-ukiyo-sd21`, `gauravgandhi2411/aetherart-pattachitra-sdxl` | Confirmed live via `curl https://huggingface.co/api/models/<id>` for all three, 2026-07-30 (each returns `private: false`) |
| `aetherart:hf-downloads` | HF API `downloads` field (HF's own rolling **last-30-days** count, not all-time — shown with that caveat, not relabeled as cumulative): ukiyo-e SDXL 124, ukiyo-e SD 2.1 14, Pattachitra SDXL 0 (published most recently in this same audit, per `lastModified: 2026-07-26T06:00:02Z`) | `curl https://huggingface.co/api/models/gauravgandhi2411/<id>` → `.downloads`, fetched 2026-07-30 |

**Not shown as a headline number:** HF's `downloads` field is a 30-day rolling count (confirmed
by comparing this wave's 124/14 against wave 13's 2026-07-25 API pull of 249/31 for the same two
models — a drop that only a rolling window explains, not a cumulative counter). Reported as-is,
labeled precisely ("last 30 days, live via HF API"), rather than presented ambiguously as if it
were a lifetime total.

## Wave 18 (2026-07-31) — AgentGauge rewrite: estimator + attribution work, v0.5.2

Wave 13's rewrite reflected the `agentgauge` repo @ `939abbf` (2026-07-25); the estimator and
attribution work in `v0.5.x` (all committed after that snapshot) is a second falsification-and-
pivot the site hadn't caught up to. All claims below verified against `agentgauge` @ `ab62677`
(2026-07-31, tag `v0.5.2`) directly, cross-checked against the repo's own consolidated
`docs/paper2/provenance.md` (34-claim ledger, `b86831b`), which resolves this same repo's three
mid-project number corrections explicitly — see its §0 supersession ledger for the full chain on
each. `agentgauge:predictive-validity`, `:blocking-causal`, `:judge-baseline`, `:retiering`,
`:audit-gate` (wave 13) are reused as-is below; only their case-study prose changed, not their
sourceRef or underlying claim.

| ID | Claim | Source |
|---|---|---|
| `agentgauge:mde-curve` | Minimum-detectable-effect curve at 80% power: naive trial-level (n=20) 0.433 → paired+CUPED (n=20) 0.188 → reallocated to full 253-task corpus 0.0537; false-alarm rate under the null 0.59% (13/2200, paired+CUPED estimator) | `reports/v2_1_estimator_rebuild.md` (ablation table + false-alarm) @ `78fff2f`, `reports/v2_5_task3_mde_completion.md:17-23` (n=253 point, independently re-verified to 4 decimals) @ `78fff2f` |
| `agentgauge:replay-determinism` | 100% cassette-replay determinism, all 6 model-provider adapters, seed=42, zero live network calls — distinct from a separate, also-100% bootstrap/verdict-replay claim in `v2_harness_evaluation.md` (a different subsystem); this ID cites the cassette-replay claim only | `reports/v0_5_wave1_report.md:136` @ `3d79172` |
| `agentgauge:homogenization-falsified` | Pre-registered mechanism hypothesis (LLM-rewritten descriptions "homogenize" toward each other, reducing discriminability) tested against 4 pre-registered falsifiers; all 4 triggered — measured similarity decreased (not increased) in 6/7 pairs, similarity-delta/outcome-delta correlations point the wrong sign. Verdict: falsified as stated | `reports/predictive_validity_study.md` §"Phase 3 mechanism test", lines 247-329 @ `78fff2f` |
| `agentgauge:attribution-kill` | `greedy_bisection` regression-attribution accuracy at the below-detection-floor band (3.0-5.0pp): 58.33% top-1 — does not clear the pre-registered 70% ship bar; measured cost 1.01x-20.24x a full 253-task re-evaluation depending on candidate-set size, crossover to cheaper-than-re-evaluating at ~2-4 changed tools; shipped as unreleased research, disabled behind `--experimental` (`agentgauge/cli.py` `attribute()` command, `_ATTRIBUTION_COST_FINDING`) | `reports/v0_5_mde_discrepancy.md` §4b (accuracy) @ `3d79172`, `reports/v0_5_probe_power_fix.md` §5 / lines 213-253 (cost + ship/kill recommendation) @ `3d79172`; shipped state confirmed directly in `agentgauge/cli.py` lines 1265-1304 |
| `agentgauge:artifact-taxonomy` | 10 distinct measurement-artifact classes found and fixed across this project, each with a named automated detector/regression test (taxonomy table, §4 of the ledger) | `docs/paper2/provenance.md` §4 @ `b86831b` |
| `agentgauge:pypi` | Live on PyPI as `agentgauge-harness`, v0.5.2 | `agentgauge/pyproject.toml`; `pip index versions agentgauge-harness` (2026-07-31, above) |
| `agentgauge:paper2` | Second paper (methods paper): "Powering Agent Evaluations: Variance Structure, Measurement Artifacts, and Minimum Detectable Effects in Tool-Use Benchmarks" — variance structure, the artifact taxonomy, the MDE estimator, and a falsification record | `agentgauge/docs/paper2/main.tex`, `agentgauge/docs/paper2/SUBMISSION.md` @ `78fff2f` (main.tex last touched) |

**Two spec numbers deliberately not shipped — decided by GG, not guessed:**

- **Total cloud spend.** The draft spec cited $29.19; the only sourced total in the repo is
  `reports/v2_2_task_c_gcp_teardown.md`'s $28.39 (GCP compute), and a repo-wide grep for "29.19"
  returns zero matches outside the spec file itself. GG's call: drop the total-spend line from
  the case study entirely rather than cite either an unsourced or a reconstructed number.
- **"4 hypotheses falsified."** Two doctrine reports (`v0_5_eval_doctrine.md:93`,
  `v2_eval_doctrine.md:91`) and the paper2 abstract itself assert this count in passing, but no
  report enumerates all four by name. Three are individually sourced and enumerable: the 8-axis
  quality-score thesis (`agentgauge:predictive-validity`), the homogenization mechanism
  (`agentgauge:homogenization-falsified`), and attribution's economic viability
  (`agentgauge:attribution-kill`, tested against a pre-registered 70% ship bar rather than a
  correlational decision rule, but the same falsify-and-kill pattern). GG's call: cite exactly
  the three that are individually sourced; the case study does not state a headline count of 4.

## Wave 18 (2026-08-05) — site-vs-repo reconciliation

GG's brief: the site had drifted from the repos and the resume; every mismatch is a credibility
risk since the portfolio URL sits in the resume header. 8 parallel research agents independently
verified every numeric/factual claim in all 13 case studies against each project's primary repo
(read-only research passes; all edits below applied directly from their findings, cross-checked
against the cited file:line before writing). Two premises in GG's brief didn't hold under
verification: tracegauge was **not** mis-derived the same way AgentGauge was (already correctly
`surface: "pypi"`), and several fixes below were found independently, not named in the brief —
reported per the explicit "report every discrepancy found, including ones I haven't named"
instruction.

| Project | Claim | Correction | Source |
|---|---|---|---|
| TriageIQ | `triageiq:classifier-top3` | Corrected 82.5%/90.4% (top-3 only, pre-ADR-0036) → 87.1%/60.5% (k8s top-3/top-1), 89.8%/76.5% (vscode top-3/top-1) | `triage-iq/README.md:79-82`; `triage-iq/docs/architecture/adr/0036-classifier-multilabel-supervision-fix.md:58-67` |
| TriageIQ | `triageiq:cqr-coverage` (new) | Conformal Quantile Regression coverage — never surfaced before — 76.2% (k8s) / 74.6% (vscode) vs. 80% nominal target; matches the live-serving artifact, not just a report | `triage-iq/README.md:94,98`; `triage-iq/data/models/cqr_conformal_adjustments.json:11,40` |
| TriageIQ | `triageiq:retrieval-recall5` | Corrected 23.5% (k8s) / "vscode retired" → 18.0% (k8s) / 50.5% (vscode) — two eval-harness corrections deep (ADR-0033 found the original vscode gold pairs ~80% noise; ADR-0035 supersedes both ADR-0031's lever numbers and ADR-0033's baselines) | `triage-iq/README.md:86-89`; `triage-iq/docs/architecture/adr/0035-retrieval-harness-correction.md:1-18` |
| TriageIQ | Top-3-vs-top-1 gap framing | Recomputed 21–31pp → 13–27pp to match the corrected classifier numbers above | Derived from the two rows above |
| TriageIQ | LLM synthesis shot count | Corrected "3-shot" → "4-shot" (ADR-0037 appended a 4th few-shot example; the repo's own README hadn't caught up either) | `triage-iq/docs/architecture/adr/0037-classifier-confidence-framing-judge-regression.md:103-114,172-174`; `triage-iq/src/triage_iq/prompts/triage_prompt.py:607` |
| Style Maitri | `style-maitri:intent-accuracy` | Corrected 93.8% (n=211, 2026-07-12) → 94.4% (n=378) — a same-day (2026-08-05) eval report supersedes the cited one | `agentic-shopping-assistant/reports/model_eval_20260805T070638Z.md:7` |
| Style Maitri | `style-maitri:catalogue-size` | Corrected 52,494 items/8 stores → 112,425 items/42 stores; also corrected the specific 8-store list, which conflated a single-brand demo config table with the real unified-catalogue roster (H&M was dropped from the unified index over a month before this content was written) | `agentic-shopping-assistant/data/processed/unified/catalogue.parquet` (112,425 rows, 42 stores, built 2026-07-24); commit `ec55efb` (H&M drop) |
| Style Maitri | DistilBERT-only router cost | Corrected "$0" → "~$0.05 per 1,000 queries" (the reranker downstream still makes one LLM call) | `agentic-shopping-assistant/reports/router_comparison.md:9-16` |
| Warmer | Hi-en payload size | Corrected "~146 KB/day" → "~150 KB/day" — the repo's own README figure was itself stale relative to actual deployed payloads | `mindmeld-payloads/manifest.json`; e.g. `mindmeld-payloads/hi-en/2026-08-18.json.gz` = 154,347 bytes |
| Warmer | `metrics.json` `repo` field | Fixed metadata bug: field said `mindmeld-payloads`, but the cited `source_file`/`commit_sha` are both from `mindmeld` | `mindmeld` git history contains commit `16f35d1`; `mindmeld-payloads` does not |
| MMFR | FAISS→Qdrant migration path | Corrected — "a shared FAISS shard server" is not a real roadmap phase, it's a rejected alternative (ADR §4, Option B); the actual §5 roadmap is lazy-loading+LRU → Qdrant → per-brand instances | `multimodal-fashion-recommender/docs/architecture/adr/0001-multi-brand-scaling.md:96-104` (rejected alternative) vs. `:132-156` (actual roadmap) |
| MMFR | H&M scaling-budget claim | Corrected "would blow past an 8GiB instance" → "pushes the current 4GiB instance over budget; scaling to include it needs a tight ~8GiB, not comfortable headroom" | `multimodal-fashion-recommender/docs/architecture/adr/0001-multi-brand-scaling.md:48,75` |
| Reclaim | AI-layer bundling | Corrected — ADR-0030 (2026-08-05) supersedes ADR-0024: the AI layer is now bundled into the public installer by default (torch dropped for ONNX-converted CLIP+MiniLM, 199.4MB total; installer 309.3MB / installed 884.0MB), not a source-only `[ai]` extra as the site said | `reclaim/README.md:298-307`; `reclaim/docs/architecture/adr/0030-onnx-conversion-and-bundled-ai-installer.md:1-16,57-78` |
| Gold Rate Tracker | Backtest results row | Fixed an internal-consistency bug: the Wilcoxon p-value (0.0003) and direction-accuracy figure (52.06%) shown alongside the 199-fold MAE numbers actually belonged to a different, earlier 194-fold snapshot — no single commit has all four numbers together. Repinned both to the same commit (`a4d892c`) already cited for the MAE/fold-count: p≈0, direction accuracy 50.75% | `gold-rate-tracker` commit `a4d892c` (`data/backtest.json`, wilcoxon 0.0) vs. commit `06ea421` (194-fold, wilcoxon 0.0003, dir_acc 0.5206) |
| Gold Rate Tracker | Scraper primary-source framing | Corrected — ADR-025 flipped the roles: IBJA is now the primary source and Tanishq is opportunistic secondary confirmation (Tanishq's site blocks automated access behind Cloudflare most of the time), the reverse of what the site said | `gold-rate-tracker/docs/adr/025-ibja-primary-source-decision.md`; `gold-rate-tracker/README.md:7` |
| DealHunter | LLM provider fallback chain | Corrected "a fallback chain across five LLM providers" → the actual live-traffic chain is two hops (Groq → OpenRouter); the other three adapters (Anthropic, NVIDIA NIM, Ollama) serve eval/demo/local-dev purposes, and NIM was tried as a third production profile and abandoned | `agentic-travel-booking-system/docs/architecture/adr/0027-llm-fallback-chain.md:1,50-54`; `CURRENT_STATE.md:635` |
| tracegauge | `tracegauge:tests` | Corrected "601/601 passing" → "643/643 passing" — the cited line was inside a superseded 0.9.0 sub-section of `CURRENT_STATE.md`; the CHANGELOG and a live `pytest` collection both confirm 643/643 is current for the shipped 0.10.0 release | `token-efficiency-scorer/CHANGELOG.md:92`; live `pytest --collect-only` (643 tests, 2026-08-05) |

**Confirmed clean, no changes needed:** ShelfSense, ReviewIQ/Samidha Reviews, Expense Tracker —
every numeric/factual claim independently verified against the repo with no discrepancies found.
AetherArt had one additional fix beyond the table above: a factual sign inversion (the site said
training loss "dipped further" at checkpoint 1500, implying a naive heuristic would pick it; the
repo says loss **jumped** ~10× at step 1500 — corrected in `content/case-studies/aetherart.ts`'s
`aetherart:checkpoint` decision).

**AgentGauge surface fix (already applied same session, documented in the resume-variant-
generator's amendment 4 log above):** `content/products.ts`'s AgentGauge entry was missing a
`pypi` field despite being published (`agentgauge-harness` v0.5.2) — added, which also moved the
site's own live-product-count hero stat 11→12 (computed via `liveProductCount()`, not hardcoded,
so no separate site edit was needed for that number).

**AgentGauge findings from this pass, superseded during the `main` rebase (2026-08-05):** this
session independently found the 45-tool-sets/10-artifacts/MDE-update facts above; the rebase onto
`main` surfaced that `main` already carried a more thorough, independently-produced AgentGauge
rewrite (the **Wave 18 (2026-07-31)** section immediately above this one — same underlying repo
state, cross-checked against the repo's own `docs/paper2/provenance.md` 34-claim ledger, with a
fuller MDE derivation chain and the killed regression-attribution pivot this pass never surfaced).
GG's explicit call: take `main`'s AgentGauge content wholesale, discard this session's version.
The two duplicate rows this pass had added to the table above were removed accordingly; nothing
in `main`'s section conflicted with this pass's other 9 projects, so those stand unchanged.

## Wave 19 (2026-08-05) — PR #32 evidentiary audit, pipeline fail-closed fix

Follow-up to Wave 18. GG flagged that this branch was stale relative to `main` — PR #32
("fix(content): correct 5 drifted numbers across case studies") had already merged, reaching
nearly identical numbers to Wave 18's independently for TriageIQ, tracegauge, and (partially)
Style Maitri/DealHunter. GG also flagged an open automation PR (#44) that would have reverted
those correct values back to stale ones. Full resolution, in order:

- **PR #44 closed, not merged** (2026-08-05T09:56:41Z) — it proposed reverting 4 metrics
  gg-portfolio's own weekly refresh had already corrected via PR #32, because the source repos'
  `.portfolio/metrics.json` manifests were never updated after PR #32's hand-verified fix. Root
  cause fixed below (items 9-10), not just the symptom.
- **Style Maitri accuracy/catalogue-size: reverted.** PR #32's 94.4%/n=378 and 112,425/42-stores
  values come from `agentic-shopping-assistant`'s `reports/model_eval_*.md` and
  `data/processed/unified/catalogue.parquet` — both **gitignored, never committed**, confirmed by
  `git ls-files` returning empty for every candidate file. No git commit date exists for either
  number. The prior values (93.8%/n=211, 52,494/8 stores) are git-committed:
  `reports/final_scorecard_2026-07-12.txt:109` (commit `57e7e60`, titled "final honest scorecard
  — supersedes the 2026-07-11 versions") and `reports/soldout_filter_fix_2026-07-12.txt:28`
  (commit `5996226`). Per GG's explicit rule — a number without a dated, auditable artifact behind
  it doesn't ship, and PR #32 is not evidence for itself — reverted `content/case-studies/
  style-maitri.ts` and `content/resume-data.json` to the git-verified numbers. The 8-store list
  itself WAS corrected (Snitch/Fashor/Virgio/Powerlook/Myntra/Flipkart/GlobalRepublic/Libas,
  replacing an original list that conflated a different single-brand demo table) — that
  correction comes from the same committed report as the store count, so it stands.
- **DealHunter test count: 597 → 727, kept.** Independently re-confirmed via a live
  `pytest --collect-only` run this session (`agentic-travel-booking-system`, 2026-08-05T09:59:47Z,
  727 tests collected, matching PR #32's figure exactly) — a reproducible live measurement, not a
  claim in a stale doc (`CURRENT_STATE.md:645`'s 597 was a frozen 2026-06-09 snapshot). Site
  updated; resume already had its raw count purged (see Wave 18/amendment 6) so no resume change
  needed.
- **Gold Rate Tracker: unchanged from Wave 18** — that fix was already pinned to a real,
  git-committed single snapshot (commit `a4d892c`, 2026-07-19T10:46:27+05:30), so no reversion
  applies.
- **Retrieval precision@5 (Style Maitri): reverted to the original site text.** Both the old and
  new numbers for this specific claim came from gitignored reports (`model_eval_20260712T091248Z.md`
  and `model_eval_20260805T070638Z.md`, neither tracked) — with neither side git-verifiable, kept
  the pre-existing baseline rather than swap one unverifiable number for another.
- **DistilBERT router cost (Style Maitri): kept.** `reports/router_comparison.md` IS git-tracked
  (commit `1487811c`, 2026-04-28) — real evidence, unaffected by the reversion above.

**Pipeline fix (`scripts/refresh-metrics.mjs`), items 9-10:**
1. **Fail-closed on a stale manifest**: a repo's `.portfolio/metrics.json` is now checked for its
   own freshest `measured_at` before any of its values are propagated; if the freshest entry is
   more than `MANIFEST_STALE_DAYS` (21) old, the whole repo's changes are held and reported, not
   opened as a PR. The script has no way to see "the repo's newest eval artifact" directly (it
   only fetches one file via `raw.githubusercontent.com`) — this is a proxy, not a perfect signal,
   and produces real false positives (AetherArt/ReviewIQ/Expense Tracker's manifests are all
   correct in value but old by this clock — see the table below) as well as real catches
   (tracegauge, DealHunter). Documented as a known tradeoff in the script's own comments, not
   hidden.
2. **Regression guard**: a manifest may only move a metric's `measured_at` forward. An incoming
   value with a `measured_at` that isn't strictly newer than what's already recorded is rejected
   outright and reported — this is exactly the shape of PR #44's attempted revert, and would have
   blocked it mechanically rather than requiring a human to notice and close it.

**Manifest staleness audit (report only, per GG's instruction — no repo manifests regenerated this
session):**

| Repo | Manifest metric | Value | measured_at | Age (2026-08-05) | Status |
|---|---|---|---|---|---|
| token-efficiency-scorer | tracegauge:tests | 601/601 | 2026-07-04 | 32d | **Stale — wrong value** (real: 643/643); now held by the 21d gate |
| agentic-travel-booking-system | dealhunter:test-coverage | 597 tests | 2026-06-09 | 57d | **Stale — wrong value** (real: 727); now held |
| AetherArt | aetherart:vram | 6.2GB | 2026-06-01 | 65d | Value still correct; held anyway (false positive — old manifest, right answer) |
| review-iq | reviewiq:extraction-eval | 83.8% | 2026-07-06 | 30d | Value still correct; held anyway (false positive) |
| expense-tracker | expense-tracker:tests | 143/143 | 2026-06-01 | 65d | Value still correct; held anyway (false positive) |
| gold-rate-tracker | gold-rate-tracker:headline | qualitative | 2026-07-19 | 17d | Under the 21d gate, propagates normally |
| reclaim | reclaim:honesty-arc | chain | 2026-07-23 | 13d | Under the 21d gate, propagates normally |
| agentgauge | agentgauge:blocking-causal | −13.3 to −28.9pp | 2026-07-25 | 11d | Under the 21d gate; value unchanged, but manifest's single-value schema can't express the 45-tool-sets/10-artifacts/5.37pp-MDE facts the Wave 18 (2026-07-31) AgentGauge rewrite added |
| triage-iq, agentic-shopping-assistant, mindmeld, multimodal-fashion-recommender | — | — | — | — | **No `.portfolio/metrics.json` at all** — structural gap, pipeline can never refresh these regardless of manifest age |

Not implemented this session (out of scope per GG's "report only" instruction): regenerating any
individual repo's manifest, or building the 4 missing manifests from scratch. GG to decide backfill
order.

## Wave 20 (2026-08-06) — Style Maitri homepage card drift, root cause + fix

Wave 19's revert (above) fixed `content/case-studies/style-maitri.ts`'s case-study body back to
the git-committed 93.8%/n=211 and 52,494/8-store figures. It did **not** fix two other places that
independently carried the same stale, gitignored-sourced numbers, because neither ever appeared in
a rebase conflict — git conflict detection only flags lines two branches both touched, and nothing
in Wave 18/19's diff touched these:

- `content/products.ts`'s Style Maitri entry: `tagline` claimed "42 store catalogues"; `figure`
  hardcoded `{ pct: 94.4, valueText: "94.4% (n=378)" }` — the homepage/projects-grid card value,
  entirely independent of the case-study body's own text.
- `content/metrics.json`'s `style-maitri:intent-accuracy` and `style-maitri:catalogue-size`
  entries: both still cited `reports/model_eval_20260731T060759Z.md` and the gitignored
  `catalogue.parquet` read — the exact same inadmissible-evidence class Wave 19 already rejected
  for the case-study body, just never applied here.

Net effect, live in production for the length of one deploy cycle: the case-study page
(`/work/style-maitri`) showed the correct, reverted numbers while the homepage/projects-grid card
for the same project showed the old, unverifiable ones — a same-project internal contradiction,
not a stale-vs-current split between two different sources.

**Fixed**, both files, cited to the same committed sources already established in Wave 19:

| Field | Old value | New value | Source |
|---|---|---|---|
| `style-maitri:intent-accuracy` | 94.4% (n=378) | 93.8% (n=211) | `reports/final_scorecard_2026-07-12.txt:109` (commit `57e7e6078a04d7fafb33219d597afd3548870a35`): `intent all-exact    93.8%  (min 88.0%, n=211) PASS` |
| `style-maitri:catalogue-size` | ~112K items / 42 stores | 52,494 items / 8 stores | `reports/soldout_filter_fix_2026-07-12.txt:28` (commit `59962265b85f5a159e60c2a18db32d1b3650385c`): `Catalogue size: 61,883 -> 52,494 items ... across all 8 stores` |
| `products.ts` tagline | "42 store catalogues" | "8 store catalogues" | same as catalogue-size above |
| `products.ts` figure | `{ pct: 94.4, valueText: "94.4% (n=378)" }` | `{ pct: 93.8, valueText: "93.8% (n=211)" }` | same as intent-accuracy above |

**Process gap this exposes:** a control that only fires on a git conflict is structurally blind to
a same-project internal contradiction across files that no single commit touched together — the
failure mode (this incident, plus the case-study-body reversion itself, plus dealhunter's stray
coverage-value carryover caught the same way during Wave 19) has now recurred three times, always
outside marked conflicts. `scripts/check-card-consistency.mjs` (added this wave) closes this class
directly: it compares `products.ts`/`metrics.json` claims against each project's own case-study
body, entirely within this repo (no network fetch, no dependence on a rebase ever happening), and
fails closed on any per-project internal disagreement — see that script's own header comment.

## Known gaps / not shipped

- **Headshot:** none provided. Site ships without one (optional per spec).
- **arXiv IDs for both AgentGauge papers:** not yet assigned for either — Research section ships
  both entries with `status: "preprint-pending"`, no live arXiv/Scholar link. Flip each
  independently when assigned (separate from Wave 3 "Living portfolio," which is the current
  wave — the original spec's post-arXiv wave 3 is still pending on GG getting real IDs).
- **Uber-metric confidentiality:** no override received from GG — default applied (publish only
  what's already in the resume; nothing beyond the resume's own Indium/Uber bullets is used).

## Wave 15 pipeline proposals — 2026-07-31 (LLM-consensus, pending human review)

Each proposal below passed all three stages (curator score against `docs/content-pipeline-rubric.md`, framer draft, verifier cross-check from a different model family) but is **not yet reflected in any case study** — this is LLM-consensus judgment, not a human-reviewed claim. Fold into the relevant case study by hand if you agree; delete this section once actioned or rejected.

- **gaurav-gandhi-2411/triage-iq** (curator 5/5 — The candidate fact demonstrates a measured result with a clear comparison to a baseline, is verifiable from the provided source text, and is not redundant with the current case-study copy.; verifier: The draft accurately reflects all numerical values, technical terms, and the comparative improvement stated in the source table without adding unsupported claims or altering the tone.)
  Source: `README.md:93`
  Draft: "Improved the accuracy of a resolution predictor by 3.27 percentage points, from 29.97% to 33.24%, using a bucket classifier in a Kubernetes environment."
  Suggested provenance ID: `triage-iq:resolution-predictor-accuracy`
- **gaurav-gandhi-2411/triage-iq** (curator 5/5 — This fact proves a skill by demonstrating a measured result of the LLM synthesis, is verifiable as it is present in the README, is current as there is no date mentioned to suggest otherwise, and isn't redundant as it provides a specific metric not mentioned in the current case-study copy.; verifier: The draft accurately and neutrally translates all numerical values and contextual details from the source table row without adding unsupported claims or tonal shifts.)
  Source: `README.md:101`
  Draft: "Achieved a mean-band score of 8.36/15 (55.8%) for LLM synthesis using a regression detector in a vscode environment."
  Suggested provenance ID: `triage-iq:llm-synthesis-score`
- **gaurav-gandhi-2411/shelfsense-m5** (curator 5/5 — This fact demonstrates a skill by showcasing the ability to handle a large dataset, apply stratified sampling, and achieve a competitive result on a Kaggle submission, with specific metrics and numbers that are verifiable from the source text.; verifier: The draft accurately reflects all numerical values, claims, and neutral tone from the source without introducing unsupported information or tone drift.)
  Source: `README.md:109`
  Draft: "Built a stratified 1,000-series sample from 30,490 series to enable rapid iteration, achieving an ETS WRMSSE of 0.6541 on the sample and a public score of 0.8377 on Kaggle."
  Suggested provenance ID: `shelfsense-m5:rapid-iteration-sample`
- **gaurav-gandhi-2411/multimodal-fashion-recommender** (curator 5/5 — This fact proves a skill by demonstrating the model's performance on a specific user archetype and providing insights into its strengths and weaknesses, and is verifiable as it is literally present in the source text.; verifier: The draft accurately reflects the source's specific metrics, user behavior description, and model performance observation without introducing unsupported claims or tone drift.)
  Source: `README.md:202`
  Draft: "Identified the lowest fused similarity scores (0.33–0.38) in users who browse a single colour across many product types, demonstrating the model's ability to retrieve the correct colour with weak confidence."
  Suggested provenance ID: `multimodal-fashion-recommender:colour-browsing-patterns`

## Wave 15 pipeline proposals — 2026-08-03 (LLM-consensus, pending human review)

Each proposal below passed all three stages (curator score against `docs/content-pipeline-rubric.md`, framer draft, verifier cross-check from a different model family) but is **not yet reflected in any case study** — this is LLM-consensus judgment, not a human-reviewed claim. Fold into the relevant case study by hand if you agree; delete this section once actioned or rejected.

- **gaurav-gandhi-2411/triage-iq** (curator 5/5 — This fact proves a skill by demonstrating a measured result with a comparison to a naive approach, is verifiable as it is present in the README, is current as there is no date information to suggest otherwise, and is not redundant as it provides new information not reflected in the current case-study copy.; verifier: The draft accurately translates the tabular metrics and context into a factual sentence, preserving all numerical values and technical terms without introducing unsupported claims or tone shifts.)
  Source: `README.md:93`
  Draft: "Improved the accuracy of a resolution predictor by 3.27 percentage points, from 29.97% to 33.24%, using a bucket classifier in a Kubernetes environment."
  Suggested provenance ID: `triage-iq:resolution-predictor-accuracy`
- **gaurav-gandhi-2411/triage-iq** (curator 5/5 — This fact proves a skill by demonstrating a measured result of the LLM synthesis, is verifiable as it is present in the README, is current as there is no date mentioned, and isn't redundant as it provides a specific metric not mentioned in the current case-study copy.; verifier: The draft accurately translates all numerical values and specific terms from the source table row into a neutral, factual sentence without adding unsupported claims or tone drift.)
  Source: `README.md:101`
  Draft: "Achieved a mean-band score of 8.36/15 (55.8%) on LLM synthesis using a regression detector in a vscode environment."
  Suggested provenance ID: `triage-iq:llm-synthesis-score`
- **gaurav-gandhi-2411/shelfsense-m5** (curator 5/5 — This fact proves a skill by demonstrating a measured result and an architectural decision with a stated trade-off, is verifiable from the source text, is current, and isn't redundant to the existing case-study copy.; verifier: The draft accurately reflects all numerical values and claims from the source without introducing unsupported information or tone drift.)
  Source: `README.md:109`
  Draft: "Built a stratified 1,000-series sample from 30,490 series to enable rapid iteration, achieving an ETS WRMSSE of 0.6541 on the sample and a public score of 0.8377 on Kaggle."
  Suggested provenance ID: `shelfsense-m5:README.md-109`
