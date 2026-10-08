import math
import random
from datetime import datetime, timedelta
from pathlib import Path

from tools.dashboard_converter.geo import haversine_m
from tools.dashboard_converter.geofence import assign, expand_runs, score_lines
from tools.dashboard_converter.model import (
    FLAG_EDGE, FLAG_INFERRED_STATION, FLAG_SEM_GPS, Direction, LineDef, Station,
)
from tools.dashboard_converter.stations import load_stations

LAT0, LON0, STEP = -22.90, -43.25, 0.01
M_PER_DEG_LON = 111194.9 * math.cos(math.radians(22.9))


def make_line(line_id, codes, start=(LAT0, LON0), step_deg=STEP):
    sts = tuple(Station(c, c, start[0], start[1] + i * step_deg) for i, c in enumerate(codes))
    fwd = Direction(line_id, 0, sts)
    bwd = Direction(line_id, 1, tuple(reversed(sts)))
    return LineDef(line_id, f"Linha {line_id}", "x", [fwd, bwd])


def pos(i, off_m=0.0, lat_off_m=0.0):
    """Point at station index i (+ along-track offset in metres)."""
    return (LAT0 + lat_off_m / 111194.9, LON0 + i * STEP + off_m / M_PER_DEG_LON)


def path(x_from, x_to, step_m=300.0):
    """Points along the track between station coordinates, always through integer stations."""
    sign = 1 if x_to > x_from else -1
    marks = [x_from]
    u = math.floor(x_from) + 1 if sign > 0 else math.ceil(x_from) - 1
    while (u < x_to - 1e-9) if sign > 0 else (u > x_to + 1e-9):
        marks.append(float(u))
        u += sign
    marks.append(x_to)
    pts = [pos(marks[0])]
    for a, b in zip(marks, marks[1:]):
        total = abs(b - a) * STEP * M_PER_DEG_LON
        k = max(1, math.ceil(total / step_m))
        for t in range(1, k + 1):
            pts.append(pos(a + (b - a) * t / k))
    return pts


def track(points, per_fix=5):
    lat, lon = [], []
    for pt in points:
        for _ in range(per_fix):
            if pt is None:
                lat.append(None)
                lon.append(None)
            else:
                lat.append(pt[0])
                lon.append(pt[1])
    return lat, lon


def route(*xs):
    pts = []
    for a, b in zip(xs, xs[1:]):
        seg = path(a, b)
        pts.extend(seg if not pts else seg[1:])
    return pts


LINE1 = make_line(1, ["A", "B", "C", "D", "E"])
def _line2():
    sts = (Station("Z", "Z", LAT0, LON0 - STEP),) + LINE1.directions[0].stations[1:]
    return LineDef(2, "Linha 2", "x", [Direction(2, 0, sts), Direction(2, 1, tuple(reversed(sts)))])


LINE2 = _line2()


def test_score_picks_line_and_penalises_off_line():
    lat, lon = track(route(0, 4))
    scores = score_lines(lat, lon, [LINE2, LINE1])
    assert scores[0].line_id == 1
    assert scores[0].score > scores[1].score
    assert scores[1].off_line >= 1


def test_ambiguous_and_override():
    la = make_line(1, ["A", "B", "C"])
    lb = make_line(2, ["A", "B", "C"])
    lat, lon = track(route(0, 2))
    a = assign(lat, lon, [la, lb])
    assert a.ambiguous
    assert any("1" in n and "2" in n for n in a.notes)
    a = assign(lat, lon, [la, lb], line_override=2)
    assert a.line_id == 2 and not a.ambiguous
    assert any("override" in n for n in a.notes)


def test_forward_trip_single_segment():
    lat, lon = track(route(0, 4))
    a = assign(lat, lon, [LINE1, LINE2])
    assert a.line_id == 1
    assert [s for _, s in a.sentido_runs] == [0]
    assert a.turnarounds == []
    assert all(p.status == "hit" for p in a.passages if p.sentido == 0)
    assert a.stations_not_hit == []
    assert [t.id for t in a.trechos] == ["A-B", "B-C", "C-D", "D-E", "E-D", "D-C", "C-B", "B-A"]
    assert [t.order for t in a.trechos] == list(range(1, 9))
    assert a.sentidos[0].name == "Sentido 1 — A → E"
    assert a.sentidos[1].name == "Sentido 2 — E → A"
    assert a.trechos[0].name == "A – B"
    n = len(lat)
    tr = expand_runs(a.trecho_runs, n)
    assert tr[0] == 0 and tr[-1] == 3
    assert tr == sorted(tr)


def test_terminal_turnaround():
    pts = route(0, 3.85) + [pos(4, -150)] + route(3.85, 0)[1:]
    # approach E to 150 m (inside terminal radius, outside radius)
    pts = route(0, 3.9) + [pos(4, -150), pos(4, -150), pos(3.9)] + route(3.9, 0)[1:]
    lat, lon = track(pts)
    a = assign(lat, lon, [LINE1])
    assert len(a.turnarounds) == 1
    t = a.turnarounds[0]
    assert t.method == "terminal" and t.terminal_code == "E"
    assert [s for _, s in a.sentido_runs] == [0, 1]
    assert a.sentido_runs[1][0] == t.index
    # first sample outside E's 200 m after arrival
    assert haversine_m(lat[t.index], lon[t.index], LAT0, LON0 + 4 * STEP) > 200
    assert haversine_m(lat[t.index - 1], lon[t.index - 1], LAT0, LON0 + 4 * STEP) <= 200
    assert [p.status for p in a.passages if p.segment == 0] == ["hit"] * 5
    # dwell samples belong to sentido 0
    sent = expand_runs(a.sentido_runs, len(lat))
    assert sent[t.index - 1] == 0


def test_reversal_turnaround():
    pts = route(0, 3) + [pos(3.0, 400), pos(3.0, 700), pos(3.0, 400)] + route(3, 0)[1:]
    lat, lon = track(pts)
    a = assign(lat, lon, [LINE1])
    assert len(a.turnarounds) == 1
    t = a.turnarounds[0]
    assert t.method == "reversal" and t.terminal_code == "E"
    # sample with minimum distance to E
    e = (LAT0, LON0 + 4 * STEP)
    c = [i for i in range(len(lat)) if lat[i] is not None]
    # the turnaround is at the peak (first of the 5 repeated peak samples)
    d_at = haversine_m(lat[t.index], lon[t.index], *e)
    assert d_at == min(haversine_m(lat[i], lon[i], *e) for i in c if i >= 15 * 0)
    assert d_at > 200
    seg0 = {p.code: p.status for p in a.passages if p.segment == 0}
    assert seg0["E"] == "inferred"
    assert (0, "E") in [(s, c_) for s, c_, _ in a.stations_not_hit]
    assert [s for _, s in a.sentido_runs] == [0, 1]


def test_noisy_backward_hit_does_not_flip():
    pts = route(0, 2) + [pos(2, 500), pos(2, 0)] + [pos(2, 700)] + route(2.7, 4)
    pts = route(0, 2.5) + [pos(2.0)] + route(2.5, 4)[1:]
    lat, lon = track(pts)
    a = assign(lat, lon, [LINE1])
    assert a.turnarounds == []
    assert [s for _, s in a.sentido_runs] == [0]


def test_gap_s():
    pts = route(0, 3.9) + [pos(4, -150), pos(4, -150), pos(3.9)] + route(3.9, 0)[1:]
    lat, lon = track(pts)
    ts = [datetime(2025, 1, 1) + timedelta(seconds=i) for i in range(len(lat))]
    ts = [t + timedelta(seconds=500) if i > 120 else t for i, t in enumerate(ts)]
    a = assign(lat, lon, [LINE1], timestamps=ts)
    assert a.turnarounds[0].gap_s is not None


def test_dwell_boundary():
    # dwell at B (several fixes within 100 m) then move on
    pts = route(0, 1) + [pos(1, 30), pos(1, 60), pos(1, 90)] + route(1, 4)[1:]
    lat, lon = track(pts)
    a = assign(lat, lon, [LINE1])
    n = len(lat)
    tr = expand_runs(a.trecho_runs, n)
    b = (LAT0, LON0 + STEP)
    for i in range(n):
        d = haversine_m(lat[i], lon[i], *b)
        if tr[i] == 1:  # B-C
            assert i > 0
    first_bc = tr.index(1)
    assert haversine_m(lat[first_bc], lon[first_bc], *b) > 100
    assert haversine_m(lat[first_bc - 1], lon[first_bc - 1], *b) <= 100
    assert tr[first_bc - 1] == 0


def test_skipped_station():
    pts = route(0, 1) + [pos(2, 0, 250)] if False else None
    # B -> (C missed by 250 m) -> D
    pts = route(0, 1.6) + [pos(2, 0, 250)] + route(2.4, 4)
    lat, lon = track(pts)
    a = assign(lat, lon, [LINE1])
    st = {p.code: p.status for p in a.passages if p.segment == 0}
    assert st["C"] == "inferred"
    assert (0, "C") in [(s, c) for s, c, _ in a.stations_not_hit]
    ids = [t.id for t in a.trechos]
    assert "B-D" not in ids
    n = len(lat)
    tr = expand_runs(a.trecho_runs, n)
    fl = expand_runs(a.flag_runs, n)
    cd = ids.index("C-D")
    bc = ids.index("B-C")
    first_cd = tr.index(cd)
    # trecho C-D starts at the sample closest to C between B boundary and D entry
    c = (LAT0, LON0 + 2 * STEP)
    cand = [i for i in range(n) if tr[i] in (bc, cd)]
    closest = min(cand, key=lambda i: haversine_m(lat[i], lon[i], *c))
    assert first_cd == closest
    assert all(fl[i] & FLAG_INFERRED_STATION for i in range(n) if tr[i] in (bc, cd))
    assert [x for x in tr] == sorted(tr)


def test_skipped_without_samples_between():
    # B then jump straight to D: no sample strictly between B boundary and D entry
    pts = route(0, 1) + [pos(3, -90)] + route(3, 4)[1:]
    lat, lon = track(pts)
    a = assign(lat, lon, [LINE1])
    st = {p.code: p.status for p in a.passages if p.segment == 0}
    assert st["C"] == "inferred"
    bnds = [p.boundary_idx for p in a.passages if p.segment == 0 and p.boundary_idx is not None]
    assert bnds == sorted(bnds)
    assert "B-D" not in [t.id for t in a.trechos]
    n = len(lat)
    tr = expand_runs(a.trecho_runs, n)
    assert tr == sorted(tr)


def test_no_gps_blocks_and_edges():
    base = route(0, 4)
    k = next(i for i, p in enumerate(base) if abs(p[1] - (LON0 + 2 * STEP)) < 1e-9)
    k += 1  # gap starts after the first fix that left C
    pts = [None, None] + base[:k + 1] + [None, None, None] + base[k + 1:]
    lat, lon = track(pts)
    a = assign(lat, lon, [LINE1])
    n = len(lat)
    tr = expand_runs(a.trecho_runs, n)
    fl = expand_runs(a.flag_runs, n)
    assert fl[0] & FLAG_SEM_GPS and fl[0] & FLAG_EDGE
    gap_start = 10 + 5 * (k + 1)
    for i in range(gap_start, gap_start + 15):
        assert lat[i] is None and fl[i] & FLAG_SEM_GPS
        assert tr[i] == 2  # C-D
    # ends dwelling at the final terminal: no edge flag at the end
    assert not fl[-1] & FLAG_EDGE


def test_edges_before_first_and_after_last():
    pts = [pos(-0.4)] + route(0, 2.3)
    lat, lon = track(pts)
    a = assign(lat, lon, [LINE1])
    fl = expand_runs(a.flag_runs, len(lat))
    assert fl[0] & FLAG_EDGE
    assert fl[-1] & FLAG_EDGE


def test_coverage_property_with_none_blocks():
    rng = random.Random(9)
    base = route(0, 4) + route(4, 0)[1:]
    pts = []
    for p in base:
        pts.append(None if rng.random() < 0.15 else p)
    lat, lon = track(pts)
    a = assign(lat, lon, [LINE1])
    n = len(lat)
    for runs in (a.sentido_runs, a.trecho_runs, a.flag_runs):
        assert runs[0][0] == 0
        assert [s for s, _ in runs] == sorted(set(s for s, _ in runs))
    assert len(expand_runs(a.trecho_runs, n)) == n
    assert a.sentido_runs[0][0] == 0
    fl = expand_runs(a.flag_runs, n)
    for i in range(n):
        if lat[i] is None:
            assert fl[i] & FLAG_SEM_GPS
        else:
            assert not fl[i] & FLAG_SEM_GPS
    # trecho order non-decreasing within each sentido segment
    tr = expand_runs(a.trecho_runs, n)
    se = expand_runs(a.sentido_runs, n)
    for i in range(1, n):
        if se[i] == se[i - 1]:
            assert tr[i] >= tr[i - 1]


def test_line1_real_file_both_directions():
    lines, _ = load_stations(Path(__file__).resolve().parent.parent / "Stations_GEO")
    l1 = next(l for l in lines if l.line_id == 1)
    pts = []
    for d in l1.directions:
        sts = d.stations
        for a, b in zip(sts, sts[1:]):
            dist = haversine_m(a.lat, a.lon, b.lat, b.lon)
            k = max(1, int(dist // 60))
            for t in range(k):
                f = t / k
                pts.append((a.lat + (b.lat - a.lat) * f, a.lon + (b.lon - a.lon) * f))
        pts.append((sts[-1].lat, sts[-1].lon))
    lat, lon = track(pts, per_fix=2)
    a = assign(lat, lon, lines)
    assert a.line_id == 1
    assert [s for _, s in a.sentido_runs] == [0, 1]
    tr = [t for _, t in a.trecho_runs]
    assert tr == list(range(len(a.trechos)))
