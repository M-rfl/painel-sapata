import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from tests.test_dashboard_converter_geofence import LAT0, LON0, STEP, route, track
from tools.dashboard_converter.cli import build_parser, main
from tools.dashboard_converter.writer import load_site_json

REPO = Path(__file__).resolve().parent.parent
HEADER = ("timestamp,ax_g,ay_g,az_g,vx_mm_s,vy_mm_s,vz_mm_s,angle_x,angle_y,angle_z,temperature_c,"
          "dx_um,dy_um,dz_um,freq_x_hz,freq_y_hz,freq_z_hz,sensor_id,gps_lat,gps_lon,gps_speed_mps")
TZ = timezone(timedelta(hours=-3))


def make_stations(path: Path):
    path.mkdir()
    names = ["AAA", "BBB", "CCC", "DDD"]

    def block(order):
        out = [f"{order[0]} -> {order[-1]}"]
        for c in order:
            i = names.index(c)
            out.append(f"{c} ({c.title()}): {LAT0},{LON0 + i * STEP:.6f}")
        return out

    text = "LINHA 7:\n" + "\n".join(block(names)) + "\n\n" + "\n".join(block(names[::-1])) + "\n"
    (path / "Line7_Stat_geo.txt").write_text(text, encoding="utf-8")


def make_rows():
    pts = route(0, 3) + route(3, 0)[1:]
    pts = pts[:8] + [None] + pts[9:]          # one sem-GPS block
    lat, lon = track(pts)
    rows = []
    for i in range(len(lat)):
        ax = (112 if i % 17 == 0 else 0) / 2048
        rows.append((i, ax, lat[i], lon[i]))
    return rows


def line(ts, ax, la, lo, sep=","):
    cells = [ts.isoformat(timespec="microseconds"), repr(ax), "0.0", "-1.0", "0.0", "0.0", "0.0", "", "", "",
             "21.7", "0.0", "0.0", "0.0", "2.0", "0.0", "0.0", "wtvb01",
             "" if la is None else repr(la), "" if lo is None else repr(lo), ""]
    return sep.join(cells)


def make_run(path: Path):
    path.mkdir()
    rows = make_rows()
    half = len(rows) // 2
    t0 = datetime(2026, 10, 2, 0, 30, 0, tzinfo=TZ)
    first = [line(t0 + timedelta(milliseconds=180 * i), ax, la, lo, ";") for i, ax, la, lo in rows[:half]]
    t1 = t0 + timedelta(minutes=10)
    second = [line(t1 + timedelta(milliseconds=180 * i), ax, la, lo) for i, ax, la, lo in rows[half:]]
    (path / "3. first.csv").write_text(HEADER.replace(",", ";") + "\n" + "\n".join(first) + "\n", encoding="utf-8")
    (path / "2. second.csv").write_text(HEADER + "\n" + "\n".join(second) + "\n", encoding="utf-8")
    return len(rows)


def setup(tmp_path):
    st = tmp_path / "st"
    make_stations(st)
    run = tmp_path / "res" / "raw"
    run.parent.mkdir()
    n = make_run(run)
    return st, run, n


def args(tmp_path, st, run, out, rep, *extra):
    return [str(run), "--stations", str(st), "--out", str(out), "--report", str(rep),
            "--run-id", "test-run", *extra]


def test_end_to_end_ok(tmp_path):
    st, run, n = setup(tmp_path)
    out, rep = tmp_path / "o" / "run.json", tmp_path / "rep.md"
    assert main(args(tmp_path, st, run, out, rep)) == 0
    obj = load_site_json(out)
    assert obj["schema"] == 1 and obj["meta"]["n"] == n
    assert len(obj["accel"]["ax"]) == n
    assert len(obj["sentidos"]) == 2
    from tools.dashboard_converter.geofence import expand_runs
    assert len(expand_runs(obj["trecho_runs"], n)) == n
    text = rep.read_text(encoding="utf-8")
    assert "## Verificação exata" in text and "## Estações" in text


def test_golden_row_mismatch_exits_1(tmp_path):
    st, run, n = setup(tmp_path)
    g = tmp_path / "g.json"
    g.write_text(json.dumps({"exact": {"rows": n + 1}}), encoding="utf-8")
    out = tmp_path / "run.json"
    assert main(args(tmp_path, st, run, out, tmp_path / "r.md", "--golden", str(g))) == 1
    assert not out.exists()


def test_golden_class_counts_wrong_exits_2(tmp_path, capsys):
    st, run, n = setup(tmp_path)
    g = tmp_path / "g.json"
    g.write_text(json.dumps({"exact": {"rows": n, "class_counts": [1, 1, 1, 1, 1]}}), encoding="utf-8")
    out = tmp_path / "run.json"
    assert main(args(tmp_path, st, run, out, tmp_path / "r.md", "--golden", str(g))) == 2
    assert out.exists()
    assert "FALHA" in capsys.readouterr().out


def test_missing_stations_exits_1(tmp_path, capsys):
    _, run, _ = setup(tmp_path)
    empty = tmp_path / "empty"
    empty.mkdir()
    assert main(args(tmp_path, empty, run, tmp_path / "o.json", tmp_path / "r.md")) == 1
    assert "ERRO" in capsys.readouterr().err


def test_parser_defaults():
    ns = build_parser().parse_args(["x"])
    assert ns.stations == "Stations_GEO" and ns.radius == 100.0 and ns.terminal_radius == 200.0


def test_module_help():
    r = subprocess.run([sys.executable, "-m", "tools.dashboard_converter", "--help"],
                       cwd=REPO, capture_output=True)
    assert r.returncode == 0


def test_source_runs_and_no_reference_without_golden(tmp_path):
    st, run, n = setup(tmp_path)
    out = tmp_path / "run.json"
    assert main(args(tmp_path, st, run, out, tmp_path / "r.md")) == 0
    obj = load_site_json(out)
    assert "workbook_reference" not in obj["meta"]
    from tools.dashboard_converter.writer import expand_runs
    assert len(expand_runs(obj["source_runs"], n)) == n
    assert len(obj["source_runs"]) == 2
    first = obj["source_runs"][0][1]
    assert obj["meta"]["source"]["files"][first]["name"] == "3. first.csv"


def test_golden_embeds_reference(tmp_path):
    st, run, n = setup(tmp_path)
    g = tmp_path / "g.json"
    cc = [1, 2, 3, 4, 5]
    g.write_text(json.dumps({"exact": {"rows": n, "class_counts": cc}}), encoding="utf-8")
    out = tmp_path / "run.json"
    main(args(tmp_path, st, run, out, tmp_path / "r.md", "--golden", str(g)))
    assert load_site_json(out)["meta"]["workbook_reference"]["class_counts"] == cc
