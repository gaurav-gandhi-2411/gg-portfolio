# GG decisions needed: case-study freshness verification (issue #123, 2026-10-10)

Nothing below was edited. No number, wording or `verifiedAt` was changed for any item on this page.
Method: `node scripts/check-metric-freshness.mjs` run locally against current `main` (0a5c0ac), plus
manual reads of the cited sources. The script is a text-presence check, not a re-measurement.

## 1. aetherart: HF download counts no longer match (blocks the `verifiedAt` bump)

| Item | Displayed | Source value now | Source |
|---|---|---|---|
| `aetherart:hf-downloads` (results row, `content/case-studies/aetherart.ts:112`) | `124 · 14 · 0` (ukiyo-e SDXL, ukiyo-e SD 2.1, Pattachitra SDXL), label "downloads last 30 days (HF API)" | `38 · 22 · 0` | `https://huggingface.co/api/models?author=gauravgandhi2411` `.downloads`, fetched 2026-10-10 |

`downloads` is HF's rolling 30-day count, so it will never be stable. The row carries no as-of date
on the page (provenance.md says "fetched 2026-07-30"). Options: show an as-of date, show a
non-rolling figure, or drop the row. Aetherart's other 6 checked claims are current
(`AetherArt` HEAD 10eb31c), but the page was left at `verifiedAt: 2026-07-31` pending this call.

## 2. style-maitri:catalogue-size: checker false positive, source still says 52,494 / 8 stores

| Displayed | Source value now | Source path + SHA |
|---|---|---|
| `52,494 items across 8 stores` | line 28: `Catalogue size: 61,883 -> 52,494 items (-9,389 net ...`, line 29: `... across all 8 stores` | `agentic-shopping-assistant/reports/soldout_filter_fix_2026-07-12.txt`, blob 0c4286d, last touched by commit db4a6ed (still the latest commit touching it); repo HEAD e1bc192 |

Value matches. The checker reports drift because `extractSourceNumbers` drops every number inside an
`A -> B` span as a "changelog transition" (`CHANGELOG_TRANSITION_PATTERN`), and 52,494 only occurs
inside `61,883 -> 52,494`. The same cause explains the cited-line "LINE MISMATCH" for the same entry.
style-maitri's `verifiedAt` WAS bumped on that basis (all its other numbers are current too).
Checker fix, if wanted, is a separate change (treat the right-hand side of `->` as current, or cite
a restated figure). Not done here (scope).

## 3. gold-rate-tracker:headline: checker artifact, claim supported

Displayed "Wilcoxon signed-rank p < 0.001". Source `data/backtest.json:42` is
`"wilcoxon_signed_rank_p": 0.0` (gold-rate-tracker HEAD a4b1e4d). 0.001 is a reporting threshold,
not a value in the source, so token `0.001` can never be found. 0.0 < 0.001 holds. Page not overdue
(`verifiedAt` 2026-09-23); untouched.

## 4. SVG banner pair `warmer:hinglish-fix`: checker false positive

Both `assets/banner-light.svg` and `banner-dark.svg` hold the text `−0.003 → 0.813 after fine-tuning`;
metrics.json value is `0.813` (source `mindmeld-payloads/evals/warmer/baseline_report.md:24`). 0.813 is
present, but it sits inside an `→` span that the same transition-exclusion filter strips. Banner is
in sync. Profile repo not edited.

## 5. warmer: unverified, private source

`gaurav-gandhi-2411/mindmeld` is PRIVATE. 9 numeric claims (`warmer:hinglish-fix`, `-baseline`,
`embedding-separation`, `hinglish-public-benchmark`, `tests`, `perf-budget`, `wasm-decision`,
`lora-reframe`) were not checked; `verifiedAt` left at 2026-07-31. Only the three metrics.json
entries backed by the PUBLIC `mindmeld-payloads` repo are text-confirmed. The local `gh` login is the
repo owner and could read mindmeld; that was deliberately not done per the brief.

## 6. triageiq:contamination-adr0018: checker artifact (not overdue)

Displayed text cites commit "877af11" and "cd2934..." whose digits get tokenised as numbers (877,
2934). Not a drift. triageiq `verifiedAt` is already 2026-10-10 on main.

## 7. warmer: "43% more data" disagrees with the public model card (added 2026-10-12, PR #307)

Not edited (no number changes in that PR). The page says the second full fine-tune "got worse with
43% more data".

| Where | Says | Evidence |
|---|---|---|
| Page decision "When fine-tuning failed twice..." | second attempt "43% more data" | `content/case-studies/warmer.ts:80`; same claim `content/provenance.md:466` and `:683` (cites private `mindmeld/PLAN.md:590-600,...`) |
| Public model card `hinglish-relatedness-sbert` (HF repo sha `4b06ad91`) | "adding more training data (543 pairs, then 756/1028 pairs)" | README.md lines 39 and 151 (756 contrastive / 1028 graded pairs) |

543 to 756 is +39.2%; 756 to 1028 is +36.0%. Neither is 43%. The two may count different things
(contrastive pairs vs graded pairs, or a different v2 corpus than the one the card lists); the private
`mindmeld/PLAN.md` ranges cited in the provenance row would settle it. Options: correct the page to
the card's figure, correct the card, or keep 43% with its private source stated. Because the 43% is
not in any public artifact, that decision stays labelled "self-reported (private repo)" until
decided; the rest of the lora-reframe narrative (13 configs, 0.639, 0.435 to 0.704) is public and
text-checked.

## 8. Re-verification of reviewiq and aetherart, 2026-10-13: verifiedAt NOT bumped on either

Rule applied: bump `verifiedAt` only where every displayed number re-verifies today. Neither passed,
so no number and no date was edited. Sources read via `gh api` at review-iq main `3d13cd9` and
AetherArt main `10eb31c`. `check-metric-freshness.mjs` reports no drift for either (it is a
text-presence check on `metrics.json` entries and does not cover case-study prose), which is why
these were found by reading, not by the checker. Warmer left alone as instructed.

### 8a. reviewiq: three displayed claims no longer match the source (decision needed)

| Displayed (content/case-studies/reviewiq.ts) | Source today | Status |
|---|---|---|
| Result row "Authenticity scoring (40 fixtures): precision/recall/F1 = 1.000", "a starting calibration" | `docs/compliance.md:76`: "The authenticity scorer has no published accuracy figure ... An earlier 40-item fixture set (21 positive) was in-sample and its result is not reproducible; it is kept only as a quarantined historical file ... and is not cited as a measurement." `README.md:424-427`: the `/v2/authenticity*` routes were removed (Session 15d D5, Session 17 W6) "because the flag is unmeasurable"; "Not measured: no authenticity labels exist for the held-out set". | CONTRADICTED. The row, the dek ("authenticity signals"), the problem text ("an authenticity score", "likely-fake ones") and `provenance.md` `reviewiq:authenticity` all describe a live, measured feature. |
| Decision "cut token cost 27.9% in v0.5.0, at a measured accuracy cost of 1.4 percentage points" | `README.md:260` (historical table, flagged not like-for-like): v0.5.0 routed 84.4%, "27.9% token reduction vs all-large"; v0.4.0 direct 85.8%. 85.8 - 84.4 = 1.4 by subtraction, but no source line states "1.4 percentage points", and the provenance row cites `README.md:139-147`, which now holds unrelated text. | 27.9% verifies; 1.4pp is derived, not published, and the citation is stale. |
| Everything else checked | 78.6% (CI 73-83%, n=43, 2026-09-19) matches `eval/report.md:5` and `eval/results.json` (`overall_score 0.78599`, `overall_ci_95` 0.7324 to 0.8294, `passed true`); gpt-oss-20b / 120b, argon2id, Postgres RLS, Cloud Run asia-south1, `assert_privacy_safe()`, Devanagari retired scope, "NOT PURSUED" (`PROMPTS.md:7`) all verify. | OK |

Options: remove or rewrite the authenticity row and copy to say the feature was removed because it
could not be measured (the honest story, and consistent with the site's other self-correction
narratives); cite the 1.4pp as a derived figure or drop it. Not done here: removing a result row
changes the product narrative, which is GG's call.

### 8b. aetherart: one displayed number is mis-scoped, everything else verifies

Verified against AetherArt `README.md`, `docs/lab_notebook.md`, `docs/MODEL_VERDICT.md`,
`reports/what_didnt_work.md`, `docs/paper/measurement_defects.md`: 6.2 GB and 2.6 GB VRAM; HPS 0.239
(0.2391), ImageReward 1.479 (1.4786), CLIP 0.359; 360-run benchmark, range 0.130 vs 0.007, 18x; 229
tests, ~60 s; rank-4 vs rank-8 CLIP (0.3384 vs 0.3337) and data-20 over data-80; INT8 2210 MB vs FP16
1803 MB (+407); 80 images, 4 h 26 min, ~$3.50, 45 MB; loss 0.008 to ~0.08; CLIP-blind 9/9 revised to
4/9; ukiyo-e promotion 3.18xSEM to 0.58xSEM (`MODEL_VERDICT.md` 354); five measurement defects; all
three HF models `private: false`. The HF row is generated from `content/generated/hf-downloads.json`
(as of 2026-10-10: 38 / 23 / 0; HF live today reads 34 / 23 / 0, an expected rolling-window move,
the as-of date is shown, not a defect).

Mismatch: decision "HPSv2.1 and ImageReward as the real quality metric" says "Nine experiments run
across both SD 2.1 and SDXL found that CLIP score is structurally blind...". The README attributes
the nine to the SD 2.1 study only (9/9, recomputed 4/9); the SDXL replication is seven experiments
(3/7, "architecture-dependent; SDXL is less CLIP-blind"). The nine is not an SD 2.1 plus SDXL count.
Suggested wording: "Nine SD 2.1 experiments (and a seven-experiment SDXL replication) ...". Not
edited here, and `verifiedAt` stays 2026-07-31 (74 days, still flagged overdue by the checker) until
GG picks the wording; once fixed, the rest re-verified today and the date can be bumped to the day
of that fix.
