#!/usr/bin/env bash
# Fake `gh` used only by scripts/check-required-checks-drift.test.sh, placed
# first on PATH so the drift script under test calls this instead of the
# real GitHub CLI. Behavior is driven entirely by env vars the test sets;
# see check-required-checks-drift.test.sh for what each STUB_* var controls.
set -euo pipefail

case "$1" in
  api)
    case "$2" in
      */branches/*)
        printf '%s\n' "${STUB_BRANCH_OUTPUT:-}"
        exit "${STUB_BRANCH_EXIT:-0}"
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
