# tests/test_utils.py
"""Unit tests for src/utils.py.

Covers: to_signed16() boundary values, get_timestamp_br() timezone correctness,
setup_logging() handler configuration, deep_merge() recursion, SensorReading fields.
"""
from __future__ import annotations

import logging
import re
from pathlib import Path

import pytest

from src.utils import (
    SensorReading,
    deep_merge,
    get_timestamp_br,
    setup_logging,
    to_signed16,
)


# ---------------------------------------------------------------------------
# to_signed16() — five mandatory boundary values (UTIL-02, STORE-03 dep)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("raw,expected", [
    (0,     0),       # zero — unchanged
    (1,     1),       # small positive — unchanged
    (32767, 32767),   # maximum positive (0x7FFF) — unchanged
    (32768, -32768),  # minimum negative (0x8000) — sign bit boundary
    (65535, -1),      # maximum unsigned = -1 signed (0xFFFF)
])
def test_to_signed16_boundary_values(raw: int, expected: int) -> None:
    assert to_signed16(raw) == expected


def test_to_signed16_mid_negative() -> None:
    """Mid-range negative value just above the sign-bit boundary."""
    assert to_signed16(32769) == -32767  # 0x8001


def test_to_signed16_does_not_modify_positive_range() -> None:
    """All values below sign bit must be returned unchanged."""
    for v in (0, 1, 100, 32767):
        assert to_signed16(v) == v


# ---------------------------------------------------------------------------
# get_timestamp_br() — STORE-03 timezone correctness
# ---------------------------------------------------------------------------

def test_get_timestamp_br_contains_utc_offset() -> None:
    """Timestamp must include -03:00 UTC offset (America/Sao_Paulo)."""
    ts = get_timestamp_br()
    assert "-03:00" in ts, f"Expected '-03:00' in timestamp, got: {ts!r}"


def test_get_timestamp_br_is_iso8601_with_microseconds() -> None:
    """Timestamp must match ISO 8601 pattern with microseconds."""
    ts = get_timestamp_br()
    # Pattern: YYYY-MM-DDTHH:MM:SS.ffffff+HH:MM or -HH:MM
    pattern = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}[+-]\d{2}:\d{2}$"
    assert re.match(pattern, ts), f"Timestamp does not match ISO 8601: {ts!r}"


# ---------------------------------------------------------------------------
# setup_logging() — UTIL-01, UTIL-02
# ---------------------------------------------------------------------------

def test_setup_logging_creates_log_directory(tmp_path: Path) -> None:
    """setup_logging() must create logs/ if it does not exist."""
    log_dir = tmp_path / "logs"
    assert not log_dir.exists()
    setup_logging(log_dir=log_dir)
    assert log_dir.exists()


def test_setup_logging_rotating_handler_params(tmp_path: Path) -> None:
    """RotatingFileHandler must be configured with 1 MB max and 5 backups."""
    from logging.handlers import RotatingFileHandler

    setup_logging(log_dir=tmp_path / "logs")
    root = logging.getLogger()

    rotating = [
        h for h in root.handlers
        if isinstance(h, RotatingFileHandler)
    ]
    assert rotating, "No RotatingFileHandler found on root logger"
    handler = rotating[0]
    assert handler.maxBytes == 1_048_576, f"Expected 1 MB, got {handler.maxBytes}"
    assert handler.backupCount == 5, f"Expected 5 backups, got {handler.backupCount}"


def test_setup_logging_console_handler_level(tmp_path: Path) -> None:
    """Console StreamHandler must be at WARNING level or higher."""
    setup_logging(log_dir=tmp_path / "logs")
    root = logging.getLogger()

    stream_handlers = [
        h for h in root.handlers
        if type(h) is logging.StreamHandler  # exact type: excludes RotatingFileHandler and pytest's LogCaptureHandler
    ]
    assert stream_handlers, "No StreamHandler found on root logger"
    assert stream_handlers[0].level >= logging.WARNING


# ---------------------------------------------------------------------------
# deep_merge() — config defaults merging
# ---------------------------------------------------------------------------

def test_deep_merge_right_wins_on_conflict() -> None:
    result = deep_merge({"a": 1, "b": 2}, {"b": 99, "c": 3})
    assert result == {"a": 1, "b": 99, "c": 3}


def test_deep_merge_nested_dicts_recursive() -> None:
    base = {"conn": {"baudrate": 9600, "timeout": 1}}
    override = {"conn": {"baudrate": 19200}}
    result = deep_merge(base, override)
    assert result["conn"]["baudrate"] == 19200
    assert result["conn"]["timeout"] == 1  # not overwritten


def test_deep_merge_does_not_mutate_base() -> None:
    base = {"a": 1}
    deep_merge(base, {"a": 99})
    assert base["a"] == 1  # original unchanged


# ---------------------------------------------------------------------------
# SensorReading dataclass — all 17 channel fields + timestamp + sensor_id
# Field names match STORE-02 CSV column names exactly.
# ---------------------------------------------------------------------------

def test_sensor_reading_has_all_fields() -> None:
    """SensorReading must be instantiable with all required STORE-02 fields."""
    reading = SensorReading(
        timestamp="2026-05-19T14:32:01.000000-03:00",
        sensor_id="wtvb01",
        ax_g=0.0,
        ay_g=0.0,
        az_g=1.0,
        vx_mm_s=0.0,
        vy_mm_s=0.0,
        vz_mm_s=0.0,
        angle_x=0.0,
        angle_y=0.0,
        angle_z=0.0,
        temperature_c=25.0,
        dx_um=0.0,
        dy_um=0.0,
        dz_um=0.0,
        freq_x_hz=0.0,
        freq_y_hz=0.0,
        freq_z_hz=0.0,
    )
    assert reading.az_g == 1.0
    assert reading.sensor_id == "wtvb01"
    assert reading.temperature_c == 25.0


def test_sensor_reading_gps_fields_default_to_none() -> None:
    """GPS fields must default to None so existing code compiles without changes."""
    reading = SensorReading(
        timestamp="2026-05-24T10:00:00.000000-03:00",
        sensor_id="wtvb01",
        ax_g=0.0, ay_g=0.0, az_g=1.0,
        vx_mm_s=0.0, vy_mm_s=0.0, vz_mm_s=0.0,
        angle_x=None, angle_y=None, angle_z=None,
        temperature_c=25.0,
        dx_um=0.0, dy_um=0.0, dz_um=0.0,
        freq_x_hz=50.0, freq_y_hz=51.0, freq_z_hz=52.0,
        # No GPS args — all should default to None
    )
    assert reading.gps_lat is None
    assert reading.gps_lon is None
    assert reading.gps_speed_mps is None


def test_sensor_reading_gps_fields_accept_floats() -> None:
    """GPS fields must accept float values."""
    reading = SensorReading(
        timestamp="2026-05-24T10:00:00.000000-03:00",
        sensor_id="wtvb01",
        ax_g=0.0, ay_g=0.0, az_g=1.0,
        vx_mm_s=0.0, vy_mm_s=0.0, vz_mm_s=0.0,
        angle_x=None, angle_y=None, angle_z=None,
        temperature_c=25.0,
        dx_um=0.0, dy_um=0.0, dz_um=0.0,
        freq_x_hz=50.0, freq_y_hz=51.0, freq_z_hz=52.0,
        gps_lat=-23.5505,
        gps_lon=-46.6333,
        gps_speed_mps=1.5,
    )
    assert reading.gps_lat == pytest.approx(-23.5505)
    assert reading.gps_lon == pytest.approx(-46.6333)
    assert reading.gps_speed_mps == pytest.approx(1.5)
