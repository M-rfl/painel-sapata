# tests/test_sensor.py
"""Mock-based unit tests for WitMotionSensor (Phase 2).

Tests cover all CONN and ACQ requirements using @patch to avoid real hardware.
All tests must FAIL (RED) until src/sensor.py is fully implemented.
"""
from __future__ import annotations

import logging
from unittest.mock import MagicMock, patch

import pytest

from src.sensor import WitMotionSensor, _MAX_CONSECUTIVE_ERRORS
from src.config_loader import AppConfig
from src.utils import SensorReading


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_config(slave_id=80):
    return AppConfig(
        serial_port="COM3",
        baudrate=9600,
        slave_id=slave_id,
        sample_interval_seconds=0.1,
        output_folder="data",
        csv_filename_prefix="wtvb01",
        log_level="WARNING",
    )


def _make_registers(ax_raw=0, ay_raw=0, az_raw=0, vel_raw=0, angle_raw=0,
                    temp_raw=2500, disp_raw=0, freq_raw=10):
    """19 registers matching burst layout:
    [0-2]   0x34-0x36  Acceleration X/Y/Z
    [3-5]   0x37-0x39  Angular velocity (SKIPPED in SensorReading)
    [6-8]   0x3A-0x3C  Vibration velocity X/Y/Z
    [9-11]  0x3D-0x3F  Angle X/Y/Z
    [12]    0x40        Temperature
    [13-15] 0x41-0x43  Displacement X/Y/Z
    [16-18] 0x44-0x46  Frequency X/Y/Z
    """
    return [
        ax_raw, ay_raw, az_raw,                    # offsets 0-2
        0, 0, 0,                                   # offsets 3-5 (angular velocity, skipped)
        vel_raw, vel_raw, vel_raw,                 # offsets 6-8
        angle_raw, angle_raw, angle_raw,           # offsets 9-11
        temp_raw,                                  # offset 12
        disp_raw, disp_raw, disp_raw,              # offsets 13-15
        freq_raw, freq_raw, freq_raw,              # offsets 16-18
    ]


def _make_successful_mock(MockClient, registers=None):
    """Return (sensor, mock_client_instance) with connect returning True and a good read."""
    if registers is None:
        registers = _make_registers()
    mock_instance = MagicMock()
    MockClient.return_value = mock_instance
    mock_instance.connect.return_value = True

    mock_response = MagicMock()
    mock_response.isError.return_value = False
    mock_response.registers = registers
    mock_instance.read_holding_registers.return_value = mock_response

    sensor = WitMotionSensor(_make_config())
    sensor.connect()
    return sensor, mock_instance


# ---------------------------------------------------------------------------
# CONN-01: connect() return value
# ---------------------------------------------------------------------------

@patch("src.sensor.ModbusSerialClient")
def test_connect_success(MockClient):
    """connect() returns True when underlying client.connect() returns True. (CONN-01)"""
    mock_instance = MagicMock()
    MockClient.return_value = mock_instance
    mock_instance.connect.return_value = True

    sensor = WitMotionSensor(_make_config())
    result = sensor.connect()

    assert result is True


@patch("src.sensor.ModbusSerialClient")
def test_connect_failure(MockClient):
    """connect() returns False when underlying client.connect() returns False. (CONN-01)"""
    mock_instance = MagicMock()
    MockClient.return_value = mock_instance
    mock_instance.connect.return_value = False

    sensor = WitMotionSensor(_make_config())
    result = sensor.connect()

    assert result is False


# ---------------------------------------------------------------------------
# ACQ-01: Single burst read per poll
# ---------------------------------------------------------------------------

@patch("src.sensor.ModbusSerialClient")
def test_burst_read_single_call(MockClient):
    """read_all_data() calls read_holding_registers exactly once with address=0x34,
    count=19, device_id=80 per poll. (ACQ-01)"""
    sensor, mock_instance = _make_successful_mock(MockClient)

    sensor.read_all_data()

    mock_instance.read_holding_registers.assert_called_once_with(
        0x34, count=19, device_id=80
    )


# ---------------------------------------------------------------------------
# ACQ-02: Acceleration conversion (zero values)
# ---------------------------------------------------------------------------

@patch("src.sensor.ModbusSerialClient")
def test_acceleration_conversion(MockClient):
    """regs[0]=0 -> ax_g=0.0; regs[1]=0 -> ay_g=0.0; regs[2]=0 -> az_g=0.0. (ACQ-02)"""
    registers = _make_registers(ax_raw=0, ay_raw=0, az_raw=0)
    sensor, _ = _make_successful_mock(MockClient, registers=registers)

    reading = sensor.read_all_data()

    assert reading is not None
    assert reading.ax_g == 0.0
    assert reading.ay_g == 0.0
    assert reading.az_g == 0.0


# ---------------------------------------------------------------------------
# ACQ-08: Signed 16-bit applied before scale (no ~32 g anomaly)
# ---------------------------------------------------------------------------

@patch("src.sensor.ModbusSerialClient")
def test_signed16_applied_to_acceleration(MockClient):
    """regs[2]=32768 (0x8000) -> to_signed16(32768)/32768*16 = -16.0 g, not +16.0 g. (ACQ-08)"""
    registers = _make_registers(az_raw=32768)
    sensor, _ = _make_successful_mock(MockClient, registers=registers)

    reading = sensor.read_all_data()

    assert reading is not None
    assert reading.az_g == pytest.approx(-16.0)
    assert reading.az_g != pytest.approx(16.0)


# ---------------------------------------------------------------------------
# ACQ-09: Returns SensorReading dataclass
# ---------------------------------------------------------------------------

@patch("src.sensor.ModbusSerialClient")
def test_returns_sensor_reading_dataclass(MockClient):
    """Successful read returns instance of SensorReading. (ACQ-09)"""
    sensor, _ = _make_successful_mock(MockClient)

    reading = sensor.read_all_data()

    assert isinstance(reading, SensorReading)


# ---------------------------------------------------------------------------
# CONN-03: ModbusException handling
# ---------------------------------------------------------------------------

@patch("src.sensor.ModbusSerialClient")
def test_modbus_exception_logged_as_warning(MockClient, caplog):
    """ModbusException during read -> returns None, logs WARNING, increments _consecutive_errors. (CONN-03)"""
    from pymodbus import ModbusException

    mock_instance = MagicMock()
    MockClient.return_value = mock_instance
    mock_instance.connect.return_value = True
    mock_instance.read_holding_registers.side_effect = ModbusException("timeout")

    sensor = WitMotionSensor(_make_config())
    sensor.connect()

    with caplog.at_level(logging.WARNING, logger="src.sensor"):
        result = sensor.read_all_data()

    assert result is None
    assert sensor._consecutive_errors == 1
    assert any(r.levelno == logging.WARNING for r in caplog.records)


@patch("src.sensor.ModbusSerialClient")
def test_error_response_logged_as_warning(MockClient, caplog):
    """response.isError()=True -> returns None, logs WARNING, increments _consecutive_errors. (CONN-03)"""
    mock_instance = MagicMock()
    MockClient.return_value = mock_instance
    mock_instance.connect.return_value = True

    mock_response = MagicMock()
    mock_response.isError.return_value = True
    mock_instance.read_holding_registers.return_value = mock_response

    sensor = WitMotionSensor(_make_config())
    sensor.connect()

    with caplog.at_level(logging.WARNING, logger="src.sensor"):
        result = sensor.read_all_data()

    assert result is None
    assert sensor._consecutive_errors == 1
    assert any(r.levelno == logging.WARNING for r in caplog.records)


@patch("src.sensor.ModbusSerialClient")
def test_consecutive_errors_logs_error(MockClient, caplog):
    """After _MAX_CONSECUTIVE_ERRORS consecutive failures -> logs ERROR with count. (CONN-03)"""
    from pymodbus import ModbusException

    mock_instance = MagicMock()
    MockClient.return_value = mock_instance
    mock_instance.connect.return_value = True
    mock_instance.read_holding_registers.side_effect = ModbusException("timeout")

    sensor = WitMotionSensor(_make_config())
    sensor.connect()

    with caplog.at_level(logging.ERROR, logger="src.sensor"):
        for _ in range(_MAX_CONSECUTIVE_ERRORS):
            sensor.read_all_data()

    # After _MAX_CONSECUTIVE_ERRORS failures, at least one ERROR must have been logged
    assert any(r.levelno == logging.ERROR for r in caplog.records)


@patch("src.sensor.ModbusSerialClient")
def test_exception_returns_none(MockClient):
    """ModbusException during read -> returns None (does not re-raise). (CONN-03)"""
    from pymodbus import ModbusException

    mock_instance = MagicMock()
    MockClient.return_value = mock_instance
    mock_instance.connect.return_value = True
    mock_instance.read_holding_registers.side_effect = ModbusException("CRC error")

    sensor = WitMotionSensor(_make_config())
    sensor.connect()

    # Must not raise — must return None
    result = sensor.read_all_data()
    assert result is None


# ---------------------------------------------------------------------------
# ACQ-03 to ACQ-07: Non-acceleration channels present and valid type
# ---------------------------------------------------------------------------

@patch("src.sensor.ModbusSerialClient")
def test_non_acceleration_channels_present(MockClient):
    """All 17 SensorReading fields accessible (no AttributeError);
    non-acceleration fields are float or None. (ACQ-03 to ACQ-07)"""
    sensor, _ = _make_successful_mock(MockClient)

    reading = sensor.read_all_data()

    assert isinstance(reading, SensorReading)

    # Acceleration: must be float (SCALE_ACC is not None)
    assert isinstance(reading.ax_g, float)
    assert isinstance(reading.ay_g, float)
    assert isinstance(reading.az_g, float)

    # Non-acceleration: must be float OR None — never raise AttributeError
    for field in (
        reading.vx_mm_s, reading.vy_mm_s, reading.vz_mm_s,
        reading.angle_x, reading.angle_y, reading.angle_z,
        reading.temperature_c,
        reading.dx_um, reading.dy_um, reading.dz_um,
        reading.freq_x_hz, reading.freq_y_hz, reading.freq_z_hz,
    ):
        assert field is None or isinstance(field, float), (
            f"Expected float or None, got {type(field)}: {field!r}"
        )
