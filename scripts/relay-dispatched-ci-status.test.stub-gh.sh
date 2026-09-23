#!/usr/bin/env bash
# Fake `gh` used only by scripts/relay-dispatched-ci-status.test.sh, placed
# first on PATH so the relay script under test calls this instead of the
# real GitHub CLI. Behavior is driven entirely by env vars the test sets;
# see relay-dispatched-ci-status.test.sh for what each STUB_* var controls.
set -euo pipefail

case "$1" in
  api)
    case "$2" in
      */branches/main/protection)
        printf '%s\n' "$STUB_PROTECTION_OUTPUT"
        exit "${STUB_PROTECTION_EXIT:-0}"
        ;;
      */statuses/*)
        printf '%s\n' "$*" >>"$STUB_POSTS_LOG"
        exit 0
        ;;
      *)
        echo "relay-dispatched-ci-status.test.stub-gh.sh: unstubbed gh api path: $2" >&2
        exit 1
        ;;
    esac
    ;;
  run)
    case "$2" in
      list)
        printf '%s\n' "$STUB_RUN_ID"
        exit 0
        ;;
      watch)
        exit "${STUB_WATCH_EXIT:-0}"
        ;;
      view)
        printf '%s\n' "$STUB_JOBS_TSV"
        exit 0
        ;;
      *)
        echo "relay-dispatched-ci-status.test.stub-gh.sh: unstubbed gh run subcommand: $2" >&2
        exit 1
        ;;
    esac
    ;;
  *)
    echo "relay-dispatched-ci-status.test.stub-gh.sh: unstubbed gh command: $1" >&2
    exit 1
    ;;
esac
