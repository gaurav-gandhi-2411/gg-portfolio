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
    monkeypatch.setattr(mod, "list_delete_requested", lambda acct: (acct, [], None))
    monkeypatch.setattr(sys, "argv", ["prog"])
    assert mod.main() == 0
