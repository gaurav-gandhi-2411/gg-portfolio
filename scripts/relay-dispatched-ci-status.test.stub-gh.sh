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
        printf 'x
' >>"${STUB_POSTS_LOG:-/dev/null}.watch"
        exit "${STUB_WATCH_EXIT:-0}"
        ;;
      view)
        # Output mimics the relay's --jq: first line is the run status, then one
        # "name<TAB>conclusion" line per job. STUB_VIEW_SEQ is a comma list consumed
        # one token per call (the last repeats): a 3-digit token is a failing call
        # ("HTTP <n>"), "empty" is a successful call with no output, anything else is
        # the run status (in_progress also blanks every job conclusion, like the real API).
        printf 'x
' >>"${STUB_POSTS_LOG:-/dev/null}.view"
        TOK="completed"
        if [ -n "${STUB_VIEW_SEQ:-}" ]; then
          N=$(wc -l <"${STUB_POSTS_LOG}.view" | tr -d ' ')
          IFS=',' read -r -a TOKS <<<"$STUB_VIEW_SEQ"
          [ "$N" -gt "${#TOKS[@]}" ] && N="${#TOKS[@]}"
          TOK="${TOKS[$((N - 1))]}"
        fi
        case "$TOK" in
          [0-9][0-9][0-9])
            echo "HTTP $TOK: stub error (https://api.github.com/repos/o/r/actions/runs/42)" >&2
            exit 1
            ;;
          empty) exit 0 ;;
        esac
        # After `gh workflow run ask-live-guard.yml` the run being viewed is the guard's.
        if [ -n "${STUB_DISPATCH_LOG:-}" ] && grep -q "ask-live-guard.yml" "$STUB_DISPATCH_LOG" 2>/dev/null; then
          JOBS="${STUB_GUARD_JOBS_TSV:-}"
        else
          JOBS="${STUB_RUN_VIEW_OUTPUT:-${STUB_JOBS_TSV:-}}"
        fi
        printf '%s
' "$TOK"
        if [ "$TOK" = "in_progress" ]; then
          printf '%s
' "$JOBS" | awk -F'	' 'BEGIN{OFS="	"} NF{print $1, ""}'
        else
          printf '%s
' "$JOBS"
        fi
        exit "${STUB_RUN_VIEW_EXIT:-0}"
        ;;
      *)
        echo "stub-gh: unstubbed gh run subcommand: $2" >&2
        exit 1
        ;;
    esac
    ;;
  workflow)
    printf '%s\n' "$*" >>"${STUB_DISPATCH_LOG:-/dev/null}"
    exit 0
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
