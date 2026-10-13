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

# is_transient_gh_error ERR: true for errors worth retrying (HTTP 5xx/429, network-level
# failures, or no error text at all); false for the rest (4xx such as 401/403/404: futile).
is_transient_gh_error() {
  [ -z "$1" ] && return 0
  printf '%s' "$1" | grep -Eiq 'HTTP (5[0-9]{2}|429)|"status": *"?(5[0-9]{2}|429)|timed? ?out|timeout|connection (reset|refused|closed)|unexpected EOF|no such host|temporary failure|TLS handshake|network is unreachable'
}

# fail_unreadable WF CONTEXTS ATTEMPTS ERR: job conclusions could not be read -- post `failure`
# for each context (best effort; the posts may be what is failing) so the PR shows red with the
# reason instead of pending forever, then exit 1. Never posts success.
fail_unreadable() {
  local WF="$1" CTXS="$2" N="$3" E MSG C PLURAL="s"
  [ "$N" = 1 ] && PLURAL=""
  E=$(printf '%s' "$4" | tr '\n\t' '  ')
  MSG="could not read job conclusions after $N attempt$PLURAL: $E"
  echo "::error::$WF for $BRANCH@$SHA: $MSG -- failing closed."
  while IFS= read -r C; do
    [ -z "$C" ] && continue
    gh api "repos/$REPO/statuses/$SHA" -f state=failure -f context="$C" \
      -f description="${MSG:0:140}" \
      -f target_url="https://github.com/$REPO/actions/runs/$RUN_ID" >/dev/null 2>&1 || true
  done <<<"$CTXS"
  exit 1
}

# collect_run WORKFLOW_FILE CONTEXTS_TO_FAIL: find the workflow_dispatch run of WORKFLOW_FILE for
# $BRANCH@$SHA, wait for it, and set RUN_ID / JOBS_TSV / JOB_NAMES_SEEN. Exits 1
# (fail closed) if the run or its jobs cannot be found. Used for ci.yml and for
# required contexts that come from a separate workflow (ask-live-guard.yml).
collect_run() {
  local WF="$1" FAIL_CONTEXTS="$2"
  # Retry loop: `gh run list` can transiently miss the dispatched run before
  # GitHub's API reflects it. Captured via `&&`/`||` rather than a bare
  # assignment so a `gh` failure doesn't trip `set -e` mid-loop (which would
  # abort on the first transient miss instead of retrying) while still being
  # loud about the last failure if every attempt is exhausted.
  RUN_ID=""
  LAST_RUN_LIST_ERR=""
  for _ in $(seq 1 30); do
    RUN_ID=$(gh run list --repo "$REPO" --workflow "$WF" --branch "$BRANCH" \
      --event workflow_dispatch --limit 5 --json databaseId,headSha \
      --jq "[.[] | select(.headSha == \"$SHA\")][0].databaseId // empty" 2>&1) && LAST_RUN_LIST_ERR="" || {
      LAST_RUN_LIST_ERR="$RUN_ID"
      RUN_ID=""
    }
    [ -n "$RUN_ID" ] && break
    sleep 5
  done

  if [ -z "$RUN_ID" ]; then
    echo "::error::No workflow_dispatch $WF run found for $BRANCH@$SHA within 150s -- required checks will stay unregistered for this PR.${LAST_RUN_LIST_ERR:+ Last gh error: $LAST_RUN_LIST_ERR}"
    exit 1
  fi

  # Read the run's final per-job conclusions, retrying TRANSIENT failures with bounded backoff
  # before failing closed. Why the loop wraps BOTH `gh run watch` and `gh run view`: `gh run
  # watch` itself dies on an HTTP 5xx and its failure is (deliberately) swallowed -- a failing
  # CI run is an expected outcome to relay, not a reason to abort -- so it can return while the
  # source run is still in progress. The jobs then read back with an EMPTY conclusion, which the
  # relay used to post as `failure`, falsely marking a healthy bot PR red (verifier, run
  # 38330790108). So a run that is not `completed` is "not read yet" (re-watch + retry), never a
  # conclusion. Non-transient errors (4xx: 401/403/404...) fail immediately -- retrying cannot
  # fix them. Success is never posted on any error path; exhausted retries post `failure`.
  #
  # History of this read (PR #124): it used to be `< <(gh run view ...)`, a process
  # substitution that `set -e` cannot see, so a transient miss produced zero lines and the
  # script exited 0 having posted nothing (run 35826364013). Capturing into a variable first
  # makes a miss recoverable and a persistent one loud (rule 98a: fail closed, not silent pass).
  local DELAYS=(2 5 10 20) MAX_ATTEMPTS=5 ATTEMPT=0 NEED_WATCH=true OUT="" RUN_STATUS="" ERR="" DELAY
  JOBS_TSV=""
  while :; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ "$NEED_WATCH" = true ]; then
      gh run watch "$RUN_ID" --repo "$REPO" --exit-status || true
    fi
    NEED_WATCH=false
    if OUT=$(gh run view "$RUN_ID" --repo "$REPO" --json status,jobs \
      --jq '.status, (.jobs[] | [.name, .conclusion] | @tsv)' 2>&1); then
      RUN_STATUS=$(printf '%s\n' "$OUT" | head -n 1)
      JOBS_TSV=$(printf '%s\n' "$OUT" | tail -n +2)
      if [ -z "$OUT" ]; then
        ERR="empty response from gh run view"
      elif [ "$RUN_STATUS" != "completed" ]; then
        ERR="run status is '$RUN_STATUS', not completed"
        NEED_WATCH=true
      elif [ -z "$JOBS_TSV" ]; then
        ERR="run completed but gh run view returned no jobs"
      else
        break
      fi
      JOBS_TSV=""
    else
      ERR="$OUT"
      JOBS_TSV=""
      if ! is_transient_gh_error "$ERR"; then
        fail_unreadable "$WF" "$FAIL_CONTEXTS" "$ATTEMPT" "$ERR"
      fi
    fi
    [ "$ATTEMPT" -lt "$MAX_ATTEMPTS" ] || fail_unreadable "$WF" "$FAIL_CONTEXTS" "$ATTEMPT" "$ERR"
    DELAY=${DELAYS[$((ATTEMPT - 1))]}
    sleep $((DELAY + RANDOM % (DELAY / 2 + 1))) # jitter: up to DELAY/2 extra seconds
  done

  JOB_NAMES_SEEN=$(printf '%s\n' "$JOBS_TSV" | cut -f1 | tr '\n' ',' | sed 's/,$//')
}

collect_run ci.yml "$CONTEXTS"

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

# `ask-live-guard` is a required context but its job lives in a SEPARATE
# workflow (ask-live-guard.yml), so it is never among ci.yml's job names above
# and used to make this script fail with "not found" on every bot PR (weekly
# metrics-refresh PR #316). The guard only has work to do when the PR changes a
# package /api/chat depends on, so: run the SAME detector the workflow runs
# (scripts/ask-guard/detect.mjs). Not applicable -> post success saying so.
# Applicable -> dispatch the real workflow and relay its job conclusion.
# Detector cannot decide / any step fails -> post failure (rule 98a, fail
# closed). Success is never posted without the detector or the guard running.
post_status() { # CONTEXT STATE DESCRIPTION TARGET_URL
  if ! POST_ERR=$(gh api "repos/$REPO/statuses/$SHA" -f state="$2" -f context="$1" \
    -f description="$3" -f target_url="$4" 2>&1); then
    echo "::error::Failed to post commit status for $1=$2 on $SHA: $POST_ERR"
    exit 1
  fi
  POSTED_COUNT=$((POSTED_COUNT + 1))
  MATCHED_CONTEXTS="$MATCHED_CONTEXTS
$1"
  echo "Relayed $1=$2 for $SHA ($3)"
}

relay_ask_live_guard() {
  local CTX="ask-live-guard" WF="ask-live-guard.yml" TMP BASE_BRANCH MB="" DET_OUT=""
  local CI_RUN_URL="https://github.com/$REPO/actions/runs/$RUN_ID"
  BASE_BRANCH=$(printf '%s' "$CONFIG_JSON" | jq -r '.branch // "main"')
  TMP=$(mktemp -d)
  if ! { { [ "$(git rev-parse --is-shallow-repository)" = true ] &&
    git fetch --no-tags --unshallow origin "$BASE_BRANCH" ||
    git fetch --no-tags origin "$BASE_BRANCH"; } &&
    MB=$(git merge-base "origin/$BASE_BRANCH" HEAD) &&
    git show "$MB:package.json" >"$TMP/bp.json" &&
    git show "$MB:package-lock.json" >"$TMP/bl.json" &&
    DET_OUT=$(node "$SCRIPT_DIR/ask-guard/detect.mjs" --base-pkg "$TMP/bp.json" --base-lock "$TMP/bl.json" \
      --head-pkg package.json --head-lock package-lock.json 2>/dev/null); } 2>/dev/null; then
    echo "::error::$CTX: detector could not decide for $BRANCH@$SHA; failing closed."
    ANY_FAILURE=true
    post_status "$CTX" failure "detector could not decide; failing closed" "$CI_RUN_URL"
    return 0
  fi
  # Exactly ONE decision line, from stdout only: a PR-controlled lockfile key containing a newline
  # could print a standalone `applicable=false` line before the real one, so 0 or >1 lines (or
  # conflicting ones) is "no decision", never a pass.
  local DECISION
  DECISION=$(printf '%s\n' "$DET_OUT" | grep -x -E 'applicable=(true|false)' || true)
  if [ "$(printf '%s\n' "$DECISION" | grep -c .)" != 1 ]; then
    DECISION=""
  fi
  if [ "$DECISION" = "applicable=false" ]; then
    post_status "$CTX" success "not applicable (no /ask-relevant package change)" "$CI_RUN_URL"
  elif [ "$DECISION" = "applicable=true" ]; then
    echo "$CTX applicable (guarded package changed); dispatching $WF"
    gh workflow run "$WF" --repo "$REPO" --ref "$BRANCH" -f base_sha="$MB"
    collect_run "$WF" "$CTX"
    local CONC
    CONC=$(printf '%s\n' "$JOBS_TSV" | awk -F'\t' -v j="$CTX" '$1 == j {print $2}')
    if [ "$CONC" = "success" ]; then
      post_status "$CTX" success "live /ask guard passed (run $RUN_ID)" "https://github.com/$REPO/actions/runs/$RUN_ID"
    else
      ANY_FAILURE=true
      post_status "$CTX" failure "live /ask guard ${CONC:-reported no job} (run $RUN_ID)" "https://github.com/$REPO/actions/runs/$RUN_ID"
    fi
  else
    echo "::error::$CTX: detector gave no (or an ambiguous) applicability decision; failing closed."
    ANY_FAILURE=true
    post_status "$CTX" failure "detector gave no decision; failing closed" "$CI_RUN_URL"
  fi
}

if printf '%s\n' "$CONTEXTS" | grep -qx 'ask-live-guard' &&
  ! printf '%s\n' "$MATCHED_CONTEXTS" | grep -qx 'ask-live-guard'; then
  relay_ask_live_guard
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
