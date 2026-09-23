## 2. PR audit

All data below verified live via `gh` CLI on 2026-09-23 against
`gaurav-gandhi-2411/gg-portfolio`. Every claim is labelled **verified**
(command given) or **believed** (not independently re-checked, usually because
it would require live-hitting a third-party URL, which was skipped for zero
new external calls). Ages computed against "today" = 2026-09-23.

Repo-wide facts used across several PRs below, both **verified**:

- Branch protection on `main` requires status checks `build` and `e2e`,
  `strict: true` (branch must be up to date). Verified:
  `gh api repos/gaurav-gandhi-2411/gg-portfolio/branches/main/protection`.
- Root cause of the three "BLOCKED" bot PRs (#124, #125, #206): all three are
  opened/updated by jobs in `.github/workflows/metrics-refresh.yml` using the
  default `GITHUB_TOKEN`. PRs opened this way do not fire `pull_request`
  workflows automatically (GitHub requires manual approval for
  first-party-token-triggered workflow runs in this configuration) — the
  workflow itself already works around this by calling
  `gh workflow run ci.yml --ref "$BRANCH"` (a `workflow_dispatch`), but that
  dispatched run's checks do not appear to satisfy branch protection's
  required-check bookkeeping for the PR (the PR's own `pull_request`-triggered
  `CI`/`Link Check` runs sit at `action_required` forever, unapproved).
  Verified: `gh run list --branch chore/identity-drift/-content-pipeline/-metrics-refresh --json event,conclusion` shows `event:"pull_request"` runs stuck at `conclusion:"action_required"` on all three branches, while a separate `event:"workflow_dispatch"` run on the same SHA completes normally. This is a real, reproducible gap in the automation's own design (the dispatch workaround does not make the PR mergeable), independent of whether the content of any given run is otherwise correct — worth fixing in Phase B alongside the triage.

---

### #99 — feat: semantic project search on /projects (BL-9)

- **Branch:** `feat/project-search` → `main`. **Age:** 40 days (created
  2026-08-14T21:27:11Z). **Draft:** no (author un-drafted in "Round 6").
- **CI (verified via `gh pr view 99 --json statusCheckRollup`):** `build`
  SUCCESS, `lychee` SUCCESS, `e2e` SUCCESS, Vercel SUCCESS, Vercel Preview
  Comments SUCCESS — all green, but these results are from 2026-08-15, before
  40 days of `main` churn; not re-run since.
- **Mergeable:** `mergeStateStatus: DIRTY`, `mergeable: CONFLICTING` — real,
  current merge conflicts against `main` (verified via the same `gh pr view`
  call).
- **Diff summary:** 65 files changed, +6113/-1. Six authoring rounds recorded
  in the PR body itself. Final shipped state per the author's own "Round 5/6"
  narrative: a client-side MiniLM semantic-reranking tier and a
  purpose-built static-embedding matrix were both built, measured (real
  Slow-4G cold-start numbers, Wilson CIs, McNemar tests), and then
  **rejected** — the PR ships **keyword-only** substring search with zero
  client-side model, plus a "how this search was built" case-study section
  on `/projects` documenting the elimination.
- **Superseded check:** N/A in the usual sense (nothing else on `main`
  implements this feature), but the PR's own merge-gate self-assessment
  (embedded in its body) already states **Gate 3 (≤~400 reviewable lines)
  FAILS** — reviewable diff is ~1,120 lines even after excluding
  designated-path generated content — and recommends a human decide
  merge-as-one vs. split-by-commit. That self-assessment is from the author,
  not independently re-verified line-by-line here, but is internally
  consistent with the reported `+6113` raw diff size.
- **Recommendation: CLOSE (keep branch, per spec §5 default for #99).**
  Spec's stated reasoning (14 projects don't need semantic search; filter
  chips + `/ask` already cover discovery; bundle-cost concern) is unchanged
  by anything found here. The PR's own conclusion after 6 rounds of work
  reinforces this independently: every embedding-based tier tested
  (MiniLM, potion-base-8M, a hand-built static matrix) was rejected in favor
  of the free keyword-only tier already shipping — i.e., the PR's own
  strongest evidence argues against adding the feature's complexity in the
  first place, not just against the neural variant. Combine with the real,
  current merge conflict (40 days stale) and the self-flagged gate-3 sizing
  failure: nothing here overrides the spec default. **Deviation check: none
  found that would justify reopening.**

---

### #124 — chore(identity): weekly identity-drift check

- **Branch:** `chore/identity-drift` → `main`. **Age:** 37 days since first
  opened (2026-08-17T03:43:35Z) but **content is current**: `updatedAt`
  2026-09-21T08:30:19Z (2 days old) — this is a rolling/force-pushed PR per
  the automation design (F15), not a stale one-shot.
- **CI:** only `Vercel` + `Vercel Preview Comments` SUCCESS appear in
  `statusCheckRollup`; the required `build`/`e2e` checks never ran in
  PR-visible form — see the repo-wide finding above. Verified real
  `workflow_dispatch` CI run (`gh run view 35578016994`) on this branch's
  latest SHA: SUCCESS.
- **Mergeable:** `mergeStateStatus: BLOCKED`, `mergeable: MERGEABLE` (no git
  conflicts — verified `gh pr view 124 --json mergeable,mergeStateStatus`).
- **Diff summary:** 1 file, `content/identity-state.json`, +30/-20. Refreshes
  `checkedAt` timestamps to 2026-09-21 across all tracked products and
  updates several live/demo URLs (e.g. `style-maitri` and `aetherart`
  `liveUrl` now point at `gaurav-gandhi.vercel.app/warmup/*` redirects,
  `aetherart` gets a new `demoUrl`/`demoStatus: 503`, `reviewiq` moves to
  `api.samidhareviews.xyz`). Report-only file per its own header note — no
  rendered site copy changes automatically from this PR alone.
- **Superseded check:** verified via `gh pr diff 124` — this is the single
  rolling PR for this job; there is no newer duplicate. Not superseded.
- **Believed, not verified:** the specific URLs/HTTP statuses in the diff
  (e.g. `aetherart` demo returning 503) were not independently re-hit; taken
  as the automation's own probe result, consistent with F2/finding-style
  drift already logged in spec.md's baseline table.
- **Recommendation: regenerate-and-verify-then-merge**, per spec §5's bot-PR
  rule — but first unblock it: a human needs to approve the pending
  `action_required` `CI`/`Link Check` workflow runs on this branch (or the
  automation needs a fix so its `workflow_dispatch` result satisfies branch
  protection) before "merge" is even possible through normal means. Content
  itself is current (2 days old) and internally consistent; no numeric
  contradiction found against spec.md's own baseline table for the fields it
  touches.

---

### #125 — chore(content): weekly curated content proposals

- **Branch:** `chore/content-pipeline` → `main`. **Age:** 37 days since first
  opened (2026-08-17T03:44:38Z). **Content is stale relative to its own
  cadence:** `updatedAt` is still 2026-09-14T08:29:12Z (9 days old) — unlike
  #124/#206, this one has **not** been refreshed by the weekly job since
  2026-09-14, despite the workflow's schedule being weekly (`cron: "0 3 * * 1"`
  in `metrics-refresh.yml`, verified). That's a real gap worth flagging
  separately in the automation-hygiene work (Phase B), independent of this
  PR's own triage.
- **CI:** same shape as #124 — only Vercel checks visible;
  `pull_request`-triggered `CI`/`Link Check` stuck at `action_required`
  (verified `gh run list --branch chore/content-pipeline`); the
  `workflow_dispatch` CI run on the same SHA succeeded
  (`gh run view 34822784864`: SUCCESS).
- **Mergeable:** `mergeStateStatus: BLOCKED`, `mergeable: MERGEABLE`.
- **Diff summary:** 2 files — `content/chatbot/index.json` (full
  regeneration, designated generated path per rule 70a, hence the huge raw
  byte diff) and `content/provenance.md` (+9 lines): appends one
  "Wave 15 pipeline proposals — 2026-09-14 (LLM-consensus, pending human
  review)" entry for `triage-iq`'s VS Code bucket classifier
  ("underperformed the naive-prior fallback by 22.08 percentage points,
  confidence ~33%"), explicitly marked **not yet folded into any case
  study** — this PR only queues the fact for a human, it does not change
  rendered site copy.
- **Superseded check:** not superseded (no newer content-pipeline PR exists).
- **Verified the underlying claim against its cited source:** fetched
  `gaurav-gandhi-2411/triage-iq`'s `README.md` via
  `gh api repos/gaurav-gandhi-2411/triage-iq/contents/README.md`. Line
  matches exactly: "raw classifier loses to naive by −22.08pp [−25.81,
  −18.02]" and "naive-prior fallback (~33% conf)" for the vscode resolution
  predictor. **Claim is accurate.**
- **Recommendation: regenerate-and-verify-then-merge.** Same CI-approval
  blocker as #124 applies. Content itself is accurate and current-enough
  (proposal text doesn't go stale the way a live metric does), but note the
  content-pipeline job hasn't produced a fresh run since 2026-09-14 — after
  unblocking/merging this one, check why the weekly cron hasn't advanced it
  since.

---

### #132 — fix(gates): eval sees content changes, bundle gate sees more than one route

- **Branch:** `fix/eval-trigger-covers-index-sources` → `main`. **Age:** 37
  days (created 2026-08-17T12:26:26Z).
- **CI (as last run, 2026-08-17):** `build` SUCCESS ×2, `lychee` SUCCESS,
  `e2e` SUCCESS ×2, `Vercel` **FAILURE** (`upgradeToPro=build-rate-limit` —
  a Vercel plan-limit issue, not a code defect).
- **Mergeable:** `mergeStateStatus: BEHIND`, `mergeable: MERGEABLE` (no git
  conflicts per GitHub's test-merge, but branch protection's `strict: true`
  requires it be brought up to date with `main` before its checks count).
- **Diff summary:** 4 files, +297/-38 — `.github/workflows/ci.yml`,
  `.github/workflows/eval.yml`, `scripts/check-bundle-size.mjs`, and a new
  `scripts/check-eval-trigger-covers-index-sources.mjs`. Fixes two real
  control-coverage gaps: (1) `eval.yml` only triggered on
  `app/api/chat/**`/`lib/chatbot/**`/`evals/chatbot/**`, so a `content/**`
  copy edit that changes the chatbot's own retrieval index ran no eval —
  adds `content/**` plus a same-PR guard script; (2) the bundle-size gate
  only ever measured `/` (`ROUTE_OVERRIDE ?? "/"`), so 52,795 bytes of
  GSAP/Lenis imported from the root layout were invisible on every other
  route — adds measurement of `/`, `/projects`, `/ask`, and one
  `/work/[slug]` route, each reported separately.
- **NOT superseded — the gap is still live on `main` today.** Verified
  directly against current `main`:
  - `.github/workflows/eval.yml`'s `pull_request`/`push` trigger paths are
    **still** exactly `app/api/chat/**`, `lib/chatbot/**`, `evals/chatbot/**`
    (read the live file on this checkout, which tracks `origin/main`) —
    `content/**` is not present. The gap #132 describes is real and open.
  - `scripts/check-bundle-size.mjs` line 78 on `main`:
    `const ROUTE = process.env.ROUTE_OVERRIDE ?? "/";` — still a single
    default route, and `.github/workflows/ci.yml`'s bundle-gate step still
    calls `node scripts/check-bundle-size.mjs` with no route loop or
    multi-route wiring. The second gap is also real and open.
- **Recommendation: rebase, prove the fixed gates fail-on-defect/pass-on-clean, merge** (per spec §5).
  This is a correctness fix for a currently-real gap, not superseded by
  later work. Caution for Phase B: both files it touches (`ci.yml`,
  `eval.yml`) have had unrelated changes land on `main` in the 37 days since
  this branch was cut (e.g. the `workflow_dispatch`/`gh workflow run ci.yml`
  dispatch pattern discussed above, and various CI comment/step additions) —
  expect the rebase to require manual conflict resolution in at least
  `ci.yml`, not a clean fast-forward. The Vercel FAILURE on the last run is
  a plan-limit artifact, not a code problem, and should not block re-review
  on its own; get a fresh Vercel check after rebase regardless.

---

### #135 — chore(ci): bump actions/setup-node from 4 to 7

- **Branch:** `dependabot/github_actions/actions/setup-node-7` → `main`.
  **Age:** 37 days (created 2026-08-17T18:40:21Z).
- **CI:** `build` SUCCESS, `lychee` SUCCESS, `e2e` SUCCESS, Vercel SUCCESS,
  Vercel Preview Comments SUCCESS — **all green**, verified via
  `gh pr view 135 --json statusCheckRollup`.
- **Mergeable:** `mergeStateStatus: BEHIND`, `mergeable: MERGEABLE`.
- **Diff summary:** 1 file, `.github/workflows/live-link-markers.yml`,
  +1/-1: bumps that one workflow's `actions/setup-node` reference from `@v4`
  to `@v7`.
- **Superseded check — mostly already superseded, but not entirely.**
  Verified on current `main`
  (`grep -rn "actions/setup-node@" .github/workflows/*.yml`):
  `ci.yml`, `eval.yml`, and `metrics-refresh.yml` **already use
  `actions/setup-node@v7`** — that part of the major bump has already landed
  on `main` through other work. `live-link-markers.yml`, the one file this
  PR touches, is the **only remaining `@v4` reference** on `main` today —
  so this PR is not fully superseded, it's the last straggler closing the
  gap the rest of the repo already crossed.
- **Recommendation: rebase, merge** (CI already identical/green — meets
  spec §5's major-bump bar). This is now effectively a 1-line consistency
  fix rather than a repo-wide major bump; low risk. No Dependabot-ignore
  needed since the major version is already adopted elsewhere in the repo.

---

### #137 — chore(deps): bump eslint from 9.39.5 to 10.8.1

- **Branch:** `dependabot/npm_and_yarn/eslint-10.8.1` → `main`. **Age:** 37
  days (created 2026-08-17T18:41:13Z).
- **CI:** `build` **FAILURE**, `lychee` SUCCESS, `e2e` SUCCESS, Vercel
  SUCCESS, Vercel Preview Comments SUCCESS.
- **Mergeable:** `mergeStateStatus: BEHIND`, `mergeable: MERGEABLE`.
- **Diff summary:** 2 files, +192/-343 (net removal, likely a lockfile
  shrink plus a config-format change) — bumps `eslint` `9.39.5` → `10.8.1`,
  a major version.
- **Root cause of the build failure — verified, and it is NOT what it looks
  like.** Inspected the actual failing run's step list
  (`gh run view 32057380034 --json jobs`): the failure is at **"Verify
  chatbot index is up to date,"** and every step after it — including
  **Lint**, the one step that would actually exercise eslint 10 — is
  `skipped`. The build never got far enough to test ESLint 9→10
  compatibility at all; it failed on branch staleness (the chatbot index
  check compares against a `main` that had moved since 2026-08-17), not on
  the dependency bump under test.
- **Recommendation: do not close or merge on the current signal — rebase
  and re-run CI first**, per spec §5's own instruction to "test on branch."
  The current FAILURE is not evidence either way about ESLint 10
  compatibility; treating it as a real incompatibility (and closing +
  adding a Dependabot ignore) would be acting on an untested claim. After
  rebase, if `Lint`/`Typecheck`/`Build` come back green, merge; if ESLint 10
  actually breaks lint config or introduces new rule violations, then close
  per spec with a Dependabot ignore for the `10.x` major.

---

### #152 — docs: CHECKS.md 29 to 33, and the wave-22 plan checkpoint

- **Branch:** `docs/checks-instances-29-33` → `main`. **Age:** 36 days
  (created 2026-08-18T11:52:56Z).
- **CI:** `build` SUCCESS ×2, `lychee` SUCCESS, `e2e` SUCCESS ×2, Vercel
  SUCCESS, Vercel Preview Comments SUCCESS — all green (as of the last run,
  2026-08-18).
- **Mergeable:** `mergeStateStatus: DIRTY`, `mergeable: CONFLICTING` — real,
  current merge conflict.
- **Diff summary:** 2 files, +301/-3 — `CHECKS.md` (adds instances 29–33:
  a copy-rule boundary miss on `/ask` citation labels, a canary alarm
  conflating three failure causes, a test docblock overclaiming its own
  reach, a negative-control run confounded by a concurrent rebuild, and one
  case where a gate's own plausibility check caught something unplanned)
  and `PLAN.md` (a "wave-22" checkpoint summarizing what shipped/didn't in
  that wave).
- **Superseded check:** **content not superseded.** Verified against current
  `main`: `CHECKS.md`'s own orienting paragraph still tops out at
  "Instance 28" (`grep -n "Instance 2[0-9]" CHECKS.md`, last hit is
  "Instance 28"), and `PLAN.md` has no `wave-22` heading anywhere
  (`grep -n "wave-22" PLAN.md` returns nothing). Both files this PR would
  add are still absent from `main` — the content is the real next entries,
  not a duplicate of something already landed.
- **Recommendation: rebase and merge if still accurate, else close** (per
  spec §5). Given the content is docs-only, still-needed, and was CI-green
  before the conflict, this should rebase cleanly-ish and merge after a
  fresh CI run — but the conflict itself needs manual resolution (likely in
  `CHECKS.md`'s running instance count/header, since other work has
  continued to append to that file's narrative in the interim; not
  independently diffed line-by-line here).

---

### #206 — chore(metrics): weekly metric refresh

- **Branch:** `chore/metrics-refresh` → `main`. **Age:** 9 days (created
  2026-09-14T08:26:02Z). **Content is current:** `updatedAt`
  2026-09-21T08:28:58Z (2 days old), matches the weekly cron.
- **CI:** only `Vercel` + `Vercel Preview Comments` SUCCESS visible in
  `statusCheckRollup` — same `action_required`-purgatory pattern as
  #124/#125 for the `pull_request`-triggered checks
  (`gh run list --branch chore/metrics-refresh`).
- **The dispatched `workflow_dispatch` CI run on this branch's latest SHA
  actually FAILED** (verified: `gh run view 35578015063` — job `build`,
  conclusion `failure`) — **this is a real content defect, not a plumbing
  gap.** Full log (`gh run view 35578015063 --job 106264159359 --log`)
  shows the "Card/metrics/case-study consistency" step
  (`scripts/check-card-consistency.mjs`) failing with 2 same-project
  internal contradictions:
  - `content/metrics.json`'s `reviewiq:extraction-eval` value was updated by
    this PR to "78.6% overall … measured under openai/gpt-oss-20b /
    openai/gpt-oss-120b," but `content/products.ts`'s `reviewiq` card
    `figure` prose still says "83.8%" — the PR updated the metric but not
    the rendered card figure that's supposed to mirror it (the PR body's
    own review note flags exactly this risk: "If a changed metric has a
    drawn figure on the site … update the figure's numbers in this PR
    too" — the automation didn't do that itself).
  - The reverse direction of the same drift (Check B): `products.ts`'s
    figure token "83.8"/"83" isn't found in the metric's new value.
- **Mergeable:** `mergeStateStatus: BLOCKED`, `mergeable: MERGEABLE`.
- **Diff summary:** 1 file, `content/metrics.json`, +8/-8 — refreshes
  `reviewiq:extraction-eval` (83.8% → 78.6% overall, new per-language
  breakdown, new commit SHA/measured_at) and `hf:downloads-alltime`
  (1033 → 1416). Body also lists 11 "held" manifests (>21 days stale,
  correctly not propagated per the fail-closed design from "wave 19") and a
  resume-drift warning list (6 metrics where `public/resume.pdf` now
  disagrees with the site, including this same `reviewiq` number).
  Not superseded — this is the current rolling PR and no newer one exists.
- **Recommendation: NOT ready to merge as-is** — this deviates from a
  literal "regenerate-and-verify-then-merge" per spec §5, because
  verification here means running the repo's own consistency gate, and it
  fails for a real reason. Before merging: update
  `content/products.ts`'s `reviewiq` figure to match the new
  `reviewiq:extraction-eval` value (78.6% overall / 78.2% en / 79.3% hi-en),
  matching what the PR's own review checklist already instructs, then
  re-run `node scripts/check-card-consistency.mjs` clean, then unblock the
  same CI-approval gap noted for #124/#125, then merge. Also flag the
  resume-drift list to GG per spec's D-decision cadence — regenerating
  `public/resume.pdf` is explicitly a human step per this repo's own
  convention (`.assets/resume-sources/`), not something to automate away in
  Phase B.

---

### #208 — chore(deps): bump the minor-and-patch group across 1 directory with 16 updates

- **Branch:** `dependabot/npm_and_yarn/minor-and-patch-fce0690aba` → `main`.
  **Age:** 2 days (created 2026-09-21T16:39:30Z).
- **CI:** `build` SUCCESS, `lychee` SUCCESS, `e2e` SUCCESS, Vercel SUCCESS —
  **all green**, verified via `gh pr view 208 --json statusCheckRollup`.
- **Mergeable:** `mergeStateStatus: CLEAN`, `mergeable: MERGEABLE` — the only
  one of the nine with a fully clean merge state.
- **Diff summary:** 2 files, +315/-325 (package.json + lockfile). Bumps 16
  packages in the minor/patch group: `next` 16.3.0→16.3.5 (includes two
  backported security advisories per the release notes — RCE fixes),
  `react`/`react-dom` 19.2.8→19.3.0, `@vercel/functions`, `tailwind-merge`,
  `@axe-core/playwright`, `@playwright/test`, `lighthouse`,
  `@huggingface/transformers`, `pdfjs-dist`, `shadcn`, and related
  `@types/*` packages — all within dependabot's own minor-and-patch grouping
  rule, none are major-version bumps.
- **Superseded check:** N/A (only open dependency PR of its kind; not
  duplicated).
- **Recommendation: merge** (per spec §5 — dependabot patch/minor, all
  gates + build green). This is the one PR in the set that needs no further
  work beyond whatever smoke-screenshot check Phase B wants to run before
  merging; note the bundled `next` bump includes real security fixes, so
  this is also the highest-priority PR in the set to land promptly once
  Phase B starts merging.

---

### Summary table

| PR # | title | CI | mergeable | age (days) | recommendation |
|---|---|---|---|---|---|
| #99 | feat: semantic project search on /projects (BL-9) | green (stale, last run 2026-08-15) | DIRTY / CONFLICTING | 40 | **Close** (keep branch) — spec default; PR's own 6-round conclusion (ship keyword-only, reject every embedding tier) reinforces it |
| #124 | chore(identity): weekly identity-drift check | only Vercel checks visible; required build/e2e stuck `action_required`; dispatched run SUCCESS | BLOCKED / MERGEABLE | 37 (content 2d old) | Regenerate-and-verify-then-merge, after unblocking the CI-approval gap |
| #125 | chore(content): weekly curated content proposals | same as #124 | BLOCKED / MERGEABLE | 37 (content 9d old — cron has stalled) | Regenerate-and-verify-then-merge; claim verified accurate against triage-iq README; also investigate why weekly cron hasn't advanced since 09-14 |
| #132 | fix(gates): eval sees content changes, bundle gate sees more than one route | green except Vercel (rate-limit, not code) | BEHIND / MERGEABLE | 37 | Rebase, prove fail-on-defect/pass-on-clean, merge — gap confirmed still live on main today |
| #135 | chore(ci): bump actions/setup-node from 4 to 7 | all green | BEHIND / MERGEABLE | 37 | Rebase, merge — last remaining `@v4` reference on main, rest already upgraded elsewhere |
| #137 | chore(deps): bump eslint from 9.39.5 to 10.8.1 | build FAILURE (but Lint step never ran — failure is stale-branch chatbot-index check, not eslint) | BEHIND / MERGEABLE | 37 | Rebase and re-run CI before judging; current failure is not evidence on ESLint 10 compatibility |
| #152 | docs: CHECKS.md 29 to 33, and the wave-22 plan checkpoint | all green (2026-08-18) | DIRTY / CONFLICTING | 36 | Rebase and merge if still accurate — confirmed content (instances 29-33, wave-22) still absent from main |
| #206 | chore(metrics): weekly metric refresh | only Vercel checks visible; dispatched run **FAILED** on card-consistency gate | BLOCKED / MERGEABLE | 9 (content 2d old) | **Not ready** — fix the reviewiq figure/metric mismatch this PR itself introduces, re-verify clean, then merge; also unblock CI-approval gap |
| #208 | chore(deps): bump the minor-and-patch group (16 updates incl. next security fixes) | all green | CLEAN / MERGEABLE | 2 | **Merge** — clean, green, includes real Next.js security backports; highest priority to land |
