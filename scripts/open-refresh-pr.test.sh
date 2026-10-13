#!/usr/bin/env bash
# Regression test for scripts/open-refresh-pr.sh, against stubbed `gh`, `git`
# and relay script (all calls appended to one log). Cases, stated before the
# script was changed: (1) changes + no prior PR -> unique branch pushed with a
# plain push, PR created, relay called with that branch; (2) changes + prior
# open PRs -> they are closed with a "Superseded by" comment; (3) nothing to
# propose + stale open PR -> closed; (4) nothing + no PR -> nothing closed;
# (5) gh pr list fails -> script fails closed. In every case: no `--force`, no
# `+refspec`, no `--delete-branch`, and no `git push --delete` anywhere, since
# repository ruleset 'no-force-push-no-delete-all-branches' rejects all three.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$SCRIPT_DIR/open-refresh-pr.sh"
W=$(mktemp -d)
trap 'rm -rf "$W"' EXIT
mkdir -p "$W/bin" "$W/scripts"
export LOG="$W/calls.log"

cat >"$W/bin/gh" <<'STUB'
#!/usr/bin/env bash
printf 'gh %s\n' "$*" >>"$LOG"
case "$1 $2" in
  "pr list") [ "${STUB_LIST_EXIT:-0}" -ne 0 ] && exit "$STUB_LIST_EXIT"; printf '%s' "${STUB_OPEN_PRS:-}"; exit 0 ;;
  "pr create") echo "https://github.com/o/r/pull/999"; exit 0 ;;
esac
exit 0
STUB
cat >"$W/bin/git" <<'STUB'
#!/usr/bin/env bash
printf 'git %s\n' "$*" >>"$LOG"
if [ "$1" = "diff" ]; then exit "${STUB_DIFF_EXIT:-1}"; fi
exit 0
STUB
cat >"$W/scripts/relay-dispatched-ci-status.sh" <<'STUB'
#!/usr/bin/env bash
printf 'relay %s\n' "$*" >>"$LOG"
STUB
chmod +x "$W/bin/gh" "$W/bin/git"

fails=0
check() { # desc, command...
  local d="$1"; shift
  if "$@"; then echo "  ok   $d"; else echo "  FAIL $d"; fails=$((fails + 1)); fi
}
has() { grep -qE -- "$1" "$LOG"; }
hasnt() { ! grep -qE -- "$1" "$LOG"; }
# line number of the first log line matching $1
first_line() { grep -nE -- "$1" "$LOG" | head -1 | cut -d: -f1; }
created_before_closed() {
  local a b
  a=$(first_line 'gh pr create'); b=$(first_line 'gh pr close')
  [ -n "$a" ] && [ -n "$b" ] && [ "$a" -lt "$b" ]
}

run() {
  : >"$LOG"
  PATH="$W/bin:$PATH" GH_TOKEN=x GITHUB_RUN_ID=4242 GITHUB_RUN_ATTEMPT="${ATTEMPT_OVERRIDE:-1}" \
    REFRESH_DATE=20261013 RELAY_SCRIPT="$W/scripts/relay-dispatched-ci-status.sh" \
    SUMMARY_PATH="$W/summary.md" bash "$SCRIPT" >"$W/out.txt" 2>&1
  RC=$?
}
echo body >"$W/summary.md"
NEWB='chore/metrics-refresh-20261013-4242'
FORCE_RE='--force|--force-with-lease|push .* \+'
DELETE_RE='--delete-branch|push .*--delete|push .* :refs/heads'

echo "case 1: changes, no prior PR"
STUB_DIFF_EXIT=1 STUB_OPEN_PRS="" run
check "exit 0" [ "$RC" -eq 0 ]
check "plain push of unique branch" has "git push origin $NEWB:refs/heads/$NEWB"
check "PR created from unique branch" has "gh pr create .*--head $NEWB"
check "relay called with unique branch" has "relay $NEWB"
check "ci dispatched on unique branch" has "gh workflow run ci.yml --ref $NEWB"
check "no force" hasnt "$FORCE_RE"
check "no branch deletion" hasnt "$DELETE_RE"
check "nothing closed" hasnt 'gh pr close'

echo "case 2: changes, two prior open PRs"
STUB_DIFF_EXIT=1 STUB_OPEN_PRS=$'316\n317' run
check "exit 0" [ "$RC" -eq 0 ]
check "closes 316 as superseded" has 'gh pr close 316 .*Superseded by'
check "closes 317 as superseded" has 'gh pr close 317 .*Superseded by'
check "superseded comment names new PR" has 'Superseded by .*999'
check "no force" hasnt "$FORCE_RE"
check "no branch deletion" hasnt "$DELETE_RE"
check "new PR created before old ones closed" created_before_closed

echo "case 3: nothing to propose, stale open PR"
STUB_DIFF_EXIT=0 STUB_OPEN_PRS="316" run
check "exit 0" [ "$RC" -eq 0 ]
check "stale PR closed" has 'gh pr close 316'
check "no branch deletion" hasnt "$DELETE_RE"
check "nothing pushed" hasnt 'git push'
check "no PR created" hasnt 'gh pr create'

echo "case 4: nothing to propose, no PR"
STUB_DIFF_EXIT=0 STUB_OPEN_PRS="" run
check "exit 0" [ "$RC" -eq 0 ]
check "nothing closed or pushed" hasnt 'gh pr close|git push'

echo "case 5: gh pr list fails -> fail closed"
STUB_DIFF_EXIT=1 STUB_LIST_EXIT=1 run
check "non-zero exit" [ "$RC" -ne 0 ]
check "nothing pushed" hasnt 'git push'

echo "case 6: identity-drift parameterisation (changes, one prior PR)"
IDB='chore/identity-drift-20261013-4242'
REFRESH_BRANCH_PREFIX=chore/identity-drift DIFF_PATHS=content/identity-state.json \
  ADD_PATHS=content/identity-state.json COMMIT_MSG="chore(identity): weekly identity-drift check" \
  PR_TITLE="chore(identity): weekly identity-drift check" \
  STUB_DIFF_EXIT=1 STUB_OPEN_PRS="12" run
check "exit 0" [ "$RC" -eq 0 ]
check "list filtered by identity-drift prefix" has 'pr list .*startswith\("chore/identity-drift"\)'
check "diff checks identity-state only" has 'git diff --quiet content/identity-state.json$'
check "plain push of identity branch" has "git push origin $IDB:refs/heads/$IDB"
check "PR created with identity title" has 'gh pr create --title chore\(identity\): weekly identity-drift check'
check "relay called with identity branch" has "relay $IDB"
check "old PR superseded" has 'gh pr close 12 .*Superseded by'
check "no force" hasnt "$FORCE_RE"
check "no branch deletion" hasnt "$DELETE_RE"

echo "case 7: content-pipeline parameterisation (pre-commit hook, re-run attempt)"
CPB='chore/content-pipeline-20261013-4242-a2'
ATTEMPT_OVERRIDE=2 REFRESH_BRANCH_PREFIX=chore/content-pipeline DIFF_PATHS=content/provenance.md \
  ADD_PATHS="content/provenance.md content/chatbot/index.json" PRE_COMMIT_CMD="echo PRECOMMIT-RAN >>$LOG" \
  COMMIT_MSG="chore(content): x" PR_TITLE="chore(content): x" STUB_DIFF_EXIT=1 STUB_OPEN_PRS="" run
check "exit 0" [ "$RC" -eq 0 ]
check "attempt suffix on branch" has "git push origin $CPB:refs/heads/$CPB"
check "pre-commit hook ran" has 'PRECOMMIT-RAN'
check "hook ran before commit" [ "$(first_line PRECOMMIT-RAN)" -lt "$(first_line 'git commit')" ]
check "both paths added" has 'git add content/provenance.md content/chatbot/index.json'

echo "case 7b: content-pipeline nothing to propose skips hook"
REFRESH_BRANCH_PREFIX=chore/content-pipeline DIFF_PATHS=content/provenance.md \
  PRE_COMMIT_CMD="echo PRECOMMIT-RAN >>$LOG" STUB_DIFF_EXIT=0 STUB_OPEN_PRS="5" run
check "hook not run" hasnt 'PRECOMMIT-RAN'
check "stale PR closed" has 'gh pr close 5'
check "no branch deletion" hasnt "$DELETE_RE"

if [ "$fails" -ne 0 ]; then echo "$fails check(s) failed"; exit 1; fi
echo "all checks passed"
