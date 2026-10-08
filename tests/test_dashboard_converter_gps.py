from datetime import datetime, timedelta, timezone
from decimal import Decimal

from tools.dashboard_converter.gps import build_fixes, key6, sample_key
from tools.dashboard_converter.model import RunData


def make_run(coords, step_s=1.0, status=None):
    n = len(coords)
    t0 = datetime(2026, 10, 2, 0, 0, 0, tzinfo=timezone(timedelta(hours=-3)))
    nones = [None] * n
    ch = {"x": list(nones), "y": list(nones), "z": list(nones)}
    return RunData(
        sources=[], timestamps=[t0 + timedelta(seconds=step_s * i) for i in range(n)],
        origin=[(0, i) for i in range(n)], ax=list(nones), ay=list(nones), az=list(nones),
        vel={k: list(v) for k, v in ch.items()}, disp={k: list(v) for k, v in ch.items()},
        freq={k: list(v) for k, v in ch.items()}, temp=list(nones),
        lat=[None if c is None else Decimal(c[0]) for c in coords],
        lon=[None if c is None else Decimal(c[1]) for c in coords],
        gps_status=status or [0] * n, sensor_id="s")


P = ("-22.9000001", "-43.2000001")
P2 = ("-22.9000002", "-43.2000002")  # same 6-dp key as P
Q = ("-22.9100000", "-43.2100000")


def test_key6():
    assert key6(Decimal("-22.9025225")) == "-22.902523"
    assert key6(Decimal("-43.1745806048")) == "-43.174581"
    assert key6(Decimal("-22.9")) == "-22.900000"
    assert sample_key(None, Decimal("1")) is None


def test_fix_runs_and_loc_ids():
    f = build_fixes(make_run([P, P, P, None, None, P, Q, Q, P2]))
    assert f.fix_runs == [(0, 0), (3, -1), (5, 1), (6, 2), (8, 3)]
    assert f.loc == [0, 0, 1, 0]
    assert f.loc_keys[0] == "-22.900000,-43.200000"
    assert f.lat[0] == -22.9 and f.lon[0] == -43.2


def test_speed_rules():
    # P -> Q is ~1.5 km: 1 s apart is far too fast; 100 s apart -> ~54 km/h too fast; 200 s -> gap
    f = build_fixes(make_run([P, Q], step_s=1.0))
    assert f.speed_kmh == [None, None]
    f = build_fixes(make_run([P, Q], step_s=200.0))
    assert f.speed_kmh == [None, None]
    f = build_fixes(make_run([P, Q], step_s=110.0))
    assert f.speed_kmh[0] is not None and 0 < f.speed_kmh[0] <= 50
    assert f.speed_kmh[0] == round(f.speed_kmh[0], 2)
    assert f.speed_kmh[1] is None


def test_status():
    f = build_fixes(make_run([P, P, Q], status=[0, 1, 0]))
    assert f.status == [1, 0]
