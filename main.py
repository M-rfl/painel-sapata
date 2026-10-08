"""main.py — WTVB01 Notebook Logger acquisition loop entry point.

Wires config_loader, WitMotionSensor, CSVLogger, and GPSReader into a continuous
polling loop with graceful Ctrl+C shutdown and session summary.

Supports two modes:
  python main.py           — headless (v1.0 behavior, unchanged)
  python main.py --gui     — real-time matplotlib visualizer

Requirements satisfied:
  CONN-02: sensor.close() + csv_logger.close() always called in finally block
  DISP-01: one formatted line printed per successful sample
  DISP-02: error/warning messages on connect failure and read failure
  DISP-03: session summary (samples, CSV path, elapsed) on Ctrl+C
  GPS-03:  GPS runs in background thread — 10 Hz acquisition loop is not delayed
  GPS-04:  GPS status line printed at startup before acquisition loop
  GPS-09:  Actionable message when Windows location permission is denied
  INTG-01: no --gui flag stays headless (zero regression from v1.0)
  INTG-02: --gui mode writes CSV rows via acquisition thread
  INTG-03: --gui mode calls PlotManager.update_data from acquisition thread
  INTG-04: window close triggers session summary and resource cleanup
"""
from __future__ import annotations

import argparse
import sys
import time
import threading

from src.sensor import WitMotionSensor
from src.csv_logger import CSVLogger
from src.config_loader import load_config
from src.utils import setup_logging

# GPS reader — graceful fallback if module or winsdk is missing (GPS-08)
try:
    from src.gps_reader import GPSReader
except ImportError:
    GPSReader = None  # type: ignore[assignment,misc]

# PlotManager NOT imported here — deferred to _run_gui_mode() to prevent
# Tk backend activation on headless / test environments.


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


def _print_summary(samples_written: int, csv_path, start_time: float) -> None:
    """Print session summary identical to v1.0 format.

    Args:
        samples_written: Number of rows written to CSV.
        csv_path: Path string to the CSV file.
        start_time: monotonic start time (from time.monotonic()).
    """
    elapsed = time.monotonic() - start_time       # DISP-03
    mins, secs = divmod(elapsed, 60)
    dur = f"{int(mins)}m{secs:.1f}s" if mins >= 1 else f"{elapsed:.1f}s"
    print()
    print("--- Session Summary ---")
    print(f"  Samples written : {samples_written}")
    print(f"  CSV file        : {csv_path}")
    print(f"  Elapsed         : {dur}")


# ---------------------------------------------------------------------------
# GPS background poller
# ---------------------------------------------------------------------------

def _gps_poll_loop(gps_reader, stop_event) -> None:
    """Background thread: call gps_reader.poll() at ~1 Hz until stop_event set.

    Args:
        gps_reader: GPSReader instance to poll.
        stop_event: threading.Event — loop exits when set.
    """
    while not stop_event.is_set():
        gps_reader.poll()
        stop_event.wait(timeout=1.0)


# ---------------------------------------------------------------------------
# GUI acquisition background thread
# ---------------------------------------------------------------------------

def _acquire(sensor, csv_logger, config, pm, stop_event, samples_ref, gps_reader=None) -> None:
    """Background thread: poll sensor and push data to PlotManager until stopped.

    Uses stop_event.wait() instead of time.sleep() so it responds immediately
    to stop signals from the close_event handler.

    Args:
        sensor: Connected WitMotionSensor instance.
        csv_logger: Open CSVLogger instance.
        config: AppConfig with sample_interval_seconds.
        pm: PlotManager instance (thread-safe update_data via GIL).
        stop_event: threading.Event — loop exits when set.
        samples_ref: Mutable list [int] used as counter (avoids nonlocal).
        gps_reader: GPSReader instance or None (GPS-03).
    """
    while not stop_event.is_set():
        reading = sensor.read_all_data()
        if reading is not None:
            if gps_reader is not None:
                reading.gps_lat, reading.gps_lon, reading.gps_speed_mps = gps_reader.get_location()
            csv_logger.write_row(reading)
            pm.update_data(reading)
            samples_ref[0] += 1
            print(_format_reading(reading))       # DISP-01
        else:
            print("[WARN] Read failed - retrying...")  # DISP-02
        stop_event.wait(timeout=config.sample_interval_seconds)


# ---------------------------------------------------------------------------
# Mode implementations
# ---------------------------------------------------------------------------

def _run_headless_mode(sensor, csv_logger, config, start_time: float, gps_reader=None, gps_stop=None) -> None:
    """Run the v1.0 acquisition loop — zero semantic changes from original main().

    Blocks until KeyboardInterrupt (Ctrl+C), then prints session summary
    and returns so the caller's finally block can close resources.

    Args:
        sensor: Connected WitMotionSensor instance.
        csv_logger: Open CSVLogger instance.
        config: AppConfig with sample_interval_seconds.
        start_time: monotonic start time (from time.monotonic()).
        gps_reader: GPSReader instance or None (GPS-03).
        gps_stop: threading.Event to stop GPS thread, or None.
    """
    samples_written = 0
    try:
        while True:
            reading = sensor.read_all_data()
            if reading is not None:
                if gps_reader is not None:
                    reading.gps_lat, reading.gps_lon, reading.gps_speed_mps = gps_reader.get_location()
                csv_logger.write_row(reading)
                samples_written += 1
                print(_format_reading(reading))       # DISP-01
            else:
                print("[WARN] Read failed - retrying...")  # DISP-02
            time.sleep(config.sample_interval_seconds)
    except KeyboardInterrupt:
        _print_summary(samples_written, csv_logger.path, start_time)
    finally:
        if gps_stop is not None:
            gps_stop.set()       # stop GPS background thread
        sensor.close()       # CONN-02: always runs
        csv_logger.close()   # CONN-02: always runs


def _run_gui_mode(sensor, csv_logger, config, start_time: float, gps_reader=None, gps_stop=None) -> None:
    """Run acquisition with real-time matplotlib visualizer.

    Architecture:
      - Acquisition runs in a daemon background thread (_acquire).
      - plt.show() blocks on the main thread inside pm.start().
      - close_event fires _on_close which sets stop_event, unblocking the thread.

    PlotManager is imported here (not at module level) to prevent Tk activation
    in headless and test environments.

    Args:
        sensor: Connected WitMotionSensor instance.
        csv_logger: Open CSVLogger instance.
        config: AppConfig with sample_interval_seconds.
        start_time: monotonic start time (from time.monotonic()).
        gps_reader: GPSReader instance or None (GPS-03).
        gps_stop: threading.Event to stop GPS thread, or None.
    """
    from src.visualizer import PlotManager  # deferred import — no Tk at module level

    stop_event = threading.Event()
    samples_ref = [0]  # mutable counter — avoids nonlocal across thread boundary

    pm = PlotManager()

    def _on_close(event):  # noqa: ANN001
        """Called by matplotlib when the figure window is closed."""
        stop_event.set()

    # Register close handler BEFORE starting threads (avoids race on instant close)
    pm._fig.canvas.mpl_connect("close_event", _on_close)

    acq_thread = threading.Thread(
        target=_acquire,
        args=(sensor, csv_logger, config, pm, stop_event, samples_ref),
        kwargs={"gps_reader": gps_reader},
        daemon=True,
        name="acq-thread",
    )
    acq_thread.start()

    try:
        pm.start()  # blocks main thread until window closes (plt.show() inside)
    except KeyboardInterrupt:
        pass  # Ctrl+C while GUI is open — treat same as window close
    finally:
        if gps_stop is not None:
            gps_stop.set()                  # stop GPS background thread
        stop_event.set()                # signal acquisition thread to stop
        acq_thread.join(timeout=2)      # wait for thread to finish (max 2s)
        _print_summary(samples_ref[0], csv_logger.path, start_time)
        sensor.close()                  # CONN-02
        csv_logger.close()              # CONN-02


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """Parse args, connect sensor, dispatch to headless or GUI mode."""
    parser = argparse.ArgumentParser(
        description="WTVB01 Notebook Logger — real-time acquisition"
    )
    parser.add_argument(
        "--gui",
        action="store_true",
        help="Open real-time matplotlib visualizer window",
    )
    args = parser.parse_args()

    config = load_config()
    setup_logging(level=config.log_level)

    # GPS: initialize reader, do one poll for startup status, start background thread (GPS-03, GPS-04)
    gps_reader = GPSReader() if GPSReader is not None else None
    gps_stop = threading.Event()
    if gps_reader is not None:
        gps_reader.poll()  # synchronous poll at startup to establish initial status
        gps_thread = threading.Thread(
            target=_gps_poll_loop,
            args=(gps_reader, gps_stop),
            daemon=True,
            name="gps-thread",
        )
        gps_thread.start()
        if gps_reader.status == "denied":
            print("GPS: location access denied — enable in Windows Settings › Privacy › Location")
        elif gps_reader.status == "unavailable":
            print("GPS: unavailable — install winrt-Windows.Devices.Geolocation to enable")
        elif gps_reader.status == "ok":
            print("GPS: fix acquired")
        else:
            print("GPS: searching for fix — CSV columns will fill once acquired")
    else:
        print("GPS: unavailable — install winrt-Windows.Devices.Geolocation to enable")

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

    if args.gui:
        _run_gui_mode(sensor, csv_logger, config, start_time, gps_reader, gps_stop)
    else:
        _run_headless_mode(sensor, csv_logger, config, start_time, gps_reader, gps_stop)


if __name__ == "__main__":
    main()
