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
REPO_DIR="$WORKDIR/repo"
mkdir -p "$REPO_DIR/scripts" "$REPO_DIR/.github"
cp "$RELAY_SCRIPT_SRC" "$REPO_DIR/scripts/relay-dispatched-ci-status.sh"
# The script under test does `git rev-parse HEAD` -- give it a real repo.
git init -q "$REPO_DIR"
git -C "$REPO_DIR" config user.email "test@example.com"
git -C "$REPO_DIR" config user.name "test"
git -C "$REPO_DIR" commit -q --allow-empty -m "init"

VALID='{"branch":"main","contexts":["build","e2e"]}'
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

if [ "$FAILURES" -ne 0 ]; then
  echo "$FAILURES assertion(s) failed."
  exit 1
fi
echo "All relay-dispatched-ci-status.sh regression cases passed."
