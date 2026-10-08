from pathlib import Path

from tools.dashboard_converter.stations import (
    DISPLAY_NAMES, display_name, geofence_overlap_warnings, load_stations,
    parse_station_file,
)

STATIONS_DIR = Path(__file__).resolve().parent.parent / "Stations_GEO"


def _write(tmp_path, name, text):
    p = tmp_path / name
    p.write_bytes(text.encode("utf-8"))
    return p


def kinds(ws):
    return [w.kind for w in ws]


def test_synthetic_quirks(tmp_path):
    text = (
        "LINHA 9:\r\n"
        "AAA ->  CCC\r\n"
        "AAA (ALFA):-22.90, -43.20\r\n"
        "xyz\r\n"
        "BBB (PRAÇA XV):   -22.91,-43.21\r\n"
        "CCC (CHARLIE): -22.92, -43.22\r\n"
        "\r\n"
        "CCC -> AAA\r\n"
        "CCC (CHARLIE): -22.92, -43.22\r\n"
        "AAA (ALFA): -22.90, -43.20"
    )
    line, warns = parse_station_file(_write(tmp_path, "Line9_Stat_geo.txt", text))
    assert line.line_id == 9
    assert len(line.directions) == 2
    assert line.directions[0].codes == ("AAA", "BBB", "CCC")
    assert line.directions[0].stations[1].name == "PRAÇA XV"
    assert kinds(warns) == ["unparsed_line"]
    assert warns[0].line_no == 4


def test_real_files():
    lines, warns = load_stations(STATIONS_DIR)
    assert [l.line_id for l in lines] == [1, 2, 3, 4]
    l4 = lines[3]
    assert l4.directions[0].codes == ("TIG", "RDV", "EQD", "PRE", "VOL", "CTR", "COT", "SAR", "TRD", "CLB", "PXV")
    assert l4.directions[1].codes == ("PXV", "CLB", "TRD", "SAR", "COT", "CTR", "GMB", "SCT", "CDG", "RDV", "TIG")
    bad = {"identical_coordinates", "conflicting_coordinates", "unparsed_line",
           "duplicate_code_in_direction", "header_mismatch"}
    assert not [w for w in warns if w.kind in bad], warns
    for l in lines:
        for d in l.directions:
            for s in d.stations:
                assert s.code in DISPLAY_NAMES


def test_identical_and_conflicting(tmp_path):
    d = tmp_path / "s"
    d.mkdir()
    _write(d, "Line1_Stat_geo.txt",
           "AAA -> CCC\nAAA (A): -22.9, -43.2\nBBB (B): -22.9, -43.2\nCCC (C): -22.95, -43.25\n")
    _write(d, "Line2_Stat_geo.txt",
           "CCC -> DDD\nCCC (C): -22.96, -43.25\nDDD (D): -23.0, -43.3\n")
    _, warns = load_stations(d)
    ks = kinds(warns)
    assert "identical_coordinates" in ks
    assert "conflicting_coordinates" in ks


def test_duplicate_and_header_mismatch(tmp_path):
    p = _write(tmp_path, "Line5_Stat_geo.txt",
               "AAA -> CCC\nAAA (A): -22.9, -43.2\nBBB (B): -22.91, -43.21\nBBB (B): -22.91, -43.21\nDDD (D): -22.95, -43.25\n")
    _, warns = parse_station_file(p)
    ks = kinds(warns)
    assert "duplicate_code_in_direction" in ks
    assert "header_mismatch" in ks


def test_geofence_overlap(tmp_path):
    p = _write(tmp_path, "Line5_Stat_geo.txt",
               "AAA -> CCC\nAAA (A): -22.9000, -43.2\nBBB (B): -22.9010, -43.2\nCCC (C): -22.9200, -43.2\n")
    line, _ = parse_station_file(p)
    ws = geofence_overlap_warnings([line], radius_m=100)
    assert kinds(ws) == ["geofence_overlap"]
    assert geofence_overlap_warnings([line], radius_m=40) == []


def test_display_names():
    assert display_name("COT") == "Cristiano Ottoni/Pequena África"
    expected = {"TIG": "Terminal Gentileza", "RDV": "Rodoviária", "EQD": "Equador",
                "PRE": "Pereira Reis", "VOL": "Vila Olímpica", "CTR": "Central",
                "SAR": "Saara", "TRD": "Tiradentes", "CLB": "Colombo", "PXV": "Praça XV",
                "GMB": "Gamboa", "SCT": "Santo Cristo", "CDG": "Cordeiro da Graça"}
    for k, v in expected.items():
        assert display_name(k) == v
    assert display_name("ZZZ") == "ZZZ"
    assert display_name("ZZZ", "foo bar") == "Foo Bar"
