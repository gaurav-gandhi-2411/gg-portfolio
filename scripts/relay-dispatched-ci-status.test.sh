#!/usr/bin/env bash
# Regression test for scripts/relay-dispatched-ci-status.sh -- table-driven:
# each case below is one run_case call against a stubbed `gh`
# (relay-dispatched-ci-status.test.stub-gh.sh) and a no-op `sleep` (keeps
# the real 150s/25s retry loops instant), sharing one fixture tree so no
# case pays for its own setup. Run directly (`bash scripts/relay-
# dispatched-ci-status.test.sh`; needs `jq` on PATH, same as the script
# under test) or via CI (ci.yml's build job).
#
# Cases, stated before this was run the first time: config missing; config
# malformed; gh-run-list API error (must exhaust retries and fail closed,
# not hang or pass); statuses-POST error (must fail on the first bad post,
# not continue); all jobs succeed (posts both, exits 0); one job fails
# (both still get posted -- rule 98a -- then exit 1); a required context is
# absent from the run's jobs (posts the one that matched, exits 1 naming
# the one that did not).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELAY_SCRIPT_SRC="$SCRIPT_DIR/relay-dispatched-ci-status.sh"
STUB_GH_SRC="$SCRIPT_DIR/relay-dispatched-ci-status.test.stub-gh.sh"

if ! command -v jq >/dev/null 2>&1; then
  echo "SKIP: jq not found on PATH -- this test needs the same jq the script under test needs. Run in an environment with jq (e.g. CI's ubuntu-latest runners, which ship it)."
  exit 0
fi

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

STUB_BIN_DIR="$WORKDIR/bin"
mkdir -p "$STUB_BIN_DIR"
cp "$STUB_GH_SRC" "$STUB_BIN_DIR/gh"
chmod +x "$STUB_BIN_DIR/gh"
printf '#!/usr/bin/env bash\nexit 0\n' >"$STUB_BIN_DIR/sleep"
chmod +x "$STUB_BIN_DIR/sleep"

# Repo-shaped tree (scripts/ and .github/ as siblings, like the real repo)
# so the relay script's own SCRIPT_DIR/../.github/required-checks.json
# resolution finds THIS tree's config, shared and rewritten per case below.
# REPO_DIR is a clone of a local ORIGIN_DIR holding main's package.json +
# package-lock.json, so the ask-live-guard path's `git fetch origin main` /
# merge-base work for real; cases overwrite the working-tree (head) copies.
ORIGIN_DIR="$WORKDIR/origin"
REPO_DIR="$WORKDIR/repo"
git init -q -b main "$ORIGIN_DIR"
git -C "$ORIGIN_DIR" config user.email "test@example.com"
git -C "$ORIGIN_DIR" config user.name "test"
BASE_PKG='{"name":"t","dependencies":{"next":"1.0.0","left-pad":"1.0.0"}}'
BASE_LOCK='{"lockfileVersion":3,"packages":{"":{},"node_modules/next":{"version":"1.0.0","integrity":"sha-a"},"node_modules/left-pad":{"version":"1.0.0","integrity":"sha-b"}}}'
GUARDED_LOCK='{"lockfileVersion":3,"packages":{"":{},"node_modules/next":{"version":"1.0.1","integrity":"sha-c"},"node_modules/left-pad":{"version":"1.0.0","integrity":"sha-b"}}}'
printf '%s' "$BASE_PKG" >"$ORIGIN_DIR/package.json"
printf '%s' "$BASE_LOCK" >"$ORIGIN_DIR/package-lock.json"
git -C "$ORIGIN_DIR" add package.json package-lock.json
git -C "$ORIGIN_DIR" commit -q -m "init"
git clone -q "$ORIGIN_DIR" "$REPO_DIR"
git -C "$REPO_DIR" config user.email "test@example.com"
git -C "$REPO_DIR" config user.name "test"
mkdir -p "$REPO_DIR/scripts/ask-guard" "$REPO_DIR/.github"
cp "$RELAY_SCRIPT_SRC" "$REPO_DIR/scripts/relay-dispatched-ci-status.sh"
cp "$SCRIPT_DIR/ask-guard/detect.mjs" "$SCRIPT_DIR/ask-guard/guarded-packages.json" "$REPO_DIR/scripts/ask-guard/"

# set_head PKG_JSON LOCK_JSON: the PR head's package files (working tree).
set_head() {
  printf '%s' "$1" >"$REPO_DIR/package.json"
  printf '%s' "$2" >"$REPO_DIR/package-lock.json"
}

VALID='{"branch":"main","contexts":["build","e2e"]}'
VALID3='{"branch":"main","contexts":["build","e2e","ask-live-guard"]}'
FAILURES=0
LAST_POSTS_COUNT=0

# run_case NAME EXPECTED_EXIT CONFIG_OR_rm NEEDLE... -- VAR=val...
# CONFIG_OR_rm is either the JSON written to .github/required-checks.json,
# or the literal string "rm" to delete any existing config first (simulates
# a missing file). Everything before the lone "--" is a required output
# substring; everything after it is forwarded to `env` as VAR=val pairs.
run_case() {
  local name="$1" expected="$2" config="$3"
  shift 3
  local needles=() envs=() seen_sep=false a
  for a in "$@"; do
    if [ "$seen_sep" = false ] && [ "$a" = "--" ]; then
      seen_sep=true
      continue
    fi
    if [ "$seen_sep" = false ]; then needles+=("$a"); else envs+=("$a"); fi
  done

  if [ "$config" = "rm" ]; then
    rm -f "$REPO_DIR/.github/required-checks.json"
  else
    printf '%s' "$config" >"$REPO_DIR/.github/required-checks.json"
  fi

  local posts_log="$WORKDIR/posts-$name.log" output actual_exit
  : >"$posts_log"

  set +e
  output=$(cd "$REPO_DIR" && env -i PATH="$STUB_BIN_DIR:$PATH" HOME="$HOME" \
    STUB_POSTS_LOG="$posts_log" "${envs[@]}" \
    bash scripts/relay-dispatched-ci-status.sh "test-branch" 2>&1)
  actual_exit=$?
  set -e

  echo "--- case: $name (exit $actual_exit, expected $expected) ---"
  echo "$output"

  if [ "$actual_exit" -ne "$expected" ]; then
    echo "FAIL [$name]: exit $actual_exit != expected $expected"
    FAILURES=$((FAILURES + 1))
  fi
  for a in "${needles[@]}"; do
    if [[ "$output" != *"$a"* ]]; then
      echo "FAIL [$name]: expected output to contain: $a"
      FAILURES=$((FAILURES + 1))
    fi
  done
  LAST_POSTS_COUNT=$(wc -l <"$posts_log" | tr -d ' ')
}

assert_posts() {
  if [ "$LAST_POSTS_COUNT" != "$2" ]; then
    echo "FAIL [$1]: posted $LAST_POSTS_COUNT statuses, expected $2"
    FAILURES=$((FAILURES + 1))
  fi
}

run_case "missing-config" 1 rm \
  "::error::Required-checks config not found" -- \
  GITHUB_REPOSITORY="test-owner/test-repo"
assert_posts "missing-config" 0

run_case "malformed-config" 1 'not valid json {' \
  "did not parse as JSON" -- \
  GITHUB_REPOSITORY="test-owner/test-repo"
assert_posts "malformed-config" 0

run_case "run-list-error" 1 "$VALID" \
  "::error::No workflow_dispatch ci.yml run found" "Resource not accessible by integration" -- \
  GITHUB_REPOSITORY="test-owner/test-repo" STUB_RUN_LIST_EXIT="1" \
  STUB_RUN_LIST_OUTPUT='{"message":"Resource not accessible by integration","status":"403"}'
assert_posts "run-list-error" 0

run_case "post-error" 1 "$VALID" \
  "::error::Failed to post commit status" -- \
  GITHUB_REPOSITORY="test-owner/test-repo" STUB_RUN_ID="42" STUB_WATCH_EXIT="0" \
  STUB_JOBS_TSV=$'build\tsuccess\ne2e\tsuccess' STUB_STATUSES_EXIT="1"
assert_posts "post-error" 0

run_case "all-success" 0 "$VALID" \
  "Relayed build=success" "Relayed e2e=success" "All required contexts relayed successfully" -- \
  GITHUB_REPOSITORY="test-owner/test-repo" STUB_RUN_ID="42" STUB_WATCH_EXIT="0" \
  STUB_JOBS_TSV=$'build\tsuccess\ne2e\tsuccess'
assert_posts "all-success" 2

run_case "one-failure" 1 "$VALID" \
  "Relayed build=success" "Relayed e2e=failure" "::error::At least one relayed status was 'failure'" -- \
  GITHUB_REPOSITORY="test-owner/test-repo" STUB_RUN_ID="42" STUB_WATCH_EXIT="1" \
  STUB_JOBS_TSV=$'build\tsuccess\ne2e\tfailure'
assert_posts "one-failure" 2

run_case "missing-context" 1 "$VALID" \
  "Relayed build=success" "::error::Required context(s) not found among run 42's job names" "e2e" -- \
  GITHUB_REPOSITORY="test-owner/test-repo" STUB_RUN_ID="42" STUB_WATCH_EXIT="0" \
  STUB_JOBS_TSV=$'build\tsuccess'
assert_posts "missing-context" 1

# --- transient API errors while reading job conclusions (the false-red bug) ---
# count_calls NAME KIND: how many times the stub saw `gh run view`/`gh run watch` in a case.
count_calls() {
  if [ -f "$WORKDIR/posts-$1.log.$2" ]; then wc -l <"$WORKDIR/posts-$1.log.$2" | tr -d ' '; else echo 0; fi
}
assert_calls() { # NAME KIND EXPECTED
  local got
  got=$(count_calls "$1" "$2")
  if [ "$got" != "$3" ]; then
    echo "FAIL [$1]: gh run $2 called $got times, expected $3"
    FAILURES=$((FAILURES + 1))
  fi
}
assert_no_success_post() { # NAME
  if grep -q "state=success" "$WORKDIR/posts-$1.log"; then
    echo "FAIL [$1]: posted a success status on an error path"
    FAILURES=$((FAILURES + 1))
  fi
}
RELAY_ENV=(GITHUB_REPOSITORY="test-owner/test-repo" STUB_RUN_ID="42")
OKJOBS=$'build	success
e2e	success'

# HTTP 502 on the first read, success on the second: retried, relayed as success.
run_case "view-502-then-success" 0 "$VALID"   "Relayed build=success" "Relayed e2e=success" "All required contexts relayed successfully" --   "${RELAY_ENV[@]}" STUB_WATCH_EXIT="0" STUB_JOBS_TSV="$OKJOBS" STUB_VIEW_SEQ="502,completed"
assert_posts "view-502-then-success" 2
assert_calls "view-502-then-success" view 2

# Empty output (API returned nothing) is transient too.
run_case "view-empty-then-success" 0 "$VALID"   "Relayed e2e=success" --   "${RELAY_ENV[@]}" STUB_WATCH_EXIT="0" STUB_JOBS_TSV="$OKJOBS" STUB_VIEW_SEQ="empty,completed"
assert_posts "view-empty-then-success" 2
assert_calls "view-empty-then-success" view 2

# The real false-red mechanism: `gh run watch` dies on a 5xx (exit != 0, swallowed) while the source
# run is still in progress, so every job conclusion reads empty. Must re-watch and wait, never relay.
run_case "watch-returns-early-in-progress" 0 "$VALID"   "Relayed build=success" "Relayed e2e=success" --   "${RELAY_ENV[@]}" STUB_WATCH_EXIT="1" STUB_JOBS_TSV="$OKJOBS" STUB_VIEW_SEQ="in_progress,completed"
assert_posts "watch-returns-early-in-progress" 2
assert_calls "watch-returns-early-in-progress" view 2
assert_calls "watch-returns-early-in-progress" watch 2
if grep -q "state=failure" "$WORKDIR/posts-watch-returns-early-in-progress.log"; then
  echo "FAIL [watch-returns-early-in-progress]: posted a failure for a still-running source run"
  FAILURES=$((FAILURES + 1))
fi

# 5xx on every attempt: fail closed after 5 attempts (initial + 4 retries), failure posted, never success.
run_case "view-502-exhausted" 1 "$VALID"   "could not read job conclusions after 5 attempts" "HTTP 502" --   "${RELAY_ENV[@]}" STUB_WATCH_EXIT="0" STUB_JOBS_TSV="$OKJOBS" STUB_VIEW_SEQ="502"
assert_posts "view-502-exhausted" 2
assert_calls "view-502-exhausted" view 5
assert_no_success_post "view-502-exhausted"

# Run never leaves in_progress: same fail-closed outcome, never a success.
run_case "run-never-completes" 1 "$VALID"   "could not read job conclusions after 5 attempts" "in_progress" --   "${RELAY_ENV[@]}" STUB_WATCH_EXIT="1" STUB_JOBS_TSV="$OKJOBS" STUB_VIEW_SEQ="in_progress"
assert_posts "run-never-completes" 2
assert_no_success_post "run-never-completes"

# A genuine failure conclusion on a completed run: relayed as failure at once, no retries.
run_case "real-failure-no-retry" 1 "$VALID"   "Relayed build=success" "Relayed e2e=failure" --   "${RELAY_ENV[@]}" STUB_WATCH_EXIT="1" STUB_JOBS_TSV=$'build	success
e2e	failure'
assert_posts "real-failure-no-retry" 2
assert_calls "real-failure-no-retry" view 1
assert_calls "real-failure-no-retry" watch 1

# Non-transient errors (4xx) fail immediately: one attempt, no backoff, failure posted.
for CODE in 404 401; do
  run_case "view-$CODE-no-retry" 1 "$VALID"     "could not read job conclusions after 1 attempt" "HTTP $CODE" --     "${RELAY_ENV[@]}" STUB_WATCH_EXIT="0" STUB_JOBS_TSV="$OKJOBS" STUB_VIEW_SEQ="$CODE"
  assert_posts "view-$CODE-no-retry" 2
  assert_calls "view-$CODE-no-retry" view 1
  assert_no_success_post "view-$CODE-no-retry"
done

# HTTP 403 "rate limit" is transient (retried); a plain 403 (permissions) fails at once.
run_case "view-ratelimit-then-success" 0 "$VALID" "Relayed e2e=success" -- \
  "${RELAY_ENV[@]}" STUB_WATCH_EXIT="0" STUB_JOBS_TSV="$OKJOBS" STUB_VIEW_SEQ="ratelimit,completed"
assert_posts "view-ratelimit-then-success" 2
assert_calls "view-ratelimit-then-success" view 2
run_case "view-403-no-retry" 1 "$VALID" "could not read job conclusions after 1 attempt" "HTTP 403" -- \
  "${RELAY_ENV[@]}" STUB_WATCH_EXIT="0" STUB_JOBS_TSV="$OKJOBS" STUB_VIEW_SEQ="403"
assert_calls "view-403-no-retry" view 1
assert_no_success_post "view-403-no-retry"

# Non-success conclusions on a completed run are failures, exactly as before this change.
for CONC in cancelled skipped timed_out; do
  run_case "conclusion-$CONC" 1 "$VALID" "Relayed build=success" "Relayed e2e=failure" -- \
    "${RELAY_ENV[@]}" STUB_WATCH_EXIT="0" STUB_JOBS_TSV=$'build\tsuccess\ne2e\t'"$CONC"
  assert_calls "conclusion-$CONC" view 1
done

# --- required context from a separate workflow (ask-live-guard) ---
if command -v node >/dev/null 2>&1; then
  CI_JOBS=$'build\tsuccess\ne2e\tsuccess'

  # Before the fix this was the live regression: exit 1, "not found among run's job names".
  set_head "$BASE_PKG" "$BASE_LOCK"
  run_case "guard-not-applicable" 0 "$VALID3" \
    "Relayed ask-live-guard=success" "not applicable (no /ask-relevant package change)" \
    "All required contexts relayed successfully" -- \
    GITHUB_REPOSITORY="test-owner/test-repo" STUB_RUN_ID="42" STUB_WATCH_EXIT="0" \
    STUB_JOBS_TSV="$CI_JOBS" STUB_DISPATCH_LOG="$WORKDIR/dispatch-na.log"
  assert_posts "guard-not-applicable" 3
  if grep -q "ask-live-guard.yml" "$WORKDIR/dispatch-na.log" 2>/dev/null; then
    echo "FAIL [guard-not-applicable]: dispatched the guard workflow although not applicable"
    FAILURES=$((FAILURES + 1))
  fi

  # A bump of a guarded package (next) must run the real guard, not be waved through.
  set_head "$BASE_PKG" "$GUARDED_LOCK"
  run_case "guard-applicable-pass" 0 "$VALID3" \
    "applicable (guarded package changed); dispatching ask-live-guard.yml" \
    "Relayed ask-live-guard=success" "live /ask guard passed" -- \
    GITHUB_REPOSITORY="test-owner/test-repo" STUB_RUN_ID="42" STUB_WATCH_EXIT="0" \
    STUB_JOBS_TSV="$CI_JOBS" STUB_GUARD_JOBS_TSV=$'ask-live-guard\tsuccess' \
    STUB_DISPATCH_LOG="$WORKDIR/dispatch-pass.log"
  assert_posts "guard-applicable-pass" 3
  if ! grep -q "workflow run ask-live-guard.yml" "$WORKDIR/dispatch-pass.log"; then
    echo "FAIL [guard-applicable-pass]: guard workflow was never dispatched"
    FAILURES=$((FAILURES + 1))
  fi

  run_case "guard-applicable-fail" 1 "$VALID3" \
    "Relayed ask-live-guard=failure" "live /ask guard failure" -- \
    GITHUB_REPOSITORY="test-owner/test-repo" STUB_RUN_ID="42" STUB_WATCH_EXIT="0" \
    STUB_JOBS_TSV="$CI_JOBS" STUB_GUARD_JOBS_TSV=$'ask-live-guard\tfailure' \
    STUB_DISPATCH_LOG="$WORKDIR/dispatch-fail.log"
  assert_posts "guard-applicable-fail" 3

  # Detector cannot decide (head lockfile unparseable): must post failure, never success.
  set_head "$BASE_PKG" 'not json'
  run_case "guard-detector-error" 1 "$VALID3" \
    "detector could not decide" "Relayed ask-live-guard=failure" -- \
    GITHUB_REPOSITORY="test-owner/test-repo" STUB_RUN_ID="42" STUB_WATCH_EXIT="0" \
    STUB_JOBS_TSV="$CI_JOBS" STUB_DISPATCH_LOG="$WORKDIR/dispatch-err.log"
  assert_posts "guard-detector-error" 3

  # Ambiguous / missing detector decisions must fail closed (never post success): swap in a stub
  # detector that exits 0 and prints exactly STUB_DETECT_OUT (stdout) / STUB_DETECT_ERR (stderr).
  printf '%s\n' 'process.stdout.write(process.env.STUB_DETECT_OUT ?? "");' \
    'process.stderr.write(process.env.STUB_DETECT_ERR ?? "");' >"$REPO_DIR/scripts/ask-guard/detect.mjs"
  set_head "$BASE_PKG" "$BASE_LOCK"
  stub_case() { # NAME STDOUT STDERR
    run_case "$1" 1 "$VALID3" \
      "Relayed ask-live-guard=failure" -- \
      GITHUB_REPOSITORY="test-owner/test-repo" STUB_RUN_ID="42" STUB_WATCH_EXIT="0" \
      STUB_JOBS_TSV="$CI_JOBS" STUB_DISPATCH_LOG="$WORKDIR/dispatch-$1.log" \
      STUB_DETECT_OUT="$2" STUB_DETECT_ERR="$3"
    assert_posts "$1" 3
  }
  stub_case "guard-no-decision" "" ""
  stub_case "guard-both-decisions" $'applicable=false\napplicable=true\n' ""
  stub_case "guard-false-twice" $'applicable=false\napplicable=false\n' ""
  stub_case "guard-stderr-only-decision" "" $'applicable=false\n'
  cp "$SCRIPT_DIR/ask-guard/detect.mjs" "$REPO_DIR/scripts/ask-guard/detect.mjs"
else
  echo "SKIP: node not found -- skipping the ask-live-guard relay cases."
fi

if [ "$FAILURES" -ne 0 ]; then
  echo "$FAILURES assertion(s) failed."
  exit 1
fi
echo "All relay-dispatched-ci-status.sh regression cases passed."
