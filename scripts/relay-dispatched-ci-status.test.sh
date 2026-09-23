#!/usr/bin/env bash
# Regression test for scripts/relay-dispatched-ci-status.sh, run against a
# fake `gh` (relay-dispatched-ci-status.test.stub-gh.sh) and a no-op `sleep`
# placed first on PATH. The relay script is copied into a throwaway
# repo-shaped tree (scripts/ and .github/ as siblings, exactly like the real
# repo) so each case can control .github/required-checks.json without ever
# touching the real one.
#
# Run directly (`bash scripts/relay-dispatched-ci-status.test.sh`; needs
# `jq` on PATH, same as the script under test) or via CI (ci.yml's build
# job).
#
# Expected outcomes, stated before this was run the first time:
#   1. missing config: no .github/required-checks.json in the tree -- exit
#      1, "::error::" naming the missing path, zero gh calls made.
#   2. malformed config: the file exists but is not valid JSON -- exit 1,
#      "::error::" saying it did not parse.
#   3. gh run list API error: every `gh run list` call fails (simulating a
#      transient or persistent GitHub API problem) -- exit 1 after
#      exhausting retries, "::error::" saying no dispatched run was found.
#   4. statuses POST error: the run is found and its jobs succeed, but `gh
#      api .../statuses/...` fails -- exit 1, "::error::" naming the failed
#      post, and it must fail on the FIRST attempted post (not silently
#      continue to the second).
#   5. all success: both required jobs conclude "success" -- exit 0, exactly
#      two lines appended to the posts log (context=build, context=e2e).
#   6. one job failure: "build" succeeds, "e2e" fails -- BOTH statuses still
#      get posted (rule 98a: a real failure must still be visible, not
#      swallowed), then the script exits 1.
#   7. required context missing from jobs: the dispatched run only ran a
#      "build" job, no "e2e" -- "build" gets posted, but the script still
#      exits 1 naming "e2e" as never posted, since a partially-covered
#      required-check set is not a pass.
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
# The real retry loops sleep 5s per attempt (up to 30 attempts for the run-
# list loop) -- a no-op stub keeps every case fast regardless of how many
# retries a case is meant to exhaust.
printf '#!/usr/bin/env bash\nexit 0\n' >"$STUB_BIN_DIR/sleep"
chmod +x "$STUB_BIN_DIR/sleep"

# Repo-shaped tree: scripts/ and .github/ as siblings, same as the real
# repo, so the relay script's own SCRIPT_DIR/../.github/required-checks.json
# resolution finds THIS tree's config, never the real one.
REPO_DIR="$WORKDIR/repo"
mkdir -p "$REPO_DIR/scripts" "$REPO_DIR/.github"
cp "$RELAY_SCRIPT_SRC" "$REPO_DIR/scripts/relay-dispatched-ci-status.sh"
git init -q "$REPO_DIR"
git -C "$REPO_DIR" config user.email "test@example.com"
git -C "$REPO_DIR" config user.name "test"
git -C "$REPO_DIR" commit -q --allow-empty -m "init"

FAILURES=0

write_config() {
  # write_config CONTENT — writes $REPO_DIR/.github/required-checks.json
  printf '%s' "$1" >"$REPO_DIR/.github/required-checks.json"
}

VALID_CONFIG='{"branch":"main","contexts":["build","e2e"]}'

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
    bash scripts/relay-dispatched-ci-status.sh "test-branch" 2>&1)
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

echo "=== Case 1: missing config ==="
rm -f "$REPO_DIR/.github/required-checks.json"
run_case "missing-config" 1 GITHUB_REPOSITORY="test-owner/test-repo"
assert_contains "missing-config" "$RUN_CASE_OUTPUT" "::error::Required-checks config not found"
assert_posts_count "missing-config" "$POSTS_LOG_FOR_CASE" 0

echo "=== Case 2: malformed config ==="
write_config 'not valid json {'
run_case "malformed-config" 1 GITHUB_REPOSITORY="test-owner/test-repo"
assert_contains "malformed-config" "$RUN_CASE_OUTPUT" "did not parse as JSON"
assert_posts_count "malformed-config" "$POSTS_LOG_FOR_CASE" 0

echo "=== Case 3: gh run list API error must fail closed, not hang forever silently ==="
write_config "$VALID_CONFIG"
run_case "run-list-error" 1 \
  GITHUB_REPOSITORY="test-owner/test-repo" \
  STUB_RUN_LIST_EXIT="1" \
  STUB_RUN_LIST_OUTPUT='{"message":"Resource not accessible by integration","status":"403"}'
assert_contains "run-list-error" "$RUN_CASE_OUTPUT" "::error::No workflow_dispatch ci.yml run found"
assert_contains "run-list-error" "$RUN_CASE_OUTPUT" "Resource not accessible by integration"
assert_posts_count "run-list-error" "$POSTS_LOG_FOR_CASE" 0

echo "=== Case 4: statuses POST error must fail closed ==="
write_config "$VALID_CONFIG"
run_case "post-error" 1 \
  GITHUB_REPOSITORY="test-owner/test-repo" \
  STUB_RUN_ID="42" \
  STUB_WATCH_EXIT="0" \
  STUB_JOBS_TSV=$'build\tsuccess\ne2e\tsuccess' \
  STUB_STATUSES_EXIT="1"
assert_contains "post-error" "$RUN_CASE_OUTPUT" "::error::Failed to post commit status"
assert_posts_count "post-error" "$POSTS_LOG_FOR_CASE" 0

echo "=== Case 5: all success ==="
write_config "$VALID_CONFIG"
run_case "all-success" 0 \
  GITHUB_REPOSITORY="test-owner/test-repo" \
  STUB_RUN_ID="42" \
  STUB_WATCH_EXIT="0" \
  STUB_JOBS_TSV=$'build\tsuccess\ne2e\tsuccess'
assert_contains "all-success" "$RUN_CASE_OUTPUT" "Relayed build=success"
assert_contains "all-success" "$RUN_CASE_OUTPUT" "Relayed e2e=success"
assert_contains "all-success" "$RUN_CASE_OUTPUT" "All required contexts relayed successfully"
assert_posts_count "all-success" "$POSTS_LOG_FOR_CASE" 2

echo "=== Case 6: one job failure — must still post, then exit non-zero ==="
write_config "$VALID_CONFIG"
run_case "one-failure" 1 \
  GITHUB_REPOSITORY="test-owner/test-repo" \
  STUB_RUN_ID="42" \
  STUB_WATCH_EXIT="1" \
  STUB_JOBS_TSV=$'build\tsuccess\ne2e\tfailure'
assert_contains "one-failure" "$RUN_CASE_OUTPUT" "Relayed build=success"
assert_contains "one-failure" "$RUN_CASE_OUTPUT" "Relayed e2e=failure"
assert_contains "one-failure" "$RUN_CASE_OUTPUT" "::error::At least one relayed status was 'failure'"
assert_posts_count "one-failure" "$POSTS_LOG_FOR_CASE" 2

echo "=== Case 7: required context missing from the run's jobs ==="
write_config "$VALID_CONFIG"
run_case "missing-context" 1 \
  GITHUB_REPOSITORY="test-owner/test-repo" \
  STUB_RUN_ID="42" \
  STUB_WATCH_EXIT="0" \
  STUB_JOBS_TSV=$'build\tsuccess'
assert_contains "missing-context" "$RUN_CASE_OUTPUT" "Relayed build=success"
assert_contains "missing-context" "$RUN_CASE_OUTPUT" "::error::Required context(s) not found among run 42's job names"
assert_contains "missing-context" "$RUN_CASE_OUTPUT" "e2e"
assert_posts_count "missing-context" "$POSTS_LOG_FOR_CASE" 1

if [ "$FAILURES" -ne 0 ]; then
  echo "$FAILURES assertion(s) failed."
  exit 1
fi
echo "All relay-dispatched-ci-status.sh regression cases passed."
