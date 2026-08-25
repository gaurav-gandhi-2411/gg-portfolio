from __future__ import annotations

"""Report any GCP project sitting in DELETE_REQUESTED, across every identity we can check.

Why this exists (2026-08-25): aetherart-497918 (AetherArt, do-not-delete labeled,
"AETHERART PROD DO NOT DEL") sat in DELETE_REQUESTED for at least 11 days -- the
do-not-delete label did nothing to stop the delete call, and the only thing that saved
it from permanent purge was still being inside GCP's 30-day recovery window when it was
finally noticed by hand. Audit logs (cloudaudit.googleapis.com/activity) show it was
deleted twice (2026-08-12 via gaurav.gandhi2411@gmail.com through the Console, then
again 2026-08-14 via gaurav.gandhi1129@gmail.com through `gcloud projects delete` run by
a Claude Code agent session) with nothing in between reporting the state or stopping it.
mindmeld-c4bba (an old, since-superseded Warmer/Firebase project also carrying a
do-not-delete label) shows the identical pattern: deleted 2026-08-12 (browser, 2411),
2026-08-13 (CC agent, 2411), and 2026-08-14 (CC agent, 1129) -- three delete calls
across three days, on a label that was supposed to mean never.

This check exists because nothing else reports the state on its own: a project in
DELETE_REQUESTED keeps answering `gcloud projects describe` (which is why it's easy to
mistake for "still around") but silently stops serving Cloud Run/API traffic once
billing lapses, well before the 30-day purge actually lands -- both AetherArt's and
mindmeld's billing were already disabled by the time this was found. A visitor sees a
plain 404, not an error that names the cause.

Design notes:
  - Uses the Resource Manager v1 `projects.list` filter (`lifecycleState:DELETE_REQUESTED`)
    directly, not a fixed list of known project IDs -- a fixed list only ever catches
    projects someone already thought to name, which is exactly the blind spot that let
    this recur. (rule 85a: a control's own construction can encode the same
    narrower-than-advertised-surface assumption it exists to catch elsewhere.)
  - Runs once per identity in ACCOUNTS_TO_CHECK. A project invisible to one identity is
    not evidence it's safe -- it may only be visible to another (CLAUDE.md's own standing
    note on `gcloud projects list` needing to be run per-identity). Reports explicitly
    which identities were actually checked, not just a bare "0 found" -- an unchecked
    identity must never look identical to a clean one (rule 98a).
  - An API call that errors is reported as UNVERIFIED for that identity, never silently
    folded into "0 found" (same rule). A `gcloud auth print-access-token` failure means
    that identity was never logged in locally on this machine -- reported, not skipped
    silently.
  - CRITICAL vs INFO split: a DELETE_REQUESTED project carrying a `do-not-delete: true`
    label (or a name containing "DO NOT DEL") is the actual anomaly this check exists to
    catch -- exit 1. A DELETE_REQUESTED project with neither is very likely an
    intentional, in-progress cleanup (e.g. a superseded pre-migration project riding out
    its own 30-day purge) and is reported for visibility only, not as a failure.

Usage:
    python ops/check_delete_requested_projects.py [--json report.json]

Exit codes:
    0 -- no CRITICAL (do-not-delete-labeled) project in DELETE_REQUESTED, on every
         identity that could actually be checked
    1 -- at least one CRITICAL project found, OR at least one identity could not be
         checked at all (fail closed -- an unchecked identity is not a clean identity)
"""

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone

import requests

# On Windows, the Cloud SDK ships `gcloud.cmd`; the bare "gcloud" name is not directly
# executable via subprocess without shell=True, which we'd rather not use for a command
# whose arguments include an email address. Resolve the real executable once instead.
GCLOUD = shutil.which("gcloud.cmd") or shutil.which("gcloud") or "gcloud"

# Every identity historically holding projects in this estate (CLAUDE.md SOLE-IDENTITY
# MANDATE section). Checking all three, not just the current active one, because a
# project can be invisible to the account currently authenticated in this shell and
# still exist under another -- that was true for tiq-billing-probe-1 in an earlier
# audit and there is no reason to assume it can't be true again here.
ACCOUNTS_TO_CHECK = [
    "gaurav.gandhi1129@gmail.com",
    "gaurav.gandhi2411@gmail.com",
    "gaurav.gandhi1249@gmail.com",
]

RESOURCE_MANAGER_URL = (
    "https://cloudresourcemanager.googleapis.com/v1/projects"
    "?filter=lifecycleState:DELETE_REQUESTED"
)


def get_access_token(account: str) -> str | None:
    try:
        result = subprocess.run(
            [GCLOUD, "auth", "print-access-token", f"--account={account}"],
            capture_output=True,
            text=True,
            timeout=30,
            check=True,
        )
        return result.stdout.strip()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
        return None


def list_delete_requested(account: str) -> tuple[str, list[dict] | None, str | None]:
    """Returns (account, projects_or_None, error_or_None). None projects means UNVERIFIED."""
    token = get_access_token(account)
    if token is None:
        return account, None, "not authenticated locally (gcloud auth print-access-token failed)"
    try:
        resp = requests.get(
            RESOURCE_MANAGER_URL,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
    except requests.RequestException as exc:
        return account, None, f"request failed: {exc}"
    if resp.status_code != 200:
        return account, None, f"HTTP {resp.status_code}: {resp.text[:300]}"
    return account, resp.json().get("projects", []), None


def is_critical(project: dict) -> bool:
    labels = project.get("labels", {}) or {}
    if str(labels.get("do-not-delete", "")).lower() == "true":
        return True
    name = project.get("name", "") or ""
    return "DO NOT DEL" in name.upper()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", help="Optional path to write the full JSON report to")
    args = parser.parse_args()

    checked_at = datetime.now(timezone.utc).isoformat()
    report: dict = {"checked_at": checked_at, "accounts": {}}
    any_critical = False
    any_unverified = False

    for account in ACCOUNTS_TO_CHECK:
        acct, projects, error = list_delete_requested(account)
        if error is not None:
            print(f"UNVERIFIED  {acct}: {error}")
            report["accounts"][acct] = {"status": "UNVERIFIED", "error": error}
            any_unverified = True
            continue

        report["accounts"][acct] = {"status": "CHECKED", "projects": projects}
        if not projects:
            print(f"clean       {acct}: 0 projects in DELETE_REQUESTED")
            continue

        for p in projects:
            pid = p.get("projectId")
            pname = p.get("name")
            labels = p.get("labels", {})
            severity = "CRITICAL" if is_critical(p) else "info"
            print(
                f"{severity:11s} {acct}: {pid} ({pname}) "
                f"labels={labels} createTime={p.get('createTime')}"
            )
            if severity == "CRITICAL":
                any_critical = True

    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"\nFull report written to {args.json}")

    if any_unverified:
        print(
            "\nRESULT: UNVERIFIED -- at least one identity could not be checked. "
            "An unchecked identity is not a clean identity; treat this as a failure "
            "until every account above reads 'clean' or lists its findings."
        )
        return 1
    if any_critical:
        print(
            "\nRESULT: FAIL -- at least one do-not-delete-labeled project is in "
            "DELETE_REQUESTED. Restore it now: `gcloud projects undelete <project-id> "
            "--account=<owning-identity>` (works inside GCP's 30-day recovery window)."
        )
        return 1

    print("\nRESULT: PASS -- no do-not-delete-labeled project is in DELETE_REQUESTED.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
