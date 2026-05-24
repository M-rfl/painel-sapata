# src/utils.py
"""Utility functions and shared data structures for WTVB01 Notebook Logger.

Contains:
- to_signed16(): two's complement conversion for Modbus register values
- get_timestamp_br(): ISO 8601 timestamp with America/Sao_Paulo timezone
- setup_logging(): dual-handler logging (file + console)
- deep_merge(): recursive dict merge for config defaults
- SensorReading: dataclass with 18 sensor channel fields + 3 GPS fields
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Dict, Optional

# ---------------------------------------------------------------------------
# Timezone — import guard for Python 3.8 compatibility
# ---------------------------------------------------------------------------

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo  # type: ignore[no-redef]  # Python 3.8

TZ_SAO_PAULO = ZoneInfo("America/Sao_Paulo")

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Signed 16-bit conversion (STORE-03, ACQ-08)
# ---------------------------------------------------------------------------

def to_signed16(value: int) -> int:
    """Convert unsigned 16-bit Modbus register value to signed Python int.

    Modbus registers are unsigned 16-bit (0–65535). Sensors encode negative
    values using two's complement: 0x8000 (32768) maps to -32768, 0xFFFF
    (65535) maps to -1.

    Apply this function to EVERY register before any scale factor multiplication.
    Skipping it produces physically plausible but wrong values (e.g., ~32 g
    instead of ~0 g on the accelerometer axes at rest).

    Args:
        value: Unsigned integer in range 0–65535.

    Returns:
        Signed integer in range -32768 to 32767.

    Examples:
        >>> to_signed16(0)
        0
        >>> to_signed16(32768)
        -32768
        >>> to_signed16(65535)
        -1
    """
    return value if value < 32768 else value - 65536


# ---------------------------------------------------------------------------
# Timezone-aware timestamp (STORE-03)
# ---------------------------------------------------------------------------

def get_timestamp_br() -> str:
    """Return current datetime as ISO 8601 string with America/Sao_Paulo offset.

    Brazil abolished DST in 2019; the offset is permanently -03:00. Using
    ZoneInfo("America/Sao_Paulo") rather than a hardcoded offset ensures
    correctness for historical data and future policy changes.

    Returns:
        ISO 8601 string with microseconds and UTC offset, e.g.:
        '2026-05-19T14:32:01.123456-03:00'
    """
    return datetime.now(tz=TZ_SAO_PAULO).isoformat()


# ---------------------------------------------------------------------------
# Logging setup (UTIL-01, UTIL-02)
# ---------------------------------------------------------------------------

def setup_logging(
    log_dir: Path = Path("logs"),
    level: str = "WARNING",
) -> None:
    """Configure dual-handler logging: WARNING+ to console, DEBUG to rotating file.

    Call this function exactly once at application startup (in main.py, Phase 3).
    Individual modules must only call logging.getLogger(__name__) — never
    basicConfig() — to avoid locking the configuration before this runs.

    File handler: logs/wtvb01.log, 1 MB max, 5 backups, DEBUG level, UTF-8.
    Console handler: WARNING level (reduces terminal noise during normal operation).

    Args:
        log_dir: Directory where wtvb01.log is written. Created if absent.
        level: Console log level string. Defaults to WARNING.
    """
    log_dir = Path(log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "wtvb01.log"

    fmt = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)

    # Console handler — WARNING+ so normal operation is quiet
    console_level = getattr(logging, level.upper(), logging.WARNING)
    ch = logging.StreamHandler()
    ch.setLevel(console_level)
    ch.setFormatter(fmt)
    root.addHandler(ch)

    # Rotating file handler — DEBUG (captures everything for post-mortem)
    fh = RotatingFileHandler(
        log_path,
        maxBytes=1_048_576,   # 1 MB per the planning spec
        backupCount=5,
        encoding="utf-8",
    )
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)
    root.addHandler(fh)


# ---------------------------------------------------------------------------
# Config dict merging (CFG-03)
# ---------------------------------------------------------------------------

def deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively merge override into base; override keys win on conflict.

    Used by config_loader.py to apply user YAML values on top of DEFAULTS.
    Does not mutate either input dict.

    Args:
        base: Default values dict.
        override: User-supplied values dict.

    Returns:
        New merged dict.

    Examples:
        >>> deep_merge({'a': 1, 'b': 2}, {'b': 99, 'c': 3})
        {'a': 1, 'b': 99, 'c': 3}
    """
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


# ---------------------------------------------------------------------------
# SensorReading dataclass — field names match STORE-02 CSV columns exactly
# ---------------------------------------------------------------------------

@dataclass
class SensorReading:
    """All sensor channel values from one Modbus burst read.

    Defined in utils.py (zero I/O dependency) so Phase 2 sensor.py and
    Phase 3 csv_logger.py can both import it without circular dependencies.

    Timestamp and sensor_id are included so a SensorReading is self-contained
    for CSV writing and display without additional context.

    Field names match STORE-02 CSV column order exactly:
        timestamp, sensor_id,
        ax_g, ay_g, az_g,
        vx_mm_s, vy_mm_s, vz_mm_s,
        angle_x, angle_y, angle_z,
        temperature_c,
        dx_um, dy_um, dz_um,
        freq_x_hz, freq_y_hz, freq_z_hz,
        gps_lat, gps_lon, gps_speed_mps
    """
    timestamp: str           # ISO 8601 with -03:00 offset, from get_timestamp_br()
    sensor_id: str           # configured in config.yaml; "wtvb01" by default

    # Acceleration (registers 0x34–0x36): signed_16 / 32768 * 16 -> g
    ax_g: Optional[float]
    ay_g: Optional[float]
    az_g: Optional[float]

    # Vibration velocity (registers 0x3A–0x3C): scale TBD from datasheet -> mm/s
    vx_mm_s: Optional[float]
    vy_mm_s: Optional[float]
    vz_mm_s: Optional[float]

    # Angle (registers 0x3D–0x3F): scale TBD from datasheet -> degrees
    angle_x: Optional[float]
    angle_y: Optional[float]
    angle_z: Optional[float]

    # Temperature (register 0x40): likely signed_16 / 100 -> °C (unverified)
    temperature_c: Optional[float]

    # Displacement (registers 0x41–0x43): scale TBD from datasheet -> µm
    dx_um: Optional[float]
    dy_um: Optional[float]
    dz_um: Optional[float]

    # Frequency (registers 0x44–0x46): scale TBD from datasheet -> Hz
    freq_x_hz: Optional[float]
    freq_y_hz: Optional[float]
    freq_z_hz: Optional[float]

    # GPS position — populated by GPSReader background thread (GPS-05)
    # Default None: field logger runs without GPS; existing callsites unaffected.
    gps_lat: Optional[float] = field(default=None)
    gps_lon: Optional[float] = field(default=None)
    gps_speed_mps: Optional[float] = field(default=None)
