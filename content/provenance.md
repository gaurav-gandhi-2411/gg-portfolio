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

| ID | Claim | Source |
|---|---|---|
| `style-maitri:garment-normalizer` | Deterministic, rule-based garment-type normalizer resolving inconsistent product titles across store catalogues into one canonical taxonomy (garment type + category + confidence score), no LLM | `agentic-shopping-assistant/src/catalogue/normalizer.py` — module docstring lines 1–19 labels it "GarmentNormalizer"; actual callable is the function `normalize_garment_type()` at line 155 (there is no `class GarmentNormalizer` — verified via grep, zero hits — "GarmentNormalizer" is the module's informal/doc name, not a literal identifier, so the card copy describes what it does rather than naming a class that doesn't exist) |

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
| `warmer:tests` | 160/160 generator + 94/94 app + 2/2 emulator integration tests | `mindmeld/README.md:175-176` |
| `warmer:perf-budget` | TBT 26ms (≤200ms budget, pass); LCP 3,082ms vs 3,000ms ceiling — failing by 82ms, tracked openly | `mindmeld/docs/known-limitations.md:369-375` |

### Style Maitri (agentic-shopping-assistant)

| ID | Claim | Source |
|---|---|---|
| `style-maitri:hybrid-retrieval` | Hybrid FAISS+BM25 via RRF handles both vibe and exact-keyword queries | `README.md:15,167-172` |
| `style-maitri:router-decision` | Router experiment: LLM 100% pass/~2100ms/~$0.10 per 1k vs DistilBERT 75%/31ms/$0 vs cascade 94%; kept LLM router + deterministic code guard | `reports/router_comparison.md:6-20`, `src/agents/graph.py:3345` |
| `style-maitri:flywheel-ranking` | Transparent outfit-ranking boost: final_score = coherence × (1 + 0.25 × positive_rate), ≥10-signal cold-start gate | `docs/architecture/adr/0005-flywheel-ranking-blend.md:6-14,32-34` |
| `style-maitri:retrieval-eval` | Retrieval P@5 96–99% occasion/search, 67% adversarial (n=92) | `reports/model_eval_20260712T091248Z.md:19-24` |
| `style-maitri:live-audit` | Adversarial live audit: 15/32 skeptical-shopper queries disappointing; 2 trust-destroying bugs; outfit-board honest vs plain-search confabulating on identical missing inventory | `reports/deep_diagnosis_2026-07-12.md:3-9,125-138` |

### TriageIQ (triage-iq)

| ID | Claim | Source |
|---|---|---|
| `triageiq:classifier-bakeoff` | DistilBERT +1.2pp on vscode (needed +11pp for 20x latency), −5.1pp on kubernetes; TF-IDF wins at this data scale | `reports/03_classifier_comparison.md:257-260,395-412` |
| `triageiq:cqr` | Raw quantile coverage unreliable (74.4%/38.2%); CQR gives distribution-free guaranteed coverage | `docs/architecture/adr/0010-conformal-quantile-regression.md:14-38` |
| `triageiq:split-fix` | closed_at split leaked (train median 1.0d vs test 677d); created_at re-split dropped MAE 693→87 days; has_priority feature leak (corr 0.595, applied during triage) | `docs/architecture/adr/0009-resolution-predictor-diagnosis.md:60-93,184` |
| `triageiq:retrieval` | k8s Recall@5 23.5% "genuinely weak"; vscode retired (gold pairs ~80% noise); 3 zero-training fixes all failed, reranking regressed at 190-330x latency | `README.md:86-90,117-120,193-207` |
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

### Gold Rate Tracker

| ID | Claim | Source |
|---|---|---|
| `gold:direction-baseline` | Direction baseline corrected 50% → true base rate 69.7–75.5% ("always predict up" in a bull regime); model loses on every window; signal kept DARK | `docs/adr/019-direction-signal-below-base-rate.md:16-35,62-72`, `docs/DIRECTION_SIGNAL_STATUS.md:15-20` |
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
| `tracegauge:tests` | 601/601 tests; baselines from 75 quality-gated sessions, 5 task types | `README.md:20,207` |
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
| `expense-tracker:state` | Built + deployed: FastAPI on Cloud Run + Next.js 16 on Vercel; Supabase Auth (ES256/HS256 dual JWT), per-user isolation (cross-user → 404), Alembic migrations; 9/9 Playwright auth E2E. **Correction 2026-07-18 (caught by this repo's lychee CI on PR #20):** the documented demo deployment is currently DOWN — frontend `expense-tracker-tawny-eight-98.vercel.app` returns 404, backend `expense-tracker-242393598566.us-central1.run.app` returns 500 (curl-verified). Site treats the project as repo-only (no liveUrl, excluded from `liveProductCount`); the case-study page states the outage explicitly. | `expense-tracker/CURRENT_STATE.md:6-26,233-236`; outage: curl checks 2026-07-18 |
| `expense-tracker:tests` | 143/143 backend tests, ruff clean, mypy clean | `expense-tracker/CURRENT_STATE.md:228-231` |
| `expense-tracker:ml-features` | Groq NL parsing + 3 local ML features (embedding categorizer, IsolationForest anomaly, Prophet forecast), documented fallbacks, manual non-CI evals | `expense-tracker/CURRENT_STATE.md:69-71,76-77` |

**Not added — reclaim:** the wave-12 inventory re-check found `reclaim` substantially more
complete than its README suggests (all 7 build stages done, real sign-off-gated runs), but the
repo has **no git remote** (local-only, verified `git remote -v` 2026-07-18) — nothing public a
visitor could open or verify, so it stays off the site until GG publishes it.

### HuggingFace account (wave 12 verification)

Fetched https://huggingface.co/gauravgandhi2411 on 2026-07-18: profile exists ("Gaurav
Gandhi"), 2 public models (`aetherart-ukiyo-sd21`: 6 downloads; `aetherart-ukiyo-sdxl`: 106
downloads), 4 public Spaces (ReviewIQ, AetherArt, Agentic Shopping Assistant, Multimodal
Fashion Recommender), 0 followers. **Decision per the wave-12 brief:** profile linked in the
hero button row and Contact; NO download stat shown anywhere — 112 cumulative downloads is
real but too small to present as a headline number.

## Known gaps / not shipped

- **Headshot:** none provided. Site ships without one (optional per spec).
- **arXiv ID for the AgentGauge paper:** not yet assigned — Research section ships with
  `status: "preprint-pending"`, no live arXiv/Scholar link. Flip when assigned (separate from
  Wave 3 "Living portfolio," which is the current wave — the original spec's post-arXiv wave 3
  is still pending on GG getting a real ID).
- **Uber-metric confidentiality:** no override received from GG — default applied (publish only
  what's already in the resume; nothing beyond the resume's own Indium/Uber bullets is used).
