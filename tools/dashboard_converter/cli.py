"""One-command converter: raw logger CSV folder -> site JSON + validation report."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .analysis_ref import reference_analysis
from .geofence import assign
from .gps import build_fixes
from .model import StructuralError
from .sources.logger_csv import read_run
from .stations import display_name, geofence_overlap_warnings, load_stations
from .validate import (golden_checks, read_workbook, render_report, workbook_checks,
                       workbook_comparison)
from .writer import (SCHEMA_VERSION, TZ_NAME, WORKBOOK_THRESHOLDS_G, build_site_json,
                     decode_samples, workbook_reference_from_golden, write_site_json)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="python -m tools.dashboard_converter",
        description="Converte CSVs brutos do logger em JSON do dashboard + relatório de validação.")
    p.add_argument("run_dir", help="pasta com os CSVs brutos da corrida")
    p.add_argument("--stations", default="Stations_GEO", help="pasta com Line*_Stat_geo.txt")
    p.add_argument("--out", default=None, help="JSON de saída (padrão site/data/run-<run_id>.json)")
    p.add_argument("--run-id", default=None, help="padrão <data>-l<linha>")
    p.add_argument("--title", default=None)
    p.add_argument("--line", type=int, default=None, help="forçar a linha (ignora a detecção)")
    p.add_argument("--radius", type=float, default=100.0, help="raio da geocerca em metros")
    p.add_argument("--terminal-radius", type=float, default=200.0, help="raio nos terminais em metros")
    p.add_argument("--golden", default=None, help="JSON golden (verificação exata)")
    p.add_argument("--workbook", default=None, help="planilha tratada (.xlsx) para comparação (lento)")
    p.add_argument("--report", default=None, help="relatório markdown (padrão ao lado da pasta da corrida)")
    return p


def _eventos_by_sentido(ref: dict, sentido: list[int], n_sentidos: int) -> list[int]:
    out = [0] * n_sentidos
    for c, s in zip(ref["class_per_row"], sentido):
        if c is not None and c >= 1:
            out[s] += 1
    return out


def _run(args) -> int:
    lines, st_warnings = load_stations(args.stations)
    if not lines:
        raise StructuralError(f"{args.stations}: no Line*_Stat_geo.txt station files found")
    golden = None
    if args.golden:
        golden = json.loads(Path(args.golden).read_text(encoding="utf-8"))
    expected = golden["exact"]["rows"] if golden else None
    run = read_run(Path(args.run_dir), expected_rows=expected)

    lat = [float(x) if x is not None else None for x in run.lat]
    lon = [float(x) if x is not None else None for x in run.lon]
    assignment = assign(lat, lon, lines, radius_m=args.radius,
                        terminal_radius_m=args.terminal_radius, line_override=args.line,
                        timestamps=run.timestamps)
    chosen = next(l for l in lines if l.line_id == assignment.line_id)
    st_warnings = list(st_warnings) + geofence_overlap_warnings([chosen], args.radius)
    fixes = build_fixes(run)

    t0 = run.timestamps[0]
    run_id = args.run_id or f"{t0:%Y-%m-%d}-l{assignment.line_id}"
    title = args.title or f"Linha {assignment.line_id} · {t0:%d/%m/%Y}"
    out_path = Path(args.out) if args.out else Path("site") / "data" / f"run-{run_id}.json"
    report_path = (Path(args.report) if args.report
                   else Path(args.run_dir).resolve().parent / f"validation-{run_id}.md")

    stations: list[dict] = []
    seen: set[str] = set()
    for d in chosen.directions:
        for s in d.stations:
            if s.code not in seen:
                seen.add(s.code)
                stations.append({"code": s.code, "name": display_name(s.code, s.name),
                                 "lat": s.lat, "lon": s.lon})

    generated = datetime.now(ZoneInfo(TZ_NAME))
    obj = build_site_json(run, assignment, fixes, run_id=run_id, title=title,
                          radius_m=args.radius, terminal_radius_m=args.terminal_radius,
                          station_warnings=st_warnings, line_name=chosen.name,
                          stations=stations, generated_at=generated,
                          reference=(workbook_reference_from_golden(golden, WORKBOOK_THRESHOLDS_G)
                                     if golden else None))
    size = write_site_json(obj, out_path)

    dec = decode_samples(obj)
    ref = reference_analysis(dec["ax"], dec["ay"], dec["az"], dec["loc_key"], dec["trecho_name"])
    n_sent = len(assignment.sentidos)
    sent_rec = [0] * n_sent
    for s in dec["sentido"]:
        sent_rec[s] += 1
    most = max(ref["per_trecho"].items(), key=lambda kv: kv[1]["eventos"])
    with_gps = sum(1 for k in fixes.sample_key if k is not None)
    counts = {
        "rows": run.n,
        "rows_per_file": {s.name: s.rows for s in run.sources},
        "rows_with_gps": with_gps, "rows_without_gps": run.n - with_gps,
        "sentido_records": sent_rec,
        "sentido_eventos": _eventos_by_sentido(ref, dec["sentido"], n_sent),
        "sentido_split_index": assignment.sentido_runs[1][0] if len(assignment.sentido_runs) > 1 else None,
        "trecho_most_events": {"name": most[0], "eventos": most[1]["eventos"]},
    }
    checks = golden_checks(ref, counts, golden) if golden else []
    comparison = None
    if args.workbook:
        print("Lendo a planilha (pode levar alguns minutos)...", flush=True)
        comparison = workbook_comparison(run, assignment, dec, ref, read_workbook(args.workbook),
                                         folded=(golden or {}).get("reference", {}).get("folded_trechos"))
        checks += workbook_checks(comparison)

    ctx = {
        "run_id": run_id, "sources": run.sources, "line_id": assignment.line_id,
        "line_scores": [(s.line_id, s.score) for s in assignment.line_scores],
        "ambiguous": assignment.ambiguous, "radius_m": args.radius,
        "terminal_radius_m": args.terminal_radius, "generated_at": generated.isoformat(),
        "checks": checks, "ref": ref, "assignment": assignment, "counts": counts,
        "comparison": comparison, "recovery_stats": run.recovery_stats, "issues": run.issues,
        "station_warnings": st_warnings,
        "folded": (golden or {}).get("reference", {}).get("folded_trechos"),
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(render_report(ctx), encoding="utf-8")

    print(f"Corrida {run_id}: {run.n} linhas, linha {assignment.line_id}"
          + (" (AMBÍGUA)" if assignment.ambiguous else ""))
    for c in checks:
        if c.exact:
            print(f"  [{'OK' if c.ok else 'FALHA'}] {c.name}: esperado {c.expected} / obtido {c.actual}")
    print(f"JSON: {out_path} ({size / 1024:.1f} KB, schema {SCHEMA_VERSION})")
    print(f"Relatório: {report_path}")
    inferred = sum(1 for p in assignment.passages if p.status == "inferred")
    unrec = sum(1 for i in run.issues if i.value is None)
    print(f"Estações inferidas: {inferred}; nunca atingidas: {len(assignment.stations_not_hit)}; "
          f"valores não recuperados: {unrec}; avisos de estações: {len(st_warnings)}")
    return 2 if any(c.exact and not c.ok for c in checks) else 0


def main(argv=None) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError, OSError):
            pass
    args = build_parser().parse_args(argv)
    try:
        return _run(args)
    except StructuralError as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
