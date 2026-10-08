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
