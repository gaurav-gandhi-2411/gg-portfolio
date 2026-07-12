# Content Provenance Manifest

Every number, metric, or factual claim rendered on the site carries a `sourceRef` in
`content/*.ts` that matches an ID (`#`) in this file. No source, no ship — claims without a
verifiable citation were omitted, not softened (rule 65b). Built by reading the actual repos on
**2026-07-12**, not from memory and not by trusting the June-12 project inventory without a
spot-check — several numbers had already drifted by a month; corrections are logged below.

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
| `derived:products-live-count` | "9 live AI products" | Derived, not external: count of entries in `content/products.ts` with a set `liveUrl` or `pypi` field as of this wave (8 live web demos + 1 published PyPI package = 9; ShelfSense is repo-only and excluded from this count, though still shown as a card) |

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

### Style Maitri

| ID | Claim | Source |
|---|---|---|
| `style-maitri:intent-accuracy` | 93.8% intent-parsing accuracy (n=211) | `agentic-shopping-assistant/reports/soldout_filter_fix_2026-07-12.txt:41-46`, cross-checked same-day in `reports/model_eval_20260712T091248Z.md:7,19-25` |
| `style-maitri:catalogue-size` | ~52K cross-store items | `agentic-shopping-assistant/reports/soldout_filter_fix_2026-07-12.txt:28` — "Catalogue size: 61,883 → 52,494 items" (current, post sold-out-filter fix, dated 2026-07-12, i.e. today) |

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

### TriageIQ

| ID | Claim | Source |
|---|---|---|
| `triageiq:classifier-top3` | Component classifier top-3 accuracy: 82.5% (k8s) / 90.4% (vscode) | `triage-iq/README.md` "Classifier metric correction (2026-07-11)" note; full methodology `triage-iq/reports/model_eval_audit.json` → `component_classifier` |

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

### DealHunter (agentic-travel-booking-system)

| ID | Claim | Source |
|---|---|---|
| `dealhunter:test-coverage` | 597 tests (579 passed, 3 skipped, 15 Docker-blocked pre-existing), ≥87.65% coverage | `agentic-travel-booking-system/CURRENT_STATE.md:645` (itemized breakdown), `:135` (87.65% coverage figure); live `pytest --collect-only` re-run 2026-07-12 confirms the codebase has grown well past this floor (727 tests collected, includes eval/integration suites not all counted in the README figure) |

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

### Multimodal Fashion Recommender

| ID | Claim | Source |
|---|---|---|
| `mmfr:recall10` | Recall@10 lift 3.06× vs. popularity baseline (0.0328 vs. 0.0107) | `multimodal-fashion-recommender/README.md:113,119-126`; locked-gate cross-check `PROJECT_MEMORY.md:375-386` ("Δ = 0.000000 vs baseline, identical"). Re-confirmed unchanged 2026-07-12 (matches the earlier concurrent-session pass exactly) |

Live entry point is the Hugging Face Space (H&M-only demo); Cloud Run deploy is not yet live —
used the HF Space URL as the card's live link, not an aspirational Cloud Run URL.

### Gold Rate Tracker

| ID | Claim | Source |
|---|---|---|
| `gold-rate-tracker:headline` | Naive flat-hold beats the ML model (Chronos-Bolt-Tiny) by ~15% MAE on a 194-fold backtest, Wilcoxon p=0.0003 | `gold-rate-tracker/data/backtest.json` (live, bot-refreshed, latest run 2026-07-12T05:18:23Z): `mae_5d_avg_naive: 258.28` vs `mae_5d_avg_chronos: 297.19`, `wilcoxon_signed_rank_p: 0.0003` |

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

### tracegauge

| Claim | Source |
|---|---|
| PyPI package `tracegauge`, current version 0.10.0, `pip install tracegauge` | `token-efficiency-scorer/pyproject.toml` (`name = "tracegauge"`, `version = "0.10.0"`), confirmed live via `pip index versions tracegauge` (2026-07-12), badges in `README.md:6-7` |

Note: the PyPI package name (`tracegauge`) differs from the GitHub repo name
(`token-efficiency-scorer`) — the card's repo link points to the actual repo; package
name/install command reference the PyPI name.

## Known gaps / not shipped

- **Headshot:** none provided. Site ships without one (optional per spec).
- **arXiv ID for the AgentGauge paper:** not yet assigned — Research section ships with
  `status: "preprint-pending"`, no live arXiv/Scholar link. Flip in Wave 3 per spec.
- **Uber-metric confidentiality:** no override received from GG — default applied (publish only
  what's already in the resume; nothing beyond the resume's own Indium/Uber bullets is used).
