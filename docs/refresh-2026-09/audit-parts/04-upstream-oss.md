## 4. Upstream OSS contributions

Scope: PRs authored by `gaurav-gandhi-2411` against repos **not** owned by
`gaurav-gandhi-2411` (per spec §3 "Upstream OSS" and finding F8). Excludes every
`repository.nameWithOwner` starting with `gaurav-gandhi-2411/` (own repos — the
huge volume of `gold-rate-tracker`/`adk-tracegauge`/`review-iq` automation and
feature PRs is not upstream OSS and is out of scope for this section).

**Commands run (verified):**
- `gh search prs --author gaurav-gandhi-2411 --merged --limit 100 --json repository,number,title,url,closedAt,state -- "-owner:gaurav-gandhi-2411"`
- `gh search prs --author gaurav-gandhi-2411 --state open --limit 100 --json repository,number,title,url,createdAt,state -- "-owner:gaurav-gandhi-2411"`
- `gh search prs --author gaurav-gandhi-2411 --state closed --limit 100 --json repository,number,title,url,closedAt,state -- "-owner:gaurav-gandhi-2411"` (superset of merged, used to catch closed-but-not-merged PRs the merged-only query would hide)
- Per-PR confirmation: `gh pr view <number> --repo <owner/repo> --json number,title,state,mergedAt,url` for all 10 PRs found — search-index results are not trusted alone, per task instructions.
- Star counts: `gh api repos/<owner>/<repo> --jq .stargazers_count`, run 2026-09-23.

**Total upstream PRs found (search + individually confirmed): 10.** This matches the
count independently maintained in the local `oss-contrib` working repo's
`CONTRIBUTIONS.md` ledger ("Opened: 10 PRs authored"), cross-checked below.

**Important nuance surfaced by this audit, load-bearing for spec acceptance criterion
#3** ("every listed 'merged' PR confirmed merged via `gh pr view --json mergedAt` on
the upstream repo"): `google/adk-python` accepts contributions via a Google-internal
Copybara import. A Copybara-landed PR shows GitHub-native `state: CLOSED` and
`mergedAt: null` forever — it is never flagged `merged` by GitHub's own API, even
though the fix is genuinely in `main`. Verified directly this session (`gh pr view`
below) for both PRs the `oss-contrib` ledger claims as landed:

| PR | `gh pr view` state | `gh pr view` mergedAt | oss-contrib ledger claim |
|---|---|---|---|
| google/adk-python#6939 | CLOSED | `null` | LANDED via Copybara, commit `85e08686f8…`, verified ancestor of `origin/main` via `git merge-base --is-ancestor` (2026-09-20) |
| google/adk-python#6681 | CLOSED | `null` | LANDED via Copybara, commit `023f45c`, per adk-python's own CONTRIBUTING.md (closed-without-native-merge is the documented accepted-PR path there) |

This audit did **not** independently re-run the `git merge-base --is-ancestor` checks
(that requires cloning/fetching the upstream repos, out of scope for a zero-cost
`gh`-only sweep) — the Copybara-landed status below is **believed**, sourced to
`oss-contrib/CONTRIBUTIONS.md`'s own documented verification, not re-verified by this
session. Only `keras-team/keras#23420` is **verified** merged, directly, via this
session's own `gh pr view --json mergedAt` (non-null timestamp, GitHub-native merge).

**Recommendation for the site/README "Open source" section (spec §3 Phase C):** if the
section's own acceptance bar is strictly "`mergedAt` non-null," only `keras#23420`
qualifies today, and the 2 Copybara-landed adk-python PRs would need either (a) a
labelled exception with the ancestry-check evidence linked, or (b) exclusion pending
independent re-verification. Flagging for GG per spec's "distinguish verified vs
believed" constraint (§6) — not resolved by this read-only audit.

### Merged (or landed, GitHub status noted)

| Upstream repo | PR # | Title | GitHub state | mergedAt | Stars | Impact |
|---|---|---|---|---|---|---|
| keras-team/keras | [#23420](https://github.com/keras-team/keras/pull/23420) | fix: R2Score returns NaN instead of 1.0 for a perfect prediction on zero-variance data | **MERGED** (verified, `gh pr view`) | `2026-09-15T16:38:09Z` | 64,330 (verified `gh api`, 2026-09-23) | `R2Score.result()` guarded against `-inf` but not `NaN`; a zero-variance class with an exact prediction produced `0/0 = NaN` that silently poisoned the aggregated score under `uniform_average`/`variance_weighted_average`. Fix keeps the original explicit branch (`ops.where` on `total_mse == 0`) over the reviewer's proposed `divide_no_nan` one-liner, on cross-backend test evidence. |
| google/adk-python | [#6939](https://github.com/google/adk-python/pull/6939) | fix(evaluation): reject num_samples=0 in JudgeModelOptions at construction time | CLOSED, `mergedAt: null` on GitHub — **believed landed** via Copybara import per oss-contrib ledger (commit `85e08686f8…`, not independently re-verified this session) | `null` (GitHub) | 21,604 (verified `gh api`, 2026-09-23) | `JudgeModelOptions.parallelism_limit` has a `ge=1` floor; sibling field `num_samples` has none, so `num_samples=0` is a silent, valid-looking config that produces no judge samples. PR adds the matching `ge=1` constraint at construction time. Successor to #6710 below. |
| google/adk-python | [#6681](https://github.com/google/adk-python/pull/6681) | fix(cli): resolve NameError in legacy create-eval-set route | CLOSED, `mergedAt: null` on GitHub — **believed landed** via Copybara import per oss-contrib ledger (commit `023f45c`, not independently re-verified this session) | `null` (GitHub) | 21,604 (verified `gh api`, 2026-09-23) | `create_eval_set_legacy` referenced `UserEvalSet`, a class never imported or defined anywhere in the package — a guaranteed `NameError` on that route. Fix swaps in the correct, already-imported `EvalSet` type. |

### Open

| Upstream repo | PR # | Title | State | Opened | Stars | Impact |
|---|---|---|---|---|---|---|
| google/adk-python | [#6740](https://github.com/google/adk-python/pull/6740) | fix(cli): adk eval process exit code now reflects PASSED/FAILED | **OPEN** (verified, `gh pr view`) | 2026-08-15 | 21,604 (verified `gh api`, 2026-09-23) | `adk eval` (the CLI) computes and prints a real pass/fail summary but never calls `sys.exit` on it — the process exit code is always 0, making the command unusable as a CI gate on its own exit status regardless of the printed verdict. |
| google/adk-python | [#6739](https://github.com/google/adk-python/pull/6739) | fix(evaluation): honor each metric's own eval_status in AgentEvaluator.evaluate() | **OPEN** (verified, `gh pr view`) | 2026-08-15 | 21,604 (verified `gh api`, 2026-09-23) | `AgentEvaluator._process_metrics_and_get_failures` recomputes pass/fail from raw scores instead of trusting each metric's own reported `eval_status`, which can silently override a metric's real FAILED verdict with a backwards PASSED one. |

**Per spec §3 Phase C constraint:** these 2 open PRs "may appear only in a clearly
labelled 'in review' line, never counted as landed" if surfaced on the site/README at
all.

### Closed, not merged (rejected / superseded) — extra context beyond the requested merged/open split

Included for audit completeness and honesty (rule: distinguish verified vs believed,
don't cherry-pick outcomes) since these are part of the same 10-PR upstream cohort and
inform the "what actually landed" claim; not part of the site/README content per se.

| Upstream repo | PR # | Title | Outcome | Stars |
|---|---|---|---|---|
| google/adk-python | [#7000](https://github.com/google/adk-python/pull/7000) | fix(evaluation): reject parallelism=0 in EvaluateConfig/InferenceConfig | CLOSED, `mergedAt: null` (verified). oss-contrib ledger: closed silently by assignee with zero comments/reviews 2026-09-22; underlying gap confirmed still unfixed on upstream `main` as of that ledger's last check (believed, not re-verified this session). | 21,604 |
| google/adk-python | [#6710](https://github.com/google/adk-python/pull/6710) | fix(evaluation): record NOT_EVALUATED instead of dropping invocations with zero auto-rater samples | CLOSED, `mergedAt: null` (verified). oss-contrib ledger: closed as superseded-partial 2026-08-29 by #6939 (above); one code path was incidentally fixed by an unrelated upstream commit, the other retargeted into #6939 (believed, not re-verified this session). | 21,604 |
| google/adk-python | [#6682](https://github.com/google/adk-python/pull/6682) | fix(evaluation): NOT_EVALUATED metric no longer masked by a passing one | CLOSED, `mergedAt: null` (verified). oss-contrib ledger: closed/rejected 2026-09-16 by a maintainer as intentional behavior (believed, not re-verified this session). | 21,604 |
| google/adk-python | [#6678](https://github.com/google/adk-python/pull/6678) | fix(evaluation): resolve threshold via criterion in LlmAsJudge, not the deprecated EvalMetric.threshold | CLOSED, `mergedAt: null` (verified). oss-contrib ledger: self-closed 2026-08-13, superseded by an independent upstream fix landing the same behavior (believed, not re-verified this session). | 21,604 |
| google/adk-docs | [#2128](https://github.com/google/adk-docs/pull/2128) | docs(integrations): add tracegauge Cost Evaluator for ADK agents | CLOSED, `mergedAt: null` (verified). Adds `adk-tracegauge` (PyPI) to the ADK integrations catalog. oss-contrib ledger: rejected by a maintainer 2026-08-19 on a maturity/adoption policy basis, not a code defect (believed, not re-verified this session). | 1,503 |

### Cross-check against `C:\Users\gaura\ml-projects\oss-contrib`

The repo exists locally (`Glob`/`ls` confirmed: `CONTRIBUTIONS.md`, `CLAUDE.md`,
`adk-docs`, `adk-python`, `adk-python-verify`, `benchmark`, `eval-defect-bench`,
`keras`, `keras-verify`, `reports`, `scripts`, `wt`) and already maintains a far more
detailed ledger (`CONTRIBUTIONS.md`) than this section reproduces, including
per-function collision-risk analysis, reviewer/assignee tracking, and a linked issue
channel (3 issues filed, tracked separately from the 10 PRs above).

**Discrepancies found: none.** Every PR this session's independent `gh search` +
`gh pr view` sweep found (10 total) is present in `oss-contrib/CONTRIBUTIONS.md`'s
ledger table with a matching state and outcome. No PR the ledger lists turned out
closed-not-merged when the ledger claimed merged, and no PR this sweep found is
missing from the ledger. One thing the ledger tracks that this section's PR-scoped
table doesn't: 3 **issues** filed against `google/adk-python` (#6951 LANDED,
#7009 LANDED, #6725 OPEN) — out of scope here since the task is scoped to PRs, but
relevant context if the site/README "Open source" copy ever describes "upstream
contributions" broadly rather than "PRs" specifically, since 2 of those 3 issues
produced a landed fix (authored by third parties, not by `gaurav-gandhi-2411`) — the
ledger is explicit that issue-driven landings and PR-authored landings must not be
summed into one number.

### Summary

- **Total upstream PRs (search-confirmed, individually verified via `gh pr view`): 10**
- **Merged, GitHub-native (`mergedAt` non-null, verified this session): 1** — keras-team/keras#23420
- **Landed, believed via Copybara import (GitHub `mergedAt` null; sourced to oss-contrib's own independently-run `git merge-base --is-ancestor` checks, not re-verified this session): 2** — google/adk-python#6939, #6681
- **Open: 2** — google/adk-python#6740, #6739
- **Closed, rejected or superseded (not landed): 5** — google/adk-python#7000, #6710, #6682, #6678; google/adk-docs#2128
- Check: 1 + 2 + 2 + 5 = 10. ✓
