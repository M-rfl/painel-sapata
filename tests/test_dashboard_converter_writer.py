import json
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from tools.dashboard_converter.gps import build_fixes
from tools.dashboard_converter.model import (Assignment, LineScore, RunData, SentidoDef,
                                             SourceFile, StationPassage, TrechoDef,
                                             Turnaround, ValueIssue)
from tools.dashboard_converter.writer import (build_site_json, decode_samples, expand_runs,
                                              load_site_json, rle, write_site_json)

TZ = timezone(timedelta(hours=-3))


def make_run(n=12, step=0.1666667):
    t0 = datetime(2026, 10, 2, 0, 30, 56, 60032, tzinfo=TZ)
    coords = [("-22.9000001", "-43.2000001")] * 4 + [None] * 2 + [("-22.91", "-43.21")] * 6
    coords = coords[:n]
    none = [None] * n
    return RunData(
        sources=[SourceFile("a.csv", "abc", n, ";", "ptbr")],
        timestamps=[t0 + timedelta(seconds=step * i) for i in range(n)],
        origin=[(0, i + 2) for i in range(n)],
        ax=list(range(n)), ay=[None] + [1] * (n - 1), az=[2048] * n,
        vel={a: [1.65] * n for a in "xyz"}, disp={a: [3.0] * n for a in "xyz"},
        freq={a: [1.9] * n for a in "xyz"}, temp=[21.71] * n,
        lat=[None if c is None else Decimal(c[0]) for c in coords],
        lon=[None if c is None else Decimal(c[1]) for c in coords],
        gps_status=[0] * n, sensor_id="wtvb01",
        issues=[ValueIssue("a.csv", 3, "ax", "x", "unrecoverable"),
                ValueIssue("a.csv", 4, "ax", "y", "ambiguous_resolved_by_rule", 1.0)])


def make_assignment(n):
    return Assignment(
        line_id=4, line_scores=[LineScore(4, 17, 10, 2, 1)], ambiguous=False,
        sentidos=[SentidoDef("TIG-PXV", "Sentido 1 — Terminal Gentileza → Praça XV", 0),
                  SentidoDef("PXV-TIG", "Sentido 2", 1)],
        trechos=[TrechoDef("A-B", "Gentileza – Rodoviária", 0, 1, "A", "B"),
                 TrechoDef("B-C", "Rodoviária – Praça XV", 0, 2, "B", "C"),
                 TrechoDef("C-B", "Praça XV – Rodoviária", 1, 3, "C", "B")],
        sentido_runs=[(0, 0), (8, 1)], trecho_runs=[(0, 0), (4, 1), (8, 2)],
        flag_runs=[(0, 0), (4, 1), (6, 0)],
        passages=[StationPassage(0, 0, "B", "inferred", 159.2, 4)],
        stations_not_hit=[], turnarounds=[Turnaround(8, "terminal", "PXV", 567.34)], notes=[])


def build(n=12):
    run = make_run(n)
    return run, build_site_json(
        run, make_assignment(n), build_fixes(run), run_id="r", title="T", radius_m=100,
        terminal_radius_m=200, station_warnings=[], line_name="Linha 4",
        stations=[{"code": "TIG", "name": "Terminal Gentileza", "lat": -22.898783, "lon": -43.211369}],
        generated_at=datetime(2026, 10, 8, tzinfo=TZ))


def test_keys_and_quantization():
    _, o = build()
    assert set(o) == {"schema", "meta", "t", "accel", "channels", "stations", "sentidos", "trechos",
                      "sentido_runs", "trecho_runs", "flag_runs", "flag_bits", "gps", "fix_runs",
                      "quality"}
    assert o["schema"] == 1
    ch = o["channels"]
    assert ch["vel"]["x"][0] == 165 and ch["temp"]["v"][0] == 2171
    assert ch["freq"]["z"][0] == 19 and ch["disp"]["y"][0] == 3
    assert o["accel"]["ay"][0] is None and o["accel"]["per_g"] == 2048
    assert o["meta"]["generated_at"].endswith("-03:00")


def test_no_time_drift():
    n = 1000
    run = make_run(n)
    o = build_site_json(run, make_assignment(n), build_fixes(run), run_id="r", title="T",
                        radius_m=1, terminal_radius_m=2, station_warnings=[], line_name="L",
                        stations=[], generated_at=datetime(2026, 1, 1, tzinfo=TZ))
    dt = o["t"]["dt_ms"]
    assert dt[0] == 0
    acc = 0
    for k, d in enumerate(dt):
        acc += d
        us = (run.timestamps[k] - run.timestamps[0]) // timedelta(microseconds=1)
        assert acc == (us + 500) // 1000


def test_off_grid_raises():
    run = make_run()
    run.vel["x"][3] = 1.655
    with pytest.raises(ValueError, match=r"vel\.x\[3\]"):
        build_site_json(run, make_assignment(12), build_fixes(run), run_id="r", title="T",
                        radius_m=1, terminal_radius_m=2, station_warnings=[], line_name="L",
                        stations=[])


def test_rle():
    assert rle([0, 0, 1, 1, 1, 0]) == [[0, 0], [2, 1], [5, 0]]
    rnd = random.Random(1)
    x = [rnd.choice([-1, 0, 1, 2]) for _ in range(300)]
    assert expand_runs(rle(x), len(x)) == x


def test_write_load_decode(tmp_path):
    run, o = build()
    p = tmp_path / "sub" / "r.json"
    nbytes = write_site_json(o, p)
    raw = p.read_bytes()
    assert nbytes == len(raw)
    assert b": " not in raw and b", " not in raw
    assert "Praça".encode("utf-8") in raw
    o2 = load_site_json(p)
    s = decode_samples(o2)
    assert s["trecho_name"][0] == "Gentileza – Rodoviária" and s["trecho_name"][11] == "Praça XV – Rodoviária"
    assert s["sentido"] == expand_runs(make_assignment(12).sentido_runs, 12)
    assert s["fix"] == [0, 0, 0, 0, -1, -1, 1, 1, 1, 1, 1, 1]
    assert s["loc_key"][0] == "-22.900000,-43.200000" and s["loc_key"][4] is None
    assert s["flags"] == expand_runs(make_assignment(12).flag_runs, 12)
    assert s["loc_key"] == run_keys(run)
    assert s["t_ms"][0] == 0


def run_keys(run):
    return build_fixes(run).sample_key


def test_schema_rejected(tmp_path):
    p = tmp_path / "x.json"
    p.write_text(json.dumps({"schema": 2}), encoding="utf-8")
    with pytest.raises(ValueError):
        load_site_json(p)


def test_quality():
    _, o = build()
    q = o["quality"]
    assert (q["rows_with_gps"], q["rows_without_gps"]) == (10, 2)
    assert q["unrecovered_values"] == 1 and q["ambiguous_values"] == 1
    assert q["turnarounds"][0]["terminal"] == "PXV"
    assert q["inferred_stations"] == [{"sentido": 0, "code": "B", "min_dist_m": 159.2}]
    assert q["max_gap_index"] in range(11)
