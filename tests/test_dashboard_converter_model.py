import json
from pathlib import Path

import pytest

import tools.dashboard_converter as dc
from tools.dashboard_converter.geo import haversine_m
from tools.dashboard_converter.model import Direction, LineDef, Station

GOLDEN = Path(__file__).parent / "fixtures" / "golden_run1.json"


def test_version():
    assert dc.__version__ == "1.0.0"


def test_haversine():
    assert haversine_m(-22.9, -43.2, -22.9, -43.2) == 0
    assert haversine_m(-22.9, -43.2, -22.899, -43.2) == pytest.approx(111.2, abs=0.5)


def test_direction_line_properties():
    a, b, c = (Station(x, x, 0.0, 0.0) for x in "ABC")
    d1 = Direction(4, 0, (a, b, c))
    d2 = Direction(4, 1, (c, b, a))
    assert (d1.from_code, d1.to_code, d1.codes) == ("A", "C", ("A", "B", "C"))
    line = LineDef(4, "Linha 4", "x.txt", [d1, d2])
    assert line.codes == {"A", "B", "C"}
    assert line.terminals == {"A", "C"}


def test_golden_fixture():
    g = json.loads(GOLDEN.read_text(encoding="utf-8"))
    e = g["exact"]
    assert sum(e["class_counts"]) == e["rows"]
    assert sum(e["rows_per_file"].values()) == e["rows"]
    assert e["rows_with_gps"] + e["rows_without_gps"] == e["rows"]
    assert len(g["reference"]["workbook_trechos"]) == 21
