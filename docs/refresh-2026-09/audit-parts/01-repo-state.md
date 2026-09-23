## 1. Repo state

### 1.1 gg-portfolio primary checkout (`C:\Users\gaura\ml-projects\gg-portfolio`)

- Current branch: `feat/ask-deep-links` — verified (command: `git branch --show-current`).
- HEAD SHA: `ff1eac0e5b074b10d481cd76c8aa678451851891` (short `ff1eac0`) — verified (command: `git rev-parse HEAD` / `git rev-parse --short HEAD`). Matches the orchestrator-verified value from the session's git status snapshot.
- Working tree: untracked-only, no modified/staged tracked files — verified (command: `git status --short`), output:
  ```
  ?? docs/refresh-2026-09/
  ?? ops/
  ?? portfolio-revamp-brief.md
  ```
  Per task instructions, `ops/**` and `portfolio-revamp-brief.md` are unrelated to this wave (already-merged GCP ops tooling and a separate UI-motion brief respectively) and are recorded as-is, not investigated further. `docs/refresh-2026-09/` is this audit's own output tree in the other worktree — not present under the primary checkout's working tree at all (see 1.2 on worktree separation); its untracked appearance here reflects the shared-index nature of the local disk layout, not a content conflict.
- HEAD commit message: "Merge remote-tracking branch 'origin/main' into feat/ask-deep-links" — verified (command: `git log -1 --format="%H %s"`).

### 1.2 `origin/main` state and CI status

- `origin/main` HEAD SHA (via local git, post-fetch on the primary checkout's remote-tracking ref as of session start): `05053866f1bf27e6e4a82a46ceb5ab828027d209` (short `0505386`) — believed (reason: relies on the orchestrator's prior fetch; not independently re-fetched from this section's checks, superseded by the two independent checks below which agree).
- `origin/main` HEAD SHA via GitHub REST API, independent of any local git state: `05053866f1bf27e6e4a82a46ceb5ab828027d209` — verified (command: `gh api repos/gaurav-gandhi-2411/gg-portfolio/commits/main --jq .sha`).
- Last 10 CI runs on `main` (via `gh run list`) — verified (command: `gh run list --branch main --limit 10 --json status,conclusion,name,headSha,createdAt`), all `status: completed`, all `conclusion: success`, all at `headSha` `05053866f1bf27e6e4a82a46ceb5ab828027d209`:

  | createdAt (UTC) | name | conclusion |
  |---|---|---|
  | 2026-09-22T21:03:20Z | Chat canary | success |
  | 2026-09-22T16:36:49Z | Chat canary | success |
  | 2026-09-22T12:44:51Z | Live Link Body Markers | success |
  | 2026-09-22T12:14:55Z | Live Link Latency | success |
  | 2026-09-22T11:14:41Z | Chat canary | success |
  | 2026-09-22T04:07:32Z | Chat canary | success |
  | 2026-09-21T21:50:05Z | Chat canary | success |
  | 2026-09-21T16:36:28Z | npm_and_yarn dependency update (#1585969578) | success |
  | 2026-09-21T16:36:24Z | github_actions dependency update (#1585969059) | success |
  | 2026-09-21T16:36:24Z | npm_and_yarn dependency update (#1585969061) | success |

- Conclusion: **confirms and refreshes** the orchestrator's prior finding — `origin/main` HEAD is `0505386` (chore(ops) PR #203 per the orchestrator's session-start note), and every CI run recorded against that SHA (Chat canary ×4, Live Link Body Markers, Live Link Latency, and 3 Dependabot update workflow runs) is `success`. No newer commits or CI activity have landed on `main` since the orchestrator's snapshot — verified (command: two independent SHA lookups above agree, both post-dating the orchestrator's snapshot).
- Note on worktree isolation (per repo `CLAUDE.md`): this audit ran read-only `git`/`gh` commands from the primary checkout (`C:\Users\gaura\ml-projects\gg-portfolio`) without checking out any branch other than the one already active (`feat/ask-deep-links`), and without mutating the working tree — no `checkout`, `merge`, `pull`, `commit`, or `push` was run. This section's output file itself was written to the `gg-portfolio-wt-refresh-audit` worktree, per task instructions, not the primary checkout.

### 1.3 Profile repo `gaurav-gandhi-2411/gaurav-gandhi-2411`

- Local clone: **does exist**, at `C:\Users\gaura\ml-projects\gh-profile` — verified (command: `git remote -v` inside that directory, returns `origin https://github.com/gaurav-gandhi-2411/gaurav-gandhi-2411.git`). Note this was found by directory-listing `ml-projects/` after an initial `Glob` search for `**/gaurav-gandhi-2411*` timed out (ripgrep 20s timeout) — the clone directory is named `gh-profile`, not a name matching the repo/org slug, which is why the glob pattern would not have found it even without the timeout.
- Local clone's checked-out branch: `main` — verified (command: `git branch --show-current`).
- Local clone's HEAD **before** this audit's fetch: `202cc620ce558532a2325be6853fc608d7101515`, dated 2026-08-13 14:42:40 +0530, "Merge pull request #5 from gaurav-gandhi-2411/feat/generator-determinism-check" — verified (command: `git log -1 --format="%H %ci %s"`), i.e. the local clone was **stale relative to remote** by about 5.5 weeks at the time of this check.
- Local clone's working tree: clean (no output from `git status --short`) — verified.
- After `git fetch origin` (network read only, no merge/checkout/pull performed — working tree left untouched): `origin/main` resolved to `a0582254b54251e70b9a4837df5f2d366dd54eb0`, dated 2026-09-21 12:54:51 +0000, message "chore(stats): refresh profile stats from the GitHub API [skip ci]" — verified (command: `git fetch origin` then `git log -1 origin/main --format="%H %ci %s"`).
- Default branch HEAD SHA confirmed independently via GitHub REST API (no local git involved): `a0582254b54251e70b9a4837df5f2d366dd54eb0`, same date/message — verified (command: `gh api repos/gaurav-gandhi-2411/gaurav-gandhi-2411/commits/main --jq '{sha,date:.commit.committer.date,message:.commit.message}'`). All three sources (stale local HEAD superseded by fetch, `git log origin/main`, and the REST API) agree once the fetch is accounted for.
- `README.md` exists at repo root: **confirmed** — verified (command: `gh api repos/gaurav-gandhi-2411/gaurav-gandhi-2411/readme --jq '{name,path,size}'`), returns `{"name":"README.md","path":"README.md","size":11283}`. The `size` field from the GitHub Contents API is the raw file size in bytes (not the base64-encoded transport size), so raw content length = **11,283 bytes**. Full content was not fetched/decoded in this section — reserved for the section covering cross-surface content (per task scope, "don't need to reproduce the whole README here").
- Last commit to the profile repo overall: 2026-09-21T12:54:51Z (stats-refresh automation commit) — verified (same API call as above). This is 2 days before this audit's run date (2026-09-23).
- Repo metadata via `gh repo view`: default branch `main`, description "GitHub profile README", `pushedAt` 2026-09-21T12:54:52Z, `updatedAt` 2026-09-21T12:54:56Z — verified (command: `gh repo view gaurav-gandhi-2411/gaurav-gandhi-2411 --json defaultBranchRef,description,updatedAt,pushedAt,name,url`).

### 1.4 GitHub user bio (for finding F1)

- Verified (command: `gh api users/gaurav-gandhi-2411 --jq '{bio,name,blog}'`):
  ```json
  {
    "bio": "Senior Data Scientist building production GenAI systems in Uber's AI org. Independent AI products and research on the side — every number sourced.",
    "blog": "https://gaurav-gandhi.vercel.app/",
    "name": "Gaurav Gandhi"
  }
  ```
- This directly confirms F1 as stated in the spec: the GitHub bio says **"Senior Data Scientist"**, which conflicts with the README/site's **"Lead Data Scientist"** claim (Lead since Aug 2026). No update to the bio was made — this section is read-only per Phase A scope; F1 remains open for Phase C.

### 1.5 Summary table

| Item | Value | Status |
|---|---|---|
| Primary checkout branch | `feat/ask-deep-links` | verified |
| Primary checkout HEAD | `ff1eac0e5b074b10d481cd76c8aa678451851891` | verified |
| `origin/main` HEAD | `05053866f1bf27e6e4a82a46ceb5ab828027d209` | verified (2 independent methods) |
| CI on `main` HEAD | 10/10 recent runs `success` | verified |
| Profile repo local clone | exists at `gh-profile`, was stale by ~5.5 weeks, now fetched (not merged) | verified |
| Profile repo `main` HEAD | `a0582254b54251e70b9a4837df5f2d366dd54eb0` | verified (2 independent methods) |
| Profile README exists, size | yes, 11,283 bytes | verified |
| Profile repo last commit | 2026-09-21T12:54:51Z | verified |
| GH bio text | "Senior Data Scientist..." | verified — confirms F1 |
