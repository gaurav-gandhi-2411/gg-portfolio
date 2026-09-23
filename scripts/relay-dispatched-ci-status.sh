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
# Bug fix (2026-09-23, live run 35839553875, bot PR #216): required contexts
# used to come from a live `gh api .../branches/main/protection` read. Inside
# Actions, GITHUB_TOKEN almost certainly cannot read branch protection (that
# endpoint needs admin) — and `gh api ... --jq` writes the HTTP error BODY to
# stdout even when --jq is given, so a 403 became a single non-empty JSON
# line ('{"message":"Resource not accessible by integration",...}'). That
# line passed the old `[ -z "$CONTEXTS" ]` emptiness check, the job-name
# match loop below matched nothing against it, and the script exited 0
# having posted no statuses at all — silent, not loud (rule 98a: "couldn't
# verify" must fail closed, never be treated as data). Required contexts now
# come from RELAY_REQUIRED_CONTEXTS, a plain comma-separated env var set by
# the caller (metrics-refresh.yml) — keep it in sync with `main`'s
# required_status_checks.contexts by hand. The old branch-protection read is
# kept below, but only as a best-effort cross-check that warns on drift; a
# malformed or unreadable response is logged and otherwise ignored, never
# substituted in as the real context list.
#
# Usage: relay-dispatched-ci-status.sh <branch>
# Preconditions: currently checked out on <branch> with the SHA to relay as
# HEAD; GH_TOKEN in env with `actions: write` and `statuses: write`;
# RELAY_REQUIRED_CONTEXTS set (comma-separated, e.g. "build,e2e").
set -euo pipefail

BRANCH="${1:?usage: relay-dispatched-ci-status.sh <branch>}"
SHA=$(git rev-parse HEAD)
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set (set automatically inside GitHub Actions)}"

# A valid context name is letters/digits/spaces/._/- only. Anything starting
# with `{` is unambiguously not a context name — it's the shape of a JSON
# error body, which is exactly what a permission-denied API response looks
# like once fed through this script's old (buggy) path.
CONTEXT_RE='^[A-Za-z0-9 ._/-]+$'

# NOTE: a literal apostrophe inside a ${VAR:?word} default-message breaks
# bash's parser even though the whole expression is double-quoted (word
# undergoes quote removal too, so a lone `'` here reads as an unterminated
# single-quoted string) -- keep this message apostrophe-free.
REQUIRED_RAW="${RELAY_REQUIRED_CONTEXTS:?RELAY_REQUIRED_CONTEXTS must be set (comma-separated required context names, e.g. build,e2e) -- see the header comment above}"
CONTEXTS=$(printf '%s' "$REQUIRED_RAW" | tr ',' '\n' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | sed '/^$/d')

if [ -z "$CONTEXTS" ]; then
  echo "::error::RELAY_REQUIRED_CONTEXTS ('$REQUIRED_RAW') did not contain any context names after parsing."
  exit 1
fi

while IFS= read -r CONTEXT; do
  if [[ "$CONTEXT" == \{* ]] || ! [[ "$CONTEXT" =~ $CONTEXT_RE ]]; then
    echo "::error::RELAY_REQUIRED_CONTEXTS contains an invalid context name: '$CONTEXT' (expected letters/digits/spaces/._/- only) -- refusing to use it."
    exit 1
  fi
done <<<"$CONTEXTS"

echo "Required contexts (from RELAY_REQUIRED_CONTEXTS): $(printf '%s' "$CONTEXTS" | tr '\n' ',' | sed 's/,$//')"

# Best-effort cross-check only — never authoritative. GITHUB_TOKEN inside
# Actions is expected not to be able to read branch protection; a clean
# response that disagrees with RELAY_REQUIRED_CONTEXTS is worth a warning,
# anything else (error body, empty, malformed) is logged and ignored.
PROTECTION_EXIT=0
PROTECTION_RAW=$(gh api "repos/$REPO/branches/main/protection" --jq '.required_status_checks.contexts[]?' 2>&1) || PROTECTION_EXIT=$?
echo "Branch protection cross-check: gh api exit=$PROTECTION_EXIT"

PROTECTION_CLEAN=true
if [ "$PROTECTION_EXIT" -ne 0 ] || [ -z "$PROTECTION_RAW" ]; then
  PROTECTION_CLEAN=false
else
  while IFS= read -r LINE; do
    if [[ "$LINE" == \{* ]] || ! [[ "$LINE" =~ $CONTEXT_RE ]]; then
      PROTECTION_CLEAN=false
      break
    fi
  done <<<"$PROTECTION_RAW"
fi

if [ "$PROTECTION_CLEAN" = true ]; then
  if [ "$(printf '%s' "$PROTECTION_RAW" | sort)" != "$(printf '%s' "$CONTEXTS" | sort)" ]; then
    echo "::warning::Branch protection's live required contexts ($(printf '%s' "$PROTECTION_RAW" | tr '\n' ',' | sed 's/,$//')) differ from RELAY_REQUIRED_CONTEXTS ($REQUIRED_RAW) -- update the workflow's env var to match."
  else
    echo "Branch protection cross-check agrees with RELAY_REQUIRED_CONTEXTS."
  fi
else
  echo "Branch protection cross-check was not a clean list of context names (expected — GITHUB_TOKEN inside Actions cannot read branch protection); raw response: $PROTECTION_RAW"
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
  echo "::error::No workflow_dispatch ci.yml run found for $BRANCH@$SHA within 150s -- required checks will stay unregistered for this PR."
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
for _ in $(seq 1 5); do
  JOBS_TSV=$(gh run view "$RUN_ID" --repo "$REPO" --json jobs --jq '.jobs[] | [.name, .conclusion] | @tsv')
  [ -n "$JOBS_TSV" ] && break
  sleep 5
done

if [ -z "$JOBS_TSV" ]; then
  echo "::error::gh run view $RUN_ID returned no jobs after the run completed — cannot relay build/e2e status for $BRANCH@$SHA. Required checks will stay unregistered; branch protection will block this PR until this is retried."
  exit 1
fi

JOB_NAMES_SEEN=$(printf '%s\n' "$JOBS_TSV" | cut -f1 | tr '\n' ',' | sed 's/,$//')

POSTED_COUNT=0
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
  POSTED_COUNT=$((POSTED_COUNT + 1))
  echo "Relayed $JOB_NAME=$STATE for $SHA (source run $RUN_ID)"
done <<<"$JOBS_TSV"

if [ "$POSTED_COUNT" -eq 0 ]; then
  echo "::error::Posted zero commit statuses for $BRANCH@$SHA. Required contexts: $(printf '%s' "$CONTEXTS" | tr '\n' ',' | sed 's/,$//'). Job names seen in run $RUN_ID: $JOB_NAMES_SEEN. Branch protection will block this PR until this is retried."
  exit 1
fi
