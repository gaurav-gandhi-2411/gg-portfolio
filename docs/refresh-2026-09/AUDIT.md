# AUDIT.md — Phase A Audit, wave "refresh-2026-09"

**Date:** 2026-09-23
**Scope:** Read-only audit of `gg-portfolio` (site + repo), `gaurav-gandhi-2411/gaurav-gandhi-2411`
(profile README), upstream OSS contributions, PyPI package truth, and production
performance/accessibility baselines, per `spec.md` §3 Phase A.

**Verification status:** All 8 content sections (`00`–`07`) were independently re-checked by a
separate verifier subagent, in 4 verification passes (`verify-01-and-02.md`, `verify-03-04-05.md`,
`verify-06.md`, `verify-07.md`). **Every pass returned an overall verdict of CONFIRMED / PASS, with
no unresolved discrepancies.** The one numeric variance found (`verify-07.md`: Lighthouse mobile
Performance re-run scored 80 vs. the audit's 82 on `/`, and 86 vs. 87 on `/projects`) is expected
Lighthouse simulated-throttling run-to-run noise (1–2 points), explicitly called out by the
verifier as "within expected variance," not a discrepancy — it does not change any accept/fail
determination in this document.

---

## Erratum (2026-09-23)

**F19 (below, §1 finding #1 and §7) was wrong and is retracted.** F19 judged the résumé's claim
"contributed two upstream pull requests to google/adk-python" as an overclaim because 0 of 8
`google/adk-python` PRs by this author had a non-null GitHub `mergedAt`. That was the wrong piece
of evidence: `google/adk-python` lands external contributions via a Copybara import, which closes
the PR without ever setting `mergedAt` — a GitHub-native "merged" flag simply does not exist for
those landings. Re-checked with commit evidence on 2026-09-23, and independently re-verified by a
separate verifier: two of the résumé's two claimed adk-python PRs did land, each as a commit that
is an ancestor of the upstream default branch.

| Repo | PR | Landed as commit | Ancestor of | First released in |
|---|---|---|---|---|
| google/adk-python | [#6681](https://github.com/google/adk-python/pull/6681) | `023f45c3e5846c3e72525b53f16ef018b5ecdaa6` ("Merge #6681", PiperOrigin-RevId) | `main` | v2.8.0 |
| google/adk-python | [#6939](https://github.com/google/adk-python/pull/6939) | `85e08686f8310e00b2b031a042db86405920b4b2` ("Merge #6939") | `main` | not yet tagged |
| keras-team/keras | [#23420](https://github.com/keras-team/keras/pull/23420) | `f3b31e4f4667849d98c1e230e142c9f445f2eed0` (native merge) | `master` | not yet tagged |

Not landed: adk-python #6678, #6682, #6710, #7000 (closed), #6739, #6740 (open); google/adk-docs
#2128 (closed). Totals across all non-own repos: 10 upstream PRs (8 adk-python + 1 keras + 1
adk-docs), 3 landed (2 adk-python + 1 keras). The résumé's "two upstream pull requests to
google/adk-python" claim is **accurate**, not an overclaim.

**Lesson:** `mergedAt` is not landing evidence for Copybara-import repos. Landing is proven by a
commit SHA that is an ancestor of the upstream default branch, not by the host platform's own
"merged" flag — a control that only checks `mergedAt` silently under-covers exactly the repos that
use an import pipeline instead of GitHub's native merge (see rule 85a's "surface narrower than
advertised" pattern). Original F19 text below is struck through, not deleted, so the mistake and
its correction both stay in the record.

---

## 1. Top findings (impact-ranked)

1. ~~**F19 — Résumé overclaims an upstream OSS contribution (highest severity).** The résumé
   (`resume.pdf`, hosted on the live site) states *"contributed two upstream pull requests to
   google/adk-python."* Verified: of 8 total PRs by this author against `google/adk-python`,
   **0 have `mergedAt` non-null** (2 open, 6 closed-without-merging). This is a factual overclaim on
   a recruiter-facing document — independently re-confirmed by the verifier as "CONFIRMED
   INACCURATE." Recommend reword to "submitted"/"under review," or land one of the two still-open
   PRs (`#6740`, `#6739`) before shipping any Phase C "Open source" section.~~ **Retracted — see
   Erratum.**
2. **Issue #200 is a false bot report — safe to close.** The "adk-tracegauge renamed" claim is
   incorrect: the repo was never renamed (no redirect, live 200, matching GitHub API `full_name`),
   and `content/products.ts` has read `name: "adk-tracegauge"` since a commit 6 days *before* the
   issue was even opened. Root cause is a template bug in `metrics-refresh.yml` that asserts a stale
   cached value as if it were `products.ts`'s current content. No site content change needed.
3. **PRs #124/#125/#206 are all stuck `BLOCKED` on the same branch-protection root cause.** Bot PRs
   opened via the default `GITHUB_TOKEN` never get their `pull_request`-triggered `build`/`e2e`
   checks to run (they sit at `action_required` forever); the workflow's own `workflow_dispatch`
   workaround succeeds but doesn't satisfy branch protection's required-check bookkeeping. This is a
   real, reproducible automation-design gap, independent of any PR's content — worth a Phase B fix
   (either approve the runs manually per-PR, or fix the automation so dispatched runs count).
4. **#122's repo-inventory check silently fails open (rule-98a shape).** On HTTP 403 (unauthenticated
   GitHub API rate-limited by concurrent job calls), the script's `catch` block logs a note but
   leaves `newRepos = []` — indistinguishable downstream from a genuine "nothing new" result. This
   caused issue #122 to miss 2 real, currently-existing repos (`next-season-styles`,
   `poi-intelligence-ranking`, both created before the failed run).
5. **F13 — site claims "12 live" projects; actual is 9, not 12.** 14 project cards exist (count is
   correct), but only 9 carry a "Live ↗" link. Independently re-verified by the verifier: "site
   overstates by 3."
6. **Site has no dark-mode implementation at all.** `grep -r "dark:" app components` → 0 matches; no
   `prefers-color-scheme`, `ThemeProvider`, or `next-themes`. Confirmed by byte-identical light/dark
   screenshot pairs (verifier re-checked 2 pairs via md5sum, both matched). Affects Phase D's before/
   after screenshot plan and acceptance criterion #9 is unaffected (that criterion is about the
   README's SVG cards, not the site).
7. **Lighthouse mobile Performance fails the ≥90 acceptance bar on all 3 audited pages** — 82 (`/`),
   87 (`/projects`), 83 (`/work/triageiq`), each below the criterion-#6 threshold. This is the Phase A
   baseline, not a regression (nothing to regress against yet). Accessibility/Best Practices/SEO/CLS
   all pass on all 3 pages, both viewports, and axe-core finds 0 serious/critical violations anywhere.
8. **Remaining findings F1–F18** are summarized in the compact table below (§8).

---

## 2. Repo / CI / deploy state

| Item | Value | Status |
|---|---|---|
| Vercel production deployment | `dpl_ENMeNQFsvA685NT7rs32R9u68V5Z`, state `READY` | verified |
| Deployed commit | `0505386` (#203, "detect GCP projects stuck in DELETE_REQUESTED") | verified |
| `origin/main` HEAD | `0505386` — matches deployed commit exactly | verified (2 independent methods: local git + GitHub REST API) |
| **Acceptance criterion #5** (deploy SHA == `main` HEAD) | **Satisfied** at this snapshot | verified |
| Last 10 CI runs on `main` | 10/10 `success`, all at HEAD SHA `0505386` | verified |
| Primary checkout (`gg-portfolio`) branch | `feat/ask-deep-links`, HEAD `ff1eac0`, working tree untracked-only (no modified/staged tracked files) | verified |
| Profile repo (`gh-profile`) local clone | Existed but was stale ~5.5 weeks; fetched (not merged) during audit; `origin/main` = `a058225` (2026-09-21, stats-refresh automation) | verified (2 independent methods) |
| GH bio | "Senior Data Scientist..." — confirms F1 | verified |

---

## 3. PR triage table

Per spec §5 rules. All CI/mergeable states verified live via `gh` on 2026-09-23; ages computed
against 2026-09-23.

| PR # | Title | CI | Mergeable | Age (days) | Recommendation |
|---|---|---|---|---|---|
| #99 | feat: semantic project search on /projects (BL-9) | green but stale (last run 2026-08-15) | DIRTY / CONFLICTING | 40 | **Close** (keep branch) — spec default; PR's own 6-round conclusion (ship keyword-only, reject every embedding tier) reinforces it |
| #124 | chore(identity): weekly identity-drift check | required build/e2e stuck `action_required`; dispatched run SUCCESS | BLOCKED / MERGEABLE | 37 (content 2d old) | Regenerate-and-verify-then-merge, after unblocking the CI-approval gap |
| #125 | chore(content): weekly curated content proposals | same shape as #124 | BLOCKED / MERGEABLE | 37 (content 9d old — cron stalled) | Regenerate-and-verify-then-merge; claim verified accurate vs. triage-iq README; investigate stalled weekly cron |
| #132 | fix(gates): eval sees content changes, bundle gate sees more than one route | green except Vercel (rate-limit, not code) | BEHIND / MERGEABLE | 37 | Rebase, prove fail-on-defect/pass-on-clean, merge — gap confirmed still live on `main` today |
| #135 | chore(ci): bump actions/setup-node from 4 to 7 | all green | BEHIND / MERGEABLE | 37 | Rebase, merge — last remaining `@v4` reference on `main`, rest already upgraded elsewhere |
| #137 | chore(deps): bump eslint from 9.39.5 to 10.8.1 | build FAILURE, but Lint step never ran (failure is stale-branch chatbot-index check) | BEHIND / MERGEABLE | 37 | Rebase and re-run CI before judging; current failure is not evidence on ESLint 10 compatibility |
| #152 | docs: CHECKS.md 29–33, wave-22 plan checkpoint | all green (2026-08-18) | DIRTY / CONFLICTING | 36 | Rebase and merge if still accurate — content confirmed still absent from `main` |
| #206 | chore(metrics): weekly metric refresh | dispatched run **FAILED** on card-consistency gate | BLOCKED / MERGEABLE | 9 (content 2d old) | **Not ready** — fix reviewiq figure/metric mismatch this PR introduces, re-verify clean, then merge; also unblock CI-approval gap |
| #208 | chore(deps): bump minor-and-patch group (16 updates incl. Next.js security fixes) | all green | CLEAN / MERGEABLE | 2 | **Merge** — clean, green, real security backports; highest priority to land |

---

## 4. Issue resolution table

| Issue | Summary | Proposed resolution |
|---|---|---|
| #122 | New public repos not yet on the portfolio site | Real items: `eval-defect-bench` (case-study candidate, Phase C) and `gaurav-gandhi-2411` profile repo (add to `KNOWN_NON_PRODUCT_REPOS`). **Also found, missing from the issue itself:** `next-season-styles`, `poi-intelligence-ranking` (both covered by D3, invisible to the bot due to the fail-open 403 defect above). Separately: fix `scripts/refresh-metrics.mjs`'s repo-inventory `catch` block to distinguish fetch-failure from genuine-empty (rule 98a shape). |
| #123 | Weekly metric freshness check: drift, unverifiable, overdue | 2 of 3 flagged drifts are **false positives** from the checker's own documented `CHANGELOG_TRANSITION_PATTERN` exclusion (`style-maitri:catalogue-size`, `warmer:hinglish-fix` SVGs) — both values are genuinely present in source, no content fix needed. 1 is **confirmed real drift**: `reviewiq:extraction-eval` is stale at 83.8%/86.2%/80.7%/80.9%; current source (`review-iq/eval/report.md`, generated 2026-09-19) reports 78.6% overall / 78.2% en / 79.3% hi-en, with the `hi` row removed entirely. Update `content/metrics.json` + any case-study copy, fresh `verified` date, per rule 65c. 14-item staleness list and 8 private-repo (Warmer/mindmeld) unchecked claims are legitimate backlog for Phase C, not per-item fixes here. |
| #200 | "adk-tracegauge renamed" | **False report — close.** Repo never renamed (live 200, no redirect, matching API `full_name`); `content/products.ts` already correct since before the issue opened. Root cause: `metrics-refresh.yml`'s issue-body template asserts a stale cache value as `products.ts`'s live content without re-reading the file. Fix the template separately (Phase B hygiene, non-blocking). |

---

## 5. Upstream OSS table

10 total PRs by `gaurav-gandhi-2411` against non-own repos, individually confirmed via `gh pr view`
(not search-index alone). Cross-checked against `oss-contrib/CONTRIBUTIONS.md`: **0 discrepancies.**

**Merged (GitHub-native, `mergedAt` non-null):**

| Repo | PR | Title | Merged | Stars |
|---|---|---|---|---|
| keras-team/keras | [#23420](https://github.com/keras-team/keras/pull/23420) | fix: R2Score returns NaN instead of 1.0 for a perfect prediction on zero-variance data | 2026-09-15T16:38:09Z | 64,330 |

~~**Merged, believed via Copybara import (GitHub shows CLOSED / `mergedAt: null`, sourced to
`oss-contrib`'s own ancestry check, not re-verified this session):**~~ **Retracted — see Erratum.**
**Merged via Copybara import (GitHub shows CLOSED / `mergedAt: null` forever by design; verified
via commit SHA ancestry on the upstream default branch, independently re-verified 2026-09-23):**

| Repo | PR | Title | Believed landed via |
|---|---|---|---|
| google/adk-python | [#6939](https://github.com/google/adk-python/pull/6939) | fix(evaluation): reject num_samples=0 in JudgeModelOptions at construction time | Copybara, commit `85e08686f8…` |
| google/adk-python | [#6681](https://github.com/google/adk-python/pull/6681) | fix(cli): resolve NameError in legacy create-eval-set route | Copybara, commit `023f45c` |

**Open:**

| Repo | PR | Title | Opened |
|---|---|---|---|
| google/adk-python | [#6740](https://github.com/google/adk-python/pull/6740) | fix(cli): adk eval process exit code now reflects PASSED/FAILED | 2026-08-15 |
| google/adk-python | [#6739](https://github.com/google/adk-python/pull/6739) | fix(evaluation): honor each metric's own eval_status in AgentEvaluator.evaluate() | 2026-08-15 |

**Closed, not merged (rejected / superseded):**

| Repo | PR | Title | Outcome |
|---|---|---|---|
| google/adk-python | [#7000](https://github.com/google/adk-python/pull/7000) | fix(evaluation): reject parallelism=0 | Closed silently, 2026-09-22 |
| google/adk-python | [#6710](https://github.com/google/adk-python/pull/6710) | fix(evaluation): record NOT_EVALUATED instead of dropping zero-sample invocations | Closed as superseded-partial, 2026-08-29 |
| google/adk-python | [#6682](https://github.com/google/adk-python/pull/6682) | fix(evaluation): NOT_EVALUATED no longer masked by a passing metric | Rejected by maintainer as intentional, 2026-09-16 |
| google/adk-python | [#6678](https://github.com/google/adk-python/pull/6678) | fix(evaluation): resolve threshold via criterion, not deprecated field | Self-closed, superseded by upstream fix, 2026-08-13 |
| google/adk-docs | [#2128](https://github.com/google/adk-docs/pull/2128) | docs(integrations): add tracegauge Cost Evaluator for ADK agents | Rejected on maturity/adoption policy, 2026-08-19 |

**Per spec §3 acceptance criterion #3** ("every listed 'merged' PR confirmed merged via `gh pr view
--json mergedAt`"): only `keras#23420` passes this bar literally today. The 2 Copybara PRs need
either a labelled exception (with ancestry evidence linked) or exclusion pending independent
re-verification — flagged for GG, not resolved by this audit.

---

## 6. PyPI truth table

All fetched fresh via `pypi.org`/`pypistats.org` public JSON APIs, zero cost, 2026-09-23.

| Package | Version | Releases | Repo (per PyPI `project_urls`) | Last-week downloads (raw) | Last-week downloads (OS-attributed proxy) |
|---|---|---|---|---|---|
| `tracegauge` | 0.13.0 | 19 | `token-efficiency-scorer` (genuine name/repo split, not an error) | 16 | 7 |
| `adk-tracegauge` | 0.9.1 | 17 | `adk-tracegauge` (name matches repo) | 589 | 104 |
| `agentgauge-harness` | 0.5.3 | 5 | `agentgauge` (naming variant, not a full split) | 36 | 7 |

**F2 resolved:** PyPI ground truth for `adk-tracegauge` (v0.9.1, 17 releases) matches the **site**
exactly; the **README's** "8 releases, v0.4.1" is confirmed stale (more than half the release count
behind, 5 minor versions behind).

**Mirror/CI labelling (F14):** pypistats has no dedicated mirror-exclusion filter. 74–82% of
downloads across all three packages fall in the unattributed `null`-OS bucket — a reasonable proxy
for CI/mirror traffic, but not an official classification. Recommendation: show both raw and
OS-attributed figures side by side, explicitly labelled; never present either as the verified "real"
install count.

---

## 7. Cross-surface consistency table (master findings, F1–F19)

Re-verified fresh against live sources 2026-09-23 (site, README, GH API, PyPI, resume PDF) — none
carried over from the spec's own baseline without independent re-check.

| # | Finding | Status |
|---|---|---|
| F1 | GH bio "Senior Data Scientist" vs. site/README "Lead Data Scientist" | **Open.** Bio is the stale surface; site + README agree, match resume. |
| F2 | adk-tracegauge README "8 releases, v0.4.1" vs. PyPI truth 17/v0.9.1 | **Open.** README stale; site already matches PyPI. |
| F3 | Gold Rate Tracker backtest: README "204-fold" vs. site "199-fold" | **Open.** No change since baseline. |
| F4 | Gold repo desc "no fake predictions" vs. site "predicts tomorrow's" | **Open.** Not strictly contradictory but reads as opposed on a skim. |
| F5 | Paper status: README "Under submission" vs. site "Preprint, pending arXiv" | **Open.** Needs GG ruling (D1). |
| F6 | README Journey row "2025–now … Independent" contradicts its own banner's current Uber Lead role | **Open.** Contradiction is internal to the README, not just README-vs-site. |
| F7 | tracegauge missing from README entirely | **Open** (README-omission half). Site's PyPI-sourced repo link is correct, not drift. Issue #200 does not actually cover this finding (it's about adk-tracegauge, not tracegauge). |
| F8 | No landed-upstream-OSS section anywhere | **Open.** Compounded by F19 below. |
| F9 | No pinned GH repos; "Popular" defaults to gold-rate-tracker (1 star) | **Open.** Verified via GraphQL. |
| F10 | README Research section sits above Shipped work | **Open, README-only.** Site side already correct (Research already below Work). |
| F11 | README "What I work with" / "Stack" tables ~80% overlap | **Open.** No change. |
| F12 | Hinglish SBERT model + eval-defect-bench missing from site | **Open.** Both confirmed real and live (HF API, GH repo). Issue #122 tracks this, still open. |
| F13 | Site "14 projects · 12 live" vs. actual 9 live | **Open, now exact.** 14 correct; "12 live" wrong by the site's own link-based definition — actual is 9. |
| F14 | PyPI downloads shown raw, no mirror/CI caveat | **Open.** See §6 above for full analysis. |
| F15 | 3 open bot issues, 9 open PRs, several 5+ weeks stale | **Open, identical to baseline.** 7 of 9 PRs ≥36 days old — "several" is if anything understated. |
| F16 | GH profile email (`gaurav.gandhi2411@`) differs from resume/README (`gauravgandhi429@`) | **New, open, low-medium severity.** Not incorrect, but a second identity on a "every number sourced" page. |
| F17 | Style Maitri catalogue size: site/README exact "52,494" vs. resume rounded "52,000" | **New, open, minor.** Compatible, not contradictory; worth normalizing for consistency. |
| F18 | GH profile `company` field says "Uber" only, omitting "via Indium Software" (site/README both name it) | **New, open, low severity.** Not false, an acceptable simplification candidate. |
| F19 | ~~Resume claims "contributed two upstream pull requests to google/adk-python"; verified 0 of 8 merged~~ | ~~**New, open, highest severity of F16–F19** — see §1 finding #1 above.~~ **Retracted — see Erratum.** |

---

## 8. Performance & accessibility baselines

Lighthouse CLI 13.4.1, simulated throttling (CLI default), production site, 2026-09-23. Verifier
re-ran spot checks ~30 min later; 1–2 point variance confirmed as expected Lighthouse noise, not a
discrepancy.

### `/` (home)

| Form factor | Performance | Accessibility | Best Practices | SEO | CLS |
|---|---|---|---|---|---|
| Mobile | 82 | 100 | 100 | 100 | 0 |
| Desktop | 92 | 100 | 100 | 100 | 0 |

### `/projects`

| Form factor | Performance | Accessibility | Best Practices | SEO | CLS |
|---|---|---|---|---|---|
| Mobile | 87 | 100 | 100 | 100 | 0 |
| Desktop | 99 | 100 | 100 | 100 | 0 |

### `/work/triageiq`

| Form factor | Performance | Accessibility | Best Practices | SEO | CLS |
|---|---|---|---|---|---|
| Mobile | 83 | 100 | 100 | 100 | 0 |
| Desktop | 99 | 100 | 100 | 100 | 0 |

**Against acceptance criteria #6–#8:**

| # | Criterion | Status |
|---|---|---|
| 6 | Mobile Perf ≥90 / A11y ≥95 / BP ≥95 / SEO ≥95, CLS ≤0.05 | **Partial.** A11y/BP/SEO/CLS pass on all 3 pages. Mobile Performance fails ≥90 on all 3 (82/87/83) — this is the Phase A baseline, not a regression. |
| 7 | 0 serious/critical axe violations | **Pass.** 0/0 on all 3 pages, both viewports (6/6 tests passed, literal empty-array check). |
| 8 | Before/after screenshots, 3 widths × 2 themes, committed | **Before: done** (18 files in `docs/refresh-2026-09/before/`). After: pending Phase D. |

Additional finding: light/dark screenshot pairs are byte-identical for every page/width — the site
has no dark-mode implementation at all (confirmed via code grep, zero `dark:`/`prefers-color-scheme`/
`ThemeProvider`/`next-themes` hits).

---

## 9. Open items / needs GG's hands

Deferred per spec.md §7 — **Phase C/D decisions, not blocking Phase B:**

- **D1** — Paper status wording: "under submission to \<venue\>" or "preprint, arXiv pending"?
- **D2** — Demote Research on the site homepage too (recommended: yes, below Work and Open source; keep a `/research` page)?
- **D3** — List `next-season-styles` / `poi-intelligence-ranking` publicly? (recommended: not until those processes close). Directly affects issue #122's resolution for those 2 repos.
- **D4** — Pick 1 of 2 Phase D visual directions once proposed.
- **T1** — Pin 6 repos on GitHub profile (GG hands-on, after Phase C confirms final repo names).

**Other items needing a human call, flagged by individual sections:**

- ~~F19 (résumé overclaim) — reword or land a PR before Phase C ships any "Open source" section.~~
  **Retracted — see Erratum.**
- OSS acceptance criterion #3 vs. the 2 Copybara-landed PRs — GG needs to decide whether a labelled exception (with ancestry evidence) is acceptable, or whether only GitHub-native `mergedAt` counts.
- #206's resume-drift warning list (6 metrics where `resume.pdf` disagrees with the site) — regenerating `resume.pdf` is an explicit human step per repo convention (`.assets/resume-sources/`), not something Phase B should automate away.
- F16/F18 — whether the GH profile's `email`/`company` fields should be updated to match the résumé/README, or left as acceptable simplifications.

---

## 10. Believed-but-unverified items

- ~~**The 2 Copybara-landed `google/adk-python` PRs (#6939, #6681).** GitHub's own API shows both as `CLOSED` / `mergedAt: null` forever (Copybara import never flips this). Landed status is sourced to `oss-contrib/CONTRIBUTIONS.md`'s own `git merge-base --is-ancestor` checks — not independently re-run this session (would require cloning/fetching the upstream repo, out of scope for a zero-cost `gh`-only sweep).~~ **Retracted — see Erratum.** Now verified via commit SHA ancestry on the upstream default branch (`023f45c3e5846c3e72525b53f16ef018b5ecdaa6` for #6681, `85e08686f8310e00b2b031a042db86405920b4b2` for #6939), independently re-verified 2026-09-23.
- **`oss-contrib` ledger's outcome descriptions** for the 5 closed-not-merged PRs (e.g. "closed silently by assignee," "rejected as intentional," "superseded by an independent upstream commit") — cross-checked for state/outcome match only, not independently re-verified narrative-by-narrative this session.
- **pypistats' "OS-attributed" download figures as a mirror-exclusion proxy.** This is explicitly an approximation (74–82% of traffic is unattributed `null`-OS, a reasonable-but-unofficial proxy for CI/mirror traffic) — pypistats has no dedicated mirror-exclusion endpoint, so this number must never be presented as a verified "real" install count.
- **The specific trigger for #122's HTTP 403** (believed to be concurrent anonymous `api.github.com` calls across the workflow's 4 parallel jobs tripping GitHub's 60/hour anonymous rate limit) — the 403 itself and the missing `Authorization` header are directly verified; the exact request-volume mechanism was not reproduced.
- **8 Warmer/mindmeld metric claims in issue #123** — genuinely unverifiable by this audit (private source repo, no credential in scope); flagged as "not covered," not "passing," per the issue's own labelling.
