#!/usr/bin/env bash
# The "Open PR if anything changed" logic of metrics-refresh.yml's refresh job.
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
set -euo pipefail

PREFIX="chore/metrics-refresh"
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

if git diff --quiet content/metrics.json content/generated/hf-downloads.json; then
  echo "No metric changes — no PR this week."
  # A prior week's PR may still be open with nothing left to propose; close it
  # (branch kept — the ruleset forbids deleting it).
  for n in $open_prs; do
    gh pr close "$n" \
      --comment "This week's refresh found nothing to propose — closing. Reopens automatically (as a fresh PR) if drift shows up again."
  done
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git checkout -b "$BRANCH"
git add content/metrics.json content/generated/hf-downloads.json
# Modified only when the HF snapshot changed (rebuild step); a no-op otherwise.
git add content/chatbot/index.json
git commit -m "chore(metrics): weekly metric refresh from source repos"
# Plain push of a brand-new branch: fast-forward by construction, no --force.
git push origin "$BRANCH:refs/heads/$BRANCH"

pr_url=$(gh pr create \
  --title "chore(metrics): weekly metric refresh" \
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
