# tests/test_main_gui.py
"""Wave 0 stub tests for main.py GUI mode (--gui flag integration).

Requirement coverage:
  test_no_flag_calls_headless          -> INTG-01 (no --gui flag stays headless)
  test_gui_mode_csv_written            -> INTG-02 (--gui mode writes CSV rows)
  test_gui_update_data_called          -> INTG-03 (--gui mode calls PlotManager.update_data)
  test_gui_close_triggers_shutdown     -> INTG-04 (window close triggers session summary)
  test_gui_resources_closed            -> INTG-04 (window close closes sensor + csv_logger)

These stubs are RED by design (Wave 0 TDD scaffold).
Plan 02 will implement the main.py changes that make these tests GREEN.
"""
from __future__ import annotations

import time
import pytest
from unittest.mock import MagicMock, patch
import matplotlib
matplotlib.use("Agg")  # Must be before any visualizer import; prevents Tk in CI
from main import main
from src.utils import SensorReading


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_reading() -> SensorReading:
    """Return a minimal valid SensorReading for use as mock return value."""
    return SensorReading(
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
    )


def _make_config() -> MagicMock:
    """Return a MagicMock AppConfig with sensible defaults."""
    cfg = MagicMock()
    cfg.serial_port = "COM3"
    cfg.baudrate = 9600
    cfg.slave_id = 80
    cfg.sample_interval_seconds = 0.0
    cfg.output_folder = "data"
    cfg.csv_filename_prefix = "wtvb01"
    cfg.log_level = "WARNING"
    return cfg


# ---------------------------------------------------------------------------
# INTG-01: no --gui flag stays headless
# ---------------------------------------------------------------------------

def test_no_flag_calls_headless(capsys):
    """When sys.argv has no --gui, main() calls sensor.read_all_data() and closes resources.

    Wave 0 stub — raises NotImplementedError until Plan 02 implements GUI mode.
    """
    raise NotImplementedError("Wave 0 stub — implement in Plan 02")


# ---------------------------------------------------------------------------
# INTG-02: --gui mode writes CSV rows
# ---------------------------------------------------------------------------

def test_gui_mode_csv_written():
    """When sys.argv has --gui, csv_logger.write_row() is called at least once.

    Wave 0 stub — raises NotImplementedError until Plan 02 implements GUI mode.
    """
    raise NotImplementedError("Wave 0 stub — implement in Plan 02")


# ---------------------------------------------------------------------------
# INTG-03: --gui mode calls PlotManager.update_data
# ---------------------------------------------------------------------------

def test_gui_update_data_called():
    """When sys.argv has --gui, pm.update_data() is called at least once from acquisition thread.

    Wave 0 stub — raises NotImplementedError until Plan 02 implements GUI mode.
    """
    raise NotImplementedError("Wave 0 stub — implement in Plan 02")


# ---------------------------------------------------------------------------
# INTG-04: window close triggers session summary
# ---------------------------------------------------------------------------

def test_gui_close_triggers_shutdown(capsys):
    """Simulating window close causes pm.start() to return and stdout contains 'Samples'.

    Wave 0 stub — raises NotImplementedError until Plan 02 implements GUI mode.
    """
    raise NotImplementedError("Wave 0 stub — implement in Plan 02")


# ---------------------------------------------------------------------------
# INTG-04: window close closes sensor + csv_logger
# ---------------------------------------------------------------------------

def test_gui_resources_closed():
    """After GUI shutdown (window close), sensor.close() and csv_logger.close() called once each.

    Wave 0 stub — raises NotImplementedError until Plan 02 implements GUI mode.
    """
    raise NotImplementedError("Wave 0 stub — implement in Plan 02")
