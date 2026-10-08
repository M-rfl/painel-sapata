import hashlib
from decimal import Decimal
from pathlib import Path

import pytest

from tools.dashboard_converter.model import (
    GPS_STATUS_ORIGINAL,
    GPS_STATUS_RECOVERED,
    StructuralError,
)
from tools.dashboard_converter.sources.logger_csv import read_run

MINI = Path(__file__).parent / "fixtures" / "run_mini"
REAL = Path("Results_1st.Run/raw")


@pytest.fixture(scope="module")
def run():
    return read_run(MINI)


def test_merge_sorted_by_timestamp_not_filename(run):
    assert run.n == 18
    assert run.timestamps == sorted(run.timestamps)
    # ';' file '3. A-B.csv' (00:30) precedes ',' file '2. B-A.csv' (00:40)
    assert [run.sources[i].name for i, _ in run.origin[:12]] == ["3. A-B.csv"] * 12
    assert [run.sources[i].name for i, _ in run.origin[12:]] == ["2. B-A.csv"] * 6


def test_sources_metadata(run):
    by = {s.name: s for s in run.sources}
    a, b = by["3. A-B.csv"], by["2. B-A.csv"]
    assert (a.delimiter, a.mode, a.rows) == (";", "ptbr", 12)
    assert (b.delimiter, b.mode, b.rows) == (",", "plain", 6)
    assert a.sha256 == hashlib.sha256((MINI / "3. A-B.csv").read_bytes()).hexdigest()
    assert run.sensor_id == "wtvb01"


def test_accel_recovery(run):
    assert run.ax[:4] == [111, -2176, 768, None]
    assert run.az[:4] == [-2112, -2576, -2124, 20815]
    assert run.ay[0] == -256


def test_unrecoverable_reported(run):
    iss = [i for i in run.issues if i.column == "ax_g"]
    assert len(iss) == 1
    i = iss[0]
    assert (i.file, i.raw, i.reason) == ("3. A-B.csv", "1.234.567", "off_grid")
    assert i.line == 5  # header = line 1, row index 3 -> line 5


def test_scaled_recovery(run):
    assert run.temp[4] == 21.65
    assert run.freq["x"][1] == 1.9
    assert run.vel["x"][6] == 1.65


def test_gps_recovery(run):
    assert run.lat[0] == Decimal("-22.89879276454220")
    assert run.lon[0] == Decimal("-43.21121748034330")
    assert run.gps_status[0] == GPS_STATUS_RECOVERED
    assert run.lat[8] is None and run.lon[9] is None
    assert run.lat[12] == Decimal("-22.902445757162067")
    assert run.gps_status[12] == GPS_STATUS_ORIGINAL
    assert run.lat[14] is None  # empty GPS in the clean file


def test_recovery_stats(run):
    s = run.recovery_stats
    assert s["accel_k"] > 0 and s["accel_k-1"] == 1
    assert s["accel_plain"] > 0 and s["gps_recovered"] == 10
    assert s["scaled_recovered"] == 3
    assert s["unrecovered"] == 1


def test_missing_column(tmp_path):
    (tmp_path / "a.csv").write_text("timestamp,ax_g,ay_g,gps_lat,gps_lon\n", encoding="utf-8")
    with pytest.raises(StructuralError, match="a.csv.*az_g"):
        read_run(tmp_path)


def test_empty_folder(tmp_path):
    with pytest.raises(StructuralError):
        read_run(tmp_path)


def test_expected_rows_mismatch():
    with pytest.raises(StructuralError, match="expected 99"):
        read_run(MINI, expected_rows=99)


@pytest.mark.skipif(not REAL.exists(), reason="real run data not present")
def test_real_run_if_present():
    r = read_run(REAL)
    assert r.n == 23383
    bad = [i for i in r.issues
           if i.column in ("ax_g", "ay_g", "az_g", "gps_lat", "gps_lon")
           and i.reason != "ambiguous_resolved_by_rule"]
    assert bad == []
    assert sum(1 for v in r.lat if v is not None) == 21363
    assert {r.sources[i].name for i, _ in r.origin[:10839]} == {"3. TIG-PXV.csv"}
