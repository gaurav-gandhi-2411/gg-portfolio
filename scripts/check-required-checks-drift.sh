#!/usr/bin/env bash
# Compares .github/required-checks.json — the config
# scripts/relay-dispatched-ci-status.sh trusts for which commit-status
# contexts to post onto bot-PR SHAs — against the live branch protection on
# the branch it names (main), so the config going stale (someone edits
# branch protection in the GitHub UI without updating this file, or vice
# versa) surfaces as a red scheduled run instead of the relay quietly
# stopping covering a real required check, or blocking on one that no
# longer exists.
#
# Unlike the relay script, which runs with GITHUB_TOKEN inside a workflow
# and cannot read branch protection (the `.../branches/main/protection`
# sub-resource needs admin — see relay's header for the silent-failure
# history that caused), this reads GET /repos/{owner}/{repo}/branches/{branch}
# instead. That endpoint is readable with plain read access — verified
# directly against this repo: it returns `.protection` even for an
# unauthenticated request, since gg-portfolio is public.
#
# Fails closed (rule 98a): any API failure, or a missing/null `.protection`
# or `.protection.required_status_checks`, is "drift unverified" and exits 1
# — never treated as "no drift found."
#
# Usage: check-required-checks-drift.sh
# Preconditions: GITHUB_REPOSITORY in env; GH_TOKEN optional (works
# unauthenticated for this public repo, but the workflow sets it anyway for
# rate-limit headroom).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/../.github/required-checks.json"

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set (set automatically inside GitHub Actions)}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "::error::Required-checks config not found at $CONFIG_FILE."
  exit 1
fi

if ! CONFIG_JSON=$(jq -c '.' "$CONFIG_FILE" 2>&1); then
  echo "::error::$CONFIG_FILE did not parse as JSON: $CONFIG_JSON"
  exit 1
fi

CONFIG_BRANCH=$(printf '%s' "$CONFIG_JSON" | jq -r '.branch // empty')
if [ -z "$CONFIG_BRANCH" ]; then
  echo "::error::$CONFIG_FILE has no non-empty .branch."
  exit 1
fi

CONTEXTS_TYPE=$(printf '%s' "$CONFIG_JSON" | jq -r '.contexts | type')
if [ "$CONTEXTS_TYPE" != "array" ]; then
  echo "::error::$CONFIG_FILE's .contexts must be a JSON array of strings (got: $CONTEXTS_TYPE)."
  exit 1
fi

CONFIG_CONTEXTS=$(printf '%s' "$CONFIG_JSON" | jq -r '.contexts[]?' | sort)
if [ -z "$CONFIG_CONTEXTS" ]; then
  echo "::error::$CONFIG_FILE's .contexts array is empty."
  exit 1
fi

if ! BRANCH_JSON=$(gh api "repos/$REPO/branches/$CONFIG_BRANCH" 2>&1); then
  echo "::error::cannot read branch protection — drift unverified. gh api repos/$REPO/branches/$CONFIG_BRANCH failed: $BRANCH_JSON"
  exit 1
fi

if ! PROTECTION_TYPE=$(printf '%s' "$BRANCH_JSON" | jq -r '.protection | type' 2>&1); then
  echo "::error::cannot read branch protection — drift unverified. Response from repos/$REPO/branches/$CONFIG_BRANCH did not parse as JSON: $PROTECTION_TYPE"
  exit 1
fi

if [ "$PROTECTION_TYPE" != "object" ]; then
  echo "::error::cannot read branch protection — drift unverified. .protection is missing or null on repos/$REPO/branches/$CONFIG_BRANCH (got: $PROTECTION_TYPE)."
  exit 1
fi

RSC_TYPE=$(printf '%s' "$BRANCH_JSON" | jq -r '.protection.required_status_checks | type')
if [ "$RSC_TYPE" != "object" ]; then
  echo "::error::cannot read branch protection — drift unverified. .protection.required_status_checks is missing or null on repos/$REPO/branches/$CONFIG_BRANCH (got: $RSC_TYPE)."
  exit 1
fi

LIVE_CONTEXTS=$(printf '%s' "$BRANCH_JSON" | jq -r '.protection.required_status_checks.contexts[]?' | sort)

if [ "$CONFIG_CONTEXTS" != "$LIVE_CONTEXTS" ]; then
  echo "::error::$CONFIG_FILE has drifted from $CONFIG_BRANCH's live branch protection."
  echo "::error::Config (.github/required-checks.json): $(printf '%s' "$CONFIG_CONTEXTS" | tr '\n' ',' | sed 's/,$//')"
  echo "::error::Live (branch protection):               $(printf '%s' "$LIVE_CONTEXTS" | tr '\n' ',' | sed 's/,$//')"
  exit 1
fi

echo "No drift: $CONFIG_FILE matches $CONFIG_BRANCH's live branch protection ($(printf '%s' "$CONFIG_CONTEXTS" | tr '\n' ',' | sed 's/,$//'))."
