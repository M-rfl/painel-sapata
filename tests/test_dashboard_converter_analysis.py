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
