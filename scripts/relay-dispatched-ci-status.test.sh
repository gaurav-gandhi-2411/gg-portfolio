#!/usr/bin/env bash
# Regression test for scripts/relay-dispatched-ci-status.sh, run against a
# fake `gh` (relay-dispatched-ci-status.test.stub-gh.sh) placed first on
# PATH. Exists specifically to prove the 2026-09-23 bug (run 35839553875,
# bot PR #216) stays fixed: a `gh api .../branches/main/protection` call
# that fails inside Actions (GITHUB_TOKEN can't read branch protection) used
# to leak its JSON error body into the "required contexts" variable and the
# script would exit 0 having posted nothing, silently. Run directly
# (`bash scripts/relay-dispatched-ci-status.test.sh`) or via CI (ci.yml's
# build job).
#
# Expected outcomes, stated before this was run the first time:
#   1. normal case: a 403-shaped JSON error body from the protection
#      cross-check must NOT poison the required-contexts list (configured
#      via RELAY_REQUIRED_CONTEXTS instead) -- script exits 0 and posts
#      exactly two statuses, context=build and context=e2e.
#   2. zero-match case: the dispatched run's job names don't match any
#      required context -- script exits 1, logs "::error::" mentioning zero
#      posted statuses, and posts nothing.
#   3. invalid-context case: RELAY_REQUIRED_CONTEXTS contains a value that
#      looks like a JSON error body (starts with `{`) -- script exits 1
#      before ever calling `gh run list`, logging "::error::" naming the bad
#      context.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELAY_SCRIPT="$SCRIPT_DIR/relay-dispatched-ci-status.sh"
STUB_GH_SRC="$SCRIPT_DIR/relay-dispatched-ci-status.test.stub-gh.sh"

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

STUB_BIN_DIR="$WORKDIR/bin"
mkdir -p "$STUB_BIN_DIR"
cp "$STUB_GH_SRC" "$STUB_BIN_DIR/gh"
chmod +x "$STUB_BIN_DIR/gh"

# The relay script does `git rev-parse HEAD` -- give it a real, throwaway repo.
REPO_DIR="$WORKDIR/repo"
git init -q "$REPO_DIR"
git -C "$REPO_DIR" config user.email "test@example.com"
git -C "$REPO_DIR" config user.name "test"
git -C "$REPO_DIR" commit -q --allow-empty -m "init"

FAILURES=0

# run_case NAME EXPECTED_EXIT VAR=val...
run_case() {
  local name="$1" expected_exit="$2"
  shift 2
  local posts_log="$WORKDIR/posts-$name.log"
  : >"$posts_log"

  set +e
  OUTPUT=$(cd "$REPO_DIR" && env -i \
    PATH="$STUB_BIN_DIR:$PATH" \
    HOME="$HOME" \
    STUB_POSTS_LOG="$posts_log" \
    "$@" \
    bash "$RELAY_SCRIPT" "test-branch" 2>&1)
  ACTUAL_EXIT=$?
  set -e

  echo "--- case: $name (exit $ACTUAL_EXIT, expected $expected_exit) ---"
  echo "$OUTPUT"
  echo "--- end case: $name ---"

  if [ "$ACTUAL_EXIT" -ne "$expected_exit" ]; then
    echo "FAIL [$name]: exit code $ACTUAL_EXIT != expected $expected_exit"
    FAILURES=$((FAILURES + 1))
    return
  fi

  POSTS_LOG_FOR_CASE="$posts_log"
  RUN_CASE_OUTPUT="$OUTPUT"
}

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "FAIL [$label]: expected output to contain: $needle"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_posts_count() {
  local label="$1" file="$2" expected="$3"
  local actual
  actual=$(wc -l <"$file" | tr -d ' ')
  if [ "$actual" != "$expected" ]; then
    echo "FAIL [$label]: posted $actual statuses, expected $expected"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "=== Case 1: error-JSON protection read must not poison contexts ==="
run_case "normal" 0 \
  GITHUB_REPOSITORY="test-owner/test-repo" \
  RELAY_REQUIRED_CONTEXTS="build,e2e" \
  STUB_PROTECTION_OUTPUT='{"message":"Resource not accessible by integration","status":"403"}' \
  STUB_PROTECTION_EXIT="1" \
  STUB_RUN_ID="42" \
  STUB_WATCH_EXIT="0" \
  STUB_JOBS_TSV=$'build\tsuccess\ne2e\tsuccess'
assert_contains "normal" "$RUN_CASE_OUTPUT" "Relayed build=success"
assert_contains "normal" "$RUN_CASE_OUTPUT" "Relayed e2e=success"
assert_contains "normal" "$RUN_CASE_OUTPUT" "cannot read branch protection"
assert_posts_count "normal" "$POSTS_LOG_FOR_CASE" 2

echo "=== Case 2: zero-match must fail closed (rule 98a), not exit 0 ==="
run_case "zero-match" 1 \
  GITHUB_REPOSITORY="test-owner/test-repo" \
  RELAY_REQUIRED_CONTEXTS="build,e2e" \
  STUB_PROTECTION_OUTPUT='{"message":"Resource not accessible by integration","status":"403"}' \
  STUB_PROTECTION_EXIT="1" \
  STUB_RUN_ID="42" \
  STUB_WATCH_EXIT="0" \
  STUB_JOBS_TSV=$'lint\tsuccess'
assert_contains "zero-match" "$RUN_CASE_OUTPUT" "::error::"
assert_contains "zero-match" "$RUN_CASE_OUTPUT" "Posted zero commit statuses"
assert_posts_count "zero-match" "$POSTS_LOG_FOR_CASE" 0

echo "=== Case 3: a JSON-error-shaped RELAY_REQUIRED_CONTEXTS value is rejected ==="
run_case "invalid-context" 1 \
  GITHUB_REPOSITORY="test-owner/test-repo" \
  RELAY_REQUIRED_CONTEXTS='{"message":"bad"},e2e'
assert_contains "invalid-context" "$RUN_CASE_OUTPUT" "::error::RELAY_REQUIRED_CONTEXTS contains an invalid context name"

if [ "$FAILURES" -ne 0 ]; then
  echo "$FAILURES assertion(s) failed."
  exit 1
fi
echo "All relay-dispatched-ci-status.sh regression cases passed."
