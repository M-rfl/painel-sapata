"""Real-data behaviour tests for the raw CSV converter (skipped when the raw run is absent)."""
from pathlib import Path

import pytest

from tools.dashboard_converter.analysis_ref import reference_analysis
from tools.dashboard_converter.cli import main
from tools.dashboard_converter.geo import haversine_m
from tools.dashboard_converter.geofence import assign, expand_runs
from tools.dashboard_converter.model import FLAG_SEM_GPS
from tools.dashboard_converter.sources.logger_csv import read_run
from tools.dashboard_converter.stations import load_stations
from tools.dashboard_converter.writer import decode_samples, load_site_json

RAW = Path("Results_1st.Run/raw")
GOLDEN = Path("tests/fixtures/golden_run1.json")

pytestmark = pytest.mark.skipif(
    not RAW.exists() or not any(RAW.glob("*.csv")),
    reason="raw run data not available (CI)")


@pytest.fixture(scope="module")
def real(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("real")
    out = tmp / "run.json"
    code = main([str(RAW), "--run-id", "2026-10-02-l4-t102", "--golden", str(GOLDEN),
                 "--out", str(out), "--report", str(tmp / "report.md")])
    obj = load_site_json(out)
    dec = decode_samples(obj)
    ref = reference_analysis(dec["ax"], dec["ay"], dec["az"], dec["loc_key"], dec["trecho_name"])
    run = read_run(RAW)
    print("JSON size:", out.stat().st_size)
    return {"code": code, "obj": obj, "dec": dec, "ref": ref, "run": run, "size": out.stat().st_size}


def test_cli_exit_zero(real):
    assert real["code"] == 0


def test_counts_and_no_unrecovered_values(real):
    run = real["run"]
    assert run.n == 23383
    assert [s.rows for s in run.sources if s.name.startswith("3.")] == [10839]
    assert [s.rows for s in run.sources if s.name.startswith("2.")] == [12544]
    bad = [i for i in run.issues if i.value is None]
    assert bad == []


def test_golden_exact(real):
    ref = real["ref"]
    assert ref["class_counts"] == [21031, 1611, 512, 173, 56]
    assert ref["eventos"] == 2352
    assert ref["impactos"] == 1749
    assert ref["impacts_by_class"] == [0, 1112, 423, 159, 55]
    assert ref["medians_lsb"] == [94, -38, -2018]


def test_gps_coverage_and_flag(real):
    run, dec = real["run"], real["dec"]
    with_c = [i for i in range(run.n) if run.lat[i] is not None and run.lon[i] is not None]
    assert len(with_c) == 21363
    assert run.n - len(with_c) == 2020
    for i in range(run.n):
        if run.lat[i] is None or run.lon[i] is None:
            assert dec["flags"][i] & FLAG_SEM_GPS


def test_line_detected(real):
    line = real["obj"]["meta"]["line"]
    assert line["id"] == 4 and line["ambiguous"] is False
    scores = sorted((s["score"] for s in line["scores"]), reverse=True)
    assert scores[0] > scores[1]


def test_sentidos_and_turnaround(real):
    obj, run = real["obj"], real["run"]
    assert [s["code"] for s in obj["sentidos"]] == ["TIG-PXV", "PXV-TIG"]
    runs = obj["sentido_runs"]
    assert len(runs) == 2 and runs[0][1] == 0 and runs[1][1] == 1
    split = runs[1][0]
    pxv = next(s for s in obj["stations"] if s["code"] == "PXV")
    first_out = next(i for i in range(10839, run.n)
                     if run.lat[i] is not None
                     and haversine_m(float(run.lat[i]), float(run.lon[i]), pxv["lat"], pxv["lon"]) > 200)
    assert 10839 <= split <= first_out


def test_turnaround_details(real):
    run = real["run"]
    lines, _ = load_stations("Stations_GEO")
    lat = [float(x) if x is not None else None for x in run.lat]
    lon = [float(x) if x is not None else None for x in run.lon]
    a = assign(lat, lon, lines, timestamps=run.timestamps)
    assert len(a.turnarounds) == 1
    t = a.turnarounds[0]
    assert t.method == "terminal" and t.terminal_code == "PXV"
    assert abs(t.gap_s - 567) <= 5
    codes = {0: set(), 1: set()}
    for p in a.passages:
        if p.status == "inferred":
            codes[p.sentido].add(p.code)
    assert codes[0] == {"EQD", "CTR"}
    assert codes[1] == {"TRD", "SCT", "CDG"}
    assert {c for _, c, _ in a.stations_not_hit} == {"EQD", "CTR", "TRD", "SCT", "CDG"}


def test_trechos(real):
    obj, dec = real["obj"], real["dec"]
    n = obj["meta"]["n"]
    names = [t["name"] for t in obj["trechos"]]
    assert len(names) == 20
    assert "Central – Dentro do Túnel" not in names
    trecho = expand_runs(obj["trecho_runs"], n)
    assert len(trecho) == n
    sent = dec["sentido"]
    # within each sentido segment, trecho order is non-decreasing
    order = [t["order"] for t in obj["trechos"]]
    for seg in (0, 1):
        o = [order[trecho[i]] for i in range(n) if sent[i] == seg]
        assert all(a <= b for a, b in zip(o, o[1:]))
    # no-GPS samples between Central exit and Gamboa entry (sentido 1) sit in 'Central – Gamboa'
    idx = [i for i in range(n) if names[trecho[i]] == "Central – Gamboa"]
    assert idx
    lo, hi = idx[0], idx[-1]
    for i in range(lo, hi + 1):
        if sent[i] == 1 and dec["flags"][i] & FLAG_SEM_GPS:
            assert names[trecho[i]] == "Central – Gamboa"


def test_json_size(real):
    print("JSON bytes:", real["size"])
    assert real["size"] < 2_500_000
