# Phase 3: Acquisition Loop - Research

**Researched:** 2026-05-21
**Domain:** Python csv module, signal/KeyboardInterrupt handling, terminal display, main.py orchestration
**Confidence:** HIGH — all findings verified against installed Python 3.13.13 stdlib on this machine

---

## Summary

Phase 3 assembles the three completed building blocks (config_loader, WitMotionSensor, utilities) into a running `main.py` that logs continuously to CSV until Ctrl+C. It also implements `src/csv_logger.py` (currently a stub) as the CSVLogger class. No new third-party dependencies are introduced: everything required — `csv`, `pathlib`, `time`, `signal`, `dataclasses`, `datetime` — is Python stdlib.

The central design decision is the separation of concerns: `CSVLogger` owns the file lifecycle (open, write header, flush-per-row, close); `main.py` owns the acquisition loop (sensor connect, poll, display, shutdown summary). This separation makes each unit independently testable without hardware.

The most important implementation details for correctness: (1) `open(newline='')` is mandatory when writing CSV on Windows — the csv module writes `\r\n` line endings, and without `newline=''`, Python's text-mode translation produces `\r\r\n`; (2) `f.flush()` must be called after every `writerow()` to satisfy STORE-04 — `buffering=1` (line-buffered) is an equivalent alternative, but explicit `flush()` is more readable and portable; (3) `None` fields in `SensorReading` must become empty strings in the CSV row (not "None", not "NaN") — `dataclasses.astuple()` followed by a list comprehension accomplishes this cleanly.

**Primary recommendation:** Implement CSVLogger as a context manager using `try/finally` in `main.py`'s polling loop, with `KeyboardInterrupt` caught at the top level to print the session summary before the `finally` block closes the file. This guarantees the CSV is closed even on hard Ctrl+C.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONN-02 | Graceful disconnect on Ctrl+C: Modbus closed, CSV file closed | `KeyboardInterrupt` caught at top-level in `main.py`; `try/finally` ensures `sensor.close()` and `csv_logger.close()` run unconditionally |
| STORE-01 | CSV created on startup named `wtvb01_YYYYMMDD_HHMMSS.csv` in configured output folder | `datetime.now(TZ_SAO_PAULO).strftime('%Y%m%d_%H%M%S')` + `config.csv_filename_prefix`; folder auto-created by `Path.mkdir(parents=True, exist_ok=True)` |
| STORE-02 | CSV columns: timestamp, ax_g, ay_g, az_g, vx_mm_s, vy_mm_s, vz_mm_s, angle_x, angle_y, angle_z, temperature_c, dx_um, dy_um, dz_um, freq_x_hz, freq_y_hz, freq_z_hz, sensor_id (18 columns) | `csv.writer.writerow(HEADER)` on first row only; HEADER is an explicit list in STORE-02 column order (sensor_id last, not second as in SensorReading dataclass) |
| STORE-03 | Timestamp ISO 8601 with -03:00 offset | Already implemented in `get_timestamp_br()` from `src/utils.py`; `sensor.py` calls it per reading |
| STORE-04 | CSV flushed after each row (no buffered data lost on crash) | `f.flush()` after each `csv_writer.writerow()` inside CSVLogger; verified: explicit flush is the correct pattern for text files |
| STORE-05 | Output directory auto-created if absent | `Path(config.output_folder).mkdir(parents=True, exist_ok=True)` in CSVLogger constructor; verified working on Windows |
| STORE-06 | Failed-read channels appear as empty string (not NaN/ERROR) | `None` in SensorReading -> `''` via list comprehension before `writerow()`; verified: `csv.writer` writes `None` as empty string naturally, but explicit conversion is safer and self-documenting |
| DISP-01 | Terminal display updates every sample interval with timestamp + channel values | `print()` in polling loop after each successful or failed read; format: one line per sample |
| DISP-02 | Connection status messages in terminal (connected, error, reconnecting) | `print()` at connect/disconnect/error events in `main.py`; these are operational events, not per-sample |
| DISP-03 | Ctrl+C prints session summary (samples written, CSV path, elapsed duration) | Caught in `except KeyboardInterrupt` block; `time.monotonic()` for elapsed; counter tracked in polling loop |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| csv | stdlib | Write CSV rows with proper dialect | stdlib; handles quoting, escaping, dialect automatically |
| pathlib.Path | stdlib | Directory creation, file path construction | Modern Python path API; `mkdir(parents=True, exist_ok=True)` is one call |
| time | stdlib | `time.sleep()` for poll interval; `time.monotonic()` for elapsed timing | `monotonic()` never goes backward (immune to clock adjustments) |
| dataclasses | stdlib | `dataclasses.astuple()` to convert SensorReading to CSV row tuple | Preserves field order; avoids manual field listing |
| datetime | stdlib | Timestamp generation for CSV filename | Already used in `get_timestamp_br()` |
| src.utils | project (Phase 1) | `get_timestamp_br()`, `SensorReading`, `setup_logging()` | All implemented and tested (42 tests green) |
| src.sensor | project (Phase 2) | `WitMotionSensor.connect()`, `read_all_data()`, `close()` | Fully implemented and tested |
| src.config_loader | project (Phase 1) | `load_config()` -> `AppConfig` | Fully implemented and tested |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| signal | stdlib | Optional: `signal.signal(signal.SIGINT, handler)` | Alternative to bare `except KeyboardInterrupt`; less necessary since `KeyboardInterrupt` is reliable on Windows |
| sys | stdlib | `sys.exit()` in extreme fallback | Already used in config_loader for validation errors |
| logging | stdlib | Already configured via `setup_logging()` | Log errors/warnings; console is WARNING+, file is DEBUG |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `time.sleep(interval)` | `threading.Event().wait(timeout)` | Event is interruptible (good for shutdown), but Ctrl+C raises KeyboardInterrupt which breaks sleep anyway; sleep is simpler |
| `except KeyboardInterrupt` | `signal.signal(SIGINT, handler)` | Signal handler runs in main thread only; KeyboardInterrupt is cleaner in a linear script |
| Explicit `f.flush()` | `buffering=1` (line-buffered) | Both work on Windows; explicit flush is more visible, easier to test, works even in binary-adjacent situations |
| `dataclasses.astuple()` | Manual field access | `astuple()` preserves declaration order; auto-adapts if SensorReading gains/loses fields |

**Installation:** No new packages. Phase 3 uses only stdlib + project modules from Phases 1-2.

---

## Architecture Patterns

### Recommended Project Structure Addition

```
src/
├── csv_logger.py     # Phase 3 — CSVLogger class (replaces stub)
main.py               # Phase 3 — acquisition loop entry point (new file)
```

### Pattern 1: CSVLogger Context Manager / Explicit Lifecycle

**What:** A class that opens the file in its constructor, writes the header, and exposes `write_row(reading)` and `close()`. Can optionally implement `__enter__`/`__exit__` for use as a context manager, but explicit `try/finally` in `main.py` is equally correct.

**When to use:** Instantiated once in `main.py` at startup; `write_row()` called per sample; `close()` called in `finally` block.

```python
# src/csv_logger.py
# Source: Python 3.13.13 csv stdlib (verified on this machine)
import csv
import dataclasses
from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

from src.utils import SensorReading, TZ_SAO_PAULO

# STORE-02 column order: sensor_id is LAST (differs from SensorReading field order)
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

class CSVLogger:
    def __init__(self, output_folder: str, prefix: str) -> None:
        folder = Path(output_folder)
        folder.mkdir(parents=True, exist_ok=True)       # STORE-05
        ts = datetime.now(tz=TZ_SAO_PAULO).strftime("%Y%m%d_%H%M%S")
        self.path = folder / f"{prefix}_{ts}.csv"       # STORE-01
        # newline='' required on Windows: csv writes \r\n; text mode would double it
        self._file = open(self.path, "w", newline="", encoding="utf-8")
        self._writer = csv.writer(self._file)
        self._writer.writerow(CSV_HEADER)               # STORE-02 header, first row only
        self._file.flush()
        self.rows_written = 0

    def write_row(self, reading: SensorReading) -> None:
        """Write one SensorReading as a CSV row. None fields become empty string. (STORE-06)"""
        # STORE-02 column order: sensor_id last
        # SensorReading field order: timestamp(0), sensor_id(1), ax_g(2)..freq_z_hz(17)
        # Reorder: timestamp, ax_g..freq_z_hz, sensor_id
        row = [
            reading.timestamp,
            reading.ax_g if reading.ax_g is not None else "",
            reading.ay_g if reading.ay_g is not None else "",
            reading.az_g if reading.az_g is not None else "",
            reading.vx_mm_s if reading.vx_mm_s is not None else "",
            reading.vy_mm_s if reading.vy_mm_s is not None else "",
            reading.vz_mm_s if reading.vz_mm_s is not None else "",
            reading.angle_x if reading.angle_x is not None else "",
            reading.angle_y if reading.angle_y is not None else "",
            reading.angle_z if reading.angle_z is not None else "",
            reading.temperature_c if reading.temperature_c is not None else "",
            reading.dx_um if reading.dx_um is not None else "",
            reading.dy_um if reading.dy_um is not None else "",
            reading.dz_um if reading.dz_um is not None else "",
            reading.freq_x_hz if reading.freq_x_hz is not None else "",
            reading.freq_y_hz if reading.freq_y_hz is not None else "",
            reading.freq_z_hz if reading.freq_z_hz is not None else "",
            reading.sensor_id,
        ]
        self._writer.writerow(row)
        self._file.flush()                              # STORE-04: flush after every row
        self.rows_written += 1

    def close(self) -> None:
        """Close the underlying file. Safe to call multiple times."""
        if self._file and not self._file.closed:
            self._file.close()
```

### Pattern 2: main.py Acquisition Loop with Graceful Shutdown

**What:** Linear script: load config -> setup logging -> connect sensor -> open CSV -> poll loop -> shutdown on KeyboardInterrupt. `try/finally` guarantees cleanup regardless of how the loop exits.

**When to use:** This IS `main.py`. One file, no threads, no asyncio.

```python
# main.py (skeleton)
# Source: Python 3.13.13 stdlib patterns (verified on this machine)
import time
import sys

from src.config_loader import load_config
from src.sensor import WitMotionSensor
from src.csv_logger import CSVLogger
from src.utils import setup_logging

def main() -> None:
    config = load_config()
    setup_logging(level=config.log_level)

    sensor = WitMotionSensor(config)
    csv_logger = CSVLogger(config.output_folder, config.csv_filename_prefix)

    print(f"[INFO] CSV: {csv_logger.path}")
    print(f"[INFO] Connecting to {config.serial_port}...")

    start_time = time.monotonic()
    samples_written = 0

    try:
        if not sensor.connect():
            print(f"[ERROR] Cannot connect to {config.serial_port}. Check cable and config.yaml.")
            sys.exit(1)
        print(f"[INFO] Connected. Logging at {1/config.sample_interval_seconds:.1f} Hz. Ctrl+C to stop.")

        while True:
            reading = sensor.read_all_data()
            if reading is not None:
                csv_logger.write_row(reading)
                samples_written += 1
                # DISP-01: terminal display per sample
                print(_format_reading(reading))
            else:
                # DISP-02: connection status on error
                print("[WARN] Read failed — retrying...")
            time.sleep(config.sample_interval_seconds)

    except KeyboardInterrupt:
        # DISP-03: session summary
        elapsed = time.monotonic() - start_time
        print()
        print("--- Session Summary ---")
        print(f"  Samples written : {samples_written}")
        print(f"  CSV file        : {csv_logger.path}")
        print(f"  Elapsed         : {elapsed:.1f}s")
    finally:
        # CONN-02: always close Modbus and CSV
        sensor.close()
        csv_logger.close()

def _format_reading(reading) -> str:
    """Format SensorReading for terminal display. (DISP-01)"""
    return (
        f"{reading.timestamp}  "
        f"ax={reading.ax_g:+.3f}g  ay={reading.ay_g:+.3f}g  az={reading.az_g:+.3f}g  "
        f"T={reading.temperature_c:.1f}°C"
        if reading.temperature_c is not None else
        f"{reading.timestamp}  ax={reading.ax_g:+.3f}g  ay={reading.ay_g:+.3f}g  az={reading.az_g:+.3f}g"
    )

if __name__ == "__main__":
    main()
```

### Pattern 3: None-to-Empty-String Conversion for STORE-06

**What:** When `sensor.read_all_data()` returns a partial `SensorReading` (some fields `None`), those fields must appear as empty strings in the CSV row — not "None", not "NaN", not "ERROR".

**Verified behavior:**
- `csv.writer` writes Python `None` as empty string naturally, BUT explicit conversion is preferable for clarity and STORE-06 compliance documentation.
- Empty string (`""`) in a CSV cell appears as `,` between delimiters — correct per requirement.

```python
# Verified on Python 3.13.13:
# csv.writer writes None as '' (empty cell) — but use explicit '' for clarity
row_value = reading.ax_g if reading.ax_g is not None else ""
# This produces: ",1.234," for None, ax_g=None, az_g=1.234
```

### Pattern 4: CSV File Safety on Windows

**What:** Three properties required for a safe CSV file on Windows:

1. `newline=""` in `open()` — prevents double `\r\n`
2. `f.flush()` after each `writerow()` — prevents buffered data loss on Ctrl+C or power loss
3. `encoding="utf-8"` — consistent encoding for all platforms

**Verified:**
```python
# Verified on Python 3.13.13, Windows 10
# csv.excel dialect writes \r\n (CRLF) as line terminator
# text mode open() on Windows translates \n -> \r\n
# Without newline='': \r\n -> \r\r\n (double CR — corrupt CSV)
# With newline='': no translation — \r\n stays \r\n (correct)
self._file = open(self.path, "w", newline="", encoding="utf-8")
```

### Pattern 5: Filename Generation

**What:** CSV filename encodes the session start time so each run creates a new file.

```python
# Verified on Python 3.13.13
from datetime import datetime
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

ts = datetime.now(tz=ZoneInfo("America/Sao_Paulo")).strftime("%Y%m%d_%H%M%S")
filename = f"{prefix}_{ts}.csv"
# Produces: "wtvb01_20260521_113106.csv" — matches STORE-01 format
```

### Anti-Patterns to Avoid

- **`open(file, 'w')` without `newline=''` for CSV on Windows:** Produces `\r\r\n` line endings. Every CSV reader will see blank rows between data rows.
- **`newline='\n'` for CSV:** Overrides csv dialect line terminator; works on Linux but inconsistent on Windows.
- **Writing header on every row:** STORE-02 says header on first row only. Never call `writerow(CSV_HEADER)` in the polling loop.
- **`datetime.now()` without timezone:** Phase 1 decision: always use `get_timestamp_br()` or `datetime.now(tz=TZ_SAO_PAULO)`. Naive datetimes produce ISO strings without UTC offset.
- **`NaN` or `"ERROR"` for failed channels:** STORE-06 explicitly requires empty string. Do not use `float('nan')` or `math.nan` — they print as "nan" in the CSV.
- **`sys.exit()` inside the polling loop:** Bypasses `finally` on some Python implementations; raises `SystemExit` which IS caught by bare `except Exception`. Use `break` or `return` instead — let `KeyboardInterrupt` propagate normally.
- **Blocking `time.sleep()` without Ctrl+C handling:** On Windows, `KeyboardInterrupt` DOES interrupt `time.sleep()` correctly in the main thread — no workaround needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV formatting (quoting, escaping) | Custom string join | `csv.writer` | Edge cases: values with commas, quotes, newlines; csv handles all of them |
| Directory creation | Custom `os.makedirs` guard | `Path.mkdir(parents=True, exist_ok=True)` | One-liner; race-condition safe; already in stdlib |
| Elapsed time measurement | Subtracting `datetime.now()` calls | `time.monotonic()` | `monotonic()` is immune to NTP adjustments and DST changes; `datetime.now()` can go backward |
| Timestamp for filename | Custom format string | `datetime.now(tz=TZ_SAO_PAULO).strftime(...)` | Already using `TZ_SAO_PAULO` constant from `utils.py` |
| Field iteration for CSV row | Hardcoded `[r.ax_g, r.ay_g, ...]` | Explicit named access per STORE-02 column order | `dataclasses.astuple()` gives SensorReading order (sensor_id 2nd), not STORE-02 order (sensor_id last); explicit named access is clearer |

**Key insight:** The "hard" problems in this phase (CSV correctness on Windows, safe shutdown, partial-read handling) are all solved by stdlib features. The implementation is thin wiring of existing components.

---

## Common Pitfalls

### Pitfall 1: Double CRLF in CSV on Windows (STORE-04 silent corruption)
**What goes wrong:** CSV file opens in a spreadsheet and shows blank rows between every data row. File is technically not corrupt but fails visual inspection.
**Why it happens:** `csv.writer` uses `\r\n` (CRLF) as line terminator per the excel dialect. Python's `open()` in text mode on Windows translates `\n` to `\r\n`. Result: `\r\n` -> `\r\r\n`.
**How to avoid:** Always `open(path, "w", newline="", encoding="utf-8")` for CSV files. `newline=""` disables the translation.
**Warning signs:** CSV row count is double-spaced in Excel; `repr(open(f).read())` shows `\r\r\n`.

### Pitfall 2: Buffered data lost on Ctrl+C (STORE-04 violation)
**What goes wrong:** Last N rows appear in the CSV file after Ctrl+C but not as many as the sample counter shows. Exact count depends on Python's I/O buffer size (typically 8 KB).
**Why it happens:** Python text-mode file I/O is buffered by default. If the process is killed before the buffer is flushed, that data is lost.
**How to avoid:** Call `f.flush()` immediately after every `csv_writer.writerow()`. Alternatively, `buffering=1` (line buffering) achieves the same — but `flush()` is explicit and easier to test.
**Warning signs:** Missing the last few seconds of data after every Ctrl+C.

### Pitfall 3: Header written multiple times (STORE-02 violation)
**What goes wrong:** CSV file has a header row at row 1, then another header row after 1000 samples.
**Why it happens:** Developer puts `writerow(CSV_HEADER)` inside the polling loop, or calls `CSVLogger.__init__()` multiple times (e.g., on reconnect).
**How to avoid:** Write the header exactly once in `CSVLogger.__init__()`. Never call it again. Create a new `CSVLogger` instance (new file, new header) only on explicit restart.
**Warning signs:** CSV has non-numeric strings appearing as data rows at regular intervals.

### Pitfall 4: sensor_id column position mismatch (STORE-02 violation)
**What goes wrong:** CSV has `sensor_id` as the second column but REQUIREMENTS.md STORE-02 specifies it as the last (18th) column.
**Why it happens:** Developer writes `dataclasses.astuple(reading)` directly to `csv.writer` — this gives SensorReading's declaration order: `timestamp, sensor_id, ax_g, ...` (sensor_id 2nd). STORE-02 requires: `timestamp, ax_g, ..., freq_z_hz, sensor_id` (sensor_id last).
**How to avoid:** Use the explicit `CSV_HEADER` list as the column definition, and construct the row with `sensor_id` last.
**Warning signs:** Automated test comparing row[1] to expected ax_g value gets a string (sensor_id) instead.

### Pitfall 5: `finally` block not running on `sys.exit()` inside loop
**What goes wrong:** Calling `sys.exit(1)` inside the `while True` loop after a connection error bypasses `finally` in some contexts, leaving the Modbus connection open.
**Why it happens:** `sys.exit()` raises `SystemExit`, which is NOT a subclass of `KeyboardInterrupt`. If the `except` block catches `KeyboardInterrupt` specifically and `SystemExit` propagates up, `finally` does run — but the logic becomes fragile.
**How to avoid:** Use `break` to exit the polling loop on unrecoverable errors, then let `main()` return normally. Reserve `sys.exit(1)` for the config validation failure case (before any resources are opened).
**Warning signs:** Modbus port stays locked after an error exit; next run cannot connect until port is released.

### Pitfall 6: Ctrl+C during `time.sleep()` skips the summary print
**What goes wrong:** `KeyboardInterrupt` is raised mid-sleep; if the `except KeyboardInterrupt` block is not at the right level, the summary never prints.
**Why it happens:** `KeyboardInterrupt` is raised in the main thread at the next Python bytecode instruction during `time.sleep()`. If caught inside the `while True` loop body, it's swallowed; if caught only at `main()` top level, it works correctly.
**How to avoid:** Place the `except KeyboardInterrupt` at the top level of the polling structure (wrapping the `while True` loop, not inside it). The session summary lives in this except block.
**Warning signs:** Ctrl+C exits silently with no summary; CSV path not printed.

---

## Code Examples

Verified patterns from stdlib (Python 3.13.13 on this machine):

### CSV Row with None -> Empty String (STORE-06)

```python
# Verified: Python 3.13.13
import csv, io
buf = io.StringIO()
w = csv.writer(buf)
w.writerow([None, 1.23, "hello"])
# Result: ',1.23,hello\r\n'  (None -> empty cell)

# Preferred explicit form for STORE-06 compliance:
reading_value = None
row_cell = reading_value if reading_value is not None else ""
# Produces "" -> empty string in CSV
```

### CSV File Open Pattern (Windows-safe, STORE-04)

```python
# Verified: Python 3.13.13, Windows 10
# csv.excel dialect writes \r\n; newline='' prevents \r\r\n double-CR
self._file = open(self.path, "w", newline="", encoding="utf-8")
self._writer = csv.writer(self._file)
self._writer.writerow(CSV_HEADER)
self._file.flush()  # flush header immediately
```

### Filename Generation (STORE-01)

```python
# Verified: Python 3.13.13
from datetime import datetime
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

TZ_SAO_PAULO = ZoneInfo("America/Sao_Paulo")
ts = datetime.now(tz=TZ_SAO_PAULO).strftime("%Y%m%d_%H%M%S")
# ts = "20260521_113106"
path = Path(output_folder) / f"{prefix}_{ts}.csv"
# path = Path("data/wtvb01_20260521_113106.csv")
```

### Session Elapsed Time (DISP-03)

```python
# Verified: Python 3.13.13
import time
start = time.monotonic()
# ... polling loop ...
elapsed = time.monotonic() - start
# Format: "143.2s" or "2m23.2s"
mins, secs = divmod(elapsed, 60)
duration_str = f"{int(mins)}m{secs:.1f}s" if mins >= 1 else f"{elapsed:.1f}s"
```

### Directory Auto-Creation (STORE-05)

```python
# Verified: Python 3.13.13, Windows 10
from pathlib import Path
folder = Path(output_folder)
folder.mkdir(parents=True, exist_ok=True)  # no-op if already exists; creates all parents
```

### Keyboard Interrupt Pattern (CONN-02, DISP-03)

```python
# Verified: KeyboardInterrupt IS raised on Ctrl+C in Python main thread on Windows
# signal.SIGINT is available on Windows (verified: hasattr(signal, 'SIGINT') == True)
import time

start = time.monotonic()
samples_written = 0
try:
    while True:
        # ... read and write ...
        time.sleep(interval)
except KeyboardInterrupt:
    elapsed = time.monotonic() - start
    print(f"\nSamples: {samples_written}, File: {csv_path}, Elapsed: {elapsed:.1f}s")
finally:
    sensor.close()    # CONN-02: always runs
    csv_logger.close()
```

---

## Critical Design Note: STORE-02 Column Order vs SensorReading Field Order

This is a confirmed mismatch between the REQUIREMENTS.md specification and the existing `SensorReading` dataclass:

| | Column position of `sensor_id` |
|---|---|
| REQUIREMENTS.md STORE-02 | 18th (last) |
| SensorReading field order | 2nd (after timestamp) |

**Resolution (HIGH confidence):** The CSV must use the STORE-02 column order. `CSVLogger.write_row()` must construct the row with explicit named field access, placing `sensor_id` last. Do NOT use `dataclasses.astuple(reading)` directly — it gives the wrong column order.

The `CSV_HEADER` list must be:
```python
CSV_HEADER = [
    "timestamp",
    "ax_g", "ay_g", "az_g",
    "vx_mm_s", "vy_mm_s", "vz_mm_s",
    "angle_x", "angle_y", "angle_z",
    "temperature_c",
    "dx_um", "dy_um", "dz_um",
    "freq_x_hz", "freq_y_hz", "freq_z_hz",
    "sensor_id",   # last per STORE-02
]
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `open(f, 'w')` for CSV | `open(f, 'w', newline='')` | Python 3.0 (csv module requirement) | Without this, double CRLF on Windows corrupts every CSV |
| `time.time()` for elapsed | `time.monotonic()` | Python 3.3 | `monotonic()` is immune to clock adjustments |
| `os.makedirs(path, exist_ok=True)` | `Path(path).mkdir(parents=True, exist_ok=True)` | Python 3.4 (pathlib) | Same result, more readable |
| Manual CSV string join | `csv.writer` | Always | Handles quoting, escaping edge cases |

**No deprecated features apply to Phase 3.** All stdlib APIs used are stable and unchanged in Python 3.13.

---

## Open Questions

1. **Terminal display format for DISP-01**
   - What we know: must show "timestamp and formatted channel values" per DISP-01; no specific format required
   - What's unclear: one line per sample vs multi-line per sample; which channels to show; whether to use `print()` or `logging`
   - Recommendation: one line per sample using `print()` directly (not logging) so it always appears regardless of log level; show timestamp + acceleration + temperature as minimum; velocity/displacement/frequency as secondary

2. **Handling `sensor.connect()` returning False at startup**
   - What we know: `connect()` returns bool; `main.py` must decide whether to exit or retry
   - What's unclear: should it retry with backoff (more robust) or exit immediately (simpler)?
   - Recommendation: exit immediately with a clear error message — matches the "simple CLI tool" scope; retry logic adds complexity with no specification requirement

3. **CSV logger behavior on partial reads (STORE-06 edge case)**
   - What we know: `read_all_data()` returns `None` for total failure; `SensorReading` fields are `Optional[float]` for partial failure
   - What's unclear: can `read_all_data()` return a SensorReading with some fields None (partial) or only all-good/None (total)?
   - Verified: current `sensor.py` implementation returns `None` for total failure and a fully-populated SensorReading for success (with `angle_x/y/z` always `None` per manual spec). STORE-06 "partial read" handling is satisfied by the None -> "" conversion.

---

## Validation Architecture

Nyquist validation enabled (`nyquist_validation: true` in `.planning/config.json`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.0.3 (already installed; 42 tests green) |
| Config file | pytest.ini (already exists) |
| Quick run command | `pytest tests/test_csv_logger.py tests/test_main.py -x -q` |
| Full suite command | `pytest tests/ -v --tb=short` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STORE-01 | CSVLogger creates file named `{prefix}_YYYYMMDD_HHMMSS.csv` in configured folder | unit | `pytest tests/test_csv_logger.py::test_file_created_with_correct_name -x` | Wave 0 gap |
| STORE-01 | Output folder is auto-created if absent | unit | `pytest tests/test_csv_logger.py::test_output_folder_created -x` | Wave 0 gap |
| STORE-02 | First row is the 18-column header in STORE-02 order (sensor_id last) | unit | `pytest tests/test_csv_logger.py::test_header_row_columns -x` | Wave 0 gap |
| STORE-02 | Header written exactly once (not repeated in subsequent rows) | unit | `pytest tests/test_csv_logger.py::test_header_written_once -x` | Wave 0 gap |
| STORE-03 | Timestamp column value matches ISO 8601 -03:00 format | unit | `pytest tests/test_csv_logger.py::test_timestamp_format -x` | Wave 0 gap |
| STORE-04 | File is readable after write_row() without explicit close (flush proof) | unit | `pytest tests/test_csv_logger.py::test_flush_after_each_row -x` | Wave 0 gap |
| STORE-05 | Directory created if not exists (use tmp_path) | unit | `pytest tests/test_csv_logger.py::test_output_folder_created -x` | Wave 0 gap |
| STORE-06 | None field in SensorReading -> empty string in CSV cell | unit | `pytest tests/test_csv_logger.py::test_none_fields_become_empty_string -x` | Wave 0 gap |
| STORE-06 | Total read failure (sensor returns None) -> row NOT written; counter not incremented | unit | `pytest tests/test_csv_logger.py::test_failed_read_not_written -x` | Wave 0 gap |
| CONN-02 | sensor.close() and csv_logger.close() called even on KeyboardInterrupt | unit | `pytest tests/test_main.py::test_graceful_shutdown_closes_resources -x` | Wave 0 gap |
| DISP-03 | Session summary printed to stdout on KeyboardInterrupt | unit | `pytest tests/test_main.py::test_session_summary_on_ctrl_c -x` | Wave 0 gap |
| DISP-01 | Terminal line printed per sample (stdout) | unit | `pytest tests/test_main.py::test_terminal_display_per_sample -x` | Wave 0 gap |
| DISP-02 | Connection error message printed to stdout | unit | `pytest tests/test_main.py::test_connection_status_messages -x` | Wave 0 gap |

### Sampling Rate
- **Per task commit:** `pytest tests/test_csv_logger.py -x -q` (for CSVLogger task) or `pytest tests/test_main.py -x -q` (for main.py task)
- **Per wave merge:** `pytest tests/ -v --tb=short` (all 42+ tests)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_csv_logger.py` — unit tests for CSVLogger (STORE-01 through STORE-06); uses `tmp_path` fixture
- [ ] `tests/test_main.py` — unit tests for main.py polling loop (CONN-02, DISP-01, DISP-02, DISP-03); patches `WitMotionSensor` and `CSVLogger`

*(conftest.py and framework already exist — no framework installation needed)*

---

## Sources

### Primary (HIGH confidence)
- Python 3.13.13 stdlib (installed on this machine) — `csv` module: `csv.writer`, `csv.excel.lineterminator`, `newline=''` requirement verified by running code
- Python 3.13.13 stdlib (installed on this machine) — `pathlib.Path.mkdir(parents=True, exist_ok=True)` verified working on Windows 10
- Python 3.13.13 stdlib (installed on this machine) — `time.monotonic()` for elapsed time; `time.sleep()` Ctrl+C behavior verified
- Python 3.13.13 stdlib (installed on this machine) — `dataclasses.astuple()` field order confirmed via `SensorReading` live test
- Python 3.13.13 stdlib (installed on this machine) — `signal.SIGINT` available on Windows; `KeyboardInterrupt` interrupts `time.sleep()` in main thread
- `src/utils.py` (Phase 1 complete) — `SensorReading` fields: 18 fields, sensor_id at index 1 (confirmed live)
- `src/sensor.py` (Phase 2 complete) — `WitMotionSensor` API confirmed; returns `SensorReading` or `None`
- `src/config_loader.py` (Phase 1 complete) — `AppConfig` fields including `output_folder`, `csv_filename_prefix`, `sample_interval_seconds`

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md STORE-02 — 18 CSV column names and order including `sensor_id` last (project-defined authoritative source)
- pytest 9.0.3 test run on this machine — 42 existing tests pass; new tests for Phase 3 can use identical fixtures and `@patch` patterns

### Tertiary (LOW confidence)
- None — all Phase 3 findings are verifiable against installed stdlib and existing project code

---

## Metadata

**Confidence breakdown:**
- csv module behavior (newline, flush, None handling): HIGH — verified by running code on Python 3.13.13 Windows 10
- KeyboardInterrupt + try/finally pattern: HIGH — standard Python idiom, verified on Windows
- STORE-02 column order mismatch: HIGH — confirmed by comparing REQUIREMENTS.md text vs SensorReading live field order
- Test patterns (patch, tmp_path): HIGH — already in use in 42 passing tests

**Research date:** 2026-05-21
**Valid until:** 2026-08-21 (stdlib APIs do not change within a Python minor version; pinned versions)
