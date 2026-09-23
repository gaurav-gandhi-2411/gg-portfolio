#!/usr/bin/env bash
# Relays a workflow_dispatch-triggered ci.yml run's per-job conclusions onto
# the dispatching branch's HEAD SHA as plain commit statuses.
#
# Why this exists: PRs opened by scheduled jobs (metrics-refresh.yml's
# refresh/content-pipeline/identity-drift jobs, all committing and pushing as
# github-actions[bot] via the default GITHUB_TOKEN) do get a `pull_request`
# workflow run queued for ci.yml — but it sits at conclusion `action_required`
# forever (0s duration, never actually starts). This is GitHub's default
# recursive-workflow-prevention gate: a workflow run whose *actor* is
# github-actions[bot] requires a human to click "Approve and run" in the
# Actions tab before a `pull_request`-triggered run executes, and nothing
# ever visits that tab for a bot PR. The existing `gh workflow run ci.yml
# --ref "$BRANCH"` workaround (right before this script runs) sidesteps that
# by using workflow_dispatch instead, which DOES execute normally — but a
# workflow_dispatch run doesn't register against branch protection's
# required-status-check bookkeeping for the PR's head SHA on its own; it's a
# real, successful run that branch protection simply never looks at.
#
# The fix: read the dispatched run's actual per-job conclusion and post it as
# a plain commit status (Statuses API, not Checks API) on the exact SHA the
# PR points at, using the same context names ("build"/"e2e") branch
# protection requires. `gh api repos/OWNER/REPO/branches/main/protection
# --jq .required_status_checks` shows `app_id: null` for both required
# contexts, which means branch protection accepts a plain status from any
# source as satisfying the check — it does not require the status/check-run
# to come from the same GitHub App identity as the original `pull_request`-
# triggered run. Reads the required context list from branch protection at
# call time rather than hardcoding ["build","e2e"], so this keeps working if
# the required checks ever change.
#
# Usage: relay-dispatched-ci-status.sh <branch>
# Preconditions: currently checked out on <branch> with the SHA to relay as
# HEAD; GH_TOKEN in env with `actions: write` and `statuses: write`.
set -euo pipefail

BRANCH="${1:?usage: relay-dispatched-ci-status.sh <branch>}"
SHA=$(git rev-parse HEAD)
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set (set automatically inside GitHub Actions)}"

CONTEXTS=$(gh api "repos/$REPO/branches/main/protection" --jq '.required_status_checks.contexts[]?' 2>/dev/null || true)
if [ -z "$CONTEXTS" ]; then
  echo "::warning::Could not read required status check contexts for main — skipping CI-status relay for $BRANCH@$SHA."
  exit 0
fi

RUN_ID=""
for _ in $(seq 1 30); do
  RUN_ID=$(gh run list --repo "$REPO" --workflow ci.yml --branch "$BRANCH" \
    --event workflow_dispatch --limit 5 --json databaseId,headSha \
    --jq "[.[] | select(.headSha == \"$SHA\")][0].databaseId // empty")
  [ -n "$RUN_ID" ] && break
  sleep 5
done

if [ -z "$RUN_ID" ]; then
  echo "::warning::No workflow_dispatch ci.yml run found for $BRANCH@$SHA within 150s — required checks will stay unregistered for this PR."
  exit 0
fi

# Block until the dispatched run finishes. `|| true`: a failing CI run is a
# legitimate, expected outcome this script still needs to relay (as a
# failure status) rather than treat as a reason to abort early.
gh run watch "$RUN_ID" --repo "$REPO" --exit-status || true

# Bug fix (2026-09-23 operational test, PR #124): this used to read straight
# from `< <(gh run view ... --jq ...)` — a process substitution. `set -e`
# does NOT see failures inside a process substitution; if that `gh run view`
# call hit a transient hiccup (e.g. the run API not yet reflecting per-job
# conclusions in the instant right after `gh run watch` reports completion)
# it silently produced zero lines, the while loop below ran zero iterations,
# and the whole script exited 0 having posted nothing — a real dispatch
# (run 35826364013) did exactly this: build/e2e both genuinely passed, but
# no commit status was ever posted and no error appeared anywhere in the
# log. Capturing into a variable first, with a retry, makes a transient miss
# recoverable and a persistent one loud (rule 98a: "couldn't verify" must
# fail closed, not silently pass).
JOBS_TSV=""
for _ in $(seq 1 5); do
  JOBS_TSV=$(gh run view "$RUN_ID" --repo "$REPO" --json jobs --jq '.jobs[] | [.name, .conclusion] | @tsv')
  [ -n "$JOBS_TSV" ] && break
  sleep 5
done

if [ -z "$JOBS_TSV" ]; then
  echo "::error::gh run view $RUN_ID returned no jobs after the run completed — cannot relay build/e2e status for $BRANCH@$SHA. Required checks will stay unregistered; branch protection will block this PR until this is retried."
  exit 1
fi

while IFS=$'\t' read -r JOB_NAME JOB_CONCLUSION; do
  MATCHED=false
  while IFS= read -r CONTEXT; do
    [ "$CONTEXT" = "$JOB_NAME" ] && MATCHED=true
  done <<<"$CONTEXTS"
  [ "$MATCHED" = true ] || continue

  STATE="failure"
  [ "$JOB_CONCLUSION" = "success" ] && STATE="success"

  gh api "repos/$REPO/statuses/$SHA" \
    -f state="$STATE" \
    -f context="$JOB_NAME" \
    -f description="Relayed from workflow_dispatch run (bot-PR required-check workaround)" \
    -f target_url="https://github.com/$REPO/actions/runs/$RUN_ID" \
    >/dev/null
  echo "Relayed $JOB_NAME=$STATE for $SHA (source run $RUN_ID)"
done <<<"$JOBS_TSV"
