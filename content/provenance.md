# Content provenance — gg-portfolio

Every displayed number/claim on the site traces to a source here (rule 65b). Any claim not
listed below, or listed as "omit," must not ship. Sourced by an independent audit agent against
each repo's actual current state (not memory) — see `content/provenance-audit.md` for the full
report, including numbers that were checked and found correct as originally drafted in `spec.md`.

## Corrected from spec.md's original draft numbers

**These three needed correction before this file existed** — spec.md's draft claims did not
match repo reality:

| Product | spec.md's draft claim | Corrected claim | Source |
|---|---|---|---|
| TriageIQ | "fabrication-gated CI (3.1% measured, hard gate)" | Fabrication rate tracking in CI: **1.9% (kubernetes) / 9.1% (vscode)** — **informational, not a blocking gate** | `README.md:103-104` (numbers), `README.md:177-181` + `eval/test_quality_regression.py:112-121` + `.github/workflows/eval-gate.yml:20,78` (non-blocking status) @ triage-iq `3727cb8` |
| StyleMaitri | "Indian occasion styling, 52–68K cross-store items" | "Indian occasion styling across 8 live brand catalogs (₹99–₹47,999 range); ~51K items across Indian-market brands" | `BRANDS.md:7-14` @ agentic-shopping-assistant `8a2815d`. No file states an aggregate "52–68K" figure; ~51K is the per-brand sum excluding H&M's SEK-priced (non-Indian) catalog. |
| Warmer | "Hinglish embedding eval story (Spearman −0.003 → 0.639)" | Same numbers, correct — but sourced to `PLAN.md`/eval report, **not README** (README has no Spearman figure at all) | `PLAN.md:267`, `generator/evals/reports/baseline_report.json:842` (`spearman_correlation: 0.6392671050340981`), pre-fix baseline in `spec-hinglish-fix.md:4` @ mindmeld `f3e64cf` |

If citing TriageIQ's number on the site: never call it a "hard gate." If citing Warmer's Spearman
story: link to the eval report artifact, not the README, until the number is added there.

## Verified as originally drafted (no correction needed)

| Product | Claim | Source |
|---|---|---|
| ShelfSense | 36% WRMSSE reduction vs. naive baseline (private LB) | `README.md:7,15` @ shelfsense-m5 `45873a7` |
| Multimodal Fashion Recommender | 3.06× Recall@10 vs. popularity baseline | `README.md:117-126` @ multimodal-fashion-recommender `b96fe30` |
| tracegauge (token-efficiency-scorer) | PyPI badge + `pip install tracegauge` one-liner | `README.md:7` (badge), `README.md:31` (install line) @ token-efficiency-scorer `6da6a64`. PyPI package confirmed live (HTTP 200 on `pypi.org/pypi/tracegauge/json`). |
| agentgauge | Paper "Tool-Description Quality Is Not One Axis: A Regime Analysis of Where It Helps and Where It Backfires" | `README.md:15-16` (title), `README.md:18-23` (abstract) @ agentgauge `7c7fbc4`. arXiv ID still unassigned — `README.md:16` shows `arXiv:XXXX.XXXXX (TO FILL after upload)` — keep the research section feature-flagged/hidden per spec.md until a real ID lands. |

## No large-n public metric exists yet — use the honest fallback

| Product | Situation | Fallback claim | Source |
|---|---|---|---|
| DealHunter (agentic-travel-booking-system) | Only a 5/39-case eval sample is committed (`apps/api/evals/wave2/reports/20260707T085306_demo-llama_tier1.md`) — too small to headline per rule 93 (n<50 → treat as noise). No populated `evals/results/summaries/`. | "249 tests, ~90% coverage" | `README.md:119,121` @ agentic-travel-booking-system `4dbc25e`. Omit any eval-accuracy percentage for this card. |
| review-iq | Real number exists, wasn't in spec.md's draft | "85.8% extraction accuracy across English/Hinglish/Hindi (v0.4.0, 46 fixtures), CI-gated at ≥85% overall / ≥80% per language" | `README.md:135-147,271` @ review-iq `a212096` |
| gold-rate-tracker | Real number exists (an honest negative result — worth keeping, it fits the site's "measured, not vibes" positioning) | "$0/month cost; ML forecasts backtested weekly against a naive baseline — none have beaten it yet (shipped honestly, directional signal off)" | `README.md:20,70` + ADR-019 @ gold-rate-tracker `ed41dc4` |
| AetherArt | Real number exists | "Fine-tuned SDXL LoRA, VRAM-optimized to 2.6GB via NF4 quantization; ran an honest CLIP-blindness study showing the standard metric misses LoRA/quantization/scheduler changes that LPIPS registers" | `README.md:45,86,91-123`, `reports/experiments/exp1_sdxl/results.json` @ AetherArt `3936ba8`. README-only sourcing — no GCP config/deploy/billing touched, per the standing hard exclusion on this repo's GCP project. |

## Pending input — cannot be sourced from any repo

The entire §Experience section (Indium/Uber work): multi-agent NL2SQL copilot; document-
understanding encoder-decoder (50M+ docs, 144 A100s, $10M+ savings); LoRA fine-tuning platform;
session-aware recommender (27% engagement lift); ViT document quality gate. **These require the
final resume PDF as the source of record.** None of it is verifiable against `ml-projects/`
repo content — do not source from memory or invent supporting detail. Blocked until GG provides:
resume PDF (final), preferred contact email, LinkedIn URL.

## Audit provenance

Full agent report, all 11 repos' HEAD SHAs and dates, and the complete verification table:
`content/provenance-audit.md`.
