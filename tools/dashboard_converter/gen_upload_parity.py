"""Python oracle for the browser (JS) CSV converter.

    python -m tools.dashboard_converter.gen_upload_parity
        [--stations-out site/data/stations.json] [--out tests/fixtures/upload_parity.json]

Writes (a) site/data/stations.json, the deployed station definitions the JS geofence
needs (Stations_GEO is not deployed) and (b) tests/fixtures/upload_parity.json, the
expected outputs of every Python converter stage on committed/synthetic inputs.
Every expectation is produced by calling the converter code (or the CPython builtins
it relies on); nothing is hand-written. tests/test_upload_fixture.py fails when either
committed file is stale.
"""
from __future__ import annotations

import argparse
import json
import math
import random
import tempfile
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from fractions import Fraction
from pathlib import Path
from zoneinfo import ZoneInfo

from .geo import haversine_m
from .geofence import assign
from .gps import build_fixes, key6
from .recover import (alternative_accel_reading, int_log10, is_thousands_shaped, parse_plain,
                      recover_accel, recover_gps, resolve_scaled)
from .sources.logger_csv import read_run
from .stations import display_name, geofence_overlap_warnings, load_stations
from .writer import TZ_NAME, build_site_json

SEED = 20261014
ROOT = Path(__file__).resolve().parents[2]
STATIONS_DIR = "Stations_GEO"
DEFAULT_STATIONS_OUT = "site/data/stations.json"
DEFAULT_OUT = "tests/fixtures/upload_parity.json"
GENERATOR = "python -m tools.dashboard_converter.gen_upload_parity"
RADIUS_M = 100.0
TERMINAL_RADIUS_M = 200.0
BRT = timezone(timedelta(hours=-3))
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
_US = timedelta(microseconds=1)


# ---------------------------------------------------------------- stations.json

def _warn(w) -> dict:
    return {"kind": w.kind, "message": w.message}


def _stations_dir() -> Path:
    return ROOT / STATIONS_DIR


def _site_stations(line) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for d in line.directions:
        for s in d.stations:
            if s.code not in seen:
                seen.add(s.code)
                out.append({"code": s.code, "name": display_name(s.code, s.name),
                            "lat": round(s.lat, 6), "lon": round(s.lon, 6)})
    return out


def build_stations(stations_dir: str | Path | None = None) -> dict:
    lines, warnings = load_stations(stations_dir or _stations_dir())
    out_lines = []
    for ln in sorted(lines, key=lambda l: l.line_id):
        out_lines.append({
            "line_id": ln.line_id, "name": ln.name, "source_file": ln.source_file,
            "directions": [
                {"index": d.index, "stations": [
                    {"code": s.code, "name": s.name, "lat": s.lat, "lon": s.lon,
                     "display": display_name(s.code)} for s in d.stations]}
                for d in ln.directions],
            "site_stations": _site_stations(ln),
            "overlap_warnings": [_warn(w) for w in geofence_overlap_warnings([ln], RADIUS_M)],
        })
    return {"generator": GENERATOR, "radius_m": 100, "terminal_radius_m": 200,
            "lines": out_lines, "warnings": [_warn(w) for w in warnings]}


def _dumps(x) -> str:
    return json.dumps(x, ensure_ascii=False, separators=(",", ":"))


def dumps_stations(obj: dict) -> str:
    head = ",".join(f"{_dumps(k)}:{_dumps(v)}" for k, v in obj.items() if k != "lines")
    body = ",\n".join(_dumps(l) for l in obj["lines"])
    return "{" + head + ',"lines":[\n' + body + "\n]}\n"


# ---------------------------------------------------------------- recover cases

def _grp3(digits: str) -> str:
    parts = []
    while len(digits) > 3:
        parts.insert(0, digits[-3:])
        digits = digits[:-3]
    parts.insert(0, digits)
    return ".".join(parts)


def _exact_text(fr: Fraction) -> str:
    """Exact decimal text of a Fraction whose denominator is 2^a * 5^b."""
    num, den = fr.numerator, fr.denominator
    d = Decimal(num)
    from decimal import localcontext
    with localcontext() as ctx:
        ctx.prec = 80
        d = Decimal(num) / Decimal(den)
    assert Fraction(d) == fr
    return format(d, "f")


def _mangle(v: Fraction, pad_to: int | None = None) -> str:
    """Excel pt-BR mangling: drop the decimal point, regroup digits by 3 with '.'."""
    text = _exact_text(abs(v))
    digits = text.replace(".", "")
    if pad_to is not None and len(digits.lstrip("0")) < pad_to:
        digits = digits.lstrip("0")
        digits = digits + "0" * (pad_to - len(digits))
    n = digits.lstrip("0") or "0"
    return ("-" if v < 0 else "") + _grp3(n)


def _log10k_cases():
    log10 = int_log10
    seen: dict[int, None] = {}
    bounds: list[int] = []
    for d in range(2, 21):
        lo, hi = 10 ** (d - 1), 10 ** d
        assert log10(lo) == d - 1
        while lo < hi:   # smallest n in [10^(d-1), 10^d] with int(log10(n)) >= d
            mid = (lo + hi) // 2
            if log10(mid) >= d:
                hi = mid
            else:
                lo = mid + 1
        b = lo
        if b > 10 ** (d - 1) and b - 1 >= 1:
            assert log10(b - 1) == d - 1, f"log10 not monotone around 10^{d}"
        bounds.append(b)
        for n in (10 ** d - 1, 10 ** d, b, b - 1):
            seen[n] = None
    return [{"n": str(n), "k": log10(n)} for n in seen], bounds


def _accel_cases(rng: random.Random, boundary_ns: list[int]) -> list[dict]:
    cases: list[tuple[str, bool]] = []

    def add(text, ptbr):
        cases.append((text, ptbr))

    for t in ("0.5", "-1.0625", "0.05419921875", "-0.98388671875", "2", "-2.5", "16", "-16",
              "0", "-0", "0.0", "16.0005", "-17", "abc", "1e", "", "  ", "1,5", "--1", ".5"):
        add(t, False)
    for t in ("0,5", "-0,98388671875", "0.5", "-0", "0", "1,5,5", "abc", "1e", "", "16,0005",
              "-20,5", "1.5"):
        add(t, True)
    # thousands-shaped k / k-1 outcomes
    for t in ("-10.625", "1.953.125", "-1.953.125", "10.625", "103.125", "-12.578.125",
              "-1.037.109.375", "1.000", "-1.000", "999.999", "123.456", "20.000", "16.000",
              "-16.000", "3.200.000", "10.000.000.000.000"):
        add(t, True)
    # float-repr padded cells, 15-17 digits, above 2^53 as integers
    for t in ("10.625.000.000.000.000", "-10.625.000.000.000.000", "21.650.000.000.000.000",
              "1.000.000.000.000.000", "-5.000.000.000.000.000", "9.007.199.254.740.993",
              "62.500.000.000.000.000"):
        add(t, True)
    # near power of ten: float log10 rounds up
    for t in ("999.999.999.999.999", "-999.999.999.999.999", "9.999.999.999.999.999",
              "99.999.999.999.999.999"):
        add(t, True)
    for n in boundary_ns:
        add(_grp3(str(n)), True)
        add("-" + _grp3(str(n)), True)
    # grid test close to the upper integer
    for N in (7, 100, 4095, 20000):
        for f in ("0.9999999", "0.999998", "0.0000001", "0.5", "0.0000011", "0.9999989"):
            for sign in (1, -1):
                v = sign * (Fraction(N) + Fraction(f)) / 2048
                add(_exact_text(v), False)
    add("-20.0001", False)
    add("20.0001", False)
    add("100.00000049", False)
    # random on-grid values, mangled the Excel way
    for _ in range(40):
        lsb = rng.randint(-32767, 32767)
        v = Fraction(lsb, 2048)
        r = rng.random()
        if r < 0.5:
            add(_mangle(v), True)
        elif r < 0.7:
            add(_mangle(v, pad_to=rng.choice((15, 16, 17))), True)
        elif r < 0.85:
            add(_exact_text(v).replace(".", ","), True)
        else:
            add(_exact_text(v), False)
    out, dup = [], set()
    for t, p in cases:
        if (t, p) in dup:
            continue
        dup.add((t, p))
        lsb, reason = recover_accel(t, ptbr=p)
        out.append({"text": t, "ptbr": p, "lsb": lsb, "reason": reason})
    return out


def _gps_cases(rng: random.Random) -> list[dict]:
    cases: list[tuple[str, str, bool]] = []
    for t, ax in (("-22.902445757162067", "lat"), ("-43.17458060488419", "lon"),
                  ("-22.92", "lat"), ("-22.88", "lat"), ("-43.22", "lon"), ("-43.16", "lon"),
                  ("-22.9200001", "lat"), ("-22.8799999", "lat"), ("-43.2200001", "lon"),
                  ("-22.93", "lat"), ("-22.87", "lat"), ("-43.23", "lon"), ("-43.15", "lon"),
                  ("", "lat"), ("", "lon"), ("abc", "lat"), ("-22.9x", "lat"), ("nan", "lat"),
                  ("inf", "lon"), ("-22,9", "lat")):
        cases.append((t, ax, False))
        cases.append((t, ax, True))
    for t, ax in (("-22.902.445.757.162.067", "lat"), ("-2.289.879.276.454.220", "lat"),
                  ("-4.321.121.748.034.330", "lon"), ("-43.174.580.604.884.190", "lon"),
                  ("-22.920.000", "lat"), ("22.902.445", "lat"), ("-229.024.457", "lat"),
                  ("-1.000", "lon"), ("-22.902.445.757.162.067.000", "lat")):
        cases.append((t, ax, True))
    for _ in range(8):
        lat = Decimal(rng.randint(-22919999999, -22880000001)) / Decimal(10 ** 9)
        lon = Decimal(rng.randint(-43219999999, -43160000001)) / Decimal(10 ** 9)
        cases.append((format(lat, "f"), "lat", False))
        cases.append((format(lon, "f"), "lon", False))
        cases.append((_grp3(format(lat, "f").replace(".", "").replace("-", "")).join(("-", "")), "lat", True))
    out, dup = [], set()
    for t, ax, p in cases:
        if (t, ax, p) in dup:
            continue
        dup.add((t, ax, p))
        val, reason = recover_gps(t, ax, ptbr=p)
        out.append({"text": t, "axis": ax, "ptbr": p,
                    "value": None if val is None else format(val, "f"), "reason": reason})
    return out


def _scaled_cases() -> list[dict]:
    raw = [
        ("21.650.000.000.000.000", "temp", [21.7], 21.7),
        ("21.650.000.000.000.000", "temp", [21.6, 21.7], None),
        ("21.650.000.000.000.000", "temp", [21.6, 21.7, 21.8], 21.7),
        ("21.650.000.000.000.000", "temp", [], 21.7),
        ("21.650.000.000.000.000", "temp", [], None),
        ("-12.500.000.000.000.000", "temp", [-12.4], None),
        ("990.000.000.000.000.000", "temp", [21.0], 21.0),
        ("19.000.000.000.000.000", "freq", [18.0, 20.0], 19.0),
        ("19.000.000.000.000.000", "freq", [], 19.0),
        ("1.800.000.000.000.000", "freq", [1.8], 1.8),
        ("1.500", "vel", [1.5], None),
        ("1.500", "vel", [15.0], None),
        ("1.500", "vel", [150.0], 150.0),
        ("6.553.500", "vel", [655.0], None),
        ("9.999.000", "vel", [99.0], None),
        ("10.000", "vel", [], None),
        ("100.000", "disp", [10.0], None),
        ("100.000", "disp", [100.0], None),
        ("655.350", "disp", [655.0], None),
        ("65.536.000", "disp", [655.0], None),
        ("1.250", "freq", [12.0, 13.0], None),
        ("1.250", "temp", [1.0, 1.4, 1.5, 12.0], None),
        ("1.250", "temp", [12.5, 12.0], None),
        ("2.500", "temp", [], 25.0),
        ("5.000", "temp", [5.0, 50.0], None),
        ("5.000", "temp", [27.5], None),
        ("500.000", "vel", [], None),
        ("-1.500", "temp", [-1.5], None),
        ("-100.000", "temp", [-10.0], None),
        ("9.000.000.000", "temp", [90.0], None),
        ("88.000", "temp", [], 60.0),
        ("123.456", "disp", [123.0, 124.0, 125.0, 126.0], None),
        ("-1.500", "vel", [1.5], 1.5),
        ("-5.000", "disp", [], 5.0),
        ("1.250", "temp", [6.875], None),
    ]
    out = []
    for text, kind, neigh, med in raw:
        val, reason = resolve_scaled(text, kind, list(neigh), med)
        out.append({"text": text, "kind": kind, "neighbours": neigh, "column_median": med,
                    "value": val, "reason": reason})
    return out


def _plain_cases() -> list[dict]:
    raw = [("0,5", True), ("0,5", False), ("0.5", True), ("0.5", False), ("", True), ("  ", False),
           ("-1,25", True), ("abc", True), ("1,2,3", True), ("1e3", False), ("1e-2", True),
           ("-0", False), ("-0,0", True), ("21.650", False), ("1.5.5", False), ("12,", True),
           (",5", True), ("0.1", False)]
    out = []
    for text, p in raw:
        try:
            v = parse_plain(text, ptbr=p)
            err = False
        except ValueError:
            v, err = None, True
        out.append({"text": text, "ptbr": p, "value": v, "error": err})
    return out


def _key6_cases() -> list[dict]:
    texts = ["-22.9024455", "-22.9024454", "-22.9024456", "22.0000005", "-22.0000005",
             "-22.9999995", "-22.9999994", "-43.1745806048841900", "-43.17458060488419",
             "-22.9", "-22", "-22.12345", "-22.123456", "-22.1234565", "-22.1234575",
             "0.0000005", "-0.0000005", "0.0000004", "-0.00000049999", "-43.1999995",
             "-22.902445757162067", "-22.5000005000001", "-22.8999999999999999999",
             "-22.1234564999", "-1.0000005", "-100.9999995"]
    return [{"text": t, "key": key6(Decimal(t))} for t in texts]


# ---------------------------------------------------------------- timestamps / round

def _timestamp_texts() -> list[str]:
    return [
        "2026-10-02T00:40:00.180000-03:00", "2026-10-02T00:40:00.18-03:00",
        "2026-10-02T00:40:00.1234567-03:00", "2026-10-02T00:40:00.1234567891-03:00",
        "2026-10-02T00:40:00,5-03:00", "2026-10-02T00:40:00.-03:00",
        "2026-10-02T00:40:00Z", "2026-10-02T00:40:00.5Z", "2026-10-02T00:40:00-03",
        "2026-10-02T00:40:00-0300", "2026-10-02T00:40:00-03:00", "2026-10-02T00:40:00+03:30",
        "2026-10-02T00:40:00-03:00:30", "2026-10-02T00:40:00-03:00:30.000001",
        "2026-10-02T00:40:00-0300.5", "2026-10-02T00:40:00-00:00", "2026-10-02T00:40:00+00:00",
        "2026-10-02 00:40:00-03:00", "2026-10-02X00:40:00-03:00", "2026-10-02_00:40:00-03:00",
        "20261002T003000-0300", "20261002T004000-0300", "2026-10-02T004000-03:00", "2026-10-02T00:40-03:00",
        "2026-10-02T00-03:00", "2026-W40-5T00:30:00-03:00", "0099-10-02T00:30:00-03:00",
        "2028-02-29T12:00:00-03:00", "2026-10-02T23:30:00-03:00", "2026-10-02T00:30:00+05:00",
        "2026-12-31T22:30:00-03:00", "2026-01-01T00:00:00+14:00", "1970-01-01T00:00:00+00:00",
        "1969-12-31T23:59:59.999999+00:00", "9999-12-31T23:59:59.999999+00:00",
        "0001-01-01T00:00:00+00:00", "2026-10-02T00:40:00.000000-03:00",
        "2026-10-02T00:40:00.999999-03:00", "2026-10-02T12:00:00.5+00:00",
        # rejected
        "2026-02-30T00:00:00-03:00", "2027-02-29T00:00:00-03:00", "2026-10-02T24:00:00-03:00",
        "2026-10-02T00:60:00-03:00", "2026-10-02T00:00:60-03:00", "2026-10-02T00:00:00+24:00",
        "2026-10-02T00:00:00z", " 2026-10-02T00:00:00-03:00", "2026-10-02T00:00:00-03:00 ",
        "2026-10-0200:30:00-03:00", "2026-10-02T1:30:00-03:00", "2026-275T00:30:00-03:00",
        "", "garbage", "2026-13-01T00:00:00-03:00", "2026-10-32T00:00:00-03:00",
        "2026-10-02T00:30:00-03:60", "2026-10-02T00:30:00--03:00",
        # naive
        "2026-10-02T00:30:00", "2026-10-02", "2026-10-02T00:30:00.123", "20261002",
    ]


def _timestamp_cases() -> list[dict]:
    out = []
    for text in _timestamp_texts():
        try:
            ts = datetime.fromisoformat(text)
        except ValueError:
            out.append({"text": text, "ok": False, "error": "bad_timestamp"})
            continue
        if ts.tzinfo is None:
            out.append({"text": text, "ok": False, "error": "naive_timestamp"})
            continue
        y = f"{ts.year:04d}"
        out.append({"text": text, "ok": True, "us": (ts - EPOCH) // _US, "iso": ts.isoformat(),
                    "date": f"{y}-{ts.month:02d}-{ts.day:02d}",
                    "dmy": f"{ts.day:02d}/{ts.month:02d}/{y}"})
    return out


def _pyround_cases(rng: random.Random) -> list[dict]:
    pairs: list[tuple[float, int]] = []
    for x in (1.25, 2.25, -1.25, 0.125, 0.375, -0.125, 3.75, 0.25, 1.75):
        for nd in (1, 2):
            pairs.append((x, nd))
    for x in (2.675, 2.35, 0.15, 1.005, 1.115, 8.345, 0.285, -2.675):
        pairs.append((x, 2))
    pairs.append((0.35, 1))
    pairs.append((0.45, 1))
    for x in (0.5, 1.5, 2.5, -0.5, -1.5, 3.5, 0.49999999999999994):
        pairs.append((x, 0))
    for x in (1e22, 1.5e-9, 123456789.125, -123456789.375, 0.0, -0.0, 5e-324, 1e-7):
        pairs.append((x, 1))
        pairs.append((x, 2))
    for u in (1250000, 2250000, 3350000, 1050000, 150000, 2250001, 1750000, 2750000, 250000):
        pairs.append((timedelta(microseconds=u).total_seconds(), 1))
    for _ in range(12):
        pairs.append((rng.uniform(0, 14), 2))
    pairs.append((13.885, 2))
    pairs.append((27.775, 2))
    out, seen = [], set()
    for x, nd in pairs:
        if (repr(x), nd) in seen:
            continue
        seen.add((repr(x), nd))
        out.append({"x": x, "nd": nd, "value": round(x, nd)})
    return out


# ---------------------------------------------------------------- geofence routes

def _dir_points(stations, step_m: float = 60.0) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    for a, b in zip(stations, stations[1:]):
        n = max(1, math.ceil(haversine_m(a.lat, a.lon, b.lat, b.lon) / step_m))
        for i in range(n):
            pts.append((a.lat + (b.lat - a.lat) * i / n, a.lon + (b.lon - a.lon) * i / n))
    pts.append((stations[-1].lat, stations[-1].lon))
    return pts


def _geofence_case(name: str, lines, pts: list) -> dict:
    t0 = datetime(2026, 10, 2, 8, 0, 0, tzinfo=BRT)
    stamps = [t0 + timedelta(seconds=i) for i in range(len(pts))]
    lat = [None if p is None else p[0] for p in pts]
    lon = [None if p is None else p[1] for p in pts]
    a = assign(lat, lon, lines, radius_m=RADIUS_M, terminal_radius_m=TERMINAL_RADIUS_M,
               timestamps=stamps)
    return {"name": name, "lat": lat, "lon": lon,
            "ts_us": [(s - EPOCH) // _US for s in stamps], "expected": asdict(a)}


def _geofence_cases(lines, rng: random.Random) -> list[dict]:
    by_id = {l.line_id: l for l in lines}
    l4, l1 = by_id[4], by_id[1]
    d0, d1 = l4.directions[0].stations, l4.directions[1].stations
    p0, p1 = _dir_points(d0), _dir_points(d1)
    out = []
    term_dwell = [p0[-1]] * 5
    out.append(_geofence_case("l4-terminal-turn", lines, p0 + term_dwell + p1))

    m = len(d0) - 3
    half = _dir_points(d0[: m + 1])
    out.append(_geofence_case("l4-reversal-no-terminal", lines, half + [half[-1]] * 3 + half[::-1]))

    sk = d0[5]
    skipped = []
    for la, lo in p0:
        if haversine_m(la, lo, sk.lat, sk.lon) < 300:
            la += 0.0018
        skipped.append((la, lo))
    out.append(_geofence_case("l4-skip-station", lines, skipped))

    st3 = d0[3]
    dwell = []
    for i, p in enumerate(p0):
        dwell.append(p)
        if haversine_m(p[0], p[1], st3.lat, st3.lon) < 1.0:
            dwell.extend([p] * 20)
    out.append(_geofence_case("l4-dwell", lines, dwell))

    tunnel = list(p0)
    mid = len(tunnel) // 2
    for i in range(mid, mid + 12):
        tunnel[i] = None
    for i in range(mid + 25, mid + 40):
        tunnel[i] = None
    out.append(_geofence_case("l4-tunnel", lines, tunnel))

    out.append(_geofence_case("l1-trip", lines, _dir_points(l1.directions[0].stations)))

    noisy = []
    for la, lo in p0 + p1:
        r = rng.uniform(0, 40) / 111000.0
        th = rng.uniform(0, 2 * math.pi)
        noisy.append((la + r * math.sin(th), lo + r * math.cos(th)))
    out.append(_geofence_case("noisy-l4", lines, noisy))
    out.append(_geofence_case("no-gps", lines, [None] * 40))
    return out


# ---------------------------------------------------------------- whole-file conversions

def _convert(named_texts: list[tuple[str, str]]) -> dict:
    """cli.py _run without writing outputs."""
    lines, st_warnings = load_stations(_stations_dir())
    with tempfile.TemporaryDirectory() as tmp:
        for name, text in named_texts:
            (Path(tmp) / name).write_bytes(text.encode("utf-8"))
        run = read_run(Path(tmp))
    lat = [float(x) if x is not None else None for x in run.lat]
    lon = [float(x) if x is not None else None for x in run.lon]
    assignment = assign(lat, lon, lines, radius_m=RADIUS_M, terminal_radius_m=TERMINAL_RADIUS_M,
                        timestamps=run.timestamps)
    chosen = next(l for l in lines if l.line_id == assignment.line_id)
    st_warnings = list(st_warnings) + geofence_overlap_warnings([chosen], RADIUS_M)
    fixes = build_fixes(run)
    t0 = run.timestamps[0]
    run_id = f"{t0:%Y-%m-%d}-l{assignment.line_id}"
    title = f"Linha {assignment.line_id} · {t0:%d/%m/%Y}"
    stations: list[dict] = []
    seen: set[str] = set()
    for d in chosen.directions:
        for s in d.stations:
            if s.code not in seen:
                seen.add(s.code)
                stations.append({"code": s.code, "name": display_name(s.code, s.name),
                                 "lat": s.lat, "lon": s.lon})
    obj = build_site_json(run, assignment, fixes, run_id=run_id, title=title,
                          radius_m=RADIUS_M, terminal_radius_m=TERMINAL_RADIUS_M,
                          station_warnings=st_warnings, line_name=chosen.name, stations=stations,
                          generated_at=datetime(2026, 10, 14, 12, 0, 0, tzinfo=ZoneInfo(TZ_NAME)))
    del obj["meta"]["generated_at"]
    del obj["meta"]["converter_version"]
    return obj


CSV_HEADER = ("timestamp,ax_g,ay_g,az_g,vx_mm_s,vy_mm_s,vz_mm_s,angle_x,angle_y,angle_z,"
              "temperature_c,dx_um,dy_um,dz_um,freq_x_hz,freq_y_hz,freq_z_hz,sensor_id,"
              "gps_lat,gps_lon,gps_speed_mps").split(",")
REST_LSB = (94, -38, -2018)
AMBIG_LSB = 22400                       # 10.9375 g; mangled '109.375' reads as 1.09375 g (k) and 10.9375 g (k-1)


def _synthetic_rows(rng: random.Random) -> tuple[list[dict], int]:
    """One continuous Line 4 run: direction 0, terminal dwell, direction 1. Returns (rows, split)."""
    lines, _ = load_stations(_stations_dir())
    l4 = next(l for l in lines if l.line_id == 4)
    d0, d1 = l4.directions[0].stations, l4.directions[1].stations
    p0, p1 = _dir_points(d0, 120.0), _dir_points(d1, 120.0)
    mid = len(p0) // 3
    p0 = [None if mid <= i < mid + 8 else p for i, p in enumerate(p0)]    # tunnel: 32 rows
    st3 = d0[3]
    fixes: list[tuple] = []     # (point, rows, tag)
    for p in p0:
        near = p is not None and haversine_m(p[0], p[1], st3.lat, st3.lon) < 1.0
        fixes.append((p, 18 if near else 4 if p is None else 3, ""))                          # dwell at a station
    fixes.append((p0[-1], 12, "terminal"))                                # terminal dwell, 1.25 s step
    split_fix = len(fixes)
    for p in p1:
        fixes.append((p, 3, ""))
    rows: list[dict] = []
    t_us = 0
    split = 0
    for fi, (pt, nrows, tag) in enumerate(fixes):
        if fi == split_fix:
            split = len(rows)
        for r in range(nrows):
            if rows:
                step = 100000
                if fi == 8 and r == 0:
                    step = 2250000                      # run maximum gap (round-half-even tie)
                if tag == "terminal" and r == 6:
                    step = 1250000                      # raw turnaround gap
                t_us += step
            lsb = [REST_LSB[a] + rng.randint(-30, 30) for a in range(3)]
            if rng.random() < 0.04:
                lsb[rng.randrange(3)] += rng.choice((-1, 1)) * rng.randint(4300, 9000)
            rows.append({
                "t_us": t_us, "pt": pt, "lsb": lsb,
                "vel": [rng.randint(100, 300) / 100 for _ in range(3)],
                "disp": [float(rng.randint(10, 20)) for _ in range(3)],
                "freq": [rng.randint(100, 160) / 10 for _ in range(3)],
                "temp": rng.choice((21.6, 21.65, 21.7, 21.75, 21.8)),
            })
    for k in (split + 20, split + 60):                       # forced ambiguous cells (direction 1)
        for j in range(k - 3, k + 4):                        # neighbours near 10.94 g
            rows[j]["lsb"][0] = AMBIG_LSB + rng.randint(-4, 4)
        rows[k]["lsb"][0] = AMBIG_LSB
        rows[k]["ambig"] = True
    for k, a, lsb in ((split + 90, 0, 21003), (split + 100, 1, -24567), (split + 110, 2, 22221)):
        rows[k]["lsb"][a] = lsb                              # >= 10 g off the k grid: rule k-1
        rows[k]["force"] = a
    return rows, split


def _fmt_ts(t_us: int) -> str:
    base = datetime(2026, 10, 2, 8, 0, 0, 180000, tzinfo=BRT)
    return (base + timedelta(microseconds=t_us)).isoformat(timespec="microseconds")


def _render_file(rows: list[dict], ptbr: bool, rng: random.Random, force_bad_cell: int | None) -> str:
    delim = ";" if ptbr else ","
    protect: set[int] = set()
    for i, r in enumerate(rows):
        if r.get("ambig"):
            protect.update(range(i - 4, i + 5))
    out = [delim.join(CSV_HEADER)]
    for i, r in enumerate(rows):
        cells = [_fmt_ts(r["t_us"])]
        for a in range(3):
            v = Fraction(r["lsb"][a], 2048)
            if ptbr and ((r.get("ambig") and a == 0) or r.get("force") == a):
                cells.append(_mangle(v))
            elif ptbr and i not in protect:
                x = rng.random()
                cells.append(_mangle(v) if x < 0.35 else
                             _exact_text(v).replace(".", ",") if x < 0.42 else _exact_text(v))
            else:
                cells.append(_exact_text(v))

        def scaled(val: float, pad: int | None = None) -> str:
            text = repr(val)
            if not ptbr or i in protect:
                return text
            x = rng.random()
            if val >= 1 and x < 0.2:
                return _mangle(Fraction(Decimal(text)), pad_to=pad or rng.choice((15, 16, 17)))
            if x < 0.3:
                return text.replace(".", ",")
            return text
        cells += [scaled(v) for v in r["vel"]]
        cells += ["", "", ""]
        cells.append(scaled(r["temp"], 17))
        cells += [scaled(v) for v in r["disp"]]
        cells += [scaled(v) for v in r["freq"]]
        cells.append("wtvb01")
        if r["pt"] is None:
            cells += ["", "", ""]
        else:
            for v in r["pt"]:
                text = repr(v)
                if ptbr and i not in protect and rng.random() < 0.5:
                    text = ("-" if v < 0 else "") + _grp3(text.replace("-", "").replace(".", ""))
                cells.append(text)
            cells.append("")
        if force_bad_cell is not None and i == force_bad_cell:
            cells[4] = "abc"
        out.append(delim.join(cells))
    return "\n".join(out) + "\n"


def _file_cases() -> list[dict]:
    cases: list[dict] = []
    mini = ROOT / "tests" / "fixtures" / "run_mini"
    mini_files = [{"name": p.name,
                   "text": p.read_bytes().decode("utf-8").replace("\r\n", "\n")}
                  for p in sorted(mini.glob("*.csv"))]
    cases.append({"name": "run_mini", "files": mini_files,
                  "expected": _convert([(f["name"], f["text"]) for f in mini_files])})
    rng = random.Random(SEED + 14)
    rows, split = _synthetic_rows(rng)
    text_a = _render_file(rows[:split], False, rng, None)
    rows_b = rows[split:]
    text_b = _render_file(rows_b, True, rng, 50)
    both = [{"name": "2. TIG-PXV.csv", "text": text_a}, {"name": "3. PXV-TIG.csv", "text": text_b}]
    cases.append({"name": "synthetic-l4", "files": both,
                  "expected": _convert([(f["name"], f["text"]) for f in both])})
    single = [both[1]]
    cases.append({"name": "single-ptbr", "files": single,
                  "expected": _convert([(f["name"], f["text"]) for f in single])})
    return cases


# ---------------------------------------------------------------- public

def build_fixture() -> dict:
    rng = random.Random(SEED)
    lines, _ = load_stations(_stations_dir())
    log10k, bounds = _log10k_cases()
    accel = _accel_cases(rng, [b for b in bounds] + [10 ** d - 1 for d in range(4, 21)])
    alt = [{"text": c["text"], "alt": alternative_accel_reading(c["text"])}
           for c in accel if c["ptbr"] and is_thousands_shaped(c["text"])]
    return {
        "generator": GENERATOR,
        "seed": SEED,
        "recover": {
            "accel": accel, "alt": alt, "gps": _gps_cases(rng), "scaled": _scaled_cases(),
            "plain": _plain_cases(), "key6": _key6_cases(), "log10k": log10k,
        },
        "timestamps": _timestamp_cases(),
        "pyround": _pyround_cases(rng),
        "geofence": _geofence_cases(lines, rng),
        "files": _file_cases(),
    }


def dumps_fixture(obj: dict) -> str:
    parts = []
    for k, v in obj.items():
        if k == "recover":
            sub = ",\n".join(f"{_dumps(sk)}:[\n" + ",\n".join(_dumps(c) for c in sv) + "\n]"
                             for sk, sv in v.items())
            parts.append(f'"recover":{{\n{sub}\n}}')
        elif isinstance(v, list):
            parts.append(f"{_dumps(k)}:[\n" + ",\n".join(_dumps(c) for c in v) + "\n]")
        else:
            parts.append(f"{_dumps(k)}:{_dumps(v)}")
    return "{" + ",\n".join(parts) + "}\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--stations-out", default=DEFAULT_STATIONS_OUT)
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args(argv)
    for path, text in ((args.stations_out, dumps_stations(build_stations())),
                       (args.out, dumps_fixture(build_fixture()))):
        out = Path(path)
        if not out.is_absolute():
            out = ROOT / out
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(text.encode("utf-8"))
        print(f"{out.stat().st_size / 1024:.1f} KB -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
