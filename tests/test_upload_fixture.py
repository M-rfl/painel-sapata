"""Freshness + coverage guard for the browser-converter oracle files.

Regenerate with: python -m tools.dashboard_converter.gen_upload_parity
"""
import json
from pathlib import Path

import pytest

from tools.dashboard_converter.gen_upload_parity import (
    build_fixture, build_stations, dumps_fixture, dumps_stations)

FIXTURE = Path("tests/fixtures/upload_parity.json")
STATIONS = Path("site/data/stations.json")
HINT = "run python -m tools.dashboard_converter.gen_upload_parity"


def _text(path: Path) -> str:
    # tolerate git autocrlf on Windows checkouts
    return path.read_bytes().decode("utf-8").replace("\r\n", "\n")


@pytest.fixture(scope="module")
def fresh():
    return build_fixture()


@pytest.fixture(scope="module")
def committed():
    return json.loads(_text(FIXTURE))


def test_stations_json_fresh():
    assert dumps_stations(build_stations()) == _text(STATIONS), f"stations.json stale: {HINT}"


def test_upload_fixture_fresh(fresh):
    assert dumps_fixture(fresh) == _text(FIXTURE), f"upload_parity.json stale: {HINT}"


def test_stations_cover_all_lines():
    s = json.loads(_text(STATIONS))
    assert {l["line_id"] for l in s["lines"]} == {1, 2, 3, 4}
    for l in s["lines"]:
        assert l["site_stations"] and all(d["stations"] for d in l["directions"])


def test_upload_fixture_coverage(committed):
    f = committed
    r = f["recover"]
    assert {c["reason"] for c in r["accel"]} >= {
        "plain", "k", "k-1", "empty", "unrecoverable", "off_grid", "out_of_range"}
    assert {c["reason"] for c in r["gps"]} >= {
        "plain", "recovered", "out_of_envelope", "empty", "unrecoverable"}
    assert {c["reason"] for c in r["scaled"]} >= {
        "neighbour", "column_median", "no_neighbours", "out_of_range"}
    assert any(c["text"].endswith("5") and len(c["text"].split(".")[-1]) == 7 for c in r["key6"])

    geo = {g["name"]: g["expected"] for g in f["geofence"]}
    methods = {t["method"] for e in geo.values() for t in e["turnarounds"]}
    assert {"terminal", "reversal"} <= methods
    assert any(p["status"] == "inferred" for e in geo.values() for p in e["passages"])

    files = {c["name"]: c["expected"] for c in f["files"]}
    assert {"run_mini", "synthetic-l4", "single-ptbr"} <= set(files)
    syn = files["synthetic-l4"]
    q = syn["quality"]
    assert q["unrecovered_values"] >= 1 and q["ambiguous_values"] >= 1
    assert q["rows_without_gps"] > 0
    assert len(syn["source_runs"]) == 2
    assert [x["mode"] for x in syn["meta"]["source"]["files"]] == ["plain", "ptbr"]
    assert q["max_gap_s"] == 2.2
    assert any(t["gap_s"] == 1.2 for t in q["turnarounds"])

    assert any(c["text"] == "999.999.999.999.999" for c in r["accel"])
    from math import log10
    thousands = [c for c in r["accel"] if c["ptbr"] and c["text"].replace("-", "").replace(".", "").isdigit()
                 and "." in c["text"]]
    assert any(int(log10(int(c["text"].replace("-", "").replace(".", "")))) !=
               len(c["text"].replace("-", "").replace(".", "")) - 1 for c in thousands)
    # upper-integer grid case: v*2048 = N + 0.9999999
    from fractions import Fraction
    def frac(text):
        try:
            return Fraction(text)
        except ValueError:
            return None
    assert any(not c["ptbr"] and frac(c["text"]) is not None
               and frac(c["text"]) * 2048 % 1 == Fraction("0.9999999") for c in r["accel"])
    assert any(c["k"] != len(c["n"]) - 1 for c in r["log10k"])

    ts = f["timestamps"]
    assert {c["ok"] for c in ts} == {True, False}
    assert {c.get("error") for c in ts if not c["ok"]} == {"bad_timestamp", "naive_timestamp"}
    texts = {c["text"] for c in ts}
    assert "20261002T003000-0300" in texts
    assert "2026-02-30T00:00:00-03:00" in texts

    assert {"x": 1.25, "nd": 1, "value": 1.2} in f["pyround"]
