# Content-manifest audit — full agent report

Read-only verification pass against actual current repo state (READMEs + linked eval reports,
`git rev-parse HEAD` per repo), run 2026-07-12. Source of truth for `content/provenance.md`'s
summary tables. Reproduced verbatim from the audit agent's output.

## Repo HEAD SHAs (live `git log`, not memory)

| Repo | HEAD SHA | HEAD date |
|---|---|---|
| agentic-shopping-assistant | `8a2815d572b5eb76449554b31efc2624b10a0772` | 2026-07-12T15:45:32+05:30 |
| mindmeld | `f3e64cf00d1fa8432a043baebeaf3db56329a7e0` | 2026-07-12T17:08:00+05:30 |
| triage-iq | `3727cb83910043847fb3c0ebada635c8c1baabfd` | 2026-07-12T18:38:12+05:30 |
| agentic-travel-booking-system | `4dbc25e4b71e6560bde6ec11d1b19dd1aa88c6bb` | 2026-07-07T14:31:53+05:30 |
| shelfsense-m5 | `45873a734b5122ab19ec5fb814d6bbc71dea0667` | 2026-05-17T19:36:51+05:30 |
| review-iq | `a212096c7d72742d02cf93c3bd4aff8c30365d7e` | 2026-07-11T20:59:25+05:30 |
| multimodal-fashion-recommender | `b96fe30dfd9c688845d87ba9b79e02dca92c9871` | 2026-07-12T03:09:31+05:30 |
| gold-rate-tracker | `ed41dc45476408281ae8be924ab7c1949536a212` | 2026-06-14T06:02:14+05:30 |
| AetherArt | `3936ba8e70d6739ddc05385bbe253a6598e40842` | 2026-06-07T07:08:26+05:30 |
| token-efficiency-scorer | `6da6a64faeb3901ce5beb201b7b971a6d8debcbb` | 2026-07-04T05:32:28+05:30 |
| agentgauge | `7c7fbc4f66e95549bf5900f2f037a776031e864c` | 2026-07-12T18:37:46+05:30 |

*(SHA note from the audit agent: these are exactly what `git rev-parse HEAD` printed — re-run
`git -C <path> rev-parse HEAD` yourself before citing a canonical value in new copy.)*

## Verification table

| Repo | Claim | Verified? | Exact source | Corrected wording |
|---|---|---|---|---|
| agentic-shopping-assistant | "Indian occasion styling, 52–68K cross-store items" | stale/unsupported (item count); occasion-styling capability itself is real | Occasion styling: `src/agents/outfit/occasions.py`, `tests/test_wedding_occasions.py`, `tests/test_cross_store_outfit.py`. Item counts: `BRANDS.md:7-14` @ 8a2815d. No file states an aggregate "52–68K" figure — sum of the per-brand table is ~50.8K (excluding H&M) or ~70.8K (including H&M's ~20K SEK-priced catalog, not INR/Indian). | "Indian occasion styling across 8 live brand catalogs (₹99–₹47,999 range); per-brand items 500–15K, ~51K items total across Indian-market brands (BRANDS.md)." |
| mindmeld (Warmer) | "Hinglish embedding eval story (Spearman −0.003 → 0.639)" | verified in substance, but not in the README | `PLAN.md:267` ("hi-en Spearman correlation | -0.003 | 0.639"), full bake-off table `PLAN.md:238-253`; corroborated in `generator/evals/reports/baseline_report.md:24-25` and `baseline_report.json:842` (`spearman_correlation: 0.6392671050340981`). Pre-fix baseline `-0.003` also in `spec-hinglish-fix.md:4`. All @ f3e64cf. README.md (full 197 lines read) contains no Spearman number — its Results section only states "Hinglish eval gate: 60/60 active ordering fixtures pass" (README.md:158). | Cite `PLAN.md:267` / `baseline_report.json:842`, not README, until the line is added to README's Results section. |
| triage-iq | "fabrication-gated CI (3.1% measured, hard gate)" | unsupported — wrong number and wrong gate status | Measured fabrication rate: README.md:103-104 → 1.9% (kubernetes) / 9.1% (vscode), not 3.1% for either. Gate status: README.md:177-181 explicitly states the rate is "currently reported informationally... pending an observation window before any promotion to a hard gate." Confirmed in code: `eval/test_quality_regression.py:112-121` ("INFORMATIONAL ONLY") and `.github/workflows/eval-gate.yml:20,78` ("NON-BLOCKING"). All @ 3727cb8. | Omit "hard gate" entirely. If citing the rate: "fabrication-rate tracking in CI (1.9% k8s / 9.1% vscode, informational — not yet a blocking gate)." |
| agentic-travel-booking-system (DealHunter) | (no specific number in spec; find best honest one-liner) | n/a — no large-n public eval pass-rate exists yet | `evals/results/README.md:1-3` — run outputs gitignored, only summary CSVs committed; `evals/results/summaries/`/`baseline.json` not present. README's "100% accuracy target" (README.md:121) is aspirational, not measured. One committed eval report has n=5/39 scored — too small to headline per rule 93. Defensible metric: README.md:119 "249 tests, ~90% coverage". @ 4dbc25e. | "249 tests, ~90% coverage (README.md:119)." Omit any eval-accuracy percentage. |
| shelfsense-m5 | "36% WRMSSE ↓ vs baseline" | verified | README.md:7 "Best public LB: 0.5422 · Best private LB: 0.5693 · Baseline (SN28): 0.8377 / 0.8956 · 36% private WRMSSE reduction"; restated README.md:15. @ 45873a7. | No change needed. |
| review-iq | (no specific number in spec; find one) | verified — real measured number exists | README.md:135-147 eval table; most recent: v0.4.0 85.8% overall (87.1% en / 83.1% hi-en / 87.5% hi), 46 fixtures. CI gate: README.md:271 "overall ≥85%, per-language ≥80%" enforced in eval.yml. @ a212096. | "85.8% extraction accuracy across English/Hinglish/Hindi (v0.4.0, 46 fixtures), CI-gated at ≥85%." |
| multimodal-fashion-recommender | "3.06× Recall@10" | verified | README.md:117-126 table: "Multimodal two-tower (ours) | 0.0328 | 3.06× | 2.12×" vs. popularity baseline, active pool (10,556 items), test set n=110,390 users. @ b96fe30. | No change needed. |
| gold-rate-tracker | (no specific number in spec; find one) | verified — an honest negative result | README.md:70 "on the walk-forward backtest no model beats it on magnitude (it's ~14% worse, p≈0.003)" — every ML model tested loses to the naive flat-hold baseline; directional signal measured and shipped OFF (README.md:20, ADR-019). @ ed41dc4. | "$0/month cost; ML forecasts backtested weekly against a naive baseline — none have beaten it yet (documented honestly, directional signal shipped off)." |
| AetherArt | (no specific number in spec; find one) | verified — real measured number exists | README.md:45,86: NF4 4-bit quantization cuts peak SDXL VRAM to 2.6GB (`reports/experiments/exp1_sdxl/results.json`). Also CLIP-blindness study (README.md:91-123) is a real, reproducible negative-methodology finding. @ 3936ba8. Per hard exclusion, only the committed README was read — no GCP/deploy/billing touched. | "Fine-tuned SDXL LoRA, VRAM-optimized to 2.6GB via NF4 quantization; ran an honest CLIP-blindness study showing the standard metric misses LoRA/quantization/scheduler changes that LPIPS registers." |
| token-efficiency-scorer (tracegauge) | "PyPI badge + install one-liner" | verified | PyPI badge: README.md:7. Install one-liner: README.md:31 `pip install tracegauge`. @ 6da6a64. | No change needed. |
| agentgauge | Paper "Tool-Description Quality Is Not One Axis" — abstract + arXiv-placeholder status | verified | Full title: README.md:15-16 "Tool-Description Quality Is Not One Axis: A Regime Analysis of Where It Helps and Where It Backfires". arXiv placeholder still unfilled: README.md:16 `arXiv:XXXX.XXXXX (TO FILL after upload)`. @ 7c7fbc4. | Abstract (verbatim from README.md:18-23): "Tool-description quality is widely treated as a broadly-applicable lever for agent tool-use — but it is not a single better/worse axis: the precision that helps an agent disambiguate within a family of confusable tools is orthogonal to, or actively harmful for, context-rich selection and for tool retrieval. The effect is real but regime-bounded, not a general law — the paper maps the exact boundary (catalog density, headroom, documented source) and finds it rare in a pilot sample of real servers." |

## Claims omitted or reworded before shipping

1. StyleMaitri "52–68K cross-store items" — no source states this aggregate anywhere. Omit the
   number; cite per-brand counts from `BRANDS.md` or the defensible ~51K total instead.
2. TriageIQ "3.1% measured, hard gate" — both the number (actual 1.9%/9.1%) and gate status
   (actual non-blocking/informational) were wrong. Omit "hard gate" language entirely.
3. Warmer's Spearman story, if cited as "per README" — real and verified, but currently lives
   only in `PLAN.md`/eval report JSON, not `README.md`. Cite the PLAN.md/report path directly.
4. DealHunter eval pass-rate — no committed, adequately-powered number exists. Ship "249 tests,
   ~90% coverage" instead, or omit a product-eval metric for this card entirely.

## Work-history claims (spec.md §Experience, Indium/Uber section)

Not verifiable against any repo in `ml-projects/` — resume/work-history claims with no
corresponding open-source artifact. Multi-agent NL2SQL copilot; document-understanding
encoder-decoder (50M+ docs, 144 A100s, $10M+ savings); LoRA fine-tuning platform; session-aware
recommender (27% engagement lift); ViT document quality gate. Require the final resume PDF as
source of record — flagged as pending that input, not sourced from repo content.
