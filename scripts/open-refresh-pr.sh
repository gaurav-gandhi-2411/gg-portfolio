#!/usr/bin/env bash
# The "open a PR if anything changed" logic of metrics-refresh.yml's refresh,
# content-pipeline and identity-drift jobs (parameterised by env; defaults are
# the refresh job's).
#
# Why a unique branch per run: repository ruleset 'no-force-push-no-delete-all-
# branches' rejects non-fast-forward pushes and branch deletion on (almost)
# every branch, with no bypass. The workflow used to force-push one long-lived
# `chore/metrics-refresh` branch and `gh pr close --delete-branch` it; the
# second run after the ruleset landed failed with GH013. So this script never
# force-pushes and never deletes: each run pushes a fresh
# `chore/metrics-refresh-<YYYYMMDD>-<run id>` branch and closes any superseded
# open refresh PR WITHOUT deleting its branch. Stale refresh branches therefore
# accumulate by design (<= 52/yr) until GG removes them via the ruleset
# disable/re-enable procedure.
#
# Fail closed (rule 98a): `set -e` + assignment-form command substitution means
# a failing `gh pr list` aborts the run instead of reading as "no open PRs".
#
# Env: GH_TOKEN (gh), GITHUB_RUN_ID (required), GITHUB_RUN_ATTEMPT (default 1;
# >1 is appended so a re-run attempt never collides with attempt 1's branch),
# SUMMARY_PATH (PR body), REFRESH_DATE (test override of today's UTC date),
# RELAY_SCRIPT (test override).
# Per-job parameters (defaults = metrics-refresh job): REFRESH_BRANCH_PREFIX
# (e.g. chore/identity-drift; open PRs whose head ref starts with it are the
# ones superseded/closed), DIFF_PATHS and ADD_PATHS (space-separated),
# COMMIT_MSG, PR_TITLE, NOTHING_COMMENT (close comment), PRE_COMMIT_CMD
# (optional bash, run only when there are changes and before committing, e.g.
# a chatbot index rebuild).
set -euo pipefail

PREFIX="${REFRESH_BRANCH_PREFIX:-chore/metrics-refresh}"
DIFF_PATHS="${DIFF_PATHS:-content/metrics.json content/generated/hf-downloads.json}"
ADD_PATHS="${ADD_PATHS:-content/metrics.json content/generated/hf-downloads.json content/chatbot/index.json}"
COMMIT_MSG="${COMMIT_MSG:-chore(metrics): weekly metric refresh from source repos}"
PR_TITLE="${PR_TITLE:-chore(metrics): weekly metric refresh}"
NOTHING_COMMENT="${NOTHING_COMMENT:-The latest refresh found nothing to propose — closing. Reopens automatically (as a fresh PR) if drift shows up again.}"
PRE_COMMIT_CMD="${PRE_COMMIT_CMD:-}"
SUMMARY_PATH="${SUMMARY_PATH:-/tmp/metrics-summary.md}"
RELAY_SCRIPT="${RELAY_SCRIPT:-scripts/relay-dispatched-ci-status.sh}"
RUN_ID="${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"
ATTEMPT="${GITHUB_RUN_ATTEMPT:-1}"
DATE_STAMP="${REFRESH_DATE:-$(date -u +%Y%m%d)}"

BRANCH="$PREFIX-$DATE_STAMP-$RUN_ID"
if [ "$ATTEMPT" != "1" ]; then BRANCH="$BRANCH-a$ATTEMPT"; fi

# Open refresh PRs from any earlier run (head ref starts with the prefix).
open_prs=$(gh pr list --state open --limit 100 --json number,headRefName \
  --jq ".[] | select(.headRefName | startswith(\"$PREFIX\")) | .number")

# shellcheck disable=SC2086 # space-separated path lists, intentionally word-split
if git diff --quiet $DIFF_PATHS; then
  echo "Nothing to propose ($PREFIX) — no PR this week."
  # A prior week's PR may still be open with nothing left to propose; close it
  # (branch kept — the ruleset forbids deleting it).
  for n in $open_prs; do
    gh pr close "$n" --comment "$NOTHING_COMMENT"
  done
  exit 0
fi

if [ -n "$PRE_COMMIT_CMD" ]; then bash -c "$PRE_COMMIT_CMD"; fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git checkout -b "$BRANCH"
# Refresh job: content/chatbot/index.json changes only when the HF snapshot did.
# shellcheck disable=SC2086
git add $ADD_PATHS
git commit -m "$COMMIT_MSG"
# Plain push of a brand-new branch: fast-forward by construction, no --force.
git push origin "$BRANCH:refs/heads/$BRANCH"

pr_url=$(gh pr create \
  --title "$PR_TITLE" \
  --body-file "$SUMMARY_PATH" \
  --base main --head "$BRANCH")
new_pr="${pr_url##*/}"
echo "Opened PR #$new_pr ($BRANCH)"

# Close superseded PRs only after the new one exists, so a failed create
# leaves the old PR open rather than nothing.
for n in $open_prs; do
  gh pr close "$n" --comment "Superseded by #$new_pr"
done

# PRs created with GITHUB_TOKEN don't trigger pull_request workflows (GitHub
# anti-recursion rule), so the required `build` check would sit absent forever.
# Dispatch CI onto the branch explicitly...
gh workflow run ci.yml --ref "$BRANCH"
# ...but a dispatched run doesn't register against branch protection on its
# own — see scripts/relay-dispatched-ci-status.sh's header for the mechanism.
bash "$RELAY_SCRIPT" "$BRANCH"
