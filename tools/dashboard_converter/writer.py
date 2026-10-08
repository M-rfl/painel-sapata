"""Site JSON schema v1: builder, writer, loader and per-sample decoder.

Phase 10's JS engine consumes exactly this schema; Schema 1. Keys are stable; additive optional keys since Phase 10: top-level
source_runs, meta.workbook_reference. Consumers must tolerate their absence.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from . import __version__
from .model import (ACCEL_PER_G, FLAG_EDGE, FLAG_INFERRED_STATION, FLAG_SEM_GPS,
                    Assignment, GpsFixes, RunData)

SCHEMA_VERSION = 1
TZ_NAME = "America/Sao_Paulo"
WORKBOOK_THRESHOLDS_G = [0.5, 1, 2, 4]
_US = timedelta(microseconds=1)


def rle(values: list[int]) -> list[list[int]]:
    """Run-length encode as [start_index, value] pairs."""
    out: list[list[int]] = []
    prev = object()
    for i, v in enumerate(values):
        if v != prev:
            out.append([i, v])
            prev = v
    return out


def expand_runs(runs, n: int) -> list[int]:
    out: list[int] = []
    for k, (start, val) in enumerate(runs):
        end = runs[k + 1][0] if k + 1 < len(runs) else n
        out.extend([val] * (end - start))
    return out


def _quantize(values: list[float | None], scale: int, name: str) -> list[int | None]:
    out: list[int | None] = []
    for i, v in enumerate(values):
        if v is None:
            out.append(None)
            continue
        q = round(v * scale)
        if abs(v * scale - q) > 1e-6:
            raise ValueError(f"{name}[{i}] = {v} is not on the 1/{scale} grid")
        out.append(int(q))
    return out


def _dt_ms(timestamps: list[datetime]) -> list[int]:
    t0 = timestamps[0]
    abs_ms = [((ts - t0) // _US + 500) // 1000 for ts in timestamps]
    return [0] + [abs_ms[k] - abs_ms[k - 1] for k in range(1, len(abs_ms))]


def _quality(run: RunData, assignment: Assignment, fixes: GpsFixes, station_warnings: list) -> dict:
    with_gps = sum(1 for k in fixes.sample_key if k is not None)
    warns = []
    for w in station_warnings:
        if isinstance(w, dict):
            warns.append({"kind": w["kind"], "message": w["message"]})
        else:
            warns.append({"kind": w.kind, "message": w.message})
    max_gap, max_idx = 0.0, 0
    for i in range(1, run.n):
        g = (run.timestamps[i] - run.timestamps[i - 1]).total_seconds()
        if g > max_gap:
            max_gap, max_idx = g, i - 1
    return {
        "rows_with_gps": with_gps,
        "rows_without_gps": run.n - with_gps,
        "unrecovered_values": sum(1 for x in run.issues if x.value is None),
        "ambiguous_values": sum(1 for x in run.issues if x.reason == "ambiguous_resolved_by_rule"),
        "station_file_warnings": warns,
        "inferred_stations": [
            {"sentido": p.sentido, "code": p.code, "min_dist_m": p.min_dist_m}
            for p in assignment.passages if p.status == "inferred"],
        "turnarounds": [
            {"index": t.index, "method": t.method, "terminal": t.terminal_code,
             "gap_s": None if t.gap_s is None else round(t.gap_s, 1)}
            for t in assignment.turnarounds],
        "max_gap_s": round(max_gap, 1),
        "max_gap_index": max_idx,
    }


def workbook_reference_from_golden(golden: dict, thresholds_g: list) -> dict | None:
    """Reference values embedded in meta.workbook_reference (None if golden has no KPIs)."""
    exact = golden.get("exact", {})
    ref = golden.get("reference", {})
    kpis = ("class_counts", "eventos", "impactos", "impacts_by_class")
    if not any(k in exact for k in kpis):
        return None
    out: dict = {"source": golden.get("oracle") or "golden", "thresholds_g": list(thresholds_g)}
    for k in ("medians_lsb", *kpis):
        if k in exact:
            out[k] = exact[k]
    out["sentido_basis"] = "source_file_time_order"
    for k in ("sentido_records", "sentido_eventos"):
        if k in ref:
            out[k] = ref[k]
    return out


def build_site_json(run: RunData, assignment: Assignment, fixes: GpsFixes, *, run_id: str,
                    title: str, radius_m: float, terminal_radius_m: float,
                    station_warnings: list, line_name: str, stations: list[dict],
                    generated_at: datetime | None = None,
                    reference: dict | None = None) -> dict:
    gen = generated_at or datetime.now(ZoneInfo(TZ_NAME))
    meta = {
        "run_id": run_id, "title": title, "sensor_id": run.sensor_id,
        "source": {"kind": "logger_csv", "files": [
            {"name": s.name, "sha256": s.sha256, "rows": s.rows,
             "delimiter": s.delimiter, "mode": s.mode} for s in run.sources]},
        "t0": run.timestamps[0].isoformat(), "tz": TZ_NAME, "n": run.n,
        "t_quality": "sub-second logger timestamps",
        "axes": {"ax": "Longitudinal", "ay": "Lateral", "az": "Vertical"},
        "workbook_defaults": {"thresholds_g": list(WORKBOOK_THRESHOLDS_G), "rest": "median",
                              "max_speed_kmh": 50, "max_fix_gap_s": 120},
        "line": {"id": assignment.line_id, "name": line_name, "ambiguous": assignment.ambiguous,
                 "scores": [{"line_id": s.line_id, "score": s.score} for s in assignment.line_scores]},
        "geofence": {"radius_m": radius_m, "terminal_radius_m": terminal_radius_m},
        "gps_decimals": 6, "converter_version": __version__, "generated_at": gen.isoformat(),
    }
    if reference is not None:
        meta["workbook_reference"] = reference
    ch = {
        "vel": {"unit": "mm/s", "scale": 100,
                **{a: _quantize(run.vel[a], 100, f"vel.{a}") for a in "xyz"}},
        "disp": {"unit": "um", "scale": 1,
                 **{a: _quantize(run.disp[a], 1, f"disp.{a}") for a in "xyz"}},
        "freq": {"unit": "Hz", "scale": 10,
                 **{a: _quantize(run.freq[a], 10, f"freq.{a}") for a in "xyz"}},
        "temp": {"unit": "C", "scale": 100, "v": _quantize(run.temp, 100, "temp")},
    }
    return {
        "schema": SCHEMA_VERSION,
        "meta": meta,
        "t": {"dt_ms": _dt_ms(run.timestamps)},
        "accel": {"unit": "lsb", "per_g": ACCEL_PER_G,
                  "ax": list(run.ax), "ay": list(run.ay), "az": list(run.az)},
        "channels": ch,
        "stations": [{**s, "lat": round(s["lat"], 6), "lon": round(s["lon"], 6)} for s in stations],
        "sentidos": [{"code": s.code, "name": s.name} for s in assignment.sentidos],
        "trechos": [{"id": t.id, "name": t.name, "sentido": t.sentido, "order": t.order}
                    for t in assignment.trechos],
        "sentido_runs": [list(r) for r in assignment.sentido_runs],
        "source_runs": rle([o[0] for o in run.origin]),
        "trecho_runs": [list(r) for r in assignment.trecho_runs],
        "flag_runs": [list(r) for r in assignment.flag_runs],
        "flag_bits": {"sem_gps": FLAG_SEM_GPS, "edge": FLAG_EDGE,
                      "inferred_station": FLAG_INFERRED_STATION},
        "gps": {"lat": [round(v, 6) for v in fixes.lat], "lon": [round(v, 6) for v in fixes.lon],
                "loc": list(fixes.loc), "speed_kmh": list(fixes.speed_kmh),
                "status": list(fixes.status)},
        "fix_runs": [list(r) for r in fixes.fix_runs],
        "quality": _quality(run, assignment, fixes, station_warnings),
    }


def write_site_json(obj: dict, path: Path) -> int:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    return len(text.encode("utf-8"))


def load_site_json(path: Path) -> dict:
    obj = json.loads(Path(path).read_text(encoding="utf-8"))
    if obj.get("schema") != SCHEMA_VERSION:
        raise ValueError(f"unsupported site JSON schema {obj.get('schema')!r} (expected {SCHEMA_VERSION})")
    return obj


def decode_samples(obj: dict) -> dict:
    n = obj["meta"]["n"]
    t_ms: list[int] = []
    acc = 0
    for d in obj["t"]["dt_ms"]:
        acc += d
        t_ms.append(acc)
    sentido = expand_runs(obj["sentido_runs"], n)
    trecho = expand_runs(obj["trecho_runs"], n)
    flags = expand_runs(obj["flag_runs"], n)
    fix = expand_runs(obj["fix_runs"], n)
    g = obj["gps"]
    fix_key = [f"{g['lat'][j]:.6f},{g['lon'][j]:.6f}" for j in range(len(g["lat"]))]
    names = [t["name"] for t in obj["trechos"]]
    return {
        "t_ms": t_ms,
        "ax": obj["accel"]["ax"], "ay": obj["accel"]["ay"], "az": obj["accel"]["az"],
        "sentido": sentido, "trecho": trecho,
        "trecho_name": [names[i] for i in trecho],
        "fix": fix,
        "loc_key": [None if f < 0 else fix_key[f] for f in fix],
        "flags": flags,
        "source": expand_runs(obj["source_runs"], n) if "source_runs" in obj else None,
    }
