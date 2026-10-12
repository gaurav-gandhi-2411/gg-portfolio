from __future__ import annotations

"""Report any GCP project sitting in DELETE_REQUESTED, across every identity we can check.

Why this exists (2026-08-25): aetherart-497918 (AetherArt, do-not-delete labeled,
"AETHERART PROD DO NOT DEL") sat in DELETE_REQUESTED for at least 11 days -- the
do-not-delete label did nothing to stop the delete call, and the only thing that saved
it from permanent purge was still being inside GCP's 30-day recovery window when it was
finally noticed by hand. Audit logs (cloudaudit.googleapis.com/activity) show it was
deleted twice (2026-08-12 via a retired identity through the Console, then
again 2026-08-14 via the current owner identity through `gcloud projects delete` run by
a Claude Code agent session) with nothing in between reporting the state or stopping it.
mindmeld-c4bba (an old, since-superseded Warmer/Firebase project also carrying a
do-not-delete label) shows the identical pattern: deleted 2026-08-12 (browser, retired identity),
2026-08-13 (CC agent, retired identity), and 2026-08-14 (CC agent, owner identity) -- three delete calls
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
  - Runs once per identity returned by load_accounts() (env var or gitignored config file;
    see ops/accounts.example.json -- real addresses are never committed). A project invisible to one identity is
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

Configuration (required, fails loudly with exit 2 if absent):
    GCP_CHECK_ACCOUNTS       comma-separated list of gcloud account emails, OR
    ops/accounts.local.json  gitignored; copy ops/accounts.example.json and fill in
                             (override the path with GCP_CHECK_ACCOUNTS_FILE)

Exit codes:
    2 -- identity configuration missing or malformed (nothing was checked)
    0 -- no CRITICAL (do-not-delete-labeled) project in DELETE_REQUESTED, on every
         identity that could actually be checked
    1 -- at least one CRITICAL project found, OR at least one identity could not be
         checked at all (fail closed -- an unchecked identity is not a clean identity)
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from collections.abc import Mapping
from datetime import datetime, timezone
from pathlib import Path

import requests

# On Windows, the Cloud SDK ships `gcloud.cmd`; the bare "gcloud" name is not directly
# executable via subprocess without shell=True, which we'd rather not use for a command
# whose arguments include an email address. Resolve the real executable once instead.
GCLOUD = shutil.which("gcloud.cmd") or shutil.which("gcloud") or "gcloud"

# Every identity historically holding projects in this estate must be listed in the
# config (CLAUDE.md SOLE-IDENTITY MANDATE section). Checking all of them, not just the
# current active one, because a project can be invisible to the account currently
# authenticated in this shell and still exist under another -- that was true for
# tiq-billing-probe-1 in an earlier audit. The addresses live outside git (public repo).
ACCOUNTS_ENV = "GCP_CHECK_ACCOUNTS"
ACCOUNTS_FILE_ENV = "GCP_CHECK_ACCOUNTS_FILE"
DEFAULT_ACCOUNTS_FILE = Path(__file__).resolve().parent / "accounts.local.json"


class ConfigError(Exception):
    """Identity configuration missing or malformed (fail closed, rule 98a)."""


def load_accounts(env: Mapping[str, str] | None = None) -> list[str]:
    """Return the accounts to check from env var or the gitignored config file.

    Raises ConfigError (never returns an empty list) so a missing config cannot look
    like a clean "0 identities, 0 findings" run.
    """
    env = os.environ if env is None else env
    raw = env.get(ACCOUNTS_ENV, "").strip()
    if raw:
        accounts = [a.strip() for a in raw.split(",") if a.strip()]
    else:
        path = Path(env.get(ACCOUNTS_FILE_ENV) or DEFAULT_ACCOUNTS_FILE)
        if not path.is_file():
            raise ConfigError(
                f"no accounts configured: set {ACCOUNTS_ENV} (comma-separated) or create "
                f"{path} from ops/accounts.example.json"
            )
        try:
            accounts = json.loads(path.read_text(encoding="utf-8"))["accounts"]
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise ConfigError(f"{path} is unreadable or lacks an 'accounts' list: {exc}") from exc
    if not accounts or not all(isinstance(a, str) and "@" in a for a in accounts):
        raise ConfigError("accounts config must be a non-empty list of email addresses")
    return accounts


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

    try:
        accounts = load_accounts()
    except ConfigError as exc:
        print(f"CONFIG ERROR: {exc}", file=sys.stderr)
        return 2

    checked_at = datetime.now(timezone.utc).isoformat()
    report: dict = {"checked_at": checked_at, "accounts": {}}
    any_critical = False
    any_unverified = False

    for account in accounts:
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
