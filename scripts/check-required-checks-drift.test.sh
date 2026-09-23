#!/usr/bin/env bash
# Regression test for scripts/check-required-checks-drift.sh, run against a
# fake `gh` (check-required-checks-drift.test.stub-gh.sh). Like the relay
# script's own test, the drift script is copied into a repo-shaped tree
# (scripts/ and .github/ as siblings) so each case can control
# .github/required-checks.json without touching the real one.
#
# Run directly (`bash scripts/check-required-checks-drift.test.sh`; needs
# `jq` on PATH, same as the script under test) or via CI (ci.yml's build
# job).
#
# Expected outcomes, stated before this was run the first time:
#   1. API error: `gh api repos/.../branches/main` fails -- exit 1,
#      "::error::" saying drift is unverified (never treated as "no drift").
#   2. .protection missing/null: the branch response parses but has no
#      .protection object (e.g. an unprotected branch) -- exit 1,
#      "::error::" saying drift is unverified.
#   3. mismatch: config and live contexts both parse cleanly but differ --
#      exit 1, "::error::" naming both sides.
#   4. match: config and live contexts are the same set (order-independent)
#      -- exit 0, "No drift" message.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRIFT_SCRIPT_SRC="$SCRIPT_DIR/check-required-checks-drift.sh"
STUB_GH_SRC="$SCRIPT_DIR/check-required-checks-drift.test.stub-gh.sh"

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

REPO_DIR="$WORKDIR/repo"
mkdir -p "$REPO_DIR/scripts" "$REPO_DIR/.github"
cp "$DRIFT_SCRIPT_SRC" "$REPO_DIR/scripts/check-required-checks-drift.sh"

FAILURES=0

VALID_CONFIG='{"branch":"main","contexts":["build","e2e"]}'
printf '%s' "$VALID_CONFIG" >"$REPO_DIR/.github/required-checks.json"

# run_case NAME EXPECTED_EXIT VAR=val...
run_case() {
  local name="$1" expected_exit="$2"
  shift 2

  set +e
  OUTPUT=$(cd "$REPO_DIR" && env -i \
    PATH="$STUB_BIN_DIR:$PATH" \
    HOME="$HOME" \
    "$@" \
    bash scripts/check-required-checks-drift.sh 2>&1)
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

  RUN_CASE_OUTPUT="$OUTPUT"
}

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "FAIL [$label]: expected output to contain: $needle"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "=== Case 1: gh api error must fail closed (unverified, never a pass) ==="
run_case "api-error" 1 \
  GITHUB_REPOSITORY="test-owner/test-repo" \
  STUB_BRANCH_EXIT="1" \
  STUB_BRANCH_OUTPUT='{"message":"Not Found","status":"404"}'
assert_contains "api-error" "$RUN_CASE_OUTPUT" "::error::cannot read branch protection"
assert_contains "api-error" "$RUN_CASE_OUTPUT" "Not Found"

echo "=== Case 2: .protection missing/null must fail closed ==="
run_case "protection-null" 1 \
  GITHUB_REPOSITORY="test-owner/test-repo" \
  STUB_BRANCH_EXIT="0" \
  STUB_BRANCH_OUTPUT='{"name":"main","protected":false,"protection":null}'
assert_contains "protection-null" "$RUN_CASE_OUTPUT" "::error::cannot read branch protection"

echo "=== Case 3: mismatch must exit non-zero and name both sides ==="
run_case "mismatch" 1 \
  GITHUB_REPOSITORY="test-owner/test-repo" \
  STUB_BRANCH_EXIT="0" \
  STUB_BRANCH_OUTPUT='{"name":"main","protected":true,"protection":{"enabled":true,"required_status_checks":{"contexts":["build","lint"]}}}'
assert_contains "mismatch" "$RUN_CASE_OUTPUT" "::error::.github/required-checks.json has drifted"
assert_contains "mismatch" "$RUN_CASE_OUTPUT" "build,e2e"
assert_contains "mismatch" "$RUN_CASE_OUTPUT" "build,lint"

echo "=== Case 4: match must exit 0 ==="
run_case "match" 0 \
  GITHUB_REPOSITORY="test-owner/test-repo" \
  STUB_BRANCH_EXIT="0" \
  STUB_BRANCH_OUTPUT='{"name":"main","protected":true,"protection":{"enabled":true,"required_status_checks":{"contexts":["e2e","build"]}}}'
assert_contains "match" "$RUN_CASE_OUTPUT" "No drift"

if [ "$FAILURES" -ne 0 ]; then
  echo "$FAILURES assertion(s) failed."
  exit 1
fi
echo "All check-required-checks-drift.sh regression cases passed."
