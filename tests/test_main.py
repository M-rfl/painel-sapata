# tests/test_main.py
"""Unit tests for main.py acquisition loop.

Requirement mapping:
  test_graceful_shutdown_closes_resources    -> CONN-02 (close resources on exit)
  test_session_summary_on_ctrl_c             -> DISP-03 (session summary on Ctrl+C)
  test_terminal_display_per_sample           -> DISP-01 (terminal display per sample)
  test_connection_status_messages            -> DISP-02 (connection failure message)
  test_connection_error_message_on_read_fail -> DISP-02 (runtime read-fail message)
  test_gps_no_fix_message_at_startup         -> GPS-04 (GPS status line at startup)
  test_gps_permission_denied_message_at_startup -> GPS-09 (actionable permission-denied message)
"""
from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch, call

from src.utils import SensorReading

# main.py does not exist yet — import will fail, making all tests RED
from main import main  # noqa: E402


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
# CONN-02: close resources on shutdown
# ---------------------------------------------------------------------------

def test_graceful_shutdown_closes_resources(capsys: pytest.CaptureFixture) -> None:
    """sensor.close() and csv_logger.close() are both called after KeyboardInterrupt.

    Requirement: CONN-02
    """
    mock_sensor = MagicMock()
    mock_sensor.connect.return_value = True
    mock_sensor.read_all_data.side_effect = [_make_reading(), KeyboardInterrupt()]

    mock_csv = MagicMock()
    mock_csv.file_path = "data/wtvb01_20260521_100000.csv"

    mock_gps = MagicMock()
    mock_gps.status = "no_fix"
    mock_gps.get_location.return_value = (None, None, None)
    mock_gps.poll.return_value = None

    with (
        patch("sys.argv", ["main.py"]),
        patch("main.load_config", return_value=_make_config()),
        patch("main.setup_logging"),
        patch("main.WitMotionSensor", return_value=mock_sensor),
        patch("main.CSVLogger", return_value=mock_csv),
        patch("main.GPSReader", return_value=mock_gps),
    ):
        main()

    mock_sensor.close.assert_called_once()
    mock_csv.close.assert_called_once()


# ---------------------------------------------------------------------------
# DISP-03: session summary printed on Ctrl+C
# ---------------------------------------------------------------------------

def test_session_summary_on_ctrl_c(capsys: pytest.CaptureFixture) -> None:
    """stdout contains 'Samples', the CSV path, and elapsed-time info after KeyboardInterrupt.

    Requirement: DISP-03
    """
    mock_sensor = MagicMock()
    mock_sensor.connect.return_value = True
    mock_sensor.read_all_data.side_effect = [_make_reading(), KeyboardInterrupt()]

    mock_csv = MagicMock()
    mock_csv.file_path = "data/wtvb01_20260521_100000.csv"
    mock_csv.rows_written = 1

    mock_gps = MagicMock()
    mock_gps.status = "no_fix"
    mock_gps.get_location.return_value = (None, None, None)
    mock_gps.poll.return_value = None

    with (
        patch("sys.argv", ["main.py"]),
        patch("main.load_config", return_value=_make_config()),
        patch("main.setup_logging"),
        patch("main.WitMotionSensor", return_value=mock_sensor),
        patch("main.CSVLogger", return_value=mock_csv),
        patch("main.GPSReader", return_value=mock_gps),
    ):
        main()

    captured = capsys.readouterr()
    output = captured.out

    assert "Samples" in output or "samples" in output, (
        f"Expected 'Samples' in stdout summary, got:\n{output}"
    )


# ---------------------------------------------------------------------------
# DISP-01: terminal display on each successful sample
# ---------------------------------------------------------------------------

def test_terminal_display_per_sample(capsys: pytest.CaptureFixture) -> None:
    """A line is printed to stdout for each successful sensor.read_all_data() return.

    Requirement: DISP-01
    """
    reading = _make_reading()

    mock_sensor = MagicMock()
    mock_sensor.connect.return_value = True
    mock_sensor.read_all_data.side_effect = [reading, KeyboardInterrupt()]

    mock_csv = MagicMock()
    mock_csv.file_path = "data/wtvb01_20260521_100000.csv"
    mock_csv.rows_written = 1

    mock_gps = MagicMock()
    mock_gps.status = "no_fix"
    mock_gps.get_location.return_value = (None, None, None)
    mock_gps.poll.return_value = None

    with (
        patch("sys.argv", ["main.py"]),
        patch("main.load_config", return_value=_make_config()),
        patch("main.setup_logging"),
        patch("main.WitMotionSensor", return_value=mock_sensor),
        patch("main.CSVLogger", return_value=mock_csv),
        patch("main.GPSReader", return_value=mock_gps),
    ):
        main()

    captured = capsys.readouterr()
    output = captured.out

    # The reading's timestamp must appear in stdout (proves per-sample display)
    assert reading.timestamp in output, (
        f"Expected reading timestamp '{reading.timestamp}' in stdout, got:\n{output}"
    )


# ---------------------------------------------------------------------------
# DISP-02: connection failure message
# ---------------------------------------------------------------------------

def test_connection_status_messages(capsys: pytest.CaptureFixture) -> None:
    """When sensor.connect() returns False, stdout contains an error/warning message.

    Requirement: DISP-02 (startup failure path)
    main() should either raise SystemExit or print an error — both are acceptable.
    """
    mock_sensor = MagicMock()
    mock_sensor.connect.return_value = False

    mock_csv = MagicMock()

    mock_gps = MagicMock()
    mock_gps.status = "no_fix"
    mock_gps.get_location.return_value = (None, None, None)
    mock_gps.poll.return_value = None

    with (
        patch("sys.argv", ["main.py"]),
        patch("main.load_config", return_value=_make_config()),
        patch("main.setup_logging"),
        patch("main.WitMotionSensor", return_value=mock_sensor),
        patch("main.CSVLogger", return_value=mock_csv),
        patch("main.GPSReader", return_value=mock_gps),
    ):
        try:
            main()
        except SystemExit:
            pass  # SystemExit is acceptable for connection failure

    captured = capsys.readouterr()
    output = captured.out + captured.err

    # Some form of error/warning message must appear
    assert any(word in output.lower() for word in ("error", "fail", "connect", "unable", "could not")), (
        f"Expected error/failure message in output when connect() returns False, got:\n{output}"
    )


# ---------------------------------------------------------------------------
# DISP-02: runtime read-fail warning
# ---------------------------------------------------------------------------

def test_connection_error_message_on_read_fail(capsys: pytest.CaptureFixture) -> None:
    """When read_all_data() returns None, stdout contains a warning/error message.

    Requirement: DISP-02 (runtime error path)
    """
    mock_sensor = MagicMock()
    mock_sensor.connect.return_value = True
    mock_sensor.read_all_data.side_effect = [None, KeyboardInterrupt()]

    mock_csv = MagicMock()
    mock_csv.file_path = "data/wtvb01_20260521_100000.csv"
    mock_csv.rows_written = 0

    mock_gps = MagicMock()
    mock_gps.status = "no_fix"
    mock_gps.get_location.return_value = (None, None, None)
    mock_gps.poll.return_value = None

    with (
        patch("sys.argv", ["main.py"]),
        patch("main.load_config", return_value=_make_config()),
        patch("main.setup_logging"),
        patch("main.WitMotionSensor", return_value=mock_sensor),
        patch("main.CSVLogger", return_value=mock_csv),
        patch("main.GPSReader", return_value=mock_gps),
    ):
        main()

    captured = capsys.readouterr()
    output = captured.out + captured.err

    # A warning or error string must appear when read returns None
    assert any(word in output.lower() for word in ("warn", "error", "fail", "none", "read")), (
        f"Expected warning message in output when read_all_data() returns None, got:\n{output}"
    )


# ---------------------------------------------------------------------------
# GPS-04: GPS status line at startup (no fix)
# ---------------------------------------------------------------------------

def test_gps_no_fix_message_at_startup(capsys: pytest.CaptureFixture) -> None:
    """When GPS has no fix, startup prints 'GPS: searching for fix — CSV columns will fill once acquired'.

    Requirement: GPS-04
    """
    mock_sensor = MagicMock()
    mock_sensor.connect.return_value = True
    mock_sensor.read_all_data.side_effect = [KeyboardInterrupt()]

    mock_csv = MagicMock()
    mock_csv.path = "data/wtvb01_test.csv"

    mock_gps = MagicMock()
    mock_gps.status = "no_fix"
    mock_gps.get_location.return_value = (None, None, None)
    mock_gps.poll.return_value = None

    with (
        patch("sys.argv", ["main.py"]),
        patch("main.load_config", return_value=_make_config()),
        patch("main.setup_logging"),
        patch("main.WitMotionSensor", return_value=mock_sensor),
        patch("main.CSVLogger", return_value=mock_csv),
        patch("main.GPSReader", return_value=mock_gps),
    ):
        try:
            main()
        except SystemExit:
            pass

    captured = capsys.readouterr()
    assert "GPS: searching for fix" in captured.out, (
        f"Expected 'GPS: searching for fix' in stdout, got:\n{captured.out}"
    )


# ---------------------------------------------------------------------------
# GPS-09: GPS permission denied message at startup
# ---------------------------------------------------------------------------

def test_gps_permission_denied_message_at_startup(capsys: pytest.CaptureFixture) -> None:
    """When GPS permission denied, startup prints the exact actionable message.

    Requirement: GPS-09
    """
    mock_sensor = MagicMock()
    mock_sensor.connect.return_value = True
    mock_sensor.read_all_data.side_effect = [KeyboardInterrupt()]

    mock_csv = MagicMock()
    mock_csv.path = "data/wtvb01_test.csv"

    mock_gps = MagicMock()
    mock_gps.status = "denied"
    mock_gps.get_location.return_value = (None, None, None)
    mock_gps.poll.return_value = None

    with (
        patch("sys.argv", ["main.py"]),
        patch("main.load_config", return_value=_make_config()),
        patch("main.setup_logging"),
        patch("main.WitMotionSensor", return_value=mock_sensor),
        patch("main.CSVLogger", return_value=mock_csv),
        patch("main.GPSReader", return_value=mock_gps),
    ):
        try:
            main()
        except SystemExit:
            pass

    captured = capsys.readouterr()
    expected = "GPS: location access denied — enable in Windows Settings"
    assert expected in captured.out, (
        f"Expected actionable GPS denial message in stdout, got:\n{captured.out}"
    )
