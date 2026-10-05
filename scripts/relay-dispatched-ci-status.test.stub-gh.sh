#!/usr/bin/env bash
# Fake `gh` used only by scripts/relay-dispatched-ci-status.test.sh, placed
# first on PATH so the relay script under test calls this instead of the
# real GitHub CLI. Behavior is driven entirely by STUB_* env vars the test
# sets -- see relay-dispatched-ci-status.test.sh for what each one controls.
set -euo pipefail

case "$1" in
  run)
    case "$2" in
      list)
        printf '%s\n' "${STUB_RUN_LIST_OUTPUT:-${STUB_RUN_ID:-}}"
        exit "${STUB_RUN_LIST_EXIT:-0}"
        ;;
      watch)
        exit "${STUB_WATCH_EXIT:-0}"
        ;;
      view)
        printf '%s\n' "${STUB_RUN_VIEW_OUTPUT:-${STUB_JOBS_TSV:-}}"
        exit "${STUB_RUN_VIEW_EXIT:-0}"
        ;;
      *)
        echo "stub-gh: unstubbed gh run subcommand: $2" >&2
        exit 1
        ;;
    esac
    ;;
  api)
    case "$2" in
      */statuses/*)
        # Only log a line on a simulated success -- the posts log counts
        # statuses that actually landed, same as the real Statuses API
        # would only count a 2xx response as posted.
        if [ "${STUB_STATUSES_EXIT:-0}" -eq 0 ]; then
          printf '%s\n' "$*" >>"$STUB_POSTS_LOG"
        fi
        exit "${STUB_STATUSES_EXIT:-0}"
        ;;
      *)
        echo "stub-gh: unstubbed gh api path: $2" >&2
        exit 1
        ;;
    esac
    ;;
  *)
    echo "stub-gh: unstubbed gh command: $1" >&2
    exit 1
    ;;
esac
