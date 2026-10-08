"""Freshness guard for the Python<->JS parity fixture."""
import json
from pathlib import Path

from tools.dashboard_converter.gen_parity import build_cases, dumps_fixture

FIXTURE = Path("tests/fixtures/parity_cases.json")
RUN1 = "site/data/run-2026-10-02-l4-t102.json"
DEFAULT_TH = [0.5, 1.0, 2.0, 4.0]


def _committed_text() -> str:
    # tolerate git autocrlf on Windows checkouts
    return FIXTURE.read_bytes().decode("utf-8").replace("\r\n", "\n")


def test_parity_fixture_fresh():
    fresh = dumps_fixture(build_cases())
    assert fresh == _committed_text(), (
        "parity fixture stale: run python -m tools.dashboard_converter.gen_parity")


def test_parity_fixture_has_nondefault_cases():
    cases = json.loads(_committed_text())["cases"]

    def nondefault(p):
        return (p["thresholds_g"] != DEFAULT_TH or p["offset"]["mode"] != "median"
                or p["gap"] != 0 or p["maxJumpMs"] != 2000)

    run1 = [c for c in cases if c["source"] == RUN1]
    assert sum(1 for c in run1 if nondefault(c["params"])) >= 5
    assert any(c["params"]["gap"] > 0 for c in cases)
    assert any(c["params"]["offset"]["mode"] == "manual" for c in cases)
    assert any(c["params"]["maxJumpMs"] != 2000 for c in cases)
    synthetic = [c for c in cases if c["source"] == "synthetic"]
    assert any(v is None for c in synthetic for k in ("ax", "ay", "az") for v in c["input"][k])
