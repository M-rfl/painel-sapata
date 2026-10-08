from datetime import datetime, timedelta, timezone

import pytest

from tools.dashboard_converter.analysis_ref import reference_analysis
from tools.dashboard_converter.model import (
    Assignment, LineScore, RunData, SentidoDef, SourceFile, StationPassage, StructuralError,
    TrechoDef, Turnaround, ValueIssue,
)
from tools.dashboard_converter.validate import (
    golden_checks, pt_br_float, pt_br_int, read_workbook, render_report, workbook_checks,
    workbook_comparison,
)

N = 12
T0 = datetime(2026, 10, 2, 0, 30, 0, tzinfo=timezone(timedelta(hours=-3)))
AX = [0, 0, 0, 2048, 0, 0, 0, 0, 5000, 0, 0, 0]
AY = [0] * N
AZ = [-2048] * N
KEYS = [None, None, "-22.900000,-43.200000", "-22.900000,-43.200000"] + ["-22.910000,-43.210000"] * 8
TRECHO_IDS = [0] * 6 + [1] * 6


def make_assignment():
    return Assignment(
        line_id=1, line_scores=[LineScore(1, 5.0, 5, 0, 2)], ambiguous=False,
        sentidos=[SentidoDef("A-C", "Sentido 1 — A → C", 0)],
        trechos=[TrechoDef("A-B", "A – B", 0, 1, "A", "B"), TrechoDef("B-C", "B – C", 0, 2, "B", "C")],
        sentido_runs=[(0, 0)], trecho_runs=[(0, 0), (6, 1)], flag_runs=[(0, 0)],
        passages=[StationPassage(0, 0, "A", "hit", 3.0, 0), StationPassage(0, 0, "B", "inferred", 150.0, 6),
                  StationPassage(0, 0, "C", "not_reached", None, None)],
        stations_not_hit=[(0, "C", 321.5)], turnarounds=[Turnaround(8, "terminal", "C", 1.5)], notes=["nota x"])


def make_run():
    return RunData(
        sources=[SourceFile("a.csv", "ab" * 32, N, ",", "plain")],
        timestamps=[T0 + timedelta(milliseconds=180 * i) for i in range(N)],
        origin=[(0, i + 2) for i in range(N)], ax=list(AX), ay=list(AY), az=list(AZ),
        vel={}, disp={}, freq={}, temp=[], lat=[], lon=[], gps_status=[], sensor_id="s",
        issues=[ValueIssue("a.csv", 7, "ax_g", "1.2.3", "unrecoverable"),
                ValueIssue("a.csv", 9, "ay_g", "0,5", "ambiguous_resolved_by_rule", 0.5)],
        recovery_stats={"accel_recovered": 3})


def make_decoded():
    names = ["A – B", "B – C"]
    return {"ax": list(AX), "ay": list(AY), "az": list(AZ), "loc_key": list(KEYS),
            "trecho_name": [names[t] for t in TRECHO_IDS]}


def make_ref():
    d = make_decoded()
    return reference_analysis(d["ax"], d["ay"], d["az"], d["loc_key"], d["trecho_name"])


def golden_for(ref):
    return {
        "exact": {"rows": N, "rows_per_file": {"a.csv": N}, "rows_with_gps": 10, "rows_without_gps": 2,
                  "medians_lsb": ref["medians_lsb"], "class_counts": ref["class_counts"],
                  "eventos": ref["eventos"], "impactos": ref["impactos"],
                  "impacts_by_class": ref["impacts_by_class"]},
        "reference": {"pontos": ref["pontos"], "points_by_class": ref["points_by_class"],
                      "sentido_records": [N], "sentido_eventos": [ref["eventos"]],
                      "sentido_split_index": None,
                      "trecho_most_events": {"name": "A – B", "eventos": 1}},
    }


COUNTS = {"rows": N, "rows_per_file": {"a.csv": N}, "rows_with_gps": 10, "rows_without_gps": 2,
          "sentido_records": [N], "sentido_eventos": [2], "sentido_split_index": None,
          "trecho_most_events": {"name": "A – B", "eventos": 1}}


def test_pt_br_helpers():
    assert pt_br_int(21031) == "21.031"
    assert pt_br_float(1.5, 2) == "1,50"
    assert pt_br_float(1234.5, 1) == "1.234,5"


def test_golden_checks_ok_and_wrong_class_count():
    ref = make_ref()
    counts = dict(COUNTS, sentido_eventos=[ref["eventos"]])
    checks = golden_checks(ref, counts, golden_for(ref))
    assert {c.name for c in checks if c.exact} == {
        "rows", "rows_per_file", "rows_with_gps", "rows_without_gps", "medians_lsb",
        "class_counts", "eventos", "impactos", "impacts_by_class"}
    assert {c.name for c in checks if not c.exact} == {
        "pontos", "points_by_class", "sentido_records", "sentido_eventos", "sentido_split_index",
        "trecho_most_events"}
    assert all(c.ok for c in checks)
    g = golden_for(ref)
    g["exact"]["class_counts"] = [ref["class_counts"][0] + 1] + ref["class_counts"][1:]
    bad = [c for c in golden_checks(ref, counts, g) if not c.ok]
    assert [c.name for c in bad] == ["class_counts"] and bad[0].exact


def write_xlsx(path, rows, sheet="02 — DADOS TRATADOS", headers=None):
    openpyxl = pytest.importorskip("openpyxl")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet
    ws.append(["TÍTULO DA ABA"])
    ws.append(headers or ["Data/Hora", "Sentido", "Trecho (padronizado)", "AX", "AY", "AZ",
                          "AX din. (g)", "CLASSIFICAÇÃO", "Evento (1/0)", "Latitude", "Longitude",
                          "Local (chave)"])
    for r in rows:
        ws.append(r)
    wb.save(path)


def wb_rows(ref, lsb=None):
    labels = ["Normal", "Leve", "Moderado", "Severo", "Crítico"]
    rows = []
    for i in range(N):
        key = KEYS[i]
        lat, lon = (None, None) if key is None else map(float, key.split(","))
        trecho = "A – B" if i < 6 else "B – C"
        ax = AX[i] / 2048 if lsb is None else lsb[i] / 2048
        rows.append([T0.replace(tzinfo=None) + timedelta(seconds=i * 0.18), "S1", trecho, ax, 0.0, -1.0, 0.0,
                     labels[ref["class_per_row"][i]], int(ref["class_per_row"][i] >= 1), lat, lon, key])
    return rows


def test_read_workbook_synthetic(tmp_path):
    p = tmp_path / "w.xlsx"
    write_xlsx(p, wb_rows(make_ref()))
    wb = read_workbook(p)
    assert wb["n"] == N
    assert wb["trecho"][0] == "A – B" and wb["cls"][3] != "Normal"
    assert wb["ax"][3] == 1.0 and wb["lat"][0] is None
    assert wb["local"][2] == KEYS[2]


def test_read_workbook_missing_column(tmp_path):
    p = tmp_path / "w.xlsx"
    write_xlsx(p, [], headers=["Data/Hora", "CLASSIFICAÇÃO", "Evento (1/0)"])
    with pytest.raises(StructuralError):
        read_workbook(p)


def test_workbook_comparison_and_report(tmp_path):
    ref = make_ref()
    run, a, dec = make_run(), make_assignment(), make_decoded()
    p = tmp_path / "w.xlsx"
    rows = wb_rows(ref)
    # fold: label the last two rows of trecho 2 as the tunnel trecho
    for r in rows[-2:]:
        r[2] = "Central – Dentro do Túnel"
    rows[-3][2] = "Central – Gamboa"
    write_xlsx(p, rows)
    cmp = workbook_comparison(run, a, dec, ref, read_workbook(p),
                              folded={"Central – Dentro do Túnel": "Central – Gamboa"})
    assert cmp["accel_mismatch"] == {"ax": 0, "ay": 0, "az": 0}
    assert cmp["gps_mismatch"] == 0 and cmp["class_mismatch"] == 0 and cmp["time_mismatch"] == 0
    names = [r["trecho"] for r in cmp["per_trecho"]]
    assert "Central – Dentro do Túnel" not in names and "Central – Gamboa" in names
    g = next(r for r in cmp["per_trecho"] if r["trecho"] == "Central – Gamboa")
    assert g["wb"]["records"] == 3 and g["conv"]["records"] == 0
    assert cmp["folded"][0]["sum_records"] == 3
    assert all(c.ok for c in workbook_checks(cmp))

    b = cmp["boundaries"][0]
    assert b["station"] == "A" or b["station"] == "B"
    assert b["conv_index"] == 6

    checks = golden_checks(ref, dict(COUNTS, sentido_eventos=[ref["eventos"]]), golden_for(ref))
    text = render_report({
        "run_id": "t", "sources": run.sources, "line_id": 1, "line_scores": [(1, 5.0)],
        "ambiguous": False, "radius_m": 100.0, "terminal_radius_m": 200.0, "generated_at": "x",
        "checks": checks + workbook_checks(cmp), "ref": ref, "assignment": a,
        "counts": COUNTS, "comparison": cmp, "recovery_stats": run.recovery_stats,
        "issues": run.issues, "station_warnings": [], "folded": {"Central – Dentro do Túnel": "Central – Gamboa"}})
    for h in ("## Verificação exata", "## Pontos e trechos (lado a lado)", "## Estações", "## Valores recuperados"):
        assert h in text
    assert "OK" in text and "FALHA" not in text
    assert "16+17" in text and "321,5" in text and "inferidas" in text
    assert "`a.csv` linha 7" in text and "1.2.3" in text and "0,5" in text


def test_report_falha_and_mismatch_counts(tmp_path):
    ref = make_ref()
    run, a, dec = make_run(), make_assignment(), make_decoded()
    lsb = list(AX)
    lsb[0] = 10
    p = tmp_path / "w.xlsx"
    write_xlsx(p, wb_rows(ref, lsb))
    cmp = workbook_comparison(run, a, dec, ref, read_workbook(p))
    assert cmp["accel_mismatch"]["ax"] == 1
    assert not all(c.ok for c in workbook_checks(cmp))
    g = golden_for(ref)
    g["exact"]["eventos"] += 1
    checks = golden_checks(ref, COUNTS, g)
    text = render_report({
        "run_id": "t", "sources": run.sources, "line_id": 1, "line_scores": [], "ambiguous": True,
        "radius_m": 100.0, "terminal_radius_m": 200.0, "checks": checks, "ref": ref, "assignment": a,
        "counts": COUNTS})
    assert "FALHA" in text
