from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parent / "check_delete_requested_projects.py"


def _load():
    spec = importlib.util.spec_from_file_location("check_delete_requested_projects", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    # @dataclass resolves string annotations via sys.modules[cls.__module__].
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def test_source_has_no_hardcoded_gmail_addresses() -> None:
    # Public repo: identities must come from env/gitignored config, never the source.
    assert not re.search(r"[\w.]+@gmail\.com", SCRIPT.read_text(encoding="utf-8"))


def test_missing_config_exits_nonzero_with_clear_message(tmp_path: Path) -> None:
    env = {
        "GCP_CHECK_ACCOUNTS_FILE": str(tmp_path / "absent.json"),
        "PATH": "",
        "SYSTEMROOT": "C:/Windows",
    }
    proc = subprocess.run(
        [sys.executable, str(SCRIPT)], env=env, capture_output=True, text=True, timeout=60
    )
    assert proc.returncode == 2
    assert "CONFIG ERROR" in proc.stderr and "GCP_CHECK_ACCOUNTS" in proc.stderr


def test_load_accounts_from_file_and_env(tmp_path: Path) -> None:
    mod = _load()
    cfg = tmp_path / "a.json"
    cfg.write_text(json.dumps({"accounts": ["a@example.com", "b@example.com"]}))
    assert mod.load_accounts({"GCP_CHECK_ACCOUNTS_FILE": str(cfg)}) == [
        "a@example.com",
        "b@example.com",
    ]
    assert mod.load_accounts({"GCP_CHECK_ACCOUNTS": "c@example.com, d@example.com"}) == [
        "c@example.com",
        "d@example.com",
    ]


@pytest.mark.parametrize("body", ["not json", '{"accounts": []}', '{"accounts": ["nope"]}'])
def test_malformed_config_is_rejected(tmp_path: Path, body: str) -> None:
    mod = _load()
    cfg = tmp_path / "bad.json"
    cfg.write_text(body)
    with pytest.raises(mod.ConfigError):
        mod.load_accounts({"GCP_CHECK_ACCOUNTS_FILE": str(cfg)})


def test_main_runs_with_config(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    mod = _load()
    monkeypatch.setenv("GCP_CHECK_ACCOUNTS", "a@example.com")
    monkeypatch.setattr(mod, "list_authenticated", lambda scope: {"a@example.com"})
    monkeypatch.setattr(mod, "list_delete_requested", lambda acct: (acct, [], None))
    monkeypatch.setattr(sys, "argv", ["prog"])
    assert mod.main() == 0


# ---- expected-absent semantics (hermetic: subprocess.run and requests.get are stubbed) ----

OWNER = "owner@example.com"
RETIRED = "retired@example.com"
EXTRA = "stranger@example.com"


class _Proc:
    def __init__(self, stdout: str = "", returncode: int = 0) -> None:
        self.stdout, self.returncode = stdout, returncode


class _Resp:
    def __init__(self, status: int = 200, body: object = None, bad_json: bool = False) -> None:
        self.status_code, self._body, self._bad = status, body, bad_json
        self.text = "boom"

    def json(self) -> object:
        if self._bad:
            raise ValueError("not json")
        return self._body


def _run(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    accounts: object,
    *,
    authed: list[str] | None = None,
    auth_list: str | None = None,
    auth_exc: Exception | None = None,
    token_fail: bool = False,
    resp: _Resp | None = None,
    get: object = None,
) -> tuple[int, dict, list[list[str]]]:
    mod = _load()
    cfg = tmp_path / "cfg.json"
    cfg.write_text(accounts if isinstance(accounts, str) else json.dumps({"accounts": accounts}))
    out = tmp_path / "report.json"
    calls: list[list[str]] = []

    def fake_run(argv: list[str], **kw: object) -> _Proc:
        calls.append(list(argv))
        if "list" in argv and "auth" in argv:
            if auth_exc:
                raise auth_exc
            if auth_list is not None:
                return _Proc(auth_list)
            return _Proc(json.dumps([{"account": a} for a in (authed or [])]))
        if token_fail:
            raise subprocess.CalledProcessError(1, argv)
        return _Proc("tok\n")

    monkeypatch.setattr(mod.subprocess, "run", fake_run)
    monkeypatch.setattr(mod.requests, "get", get or (lambda *a, **k: resp or _Resp(body={})))
    monkeypatch.delenv("GCP_CHECK_ACCOUNTS", raising=False)
    monkeypatch.setenv("GCP_CHECK_ACCOUNTS_FILE", str(cfg))
    monkeypatch.setattr(sys, "argv", ["prog", "--json", str(out)])
    code = mod.main()
    report = json.loads(out.read_text()) if out.exists() else {}
    return code, report, calls


NORMAL = [OWNER, {"email": RETIRED, "on_this_machine": False, "reason": "retired"}]


def test_normal_state_exits_zero_and_marks_expected_absent(monkeypatch, tmp_path) -> None:
    code, rep, calls = _run(monkeypatch, tmp_path, NORMAL, authed=[OWNER])
    assert code == 0
    assert rep["accounts"][OWNER]["status"] == "CHECKED"
    assert rep["accounts"][RETIRED] == {"status": "EXPECTED_ABSENT", "reason": "retired"}
    assert rep["summary"] == {"CHECKED": 1, "EXPECTED_ABSENT": 1}
    # every gcloud call names an account, and none names the off-machine identity
    assert calls and all(any(a.startswith("--account=") for a in c) for c in calls)
    assert not any(RETIRED in " ".join(c) for c in calls)


def test_critical_project_fails(monkeypatch, tmp_path) -> None:
    proj = {"projectId": "p", "name": "x", "labels": {"do-not-delete": "true"}}
    code, rep, _ = _run(
        monkeypatch, tmp_path, NORMAL, authed=[OWNER], resp=_Resp(body={"projects": [proj]})
    )
    assert code == 1 and rep["accounts"][OWNER]["status"] == "CHECKED"


def test_noncritical_delete_requested_is_info_only(monkeypatch, tmp_path) -> None:
    proj = {"projectId": "p", "name": "x", "labels": {}}
    code, _, _ = _run(
        monkeypatch, tmp_path, NORMAL, authed=[OWNER], resp=_Resp(body={"projects": [proj]})
    )
    assert code == 0


def test_on_machine_account_not_authenticated_fails(monkeypatch, tmp_path) -> None:
    code, rep, _ = _run(monkeypatch, tmp_path, NORMAL, authed=[])
    assert code == 1 and rep["accounts"][OWNER]["status"] == "UNVERIFIED"
    assert rep["accounts"][RETIRED]["status"] == "EXPECTED_ABSENT"


@pytest.mark.parametrize(
    "kw",
    [
        {"token_fail": True},
        {"resp": _Resp(status=403)},
        {"resp": _Resp(bad_json=True)},
        {"resp": _Resp(body={"projects": "nope"})},
    ],
)
def test_gcloud_or_api_errors_fail(monkeypatch, tmp_path, kw) -> None:
    code, rep, _ = _run(monkeypatch, tmp_path, NORMAL, authed=[OWNER], **kw)
    assert code == 1 and rep["accounts"][OWNER]["status"] == "UNVERIFIED"


@pytest.mark.parametrize(
    "kw",
    [
        {"auth_list": "garbage"},
        {"auth_list": '{"account": "x"}'},
        {"auth_exc": subprocess.TimeoutExpired("gcloud", 30)},
        {"auth_exc": subprocess.CalledProcessError(1, "gcloud")},
        {"auth_exc": FileNotFoundError()},
    ],
)
def test_auth_list_failure_fails_closed(monkeypatch, tmp_path, kw) -> None:
    code, rep, _ = _run(monkeypatch, tmp_path, NORMAL, **kw)
    assert code == 1 and "auth_list_error" in rep
    assert rep["accounts"][RETIRED]["status"] == "UNVERIFIED"  # absence cannot be confirmed


def test_off_machine_but_authenticated_is_drift(monkeypatch, tmp_path) -> None:
    code, rep, calls = _run(monkeypatch, tmp_path, NORMAL, authed=[OWNER, RETIRED.upper()])
    assert code == 1 and rep["accounts"][RETIRED]["status"] == "DRIFT"
    assert not any(f"--account={RETIRED}" in c for c in calls)


def test_authenticated_account_missing_from_config_fails(monkeypatch, tmp_path) -> None:
    code, rep, _ = _run(monkeypatch, tmp_path, NORMAL, authed=[OWNER, EXTRA])
    assert code == 1 and rep["unlisted_authenticated"] == [EXTRA]


@pytest.mark.parametrize(
    "cfg",
    [
        "not json",
        '{"accounts": []}',
        '{"accounts": [{"email": "nope"}]}',
        '{"accounts": [7]}',
        '{"accounts": [{"email": "a@example.com", "on_this_machine": "no"}]}',
    ],
)
def test_malformed_config_exits_two(monkeypatch, tmp_path, cfg) -> None:
    code, _, calls = _run(monkeypatch, tmp_path, cfg, authed=[OWNER])
    assert code == 2 and calls == []


def test_all_off_machine_and_duplicates_rejected(tmp_path) -> None:
    mod = _load()
    for accts in (
        [{"email": RETIRED, "on_this_machine": False}],
        [OWNER, OWNER.upper()],
    ):
        cfg = tmp_path / "c.json"
        cfg.write_text(json.dumps({"accounts": accts}))
        with pytest.raises(mod.ConfigError):
            mod.load_account_specs({"GCP_CHECK_ACCOUNTS_FILE": str(cfg)})


def test_missing_config_file_exits_two(monkeypatch, tmp_path) -> None:
    mod = _load()
    monkeypatch.delenv("GCP_CHECK_ACCOUNTS", raising=False)
    monkeypatch.setenv("GCP_CHECK_ACCOUNTS_FILE", str(tmp_path / "absent.json"))
    monkeypatch.setattr(sys, "argv", ["prog"])
    assert mod.main() == 2


def test_entry_without_field_defaults_to_on_machine_fail_closed(monkeypatch, tmp_path) -> None:
    mod = _load()
    cfg = tmp_path / "c.json"
    cfg.write_text(json.dumps({"accounts": [OWNER, {"email": RETIRED}]}))
    specs = mod.load_account_specs({"GCP_CHECK_ACCOUNTS_FILE": str(cfg)})
    assert all(s.on_this_machine for s in specs)
    # and operationally: such an unauthenticated account fails the run
    code, rep, _ = _run(monkeypatch, tmp_path, [OWNER, {"email": RETIRED}], authed=[OWNER])
    assert code == 1 and rep["accounts"][RETIRED]["status"] == "UNVERIFIED"


# ---- pagination: a project on a later page must not be missed (fail closed otherwise) ----

CRIT = {"projectId": "prod-p2", "name": "DO NOT DEL", "labels": {"do-not-delete": "true"}}


def _paged(pages: dict):
    """requests.get stub serving `pages` keyed by the pageToken sent (None = first page)."""
    seen: list = []

    def get(*a: object, **k: dict) -> _Resp:
        token = (k.get("params") or {}).get("pageToken")
        seen.append(token)
        return _Resp(body=pages[token])

    get.seen = seen  # type: ignore[attr-defined]
    return get


def test_target_project_only_on_page_two_is_found(monkeypatch, tmp_path) -> None:
    get = _paged(
        {
            None: {"projects": [{"projectId": "p1", "name": "x"}], "nextPageToken": "t2"},
            "t2": {"projects": [CRIT]},
        }
    )
    code, rep, _ = _run(monkeypatch, tmp_path, NORMAL, authed=[OWNER], get=get)
    assert code == 1  # the do-not-delete project on page 2 is CRITICAL
    ids = [p["projectId"] for p in rep["accounts"][OWNER]["projects"]]
    assert ids == ["p1", "prod-p2"] and get.seen == [None, "t2"]


def test_empty_final_page_token_ends_pagination_cleanly(monkeypatch, tmp_path) -> None:
    get = _paged({None: {"projects": [], "nextPageToken": ""}})
    code, rep, _ = _run(monkeypatch, tmp_path, NORMAL, authed=[OWNER], get=get)
    assert code == 0 and rep["accounts"][OWNER]["status"] == "CHECKED"


def test_repeated_page_token_fails_closed(monkeypatch, tmp_path) -> None:
    get = _paged(
        {
            None: {"projects": [], "nextPageToken": "loop"},
            "loop": {"projects": [], "nextPageToken": "loop"},
        }
    )
    code, rep, _ = _run(monkeypatch, tmp_path, NORMAL, authed=[OWNER], get=get)
    assert code == 1 and rep["accounts"][OWNER]["status"] == "UNVERIFIED"
    assert "loop" in rep["accounts"][OWNER]["error"]


def test_page_cap_exceeded_fails_closed(monkeypatch, tmp_path) -> None:
    mod = _load()
    calls: list = []

    def endless(*a: object, **k: dict) -> _Resp:
        calls.append(1)
        return _Resp(body={"projects": [], "nextPageToken": f"t{len(calls)}"})

    code, rep, _ = _run(monkeypatch, tmp_path, NORMAL, authed=[OWNER], get=endless)
    assert code == 1 and rep["accounts"][OWNER]["status"] == "UNVERIFIED"
    assert len(calls) == mod.MAX_PAGES  # stops at the cap, never runs unbounded


@pytest.mark.parametrize("bad", [123, ["t"], {"a": 1}, True])
def test_malformed_page_token_fails_closed(monkeypatch, tmp_path, bad) -> None:
    get = _paged({None: {"projects": [], "nextPageToken": bad}})
    code, rep, _ = _run(monkeypatch, tmp_path, NORMAL, authed=[OWNER], get=get)
    assert code == 1 and rep["accounts"][OWNER]["status"] == "UNVERIFIED"


def test_error_on_later_page_is_unverified_not_partial_pass(monkeypatch, tmp_path) -> None:
    def get(*a: object, **k: dict) -> _Resp:
        if (k.get("params") or {}).get("pageToken"):
            return _Resp(status=500)
        return _Resp(body={"projects": [], "nextPageToken": "t2"})

    code, rep, _ = _run(monkeypatch, tmp_path, NORMAL, authed=[OWNER], get=get)
    assert code == 1 and rep["accounts"][OWNER]["status"] == "UNVERIFIED"


# ---- on_this_machine: only an exact JSON boolean false marks an identity off-machine ----


@pytest.mark.parametrize("val", ["false", 0, None, "no", []])
def test_falsy_ish_on_this_machine_is_not_accepted_as_false(monkeypatch, tmp_path, val) -> None:
    mod = _load()
    accts = [OWNER, {"email": RETIRED, "on_this_machine": val}]
    cfg = tmp_path / "f.json"
    cfg.write_text(json.dumps({"accounts": accts}))
    with pytest.raises(mod.ConfigError):
        mod.load_account_specs({"GCP_CHECK_ACCOUNTS_FILE": str(cfg)})
    code, _, calls = _run(monkeypatch, tmp_path, accts, authed=[OWNER])
    assert code == 2 and calls == []  # config error: nothing was checked


# ---- report write failure must not be a silent pass ----


def test_unwritable_report_path_exits_nonzero_with_clear_error(
    monkeypatch, tmp_path, capsys
) -> None:
    mod = _load()
    cfg = tmp_path / "cfg.json"
    cfg.write_text(json.dumps({"accounts": [OWNER]}))
    monkeypatch.delenv("GCP_CHECK_ACCOUNTS", raising=False)
    monkeypatch.setenv("GCP_CHECK_ACCOUNTS_FILE", str(cfg))
    monkeypatch.setattr(mod, "list_authenticated", lambda scope: {OWNER})
    monkeypatch.setattr(mod, "list_delete_requested", lambda acct: (acct, [], None))
    # A directory cannot be opened for writing, on every OS, without touching real paths.
    monkeypatch.setattr(sys, "argv", ["prog", "--json", str(tmp_path)])
    assert mod.main() == 1
    err = capsys.readouterr().err
    assert "REPORT ERROR" in err and str(tmp_path) in err
