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
    GCP_CHECK_ACCOUNTS       comma-separated list of gcloud account emails (all treated as
                             on this machine), OR
    ops/accounts.local.json  gitignored; copy ops/accounts.example.json and fill in
                             (override the path with GCP_CHECK_ACCOUNTS_FILE)

    Each entry of "accounts" is either a bare email string or an object
    {"email": ..., "on_this_machine": true|false, "reason": "..."}. An entry without
    "on_this_machine" is treated as ON this machine (fail closed: it must be
    authenticated and checkable). "on_this_machine": false marks an identity that is
    intentionally NOT authenticated here (SOLE-IDENTITY MANDATE) -- it is reported
    EXPECTED_ABSENT, never queried (there is nothing to ask), and does not fail the run.

Account statuses in the summary/report:
    CHECKED          on-machine account queried; projects listed
    EXPECTED_ABSENT  marked not on this machine and indeed not in `gcloud auth list`
    UNVERIFIED       on-machine account not authenticated, or its gcloud/API call failed
    DRIFT            marked not on this machine but IS authenticated here (violates the
                     sole-identity expectation)
    UNLISTED         authenticated here but absent from the config (reported under
                     "unlisted_authenticated")

Exit codes:
    2 -- identity configuration missing or malformed (nothing was checked)
    0 -- every on-machine account CHECKED with no CRITICAL project, every off-machine
         account EXPECTED_ABSENT, no unlisted authenticated identity
    1 -- anything else (CRITICAL project, UNVERIFIED incl. incomplete pagination, DRIFT,
         UNLISTED identity, `gcloud auth list` unreadable, or --json report unwritable)
         -- fail closed
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from collections.abc import Mapping
from dataclasses import dataclass
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


@dataclass(frozen=True)
class AccountSpec:
    """One configured identity and whether it is expected to be authenticated here."""

    email: str
    on_this_machine: bool = True
    reason: str = ""


def _parse_entry(entry: object) -> AccountSpec:
    if isinstance(entry, str):
        email, on_machine, reason = entry, True, ""
    elif isinstance(entry, dict):
        email = entry.get("email")
        # Missing field => on this machine (fail closed: it must then be checkable).
        on_machine = entry.get("on_this_machine", True)
        reason = entry.get("reason", "")
        if not isinstance(on_machine, bool) or not isinstance(reason, str):
            raise ConfigError(f"bad 'on_this_machine'/'reason' type for {email!r}")
    else:
        raise ConfigError(f"account entry must be a string or object, got {entry!r}")
    if not isinstance(email, str) or "@" not in email:
        raise ConfigError(f"account entry has no valid email: {entry!r}")
    return AccountSpec(email.strip(), on_machine, reason.strip())


def load_account_specs(env: Mapping[str, str] | None = None) -> list[AccountSpec]:
    """Return the configured identities from env var or the gitignored config file.

    Raises ConfigError (never returns an empty list) so a missing config cannot look
    like a clean "0 identities, 0 findings" run.
    """
    env = os.environ if env is None else env
    raw = env.get(ACCOUNTS_ENV, "").strip()
    if raw:
        entries: object = [a.strip() for a in raw.split(",") if a.strip()]
    else:
        path = Path(env.get(ACCOUNTS_FILE_ENV) or DEFAULT_ACCOUNTS_FILE)
        if not path.is_file():
            raise ConfigError(
                f"no accounts configured: set {ACCOUNTS_ENV} (comma-separated) or create "
                f"{path} from ops/accounts.example.json"
            )
        try:
            entries = json.loads(path.read_text(encoding="utf-8"))["accounts"]
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise ConfigError(f"{path} is unreadable or lacks an 'accounts' list: {exc}") from exc
    if not isinstance(entries, list) or not entries:
        raise ConfigError("accounts config must be a non-empty list")
    specs = [_parse_entry(e) for e in entries]
    emails = [x.email.lower() for x in specs]
    if len(set(emails)) != len(emails):
        raise ConfigError("accounts config lists the same email more than once")
    if not any(x.on_this_machine for x in specs):
        raise ConfigError("accounts config marks every account off this machine: nothing to check")
    return specs


def load_accounts(env: Mapping[str, str] | None = None) -> list[str]:
    """Return just the configured emails (kept for callers of the pre-schema API)."""
    return [x.email for x in load_account_specs(env)]


RESOURCE_MANAGER_URL = (
    "https://cloudresourcemanager.googleapis.com/v1/projects"
    "?filter=lifecycleState:DELETE_REQUESTED"
)


# Upper bound on pages followed per identity; exceeding it is UNVERIFIED, not a pass.
MAX_PAGES = 50


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


def list_authenticated(scope_account: str) -> set[str] | None:
    """Emails present in `gcloud auth list`, lower-cased; None if unreadable (fail closed).

    `auth list` enumerates every stored credential and has no per-account mode; the explicit
    --account (CHECKS.md instance 15) is passed anyway so the call can never depend on the
    ambient active account, and it is read-only.
    """
    try:
        result = subprocess.run(
            [GCLOUD, "auth", "list", "--format=json", f"--account={scope_account}"],
            capture_output=True,
            text=True,
            timeout=30,
            check=True,
        )
        data = json.loads(result.stdout)
        return {str(row["account"]).strip().lower() for row in data}
    except (
        subprocess.CalledProcessError,
        subprocess.TimeoutExpired,
        FileNotFoundError,
        ValueError,
        KeyError,
        TypeError,
    ):
        return None


def list_delete_requested(account: str) -> tuple[str, list[dict] | None, str | None]:
    """Returns (account, projects_or_None, error_or_None). None projects means UNVERIFIED."""
    token = get_access_token(account)
    if token is None:
        return account, None, "not authenticated locally (gcloud auth print-access-token failed)"
    projects: list[dict] = []
    seen_tokens: set[str] = set()
    page_token: str | None = None
    for _ in range(MAX_PAGES):
        try:
            resp = requests.get(
                RESOURCE_MANAGER_URL,
                headers={"Authorization": f"Bearer {token}"},
                params={"pageToken": page_token} if page_token else None,
                timeout=30,
            )
        except requests.RequestException as exc:
            return account, None, f"request failed: {exc}"
        if resp.status_code != 200:
            return account, None, f"HTTP {resp.status_code}: {resp.text[:300]}"
        try:
            body = resp.json()
            page = body.get("projects", [])
            next_token = body.get("nextPageToken")
        except (ValueError, AttributeError) as exc:
            return account, None, f"unparseable response: {exc}"
        if not isinstance(page, list):
            return account, None, "unparseable response: 'projects' is not a list"
        projects.extend(page)
        if next_token is None or next_token == "":
            break
        # Fail closed: a token we cannot trust means later pages were never read, and an
        # unread page is not a clean page (rule 98a).
        if not isinstance(next_token, str):
            return account, None, f"malformed nextPageToken: {next_token!r}"
        if next_token in seen_tokens:
            return account, None, "pagination loop: repeated nextPageToken"
        seen_tokens.add(next_token)
        page_token = next_token
    else:
        return account, None, f"pagination incomplete: more than {MAX_PAGES} pages"
    return account, projects, None


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
        specs = load_account_specs()
    except ConfigError as exc:
        print(f"CONFIG ERROR: {exc}", file=sys.stderr)
        return 2

    checked_at = datetime.now(timezone.utc).isoformat()
    report: dict = {"checked_at": checked_at, "accounts": {}, "unlisted_authenticated": []}
    any_critical = False
    any_unverified = False
    any_drift = False

    # Scope for the (account-less by nature) `auth list` call: first on-machine identity.
    scope = next(x.email for x in specs if x.on_this_machine)
    authenticated = list_authenticated(scope)
    auth_list_ok = authenticated is not None
    if authenticated is None:
        print("UNVERIFIED  gcloud auth list: unreadable (error, timeout or unparseable output)")
        report["auth_list_error"] = "gcloud auth list failed or was unparseable"
        any_unverified = True
        authenticated = set()
    else:
        configured = {x.email.lower() for x in specs}
        unlisted = sorted(authenticated - configured)
        report["unlisted_authenticated"] = unlisted
        for email in unlisted:
            print(f"UNLISTED    {email}: authenticated here but not in the accounts config")

    for spec in specs:
        account = spec.email
        if not spec.on_this_machine:
            # Never call gcloud for an identity that should not exist here.
            if account.lower() in authenticated:
                msg = "marked not on this machine but IS authenticated here (config drift)"
                print(f"DRIFT       {account}: {msg}")
                report["accounts"][account] = {"status": "DRIFT", "error": msg}
                any_drift = True
            elif not auth_list_ok:
                msg = "cannot confirm absence: gcloud auth list unavailable"
                print(f"UNVERIFIED  {account}: {msg}")
                report["accounts"][account] = {"status": "UNVERIFIED", "error": msg}
                any_unverified = True
            else:
                print(f"expected    {account}: not on this machine ({spec.reason or 'no reason'})")
                report["accounts"][account] = {
                    "status": "EXPECTED_ABSENT",
                    "reason": spec.reason,
                }
            continue

        if not auth_list_ok:
            acct, projects, error = account, None, "gcloud auth list unavailable"
        elif account.lower() not in authenticated:
            acct, projects = account, None
            error = "not authenticated locally (absent from gcloud auth list)"
        else:
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

    counts: dict[str, int] = {}
    for entry in report["accounts"].values():
        counts[entry["status"]] = counts.get(entry["status"], 0) + 1
    report["summary"] = counts
    n_unlisted = len(report["unlisted_authenticated"])
    any_unlisted = n_unlisted > 0
    print(f"\nSUMMARY: {json.dumps(counts, sort_keys=True)} unlisted_authenticated={n_unlisted}")

    if args.json:
        try:
            with open(args.json, "w", encoding="utf-8") as f:
                json.dump(report, f, indent=2)
        except OSError as exc:
            # An unwritable report must not look like a pass the caller can rely on.
            print(f"\nREPORT ERROR: could not write {args.json}: {exc}", file=sys.stderr)
            return 1
        print(f"\nFull report written to {args.json}")

    if any_unverified:
        print(
            "\nRESULT: UNVERIFIED -- at least one on-machine identity could not be checked. "
            "An unchecked identity is not a clean identity; treat this as a failure "
            "until every on-machine account above reads 'clean' or lists its findings."
        )
        return 1
    if any_drift or any_unlisted:
        print(
            "\nRESULT: DRIFT -- an identity is authenticated on this machine that the "
            "config says should not be (or is not listed at all). This violates the "
            "sole-identity expectation: log it out (`gcloud auth revoke <account>`) or fix "
            "the config."
        )
        return 1
    if any_critical:
        print(
            "\nRESULT: FAIL -- at least one do-not-delete-labeled project is in "
            "DELETE_REQUESTED. Restore it now: `gcloud projects undelete <project-id> "
            "--account=<owning-identity>` (works inside GCP's 30-day recovery window)."
        )
        return 1

    print("\nRESULT: PASS -- no do-not-delete-labeled project is in DELETE_REQUESTED "
        "(EXPECTED_ABSENT accounts are not on this machine by design).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
