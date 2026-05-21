# src/csv_logger.py
"""CSVLogger: timestamped CSV append with flush-per-row.

Implements STORE-01 through STORE-06 requirements for the WTVB01 Notebook Logger.

Key design decisions:
  - open(newline="") prevents \r\r\n double-CR on Windows (csv writes \r\n; text mode
    would add another \r -> corrupt CSV)
  - flush() after every writerow() satisfies STORE-04 (no buffered data lost on crash)
  - None fields explicitly converted to "" (STORE-06 compliance; clearer than relying
    on csv.writer's implicit None -> "" behaviour)
  - sensor_id placed LAST in row (STORE-02); do NOT use dataclasses.astuple() which
    gives SensorReading declaration order (sensor_id 2nd, not 18th)
"""
import csv
from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo  # type: ignore[no-redef]  # Python 3.8

from src.utils import SensorReading, TZ_SAO_PAULO

# ---------------------------------------------------------------------------
# STORE-02: 18-column header — sensor_id LAST (differs from SensorReading field order)
# ---------------------------------------------------------------------------

CSV_HEADER = [
    "timestamp",
    "ax_g", "ay_g", "az_g",
    "vx_mm_s", "vy_mm_s", "vz_mm_s",
    "angle_x", "angle_y", "angle_z",
    "temperature_c",
    "dx_um", "dy_um", "dz_um",
    "freq_x_hz", "freq_y_hz", "freq_z_hz",
    "sensor_id",   # 18th column — LAST per STORE-02
]


class CSVLogger:
    """Owns the CSV file lifecycle for one acquisition session.

    Opens the file on construction, writes the header, and exposes write_row()
    for per-sample data. close() is idempotent.

    Usage in main.py (try/finally guarantees cleanup on Ctrl+C):
        logger = CSVLogger(config.output_folder, config.csv_filename_prefix)
        try:
            while True:
                reading = sensor.read_all_data()
                if reading is not None:
                    logger.write_row(reading)
        finally:
            logger.close()
    """

    def __init__(self, output_folder: str, prefix: str) -> None:
        """Open (or create) the CSV file and write the header.

        Args:
            output_folder: Directory where the CSV will be written. Created
                           automatically with all parent directories if absent (STORE-05).
            prefix: Filename prefix; the full name is ``{prefix}_YYYYMMDD_HHMMSS.csv``
                    timestamped in America/Sao_Paulo timezone (STORE-01).
        """
        folder = Path(output_folder)
        folder.mkdir(parents=True, exist_ok=True)  # STORE-05

        ts = datetime.now(tz=TZ_SAO_PAULO).strftime("%Y%m%d_%H%M%S")
        self.path: Path = folder / f"{prefix}_{ts}.csv"  # STORE-01

        # newline="" required on Windows: csv writes \r\n; text mode would produce \r\r\n
        self._file = open(self.path, "w", newline="", encoding="utf-8")
        self._writer = csv.writer(self._file)
        self._writer.writerow(CSV_HEADER)  # STORE-02: header on first row only
        self._file.flush()                 # flush header immediately

        self.rows_written: int = 0

    def write_row(self, reading: SensorReading) -> None:
        """Write one SensorReading as a CSV data row.

        None fields (e.g., angle_x/y/z which are RESERVED on WTVB01-485) become
        empty CSV cells per STORE-06. File is flushed after every row (STORE-04).

        Args:
            reading: Populated SensorReading from WitMotionSensor.read_all_data().
        """
        # Explicit named-field access in STORE-02 column order (sensor_id LAST).
        # Do NOT use dataclasses.astuple(reading) — that gives SensorReading field order
        # (sensor_id at index 1) which violates STORE-02.
        def _cell(value: Optional[float]) -> object:
            return value if value is not None else ""

        row = [
            reading.timestamp,
            _cell(reading.ax_g),
            _cell(reading.ay_g),
            _cell(reading.az_g),
            _cell(reading.vx_mm_s),
            _cell(reading.vy_mm_s),
            _cell(reading.vz_mm_s),
            _cell(reading.angle_x),
            _cell(reading.angle_y),
            _cell(reading.angle_z),
            _cell(reading.temperature_c),
            _cell(reading.dx_um),
            _cell(reading.dy_um),
            _cell(reading.dz_um),
            _cell(reading.freq_x_hz),
            _cell(reading.freq_y_hz),
            _cell(reading.freq_z_hz),
            reading.sensor_id,             # STORE-02: sensor_id last (column 18)
        ]
        self._writer.writerow(row)
        self._file.flush()                 # STORE-04: no buffered data lost on Ctrl+C
        self.rows_written += 1

    def close(self) -> None:
        """Close the underlying file. Safe to call multiple times (idempotent)."""
        if self._file and not self._file.closed:
            self._file.close()
