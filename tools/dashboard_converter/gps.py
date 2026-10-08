"""GPS fixes, 6-decimal location keys and estimated speed between fixes."""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from .geo import haversine_m
from .model import GPS_STATUS_RECOVERED, GpsFixes, RunData

_Q = Decimal("0.000001")


def key6(d: Decimal) -> str:
    """6-decimal string, ROUND_HALF_UP (Excel parity; Python round() differs)."""
    return format(Decimal(d).quantize(_Q, rounding=ROUND_HALF_UP), "f")


def sample_key(lat: Decimal | None, lon: Decimal | None) -> str | None:
    if lat is None or lon is None:
        return None
    return f"{key6(lat)},{key6(lon)}"


def build_fixes(run: RunData, *, max_speed_kmh: float = 50.0,
                max_fix_gap_s: float = 120.0) -> GpsFixes:
    keys = [sample_key(a, o) for a, o in zip(run.lat, run.lon)]
    fix_lat: list[float] = []
    fix_lon: list[float] = []
    fix_loc: list[int] = []
    loc_keys: list[str] = []
    loc_ids: dict[str, int] = {}
    status: list[int] = []
    starts: list[int] = []
    fix_runs: list[tuple[int, int]] = []

    prev: str | None | object = object()
    for i, k in enumerate(keys):
        if k is None:
            if prev is not None:
                fix_runs.append((i, -1))
            prev = None
            continue
        if k != prev:
            if k not in loc_ids:
                loc_ids[k] = len(loc_keys)
                loc_keys.append(k)
            idx = len(fix_lat)
            la, lo = k.split(",")
            fix_lat.append(float(la))
            fix_lon.append(float(lo))
            fix_loc.append(loc_ids[k])
            status.append(0)
            starts.append(i)
            fix_runs.append((i, idx))
        if run.gps_status[i] == GPS_STATUS_RECOVERED:
            status[-1] = 1
        prev = k

    speed: list[float | None] = []
    for j in range(len(fix_lat)):
        if j + 1 >= len(fix_lat):
            speed.append(None)
            continue
        dt = (run.timestamps[starts[j + 1]] - run.timestamps[starts[j]]).total_seconds()
        if dt <= 0 or dt > max_fix_gap_s:
            speed.append(None)
            continue
        d = haversine_m(fix_lat[j], fix_lon[j], fix_lat[j + 1], fix_lon[j + 1])
        v = d / dt * 3.6
        speed.append(None if v > max_speed_kmh else round(v, 2))

    return GpsFixes(lat=fix_lat, lon=fix_lon, loc=fix_loc, loc_keys=loc_keys,
                    speed_kmh=speed, status=status, fix_runs=fix_runs, sample_key=keys)
