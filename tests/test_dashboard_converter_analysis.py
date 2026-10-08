from tools.dashboard_converter.analysis_ref import reference_analysis


def run(ax, ay=None, az=None, loc=None, tr=None):
    n = len(ax)
    ay = ay or [0] * n
    az = az or [0] * n
    loc = loc or [None] * n
    tr = tr or ["T"] * n
    return reference_analysis(ax, ay, az, loc, tr)


def test_medians():
    r = run([1, 2, 3], [1, 2, 3, 4][:3])
    assert r["medians_lsb"][0] == 2
    r = reference_analysis([0, 1, 5, 6], [0] * 4, [0] * 4, [None] * 4, ["T"] * 4)
    assert r["medians_lsb"][0] == 3.0
    r = reference_analysis([0, 1, 2, 4], [0] * 4, [0] * 4, [None] * 4, ["T"] * 4)
    assert r["medians_lsb"][0] == 1.5


def test_inclusive_thresholds():
    # median of ax is 0 (many zeros)
    ax = [0] * 10 + [1024, 1023, 8192, 2048, 4096]
    r = run(ax)
    c = r["class_per_row"]
    assert c[10] == 1      # exactly 0.5 g -> Leve
    assert c[11] == 0      # just below
    assert c[12] == 4      # exactly 4 g (8192? 4 g = 8192 LSB) -> Critico
    assert c[13] == 2      # exactly 1 g = 2048
    assert c[14] == 3      # exactly 2 g = 4096
    assert sum(r["class_counts"]) == len(ax)


def test_dominant_axis_tie_and_impacts():
    n = 10
    ax = [0] * n
    ay = [0] * n
    az = [0] * n
    ax[2], ay[2] = 1500, 1500
    ay[3] = 1600
    ax[7] = 1100
    r = run(ax, ay, az)
    assert r["class_per_row"][2] == 1 and r["eventos"] == 3
    assert r["impact_starts"] == [2, 7] and r["impactos"] == 2
    assert r["impacts_by_class"][1] == 2


def test_impact_class_is_max():
    ax = [0] * 6 + [1100, 3000, 1100] + [0] * 6
    r = run(ax)
    assert r["impacts_by_class"] == [0, 0, 1, 0, 0] and r["impactos"] == 1


def test_pontos_and_sem_gps_and_trecho():
    ax = [0] * 20
    ax[3], ax[4], ax[8], ax[12] = 1100, 1500, 1200, 1300
    loc = [None] * 20
    loc[3] = loc[4] = "k1"
    loc[8] = "k2"
    tr = ["A"] * 6 + ["B"] * 14
    r = run(ax, loc=loc, tr=tr)
    # k1 -> row 4 (max), k2 -> row 8, SEM GPS | B -> row 12
    assert r["point_rows"] == [4, 8, 12] and r["pontos"] == 3
    assert r["per_trecho"]["A"] == {"records": 6, "eventos": 2, "impactos": 1, "pontos": 1}
    assert r["per_trecho"]["B"]["pontos"] == 2 and r["per_trecho"]["B"]["impactos"] == 2


def test_tie_first_wins():
    ax = [0] * 10
    ax[2] = ax[5] = 1100
    r = run(ax, loc=["k"] * 10)
    assert r["point_rows"] == [2]


def test_unclassified_breaks_impacts():
    ax = [0] * 6 + [1100, None, 1100]
    r = run(ax)
    assert r["unclassified"] == 1 and r["impactos"] == 2 and r["eventos"] == 2


# ---------------------------------------------------------------- Phase 10 parameters
import json
from pathlib import Path

import pytest

from tools.dashboard_converter.analysis_ref import half_up, thresholds2
from tools.dashboard_converter.writer import decode_samples, load_site_json


def ra(ax, **kw):
    n = len(ax)
    return reference_analysis(ax, [0] * n, [0] * n, [None] * n, ["T"] * n, **kw)


def test_thresholds2_ceil():
    assert thresholds2((0.5, 1, 2, 4)) == [2048, 4096, 8192, 16384]
    assert thresholds2((0.7,)) == [2868]


def test_custom_threshold_boundary():
    ax = [0] * 10 + [1434, 1433]
    r = ra(ax, thresholds=(0.7,))
    assert r["class_per_row"][10] == 1
    assert r["class_per_row"][11] == 0


def test_half_up():
    assert half_up(2.5) == 3
    assert half_up(-2.5) == -2
    assert half_up(-4035.5) == -4035


def test_manual_offset_equals_median():
    n = 6
    ax, ay, az = [94] * n, [-38] * n, [-2018] * n
    a = reference_analysis(ax, ay, az, [None] * n, ["T"] * n)
    b = reference_analysis(ax, ay, az, [None] * n, ["T"] * n,
                           offset={"mode": "manual",
                                   "g": [0.0458984375, -0.0185546875, -0.9853515625]})
    assert a["offsets2"] == [188, -76, -4036]
    assert b["offsets2"] == [188, -76, -4036]
    assert b["medians_lsb"] == [94, -38, -2018]


def test_manual_offset_shifts_classification():
    ax = [0] * 4 + [1024]
    assert ra(ax)["class_per_row"][4] == 1
    r = ra(ax, offset={"mode": "manual", "g": [4 / 4096, 0, 0]})
    assert r["offsets2"][0] == 4
    assert r["class_per_row"][4] == 0  # dom2 = 2048 - 4 < 2048
    assert ra(ax, offset={"mode": "median"})["offsets2"] == [0, 0, 0]


def test_bad_offset_mode():
    with pytest.raises(ValueError):
        ra([0, 0], offset={"mode": "x"})


def test_gap_normal_rows():
    ax = [0] * 10
    ax[2] = ax[4] = 1100
    assert ra(ax, gap=0)["impactos"] == 2
    assert ra(ax, gap=1)["impactos"] == 1
    ax = [0] * 10
    ax[2] = ax[5] = 1100
    assert ra(ax, gap=1)["impactos"] == 2
    assert ra(ax, gap=2)["impactos"] == 1


def test_gap_counts_unclassified():
    ax = [0] * 6 + [1100, None, 1100]
    assert ra(ax, gap=0)["impactos"] == 2
    r = ra(ax, gap=1)
    assert r["impactos"] == 1 and r["eventos"] == 2 and r["unclassified"] == 1


def test_time_jump_split():
    ax = [0] * 6 + [1100, 1100]
    base = [0, 1, 2, 3, 4, 5, 6]
    assert ra(ax, t_ms=base + [6 + 2000], max_jump_ms=2000)["impactos"] == 1
    assert ra(ax, t_ms=base + [6 + 2001], max_jump_ms=2000)["impactos"] == 2
    assert ra(ax, t_ms=None)["impactos"] == 1


def test_gap_impact_peak_and_class():
    ax = [0] * 6 + [1100, 0, 3000, 0, 3000]
    r = ra(ax, gap=1)
    assert r["impactos"] == 1
    assert r["impact_peaks"] == [8]  # first maximum
    assert r["impacts_by_class"][2] == 1


SITE = Path("site/data/run-2026-10-02-l4-t102.json")
GOLDEN = json.loads(Path("tests/fixtures/golden_run1.json").read_text(encoding="utf-8"))["exact"]


def test_run1_with_time_jump_split_unchanged():
    dec = decode_samples(load_site_json(SITE))
    r = reference_analysis(dec["ax"], dec["ay"], dec["az"], dec["loc_key"],
                           dec["trecho_name"], t_ms=dec["t_ms"], max_jump_ms=2000)
    assert r["impactos"] == 1749 == GOLDEN["impactos"]
    assert r["class_counts"] == GOLDEN["class_counts"]
    assert r["eventos"] == GOLDEN["eventos"]
    assert r["impacts_by_class"] == GOLDEN["impacts_by_class"]


# ---------------------------------------------------------------- Phase 10 outputs
from tools.dashboard_converter.analysis_ref import class_digest


def _prio(ax, tr, order=None, **kw):
    n = len(ax)
    r = reference_analysis(ax, [0] * n, [0] * n, [None] * n, tr, trecho_order=order, **kw)
    return {p["trecho"]: p for p in r["priority"]}, r


def test_priority_levels():
    # median 0 (many zeros); classes: 1100 Leve(1), 2200 Moderado(2), 4500 Severo(3), 9000 Critico(4)
    ax = [0] * 20
    tr = ["Z"] * 20
    ax[1], tr[1] = 9000, "A"
    ax[3], tr[3] = 4500, "B"
    ax[5], tr[5] = 2200, "C"
    ax[7], tr[7] = 1100, "D"
    p, r = _prio(ax, tr, order=["A", "B", "C", "D", "E", "Z"])
    assert (p["A"]["level"], p["B"]["level"], p["C"]["level"], p["D"]["level"]) == (1, 2, 3, 4)
    assert p["E"] == {"trecho": "E", "level": 4, "max_cls": 0, "top_count": 0, "peak_dom2": 0}
    assert [x["trecho"] for x in r["priority"]][:4] == ["A", "B", "C", "D"]


def test_priority_ordering_within_level():
    ax = [0] * 30
    tr = ["Z"] * 30
    # A: one Critico (peak 18000 >> 16384); B: two Critico; C: one Critico, higher peak
    for i, nm, v in ((1, "A", 9000), (4, "B", 9000), (6, "B", 9000), (9, "C", 9500)):
        ax[i], tr[i] = v, nm
    p, r = _prio(ax, tr, order=["A", "B", "C"])
    assert [x["trecho"] for x in r["priority"]][:3] == ["B", "C", "A"]
    # tie on top_count and peak -> order index
    ax = [0] * 20
    tr = ["Z"] * 20
    ax[1], tr[1], ax[3], tr[3] = 9000, "A", 9000, "B"
    p, r = _prio(ax, tr, order=["B", "A"])
    assert [x["trecho"] for x in r["priority"]][:2] == ["B", "A"]


def test_priority_uses_peak_row_trecho_and_event_peak():
    ax = [0] * 20
    tr = ["Z"] * 20
    ax[1], tr[1] = 1100, "A"
    ax[2], tr[2] = 9000, "B"   # impact rows 1-2 peaks in B
    ax[6], tr[6] = 1100, "A"   # separate Leve impact in A
    p, _ = _prio(ax, tr, order=["A", "B"])
    assert p["B"]["level"] == 1 and p["B"]["top_count"] == 1
    assert p["A"]["level"] == 4 and p["A"]["max_cls"] == 1
    assert p["A"]["peak_dom2"] == 2200  # over event rows, not only peaks


def test_priority_custom_thresholds():
    ax = [0] * 10 + [1500, 0, 3000]
    tr = ["A"] * 11 + ["B"] * 2
    p, _ = _prio(ax, tr, thresholds=(0.5, 1.0))
    assert p["B"]["level"] == 1 and p["A"]["level"] == 2


def test_region_split():
    ax = [0, 1100, 0, 0, 1100, 0]
    n = 6
    r = reference_analysis(ax, [0] * n, [0] * n, [None] * n, ["T"] * n, region=[1, 1, 1, 0, 0, 0])
    assert r["region_records"] == [3, 3] and r["region_eventos"] == [1, 1]
    r = run(ax)
    assert r["region_records"] is None and r["region_eventos"] is None


def test_class_digest():
    h = 0x811C9DC5
    for b in (0x00, 0x01, 0xFF, 0x04):
        h = ((h ^ b) * 0x01000193) & 0xFFFFFFFF
    assert class_digest([0, 1, None, 4]) == f"{h:08x}"
    assert class_digest([]) == "811c9dc5"
    assert run([0, 0, 0])["class_digest"] == class_digest([0, 0, 0])


def test_run1_priority_sanity():
    # Sanity of the impact basis, NOT a workbook parity assertion.
    obj = load_site_json(SITE)
    dec = decode_samples(obj)
    names = [t["name"] for t in obj["trechos"]]
    r = reference_analysis(dec["ax"], dec["ay"], dec["az"], dec["loc_key"], dec["trecho_name"],
                           trecho_order=names)
    by = {p["trecho"]: p["max_cls"] for p in r["priority"]}
    assert [by[nm] for nm in names] == [4, 0, 4, 4, 0, 4, 4, 3, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 4, 4]
    levels = [p["level"] for p in r["priority"]]
    assert (levels.count(1), levels.count(2), levels.count(4)) == (15, 3, 2)
