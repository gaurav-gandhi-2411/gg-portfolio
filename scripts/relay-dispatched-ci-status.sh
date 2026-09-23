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
# triggered run.
#
# History — three failed attempts, all silent:
#   1. Original version read required contexts live from `gh api
#      repos/OWNER/REPO/branches/main/protection`. That endpoint needs admin;
#      GITHUB_TOKEN inside Actions cannot read it, and `gh api ... --jq`
#      writes the HTTP error BODY to stdout even when --jq is given, so a 403
#      became a single non-empty JSON line. It passed an `[ -z "$CONTEXTS" ]`
#      emptiness check, matched nothing against real job names, and the
#      script exited 0 having posted no statuses at all (rule 98a: a
#      "couldn't verify" response was treated as data, not a denial).
#   2. A branch (`fix/relay-required-contexts`, unmerged) replaced that read
#      with a `RELAY_REQUIRED_CONTEXTS` env var the caller had to set and
#      keep in sync with branch protection by hand — a second place to edit
#      every time the required checks change, with no enforcement that the
#      two stay matched.
#   3. This version: required contexts are read from a checked-in config
#      file, `.github/required-checks.json` — one file, versioned, reviewable
#      in the same PR as any branch-protection change. This script no longer
#      touches branch protection at all (live or cross-check); a separate
#      scheduled job, .github/workflows/required-checks-drift.yml (which CAN
#      read branch protection, via GET /branches/main rather than the
#      admin-only /branches/main/protection sub-resource), is the thing that
#      keeps the config file honest.
#
# Usage: relay-dispatched-ci-status.sh <branch>
# Preconditions: currently checked out on <branch> with the SHA to relay as
# HEAD; GH_TOKEN in env with `actions: write` and `statuses: write`;
# .github/required-checks.json present and valid (relative to this script's
# own directory, not the caller's cwd).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/../.github/required-checks.json"
CONTEXT_RE='^[A-Za-z0-9 ._/-]+$'

BRANCH="${1:?usage: relay-dispatched-ci-status.sh <branch>}"
SHA=$(git rev-parse HEAD)
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set (set automatically inside GitHub Actions)}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "::error::Required-checks config not found at $CONFIG_FILE -- cannot determine which contexts to relay."
  exit 1
fi

if ! CONFIG_JSON=$(jq -c '.' "$CONFIG_FILE" 2>&1); then
  echo "::error::$CONFIG_FILE did not parse as JSON: $CONFIG_JSON"
  exit 1
fi

CONTEXTS_TYPE=$(printf '%s' "$CONFIG_JSON" | jq -r '.contexts | type')
if [ "$CONTEXTS_TYPE" != "array" ]; then
  echo "::error::$CONFIG_FILE's .contexts must be a JSON array of strings (got: $CONTEXTS_TYPE)."
  exit 1
fi

CONTEXTS=$(printf '%s' "$CONFIG_JSON" | jq -r '.contexts[]?')
if [ -z "$CONTEXTS" ]; then
  echo "::error::$CONFIG_FILE's .contexts array is empty -- refusing to relay with no required checks named."
  exit 1
fi

while IFS= read -r CONTEXT; do
  if ! [[ "$CONTEXT" =~ $CONTEXT_RE ]]; then
    echo "::error::$CONFIG_FILE contains an invalid context name: '$CONTEXT' (expected letters/digits/spaces/._/- only) -- refusing to use it."
    exit 1
  fi
done <<<"$CONTEXTS"

echo "Required contexts (from $CONFIG_FILE): $(printf '%s' "$CONTEXTS" | tr '\n' ',' | sed 's/,$//')"

# Retry loop: `gh run list` can transiently miss the dispatched run before
# GitHub's API reflects it. Captured via `&&`/`||` rather than a bare
# assignment so a `gh` failure doesn't trip `set -e` mid-loop (which would
# abort on the first transient miss instead of retrying) while still being
# loud about the last failure if every attempt is exhausted.
RUN_ID=""
LAST_RUN_LIST_ERR=""
for _ in $(seq 1 30); do
  RUN_ID=$(gh run list --repo "$REPO" --workflow ci.yml --branch "$BRANCH" \
    --event workflow_dispatch --limit 5 --json databaseId,headSha \
    --jq "[.[] | select(.headSha == \"$SHA\")][0].databaseId // empty" 2>&1) && LAST_RUN_LIST_ERR="" || {
    LAST_RUN_LIST_ERR="$RUN_ID"
    RUN_ID=""
  }
  [ -n "$RUN_ID" ] && break
  sleep 5
done

if [ -z "$RUN_ID" ]; then
  echo "::error::No workflow_dispatch ci.yml run found for $BRANCH@$SHA within 150s -- required checks will stay unregistered for this PR.${LAST_RUN_LIST_ERR:+ Last gh error: $LAST_RUN_LIST_ERR}"
  exit 1
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
LAST_RUN_VIEW_ERR=""
for _ in $(seq 1 5); do
  JOBS_TSV=$(gh run view "$RUN_ID" --repo "$REPO" --json jobs --jq '.jobs[] | [.name, .conclusion] | @tsv' 2>&1) && LAST_RUN_VIEW_ERR="" || {
    LAST_RUN_VIEW_ERR="$JOBS_TSV"
    JOBS_TSV=""
  }
  [ -n "$JOBS_TSV" ] && break
  sleep 5
done

if [ -z "$JOBS_TSV" ]; then
  echo "::error::gh run view $RUN_ID returned no jobs after the run completed — cannot relay build/e2e status for $BRANCH@$SHA. Required checks will stay unregistered; branch protection will block this PR until this is retried.${LAST_RUN_VIEW_ERR:+ Last gh error: $LAST_RUN_VIEW_ERR}"
  exit 1
fi

JOB_NAMES_SEEN=$(printf '%s\n' "$JOBS_TSV" | cut -f1 | tr '\n' ',' | sed 's/,$//')

POSTED_COUNT=0
ANY_FAILURE=false
MATCHED_CONTEXTS=""
while IFS=$'\t' read -r JOB_NAME JOB_CONCLUSION; do
  MATCHED=false
  while IFS= read -r CONTEXT; do
    [ "$CONTEXT" = "$JOB_NAME" ] && MATCHED=true
  done <<<"$CONTEXTS"
  [ "$MATCHED" = true ] || continue

  STATE="failure"
  if [ "$JOB_CONCLUSION" = "success" ]; then
    STATE="success"
  else
    ANY_FAILURE=true
  fi

  if ! POST_ERR=$(gh api "repos/$REPO/statuses/$SHA" \
    -f state="$STATE" \
    -f context="$JOB_NAME" \
    -f description="Relayed from workflow_dispatch run (bot-PR required-check workaround)" \
    -f target_url="https://github.com/$REPO/actions/runs/$RUN_ID" 2>&1); then
    echo "::error::Failed to post commit status for $JOB_NAME=$STATE on $SHA: $POST_ERR"
    exit 1
  fi

  POSTED_COUNT=$((POSTED_COUNT + 1))
  MATCHED_CONTEXTS="$MATCHED_CONTEXTS
$JOB_NAME"
  echo "Relayed $JOB_NAME=$STATE for $SHA (source run $RUN_ID)"
done <<<"$JOBS_TSV"

if [ "$POSTED_COUNT" -eq 0 ]; then
  echo "::error::Posted zero commit statuses for $BRANCH@$SHA. Required contexts: $(printf '%s' "$CONTEXTS" | tr '\n' ',' | sed 's/,$//'). Job names seen in run $RUN_ID: $JOB_NAMES_SEEN. Branch protection will block this PR until this is retried."
  exit 1
fi

# Every required context has to have actually matched a job in this run —
# a context present in the config but absent from the run's job names would
# otherwise silently leave that one check unregistered while the script
# still exits 0 because *some* statuses posted.
MISSING=""
while IFS= read -r CONTEXT; do
  [ -z "$CONTEXT" ] && continue
  if ! printf '%s\n' "$MATCHED_CONTEXTS" | grep -qx "$CONTEXT"; then
    MISSING="$MISSING $CONTEXT"
  fi
done <<<"$CONTEXTS"

if [ -n "$MISSING" ]; then
  echo "::error::Required context(s) not found among run $RUN_ID's job names ($JOB_NAMES_SEEN), so were never posted:$MISSING"
  exit 1
fi

if [ "$ANY_FAILURE" = true ]; then
  echo "::error::At least one relayed status was 'failure' for $BRANCH@$SHA -- see the Relayed lines above for which."
  exit 1
fi

echo "All required contexts relayed successfully for $BRANCH@$SHA."
