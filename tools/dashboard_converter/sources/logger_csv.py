"""Reader for the raw logger CSVs (clean ',' files and pt-BR Excel ';' re-saves).

Rows from every *.csv in the run folder are merged and stable-sorted by
timestamp; file names never decide order. Mangled cells are recovered with
tools.dashboard_converter.recover; whatever cannot be recovered becomes None
and is listed as a ValueIssue (never guessed).
"""
from __future__ import annotations

import csv
import hashlib
import statistics
from collections import Counter
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from ..model import (
    GPS_STATUS_ORIGINAL,
    GPS_STATUS_RECOVERED,
    RunData,
    SourceFile,
    StructuralError,
    ValueIssue,
)
from ..recover import (
    ACCEL_PER_G,
    alternative_accel_reading,
    is_thousands_shaped,
    parse_plain,
    recover_accel,
    recover_gps,
    resolve_scaled,
)

REQUIRED = ["timestamp", "ax_g", "ay_g", "az_g", "gps_lat", "gps_lon"]
# (RunData group, axis, column header, SCALED_RANGES kind)
SCALED_COLS = [
    ("vel", "x", "vx_mm_s", "vel"), ("vel", "y", "vy_mm_s", "vel"), ("vel", "z", "vz_mm_s", "vel"),
    ("disp", "x", "dx_um", "disp"), ("disp", "y", "dy_um", "disp"), ("disp", "z", "dz_um", "disp"),
    ("freq", "x", "freq_x_hz", "freq"), ("freq", "y", "freq_y_hz", "freq"), ("freq", "z", "freq_z_hz", "freq"),
    ("temp", "", "temperature_c", "temp"),
]
NEIGHBOUR_WINDOW = 6
AMBIGUITY_WINDOW = 3
AMBIGUITY_G = 2.0


def _read_file(path: Path, index: int, issues: list[ValueIssue], stats: Counter):
    """Parse one file -> (SourceFile, list of per-row dicts)."""
    try:
        raw = path.read_bytes()
        text = raw.decode("utf-8-sig")
    except (OSError, UnicodeDecodeError) as exc:
        raise StructuralError(f"{path.name}: unreadable ({exc})") from exc
    first = text.split("\n", 1)[0]
    delim = ";" if first.count(";") > first.count(",") else ","
    ptbr = delim == ";"
    reader = csv.reader(text.splitlines(keepends=True), delimiter=delim)
    try:
        header = next(reader)
    except StopIteration:
        raise StructuralError(f"{path.name}: empty file") from None
    header = [h.strip() for h in header]
    for col in REQUIRED:
        if col not in header:
            raise StructuralError(f"{path.name}: missing column {col}")
    pos = {h: i for i, h in enumerate(header)}

    def cell(row: list[str], col: str) -> str:
        i = pos.get(col)
        return row[i].strip() if i is not None and i < len(row) else ""

    name = path.name
    recs: list[dict] = []
    for row in reader:
        if not row or all(not c.strip() for c in row):
            continue
        line = reader.line_num
        ts_text = cell(row, "timestamp")
        try:
            ts = datetime.fromisoformat(ts_text)
        except ValueError as exc:
            raise StructuralError(f"{name}:{line}: invalid timestamp {ts_text!r}") from exc
        if ts.tzinfo is None:
            raise StructuralError(f"{name}:{line}: naive timestamp {ts_text!r}")
        rec = {"ts": ts, "line": line, "raw": row, "acc": {}, "rules": {}}
        for col, key in (("ax_g", "ax"), ("ay_g", "ay"), ("az_g", "az")):
            txt = cell(row, col)
            val, reason = recover_accel(txt, ptbr=ptbr)
            rec["acc"][key] = val
            rec["rules"][key] = reason
            if val is None:
                if reason != "empty":
                    issues.append(ValueIssue(name, line, col, txt, reason))
                    stats["unrecovered"] += 1
            else:
                stats[f"accel_{reason}"] += 1
        # GPS (pair)
        lat_t, lon_t = cell(row, "gps_lat"), cell(row, "gps_lon")
        lat, lat_r = recover_gps(lat_t, "lat", ptbr=ptbr)
        lon, lon_r = recover_gps(lon_t, "lon", ptbr=ptbr)
        for col, txt, v, r in (("gps_lat", lat_t, lat, lat_r), ("gps_lon", lon_t, lon, lon_r)):
            if v is None and r != "empty":
                issues.append(ValueIssue(name, line, col, txt, r))
                stats["unrecovered"] += 1
        if lat is None or lon is None:
            rec["lat"] = rec["lon"] = None
            rec["gps_status"] = GPS_STATUS_ORIGINAL
        else:
            rec["lat"], rec["lon"] = lat, lon
            recovered = "recovered" in (lat_r, lon_r)
            rec["gps_status"] = GPS_STATUS_RECOVERED if recovered else GPS_STATUS_ORIGINAL
            if recovered:
                stats["gps_recovered"] += 1
        rec["sensor_id"] = cell(row, "sensor_id")
        recs.append(rec)

    _resolve_scaled(recs, name, ptbr, cell, issues, stats)
    if ptbr:
        _ambiguity_audit(recs, name, cell, issues)
    sf = SourceFile(name=name, sha256=hashlib.sha256(raw).hexdigest(), rows=len(recs),
                    delimiter=delim, mode="ptbr" if ptbr else "plain")
    return sf, recs


def _resolve_scaled(recs, name, ptbr, cell, issues, stats):
    """Fill rec['sc'][col] for every scaled channel (two passes: plain, then thousands-shaped)."""
    for rec in recs:
        rec["sc"] = {}
    for _grp, _ax, col, kind in SCALED_COLS:
        plain: list[float | None] = []
        pending: list[int] = []
        for i, rec in enumerate(recs):
            txt = cell(rec["raw"], col)
            val = None
            if ptbr and is_thousands_shaped(txt):
                pending.append(i)
            else:
                try:
                    val = parse_plain(txt, ptbr=ptbr)
                except ValueError:
                    issues.append(ValueIssue(name, rec["line"], col, txt, "unrecoverable"))
                    stats["unrecovered"] += 1
            plain.append(val)
            rec["sc"][col] = val
        known = [v for v in plain if v is not None]
        col_median = statistics.median(known) if known else None
        for i in pending:
            lo, hi = max(0, i - NEIGHBOUR_WINDOW), min(len(recs), i + NEIGHBOUR_WINDOW + 1)
            neigh = [plain[j] for j in range(lo, hi) if j != i and plain[j] is not None]
            txt = cell(recs[i]["raw"], col)
            val, reason = resolve_scaled(txt, kind, neigh, col_median)
            recs[i]["sc"][col] = val
            if val is None:
                issues.append(ValueIssue(name, recs[i]["line"], col, txt, reason))
                stats["unrecovered"] += 1
            else:
                stats["scaled_recovered"] += 1


def _ambiguity_audit(recs, name, cell, issues):
    """Report (never change) k / k-1 accel readings where the other reading fits neighbours better."""
    for key, col in (("ax", "ax_g"), ("ay", "ay_g"), ("az", "az_g")):
        for i, rec in enumerate(recs):
            if rec["rules"].get(key) not in ("k", "k-1"):
                continue
            txt = cell(rec["raw"], col)
            alt = alternative_accel_reading(txt)
            if alt is None:
                continue
            lo, hi = max(0, i - AMBIGUITY_WINDOW), min(len(recs), i + AMBIGUITY_WINDOW + 1)
            neigh = [recs[j]["acc"][key] / ACCEL_PER_G for j in range(lo, hi)
                     if j != i and recs[j]["rules"].get(key) == "plain" and recs[j]["acc"][key] is not None]
            if not neigh:
                continue
            med = statistics.median(neigh)
            chosen_g = rec["acc"][key] / ACCEL_PER_G
            alt_g = alt / ACCEL_PER_G
            if abs(chosen_g - med) > AMBIGUITY_G and abs(alt_g - med) < abs(chosen_g - med):
                issues.append(ValueIssue(name, rec["line"], col, txt, "ambiguous_resolved_by_rule", chosen_g))


def read_run(run_dir: Path, *, expected_rows: int | None = None) -> RunData:
    """Read every *.csv in run_dir into one time-ordered RunData."""
    run_dir = Path(run_dir)
    files = sorted(run_dir.glob("*.csv"))
    if not files:
        raise StructuralError(f"{run_dir}: no CSV files found")
    issues: list[ValueIssue] = []
    stats: Counter = Counter()
    sources: list[SourceFile] = []
    merged: list[tuple[int, dict]] = []
    for idx, path in enumerate(files):
        sf, recs = _read_file(path, idx, issues, stats)
        sources.append(sf)
        merged.extend((idx, r) for r in recs)
    if not merged:
        raise StructuralError(f"{run_dir}: no data rows")
    merged.sort(key=lambda t: t[1]["ts"])  # stable: ties keep file-sorted order
    if expected_rows is not None and expected_rows != len(merged):
        raise StructuralError(f"recovered {len(merged)} rows, expected {expected_rows}")

    def col(cname: str) -> list[float | None]:
        return [r["sc"].get(cname) for _i, r in merged]

    ids = Counter(r["sensor_id"] for _i, r in merged if r["sensor_id"])
    for k in ("accel_plain", "accel_k", "accel_k-1", "gps_recovered", "scaled_recovered", "unrecovered"):
        stats.setdefault(k, 0)
    return RunData(
        sources=sources,
        timestamps=[r["ts"] for _i, r in merged],
        origin=[(i, r["line"]) for i, r in merged],
        ax=[r["acc"]["ax"] for _i, r in merged],
        ay=[r["acc"]["ay"] for _i, r in merged],
        az=[r["acc"]["az"] for _i, r in merged],
        vel={a: col(c) for g, a, c, _k in SCALED_COLS if g == "vel"},
        disp={a: col(c) for g, a, c, _k in SCALED_COLS if g == "disp"},
        freq={a: col(c) for g, a, c, _k in SCALED_COLS if g == "freq"},
        temp=col("temperature_c"),
        lat=[r["lat"] for _i, r in merged],
        lon=[r["lon"] for _i, r in merged],
        gps_status=[r["gps_status"] for _i, r in merged],
        sensor_id=ids.most_common(1)[0][0] if ids else "",
        issues=issues,
        recovery_stats=dict(stats),
    )
