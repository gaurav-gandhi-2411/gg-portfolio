#!/usr/bin/env bash
# Regression test for scripts/check-required-checks-drift.sh -- table-
# driven, same pattern as relay-dispatched-ci-status.test.sh: one run_case
# call per scenario against a stubbed `gh`
# (check-required-checks-drift.test.stub-gh.sh), sharing one fixture tree.
# Run directly (`bash scripts/check-required-checks-drift.test.sh`; needs
# `jq` on PATH, same as the script under test) or via CI (ci.yml's build
# job).
#
# Cases, stated before this was run the first time: branch-protection API
# error (must fail closed -- "unverified", never "no drift"); a response
# whose .protection is missing/null (unprotected branch shape -- same fail-
# closed rule); config and live contexts differ (exit 1, names both sides);
# config and live contexts match, order-independent (exit 0).
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
printf '%s' '{"branch":"main","contexts":["build","e2e"]}' >"$REPO_DIR/.github/required-checks.json"

FAILURES=0

# run_case NAME EXPECTED_EXIT NEEDLE... -- VAR=val...
# Everything before the lone "--" is a required output substring;
# everything after it is forwarded to `env` as VAR=val pairs.
run_case() {
  local name="$1" expected="$2"
  shift 2
  local needles=() envs=() seen_sep=false a
  for a in "$@"; do
    if [ "$seen_sep" = false ] && [ "$a" = "--" ]; then
      seen_sep=true
      continue
    fi
    if [ "$seen_sep" = false ]; then needles+=("$a"); else envs+=("$a"); fi
  done

  local output actual_exit
  set +e
  output=$(cd "$REPO_DIR" && env -i PATH="$STUB_BIN_DIR:$PATH" HOME="$HOME" \
    "${envs[@]}" bash scripts/check-required-checks-drift.sh 2>&1)
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
}

run_case "api-error" 1 \
  "::error::cannot read branch protection" "Not Found" -- \
  GITHUB_REPOSITORY="test-owner/test-repo" STUB_BRANCH_EXIT="1" \
  STUB_BRANCH_OUTPUT='{"message":"Not Found","status":"404"}'

run_case "protection-null" 1 \
  "::error::cannot read branch protection" -- \
  GITHUB_REPOSITORY="test-owner/test-repo" STUB_BRANCH_EXIT="0" \
  STUB_BRANCH_OUTPUT='{"name":"main","protected":false,"protection":null}'

run_case "mismatch" 1 \
  "has drifted from main's live branch protection" "build,e2e" "build,lint" -- \
  GITHUB_REPOSITORY="test-owner/test-repo" STUB_BRANCH_EXIT="0" \
  STUB_BRANCH_OUTPUT='{"name":"main","protected":true,"protection":{"enabled":true,"required_status_checks":{"contexts":["build","lint"]}}}'

run_case "match" 0 \
  "No drift" -- \
  GITHUB_REPOSITORY="test-owner/test-repo" STUB_BRANCH_EXIT="0" \
  STUB_BRANCH_OUTPUT='{"name":"main","protected":true,"protection":{"enabled":true,"required_status_checks":{"contexts":["e2e","build"]}}}'

if [ "$FAILURES" -ne 0 ]; then
  echo "$FAILURES assertion(s) failed."
  exit 1
fi
echo "All check-required-checks-drift.sh regression cases passed."
