"""CI golden test on the committed site JSON (needs no raw data or workbook)."""
import json
from pathlib import Path

from tools.dashboard_converter.analysis_ref import reference_analysis
from tools.dashboard_converter.model import FLAG_SEM_GPS
from tools.dashboard_converter.writer import decode_samples, expand_runs, load_site_json

SITE = Path("site/data/run-2026-10-02-l4-t102.json")
GOLDEN = json.loads(Path("tests/fixtures/golden_run1.json").read_text(encoding="utf-8"))["exact"]

OBJ = load_site_json(SITE)
DEC = decode_samples(OBJ)
REF = reference_analysis(DEC["ax"], DEC["ay"], DEC["az"], DEC["loc_key"], DEC["trecho_name"])
N = OBJ["meta"]["n"]


def test_golden_exact_totals():
    assert N == GOLDEN["rows"]
    with_gps = sum(1 for f in DEC["fix"] if f != -1)
    assert with_gps == GOLDEN["rows_with_gps"]
    assert N - with_gps == GOLDEN["rows_without_gps"]
    assert REF["medians_lsb"] == GOLDEN["medians_lsb"]
    assert REF["class_counts"] == GOLDEN["class_counts"]
    assert REF["eventos"] == GOLDEN["eventos"]
    assert REF["impactos"] == GOLDEN["impactos"]
    assert REF["impacts_by_class"] == GOLDEN["impacts_by_class"]


def test_schema_and_meta():
    assert OBJ["schema"] == 1
    assert OBJ["meta"]["run_id"] == "2026-10-02-l4-t102"
    assert OBJ["meta"]["line"]["id"] == 4
    assert OBJ["accel"]["per_g"] == 2048
    for a in ("ax", "ay", "az"):
        assert all(type(v) is int for v in OBJ["accel"][a])
    assert len(OBJ["trechos"]) == 20
    assert len(OBJ["sentidos"]) == 2


def test_runs_cover_every_sample():
    for key in ("trecho_runs", "sentido_runs", "flag_runs", "fix_runs"):
        assert len(expand_runs(OBJ[key], N)) == N


def test_sem_gps_flag():
    for f, fl in zip(DEC["fix"], DEC["flags"]):
        if f == -1:
            assert fl & FLAG_SEM_GPS


def test_gps_six_decimals():
    for v in OBJ["gps"]["lat"] + OBJ["gps"]["lon"]:
        assert round(v, 6) == v


def test_file_size():
    size = SITE.stat().st_size
    print("site JSON bytes:", size)
    assert size < 2_500_000


FULL = json.loads(Path("tests/fixtures/golden_run1.json").read_text(encoding="utf-8"))


def test_source_runs_file_boundary():
    assert OBJ["source_runs"] == [[0, 1], [10839, 0]]
    assert OBJ["meta"]["source"]["files"][1]["name"] == "3. TIG-PXV.csv"
    assert len(expand_runs(OBJ["source_runs"], N)) == N


def test_workbook_reference_embedded():
    wr = OBJ["meta"]["workbook_reference"]
    for k in ("class_counts", "eventos", "impactos", "impacts_by_class"):
        assert wr[k] == FULL["exact"][k]
    assert wr["sentido_records"] == FULL["reference"]["sentido_records"]
    assert wr["sentido_eventos"] == FULL["reference"]["sentido_eventos"]


def test_file_boundary_sentido_split():
    src = expand_runs(OBJ["source_runs"], N)
    order: list[int] = []
    for s in src:
        if s not in order:
            order.append(s)
    region = [order.index(s) for s in src]
    recs = [0] * len(order)
    evs = [0] * len(order)
    for r, c in zip(region, REF["class_per_row"]):
        recs[r] += 1
        if c is not None and c >= 1:
            evs[r] += 1
    assert recs == [10839, 12544]
    assert evs == [1262, 1090]
