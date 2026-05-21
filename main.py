"""main.py — WTVB01 Notebook Logger acquisition loop entry point.

Wires config_loader, WitMotionSensor, and CSVLogger into a continuous
polling loop with graceful Ctrl+C shutdown and session summary.

Requirements satisfied:
  CONN-02: sensor.close() + csv_logger.close() always called in finally block
  DISP-01: one formatted line printed per successful sample
  DISP-02: error/warning messages on connect failure and read failure
  DISP-03: session summary (samples, CSV path, elapsed) on Ctrl+C
"""
from __future__ import annotations

import sys
import time

from src.sensor import WitMotionSensor
from src.csv_logger import CSVLogger
from src.config_loader import load_config
from src.utils import setup_logging


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _format_reading(reading) -> str:
    """Return a one-line display string for a SensorReading.

    Handles temperature_c=None gracefully (omits the temperature field).
    """
    ax = reading.ax_g if reading.ax_g is not None else 0.0
    ay = reading.ay_g if reading.ay_g is not None else 0.0
    az = reading.az_g if reading.az_g is not None else 0.0
    temp = f"  T={reading.temperature_c:.1f}C" if reading.temperature_c is not None else ""
    return f"{reading.timestamp}  ax={ax:+.3f}g  ay={ay:+.3f}g  az={az:+.3f}g{temp}"


# ---------------------------------------------------------------------------
# Main acquisition loop
# ---------------------------------------------------------------------------

def main() -> None:
    """Load config, connect sensor, run polling loop, print summary on exit."""
    config = load_config()
    setup_logging(level=config.log_level)

    csv_logger = CSVLogger(config.output_folder, config.csv_filename_prefix)
    print(f"[INFO] CSV: {csv_logger.path}")

    sensor = WitMotionSensor(config)
    print(f"[INFO] Connecting to {config.serial_port}...")

    if not sensor.connect():
        print(
            f"[ERROR] Cannot connect to {config.serial_port}. "
            "Check cable and config.yaml."
        )
        sys.exit(1)

    hz = 1.0 / config.sample_interval_seconds if config.sample_interval_seconds > 0 else 0
    print(f"[INFO] Connected. Logging at {hz:.1f} Hz. Ctrl+C to stop.")

    start_time = time.monotonic()
    samples_written = 0

    try:
        while True:
            reading = sensor.read_all_data()
            if reading is not None:
                csv_logger.write_row(reading)
                samples_written += 1
                print(_format_reading(reading))       # DISP-01
            else:
                print("[WARN] Read failed - retrying...")  # DISP-02
            time.sleep(config.sample_interval_seconds)
    except KeyboardInterrupt:
        elapsed = time.monotonic() - start_time       # DISP-03
        mins, secs = divmod(elapsed, 60)
        dur = f"{int(mins)}m{secs:.1f}s" if mins >= 1 else f"{elapsed:.1f}s"
        print()
        print("--- Session Summary ---")
        print(f"  Samples written : {samples_written}")
        print(f"  CSV file        : {csv_logger.path}")
        print(f"  Elapsed         : {dur}")
    finally:
        sensor.close()       # CONN-02: always runs, even on unexpected exceptions
        csv_logger.close()   # CONN-02: always runs


if __name__ == "__main__":
    main()
