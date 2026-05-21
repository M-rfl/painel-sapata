# src/sensor.py
"""WitMotionSensor: Modbus RTU connection and burst register read for WTVB01-485.

Connects to the sensor over Modbus RTU, reads 19 holding registers in a single
burst call per poll, converts raw values to physical units, and returns a
SensorReading dataclass. Handles transient communication errors without crashing.

Usage (Phase 3 main.py):
    from src.config_loader import load_config
    from src.sensor import WitMotionSensor

    config = load_config()
    sensor = WitMotionSensor(config)
    if sensor.connect():
        reading = sensor.read_all_data()   # returns SensorReading or None on error
    sensor.close()
"""
from __future__ import annotations

import logging
from typing import Optional

from pymodbus import FramerType, ModbusException
from pymodbus.client import ModbusSerialClient

from src.utils import SensorReading, get_timestamp_br, to_signed16

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------

_REG_START = 0x34    # First Modbus holding register in burst (address 52)
_REG_COUNT = 19      # Reads 0x34 through 0x46 inclusive
_MAX_CONSECUTIVE_ERRORS = 5  # Log ERROR after this many consecutive read failures

# Scale factors — apply to_signed16() BEFORE each multiplication
# [HIGH confidence] ACQ-02: confirmed from REQUIREMENTS.md
SCALE_ACC   = 1.0 / 32768 * 16   # signed_16 / 32768 * 16 -> g

# [UNVERIFIED] All below require confirmation from WTVB01-485 protocol PDF
# Set to None so those SensorReading fields remain None until datasheet is obtained.
SCALE_VEL   = None    # TODO: confirm from datasheet -> mm/s
SCALE_ANGLE = None    # TODO: confirm from datasheet -> degrees
SCALE_TEMP  = None    # TODO: confirm from datasheet -> °C (WitMotion convention: /100)
SCALE_DISP  = None    # TODO: confirm from datasheet -> µm
SCALE_FREQ  = None    # TODO: confirm from datasheet -> Hz


# ---------------------------------------------------------------------------
# WitMotionSensor class
# ---------------------------------------------------------------------------

class WitMotionSensor:
    """Modbus RTU client for the WitMotion WTVB01-485 vibration sensor.

    Wraps pymodbus.client.ModbusSerialClient to provide:
    - connect() / close() lifecycle
    - read_all_data(): single 19-register burst read, returns SensorReading or None
    - Consecutive-error counter with WARNING + ERROR logging (CONN-03)

    Args:
        config: AppConfig (or any object with serial_port, baudrate, slave_id fields).
                sensor_id is read via getattr fallback to "wtvb01" — AppConfig does
                not need a sensor_id field.
    """

    def __init__(self, config) -> None:
        self._config = config
        self._client: Optional[ModbusSerialClient] = None
        self._consecutive_errors: int = 0

    # ------------------------------------------------------------------
    # Public lifecycle
    # ------------------------------------------------------------------

    def connect(self) -> bool:
        """Open Modbus RTU connection on the configured serial port.

        Constructs a ModbusSerialClient with the settings from config and calls
        client.connect(). Always passes baudrate from config (pymodbus default is
        19200, which is wrong for the WTVB01-485 factory default of 9600).

        Returns:
            True if connection succeeded, False otherwise.
        """
        self._client = ModbusSerialClient(
            self._config.serial_port,
            framer=FramerType.RTU,
            baudrate=self._config.baudrate,   # ALWAYS pass; pymodbus default 19200 != sensor 9600
            bytesize=8,
            parity="N",
            stopbits=1,
            timeout=3,
        )
        connected = self._client.connect()
        if connected:
            logger.info(
                "Connected to %s at %d baud (slave_id=%d)",
                self._config.serial_port,
                self._config.baudrate,
                self._config.slave_id,
            )
        else:
            logger.error(
                "Failed to connect to %s at %d baud",
                self._config.serial_port,
                self._config.baudrate,
            )
        return connected

    def close(self) -> None:
        """Close the Modbus RTU connection if open."""
        if self._client:
            self._client.close()
            logger.info("Disconnected from %s", self._config.serial_port)

    # ------------------------------------------------------------------
    # Public data read
    # ------------------------------------------------------------------

    def read_all_data(self) -> Optional[SensorReading]:
        """Read 19 holding registers in a single burst and return a SensorReading.

        Reads registers 0x34–0x46 in one Modbus call (ACQ-01). Converts raw
        unsigned 16-bit values to physical units using to_signed16() before every
        multiplication (ACQ-08). Scale constants for non-acceleration channels are
        currently None (awaiting datasheet); those SensorReading fields will be None.

        Returns:
            SensorReading on success, None on any communication error.
            Never raises; ModbusException and device error responses are caught,
            logged as WARNING, and counted in _consecutive_errors (CONN-03).
            After _MAX_CONSECUTIVE_ERRORS consecutive failures, logs ERROR as well.
        """
        if not self._client:
            logger.error("read_all_data() called before connect()")
            return None

        try:
            response = self._client.read_holding_registers(
                _REG_START,
                count=_REG_COUNT,
                device_id=self._config.slave_id,   # pymodbus 3.10+ API — NOT slave=, NOT unit=
            )
        except ModbusException as exc:
            self._consecutive_errors += 1
            logger.warning(
                "Modbus exception reading sensor (consecutive=%d): %s",
                self._consecutive_errors,
                exc,
            )
            if self._consecutive_errors >= _MAX_CONSECUTIVE_ERRORS:
                logger.error(
                    "Sensor: %d consecutive errors — check cable and slave ID",
                    self._consecutive_errors,
                )
            return None

        if response.isError():
            self._consecutive_errors += 1
            logger.warning(
                "Device error response (consecutive=%d): %s",
                self._consecutive_errors,
                response,
            )
            if self._consecutive_errors >= _MAX_CONSECUTIVE_ERRORS:
                logger.error(
                    "Sensor: %d consecutive errors — check cable and slave ID",
                    self._consecutive_errors,
                )
            return None

        # Successful read — reset counter and parse
        self._consecutive_errors = 0
        return self._parse_registers(response.registers)

    # ------------------------------------------------------------------
    # Private register parsing
    # ------------------------------------------------------------------

    def _parse_registers(self, regs: list) -> SensorReading:
        """Convert 19 raw unsigned register values to a SensorReading with physical units.

        to_signed16() is applied to EVERY register before multiplication (ACQ-08).
        Non-acceleration scale constants are None until the WTVB01-485 datasheet
        is obtained; the corresponding fields are set to None.

        Register index layout (0-based from address 0x34):
        # [0-2]   0x34-0x36  Acceleration X/Y/Z     -> ax_g, ay_g, az_g
        # [3-5]   0x37-0x39  Angular velocity        -> SKIPPED (not in SensorReading)
        # [6-8]   0x3A-0x3C  Vibration velocity      -> vx_mm_s, vy_mm_s, vz_mm_s
        # [9-11]  0x3D-0x3F  Angle X/Y/Z            -> angle_x, angle_y, angle_z
        # [12]    0x40        Temperature             -> temperature_c
        # [13-15] 0x41-0x43  Displacement X/Y/Z      -> dx_um, dy_um, dz_um
        # [16-18] 0x44-0x46  Frequency X/Y/Z         -> freq_x_hz, freq_y_hz, freq_z_hz
        """
        return SensorReading(
            timestamp=get_timestamp_br(),
            sensor_id=getattr(self._config, "sensor_id", "wtvb01"),

            # Acceleration — HIGH confidence (REQUIREMENTS.md ACQ-02)
            ax_g=to_signed16(regs[0]) * SCALE_ACC,   # 0x34
            ay_g=to_signed16(regs[1]) * SCALE_ACC,   # 0x35
            az_g=to_signed16(regs[2]) * SCALE_ACC,   # 0x36

            # Vibration velocity — UNVERIFIED scale (ACQ-03)
            vx_mm_s=to_signed16(regs[6])  * SCALE_VEL   if SCALE_VEL   else None,  # 0x3A
            vy_mm_s=to_signed16(regs[7])  * SCALE_VEL   if SCALE_VEL   else None,  # 0x3B
            vz_mm_s=to_signed16(regs[8])  * SCALE_VEL   if SCALE_VEL   else None,  # 0x3C

            # Angle — UNVERIFIED scale (ACQ-04)
            angle_x=to_signed16(regs[9])  * SCALE_ANGLE if SCALE_ANGLE else None,  # 0x3D
            angle_y=to_signed16(regs[10]) * SCALE_ANGLE if SCALE_ANGLE else None,  # 0x3E
            angle_z=to_signed16(regs[11]) * SCALE_ANGLE if SCALE_ANGLE else None,  # 0x3F

            # Temperature — UNVERIFIED scale (ACQ-05; WitMotion convention: /100)
            temperature_c=to_signed16(regs[12]) * SCALE_TEMP if SCALE_TEMP else None,  # 0x40

            # Displacement — UNVERIFIED scale (ACQ-06)
            dx_um=to_signed16(regs[13]) * SCALE_DISP  if SCALE_DISP  else None,  # 0x41
            dy_um=to_signed16(regs[14]) * SCALE_DISP  if SCALE_DISP  else None,  # 0x42
            dz_um=to_signed16(regs[15]) * SCALE_DISP  if SCALE_DISP  else None,  # 0x43

            # Frequency — UNVERIFIED scale (ACQ-07)
            freq_x_hz=to_signed16(regs[16]) * SCALE_FREQ if SCALE_FREQ else None,  # 0x44
            freq_y_hz=to_signed16(regs[17]) * SCALE_FREQ if SCALE_FREQ else None,  # 0x45
            freq_z_hz=to_signed16(regs[18]) * SCALE_FREQ if SCALE_FREQ else None,  # 0x46
        )
