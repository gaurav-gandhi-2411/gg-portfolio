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
