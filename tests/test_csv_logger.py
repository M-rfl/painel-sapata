# tests/test_csv_logger.py
"""Unit tests for CSVLogger.

Requirement mapping:
  test_file_created_with_correct_name   -> STORE-01 (timestamped CSV filename)
  test_output_folder_created            -> STORE-01 (output folder auto-created)
  test_header_row_columns               -> STORE-02 (18-column header, sensor_id last)
  test_header_written_once              -> STORE-04 (header written exactly once)
  test_timestamp_format                 -> STORE-03 (ISO 8601 -03:00 timestamp)
  test_flush_after_each_row             -> STORE-05 (flush after each write_row call)
  test_none_fields_become_empty_string  -> STORE-06 (None -> empty string in CSV)
  test_rows_written_counter             -> STORE-06 (rows_written tracks written rows)
  test_header_includes_gps_columns      -> GPS-06 (header always contains GPS columns)
  test_gps_values_written_to_row        -> GPS-07 (row contains GPS values when fix exists)
  test_gps_none_written_as_empty_string -> GPS-07 (row contains empty strings when no fix)
"""
from __future__ import annotations

import csv
import re
from pathlib import Path

import pytest

from src.utils import SensorReading

# CSVLogger does not exist yet — import will fail, making all tests RED
from src.csv_logger import CSVLogger  # noqa: E402

# ---------------------------------------------------------------------------
# CSV column order (STORE-02): sensor_id is LAST, index 17
# ---------------------------------------------------------------------------
CSV_HEADER = [
    "timestamp",
    "ax_g", "ay_g", "az_g",
    "vx_mm_s", "vy_mm_s", "vz_mm_s",
    "angle_x", "angle_y", "angle_z",
    "temperature_c",
    "dx_um", "dy_um", "dz_um",
    "freq_x_hz", "freq_y_hz", "freq_z_hz",
    "sensor_id",
]

# 21-column header including GPS columns (GPS-06)
GPS_CSV_HEADER = CSV_HEADER + ["gps_lat", "gps_lon", "gps_speed_mps"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_reading(
    *,
    ax_g: float | None = 0.1,
    ay_g: float | None = 0.2,
    az_g: float | None = 9.8,
) -> SensorReading:
    """Construct a valid SensorReading. angle_x/y/z always None per sensor spec."""
    return SensorReading(
        timestamp="2026-05-21T10:00:00.000000-03:00",
        sensor_id="wtvb01",
        ax_g=ax_g,
        ay_g=ay_g,
        az_g=az_g,
        vx_mm_s=1.0,
        vy_mm_s=2.0,
        vz_mm_s=3.0,
        angle_x=None,   # RESERVED registers — always None
        angle_y=None,
        angle_z=None,
        temperature_c=25.0,
        dx_um=10.0,
        dy_um=11.0,
        dz_um=12.0,
        freq_x_hz=50.0,
        freq_y_hz=51.0,
        freq_z_hz=52.0,
    )


# ---------------------------------------------------------------------------
# STORE-01: timestamped filename
# ---------------------------------------------------------------------------

def test_file_created_with_correct_name(tmp_path: Path) -> None:
    """CSVLogger creates a file matching wtvb01_YYYYMMDD_HHMMSS.csv inside output_folder.

    Requirement: STORE-01
    """
    logger = CSVLogger(output_folder=str(tmp_path), prefix="wtvb01")
    files = list(tmp_path.glob("*.csv"))
    logger.close()

    assert len(files) == 1, f"Expected exactly 1 CSV file in {tmp_path}, got {files}"
    pattern = r"wtvb01_\d{8}_\d{6}\.csv"
    assert re.match(pattern, files[0].name), (
        f"Filename '{files[0].name}' does not match pattern '{pattern}'"
    )


# ---------------------------------------------------------------------------
# STORE-01: output folder auto-created
# ---------------------------------------------------------------------------

def test_output_folder_created(tmp_path: Path) -> None:
    """CSVLogger creates nested output folder if it does not exist.

    Requirement: STORE-01
    """
    nested = tmp_path / "sub" / "dir"
    assert not nested.exists(), "Test pre-condition: directory must not exist yet"

    logger = CSVLogger(output_folder=str(nested), prefix="wtvb01")
    logger.close()

    assert nested.exists(), f"Expected {nested} to be created by CSVLogger"
    assert nested.is_dir()


# ---------------------------------------------------------------------------
# STORE-02: 18-column header, sensor_id last
# ---------------------------------------------------------------------------

def test_header_row_columns(tmp_path: Path) -> None:
    """First row of CSV matches GPS_CSV_HEADER (21 columns: 18 sensor + 3 GPS).

    Requirement: STORE-02, GPS-06
    """
    logger = CSVLogger(output_folder=str(tmp_path), prefix="wtvb01")
    logger.write_row(_make_reading())
    logger.close()

    csv_file = next(tmp_path.glob("*.csv"))
    with csv_file.open(newline="", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        header = next(reader)

    assert header == GPS_CSV_HEADER, f"Header mismatch:\nGot:      {header}\nExpected: {GPS_CSV_HEADER}"


# ---------------------------------------------------------------------------
# STORE-04: header written exactly once
# ---------------------------------------------------------------------------

def test_header_written_once(tmp_path: Path) -> None:
    """After 3 write_row() calls the file has exactly 4 rows (1 header + 3 data).

    Requirement: STORE-04
    """
    logger = CSVLogger(output_folder=str(tmp_path), prefix="wtvb01")
    for _ in range(3):
        logger.write_row(_make_reading())
    logger.close()

    csv_file = next(tmp_path.glob("*.csv"))
    with csv_file.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.reader(fh))

    assert len(rows) == 4, (
        f"Expected 4 rows (1 header + 3 data), got {len(rows)}: {rows}"
    )


# ---------------------------------------------------------------------------
# STORE-03: ISO 8601 timestamp with -03:00 offset
# ---------------------------------------------------------------------------

def test_timestamp_format(tmp_path: Path) -> None:
    """Timestamp cell matches ISO 8601 format with -03:00 offset.

    Requirement: STORE-03
    """
    logger = CSVLogger(output_folder=str(tmp_path), prefix="wtvb01")
    logger.write_row(_make_reading())
    logger.close()

    csv_file = next(tmp_path.glob("*.csv"))
    with csv_file.open(newline="", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        next(reader)  # skip header
        data_row = next(reader)

    timestamp = data_row[0]  # column index 0 per STORE-02
    pattern = r"\d{4}-\d{2}-\d{2}T.*-03:00"
    assert re.match(pattern, timestamp), (
        f"Timestamp '{timestamp}' does not match ISO 8601 -03:00 pattern"
    )


# ---------------------------------------------------------------------------
# STORE-05: flush after each write_row
# ---------------------------------------------------------------------------

def test_flush_after_each_row(tmp_path: Path) -> None:
    """Data is readable from disk after write_row() without calling close() first.

    Requirement: STORE-05
    """
    logger = CSVLogger(output_folder=str(tmp_path), prefix="wtvb01")
    logger.write_row(_make_reading())
    # Intentionally do NOT call logger.close() before reading

    csv_file = next(tmp_path.glob("*.csv"))
    with csv_file.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.reader(fh))

    logger.close()  # clean up after reading

    # Must have header row + 1 data row
    assert len(rows) >= 2, (
        f"Expected at least 2 rows (header + data) after write_row() without close(), "
        f"got {len(rows)} rows. This indicates data was not flushed to disk."
    )


# ---------------------------------------------------------------------------
# STORE-06: None fields become empty string
# ---------------------------------------------------------------------------

def test_none_fields_become_empty_string(tmp_path: Path) -> None:
    """SensorReading with ax_g=None writes empty string at CSV column index 1 (ax_g).

    Requirement: STORE-06
    Column order: [timestamp, ax_g, ay_g, az_g, ...] — ax_g is index 1.
    """
    reading = _make_reading(ax_g=None)
    logger = CSVLogger(output_folder=str(tmp_path), prefix="wtvb01")
    logger.write_row(reading)
    logger.close()

    csv_file = next(tmp_path.glob("*.csv"))
    with csv_file.open(newline="", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        next(reader)  # skip header
        data_row = next(reader)

    # ax_g is CSV column index 1 (after timestamp)
    assert data_row[1] == "", (
        f"Expected empty string for None ax_g at column index 1, got '{data_row[1]}'"
    )


# ---------------------------------------------------------------------------
# STORE-06: rows_written counter tracks writes
# ---------------------------------------------------------------------------

def test_rows_written_counter(tmp_path: Path) -> None:
    """CSVLogger.rows_written starts at 0 and increments once per write_row() call.

    Requirement: STORE-06
    """
    logger = CSVLogger(output_folder=str(tmp_path), prefix="wtvb01")
    assert logger.rows_written == 0, (
        f"Expected rows_written=0 after init, got {logger.rows_written}"
    )

    logger.write_row(_make_reading())
    assert logger.rows_written == 1, (
        f"Expected rows_written=1 after one write_row(), got {logger.rows_written}"
    )

    logger.write_row(_make_reading())
    assert logger.rows_written == 2, (
        f"Expected rows_written=2 after two write_row() calls, got {logger.rows_written}"
    )

    logger.close()


# ---------------------------------------------------------------------------
# GPS-06: header always contains GPS columns (columns 18-20)
# ---------------------------------------------------------------------------

def test_header_includes_gps_columns(tmp_path: Path) -> None:
    """CSV header row contains gps_lat, gps_lon, gps_speed_mps as columns 18-20.

    Requirement: GPS-06
    GPS columns must always be present regardless of whether a GPS fix occurred.
    """
    logger = CSVLogger(output_folder=str(tmp_path), prefix="wtvb01")
    logger.write_row(_make_reading())
    logger.close()

    csv_file = next(tmp_path.glob("*.csv"))
    with csv_file.open(newline="", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        header = next(reader)

    assert header == GPS_CSV_HEADER, (
        f"Header mismatch:\nGot:      {header}\nExpected: {GPS_CSV_HEADER}"
    )


# ---------------------------------------------------------------------------
# GPS-07: row contains GPS values when a fix is available
# ---------------------------------------------------------------------------

def test_gps_values_written_to_row(tmp_path: Path) -> None:
    """SensorReading with GPS fix writes numeric values at CSV columns 18-20.

    Requirement: GPS-07
    Column 18: gps_lat, column 19: gps_lon, column 20: gps_speed_mps.
    """
    reading = SensorReading(
        timestamp="2026-05-21T10:00:00.000000-03:00",
        sensor_id="wtvb01",
        ax_g=0.1,
        ay_g=0.2,
        az_g=9.8,
        vx_mm_s=1.0,
        vy_mm_s=2.0,
        vz_mm_s=3.0,
        angle_x=None,
        angle_y=None,
        angle_z=None,
        temperature_c=25.0,
        dx_um=10.0,
        dy_um=11.0,
        dz_um=12.0,
        freq_x_hz=50.0,
        freq_y_hz=51.0,
        freq_z_hz=52.0,
        gps_lat=-23.5505,
        gps_lon=-46.6333,
        gps_speed_mps=1.5,
    )
    logger = CSVLogger(output_folder=str(tmp_path), prefix="wtvb01")
    logger.write_row(reading)
    logger.close()

    csv_file = next(tmp_path.glob("*.csv"))
    with csv_file.open(newline="", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        next(reader)  # skip header
        data_row = next(reader)

    assert data_row[18] == "-23.5505", (
        f"Expected gps_lat='-23.5505' at column 18, got '{data_row[18]}'"
    )
    assert data_row[19] == "-46.6333", (
        f"Expected gps_lon='-46.6333' at column 19, got '{data_row[19]}'"
    )
    assert data_row[20] == "1.5", (
        f"Expected gps_speed_mps='1.5' at column 20, got '{data_row[20]}'"
    )


# ---------------------------------------------------------------------------
# GPS-07: row contains empty strings when no GPS fix
# ---------------------------------------------------------------------------

def test_gps_none_written_as_empty_string(tmp_path: Path) -> None:
    """SensorReading with no GPS fix writes empty strings at CSV columns 18-20.

    Requirement: GPS-07
    Matches the existing None→'' pattern used for RESERVED angle registers.
    """
    logger = CSVLogger(output_folder=str(tmp_path), prefix="wtvb01")
    logger.write_row(_make_reading())  # GPS fields default to None
    logger.close()

    csv_file = next(tmp_path.glob("*.csv"))
    with csv_file.open(newline="", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        next(reader)  # skip header
        data_row = next(reader)

    assert data_row[18] == "", (
        f"Expected empty string for None gps_lat at column 18, got '{data_row[18]}'"
    )
    assert data_row[19] == "", (
        f"Expected empty string for None gps_lon at column 19, got '{data_row[19]}'"
    )
    assert data_row[20] == "", (
        f"Expected empty string for None gps_speed_mps at column 20, got '{data_row[20]}'"
    )
