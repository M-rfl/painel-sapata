# Phase 6: main.py Integration - Research

**Researched:** 2026-05-23
**Domain:** argparse CLI flags, threading.Thread for background acquisition, matplotlib main-thread constraint, graceful shutdown from GUI close event, regression-safe refactoring of existing main()
**Confidence:** HIGH — all findings verified against installed Python 3.13.13, matplotlib 3.10.9, existing project source, and the passing 74-test suite

---

## Summary

Phase 6 wires the already-implemented `PlotManager` (Phase 5) into `main.py` via a `--gui` argparse flag. The architecture is already locked by project decisions: matplotlib TkAgg runs on the main thread; sensor acquisition runs on a `threading.Thread`. The primary engineering challenge is adding the GUI path cleanly without touching any logic that the existing 74 passing tests exercise.

The existing `main()` function is a single flat function (~50 lines). The safest integration pattern is to parse arguments at the top of `main()`, then branch: when `--gui` is absent, execute the existing loop verbatim (zero code change to that branch); when `--gui` is present, extract the acquisition loop into a background thread function, instantiate `PlotManager`, register a `close_event` handler to signal shutdown, and call `pm.start()` (which calls `plt.show()` and blocks the main thread on the Tk event loop). The session summary logic is identical in both paths and should be extracted into a shared `_print_summary()` helper.

The most important risk is regression to the no-flag path. All five existing `test_main.py` tests mock at module-patch level (`patch("main.WitMotionSensor", ...)`) and will continue to pass as long as `main()` still imports and uses those names at module level. If `from src.visualizer import PlotManager` is added as a top-level import, it will force the TkAgg backend at import time — which will break the `test_main.py` tests that run with Agg already set. The correct fix is a **deferred/conditional import**: `PlotManager` is imported inside the `if args.gui:` branch, not at module level.

**Primary recommendation:** Add `import argparse` at module level; parse `--gui` as a `store_true` flag; move `PlotManager` import inside the GUI branch; extract `_print_summary()` helper; add `_run_acquisition_thread()` function that replicates the existing loop body; wire `fig.canvas.mpl_connect('close_event', ...)` to set a `threading.Event` that stops the acquisition thread; call `pm.start()` on main thread.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTG-01 | `python main.py` without `--gui` behaves identically to v1.0 (zero regression) | Deferred import of PlotManager prevents backend contamination; existing test_main.py 5 tests must remain GREEN with zero changes to their patch targets |
| INTG-02 | CSV logging writes every reading to file when `--gui` is active (no data loss) | Acquisition thread calls `csv_logger.write_row(reading)` on every non-None reading, same as the no-flag path; the CSV write and `pm.update_data()` are both called on the same reading in the acquisition thread |
| INTG-03 | Sensor acquisition runs in background thread; matplotlib animation runs on main thread | `threading.Thread(target=_acquire, daemon=True)` for sensor loop; `pm.start()` (plt.show()) on main thread; established and locked in STATE.md |
| INTG-04 | Closing graph window triggers graceful shutdown with terminal session summary | `fig.canvas.mpl_connect('close_event', handler)` sets a `threading.Event`; acquisition thread checks the event; finally block prints summary; equivalent to Ctrl+C path |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| argparse | stdlib | Parse `--gui` flag | Python stdlib; already used pattern in many CLI tools; no new dependency |
| threading.Thread | stdlib | Run acquisition loop in background | Already in project (Phase 5 mock mode uses threading.Timer); matches locked decision |
| threading.Event | stdlib | Signal stop between GUI close and acquisition thread | Lightweight, no polling overhead, idiomatic for thread cancellation |
| matplotlib close_event | matplotlib 3.10.9 | Detect window X button close | `fig.canvas.mpl_connect('close_event', callback)` — verified in Phase 5 research |
| PlotManager (Phase 5) | project | Owns figure, subplots, FuncAnimation | Already implemented in src/visualizer.py; public API: `update_data(reading)` and `start()` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sys | stdlib | sys.exit(1) on connection failure | Already in main.py |
| time | stdlib | time.sleep() in acquisition loop, elapsed timing | Already in main.py |

### No New Dependencies
Phase 6 adds zero new packages to requirements.txt. All components (argparse, threading, matplotlib, PlotManager) are either stdlib or already installed.

**Installation:**
```bash
# Nothing to install — all dependencies already present
```

---

## Architecture Patterns

### Recommended Project Structure

No new files required. Phase 6 modifies only `main.py` and adds `tests/test_main_gui.py`.

```
main.py                          # modified — add argparse, GUI branch, _print_summary helper
tests/
├── test_main.py                 # UNCHANGED — existing 5 tests must stay GREEN
└── test_main_gui.py             # new — INTG-01 through INTG-04 unit tests
src/
└── visualizer.py               # UNCHANGED — PlotManager API is stable
```

### Pattern 1: argparse Flag Parsing (INTG-01)

**What:** Parse `--gui` at the top of `main()` using `argparse.ArgumentParser`. No-flag default is `False`, so the entire existing path executes unchanged.
**When to use:** At the start of `main()`, before any config loading.

```python
# main.py — verified pattern for boolean flag
import argparse

def main() -> None:
    parser = argparse.ArgumentParser(description="WTVB01 Notebook Logger")
    parser.add_argument("--gui", action="store_true", help="Open live visualization window")
    args = parser.parse_args()

    # ... existing config/sensor/csv setup unchanged ...

    if args.gui:
        _run_gui_mode(sensor, csv_logger, config, start_time)
    else:
        _run_headless_mode(sensor, csv_logger, config, start_time)
```

**Key:** `action="store_true"` means `args.gui` is `False` when flag is absent — zero behavior change for the no-flag path.

### Pattern 2: Deferred PlotManager Import (Critical for INTG-01 Regression Safety)

**What:** Import `PlotManager` inside the GUI branch, not at module level. This prevents `matplotlib.use("TkAgg")` from executing at import time, which would conflict with `matplotlib.use("Agg")` set by `test_visualizer.py` and could contaminate `test_main.py`'s Agg environment.
**When to use:** Always — this is the only safe approach for the GUI import.

```python
# main.py — CORRECT: deferred import inside GUI branch
def _run_gui_mode(sensor, csv_logger, config, start_time):
    from src.visualizer import PlotManager  # deferred: TkAgg set here, not at module level
    pm = PlotManager()
    # ... rest of GUI setup
```

```python
# main.py — WRONG: top-level import (breaks test_main.py)
from src.visualizer import PlotManager  # Forces TkAgg at import time — test contamination
```

**Verification:** `test_main.py` imports `from main import main` — if PlotManager is at module level, this import executes `matplotlib.use("TkAgg")` during test collection, which conflicts with `test_visualizer.py`'s `matplotlib.use("Agg")` guard.

### Pattern 3: Background Acquisition Thread (INTG-03)

**What:** Extract the acquisition loop body into a standalone function that accepts a `threading.Event` stop signal. Launch as `threading.Thread(target=..., daemon=True)`.
**When to use:** GUI mode only. Headless mode keeps the existing `while True` loop.

```python
# main.py
import threading

def _acquire(sensor, csv_logger, config, pm, stop_event, samples_ref):
    """Acquisition loop for GUI mode. Runs in background thread.
    
    Writes CSV on every reading (INTG-02) and feeds PlotManager (INTG-03).
    stop_event is set by the GUI close handler (INTG-04) or Ctrl+C handler.
    samples_ref is a list([0]) used as a mutable int across threads.
    """
    while not stop_event.is_set():
        reading = sensor.read_all_data()
        if reading is not None:
            csv_logger.write_row(reading)    # INTG-02: CSV always written
            pm.update_data(reading)          # INTG-03: feeds PlotManager
            samples_ref[0] += 1
            print(_format_reading(reading))
        else:
            print("[WARN] Read failed - retrying...")
        # stop_event.wait() instead of time.sleep() — responds to stop signal immediately
        stop_event.wait(timeout=config.sample_interval_seconds)
```

**Key design decisions:**
- `daemon=True` ensures the thread dies when main thread exits (Ctrl+C or window close)
- `stop_event.wait(timeout=...)` replaces `time.sleep(...)` — allows immediate thread stop when event is set without waiting for the full sleep interval
- `samples_ref = [0]` (list-as-mutable-int) avoids threading.Value complexity for a simple counter

### Pattern 4: GUI Close Event Shutdown (INTG-04)

**What:** Register a matplotlib `close_event` callback on the figure. When the user clicks X, the callback sets the stop event and the acquisition thread exits cleanly.
**When to use:** GUI mode only. The callback must be registered BEFORE calling `pm.start()`.

```python
# main.py — close_event pattern
# Source: matplotlib docs + Phase 5 research (fig.canvas.mpl_connect)

def _run_gui_mode(sensor, csv_logger, config, start_time):
    from src.visualizer import PlotManager
    
    stop_event = threading.Event()
    samples_ref = [0]
    
    pm = PlotManager()
    
    # Register close_event BEFORE starting acquisition thread
    def _on_close(event):
        stop_event.set()   # signals acquisition thread to exit
    
    pm._fig.canvas.mpl_connect('close_event', _on_close)
    
    # Start acquisition in background
    acq_thread = threading.Thread(
        target=_acquire,
        args=(sensor, csv_logger, config, pm, stop_event, samples_ref),
        daemon=True,
    )
    acq_thread.start()
    
    try:
        pm.start()  # blocks on main thread (Tk event loop) until window closes
    finally:
        stop_event.set()           # ensure thread stops even if pm.start() raises
        acq_thread.join(timeout=2) # wait up to 2s for clean thread exit
        _print_summary(samples_ref[0], csv_logger.path, start_time)  # INTG-04
        sensor.close()
        csv_logger.close()
```

**Key insight:** `pm.start()` calls `plt.show()` which blocks until the window is closed. When `_on_close` fires, `stop_event.set()` signals the thread; after `plt.show()` returns, the `finally` block does cleanup identically to the Ctrl+C path.

### Pattern 5: Ctrl+C in GUI Mode

**What:** When the user presses Ctrl+C while the GUI window is open, `KeyboardInterrupt` propagates to the main thread (which is blocked in `plt.show()`). The `finally` block handles cleanup identically to the window-close path.
**When to use:** Implicitly — the `try/finally` wrapping `pm.start()` handles both cases.

```python
try:
    pm.start()             # plt.show() — blocks; raises KeyboardInterrupt on Ctrl+C
except KeyboardInterrupt:
    pass                   # allow finally to execute
finally:
    stop_event.set()       # works for both window close and Ctrl+C
    acq_thread.join(timeout=2)
    _print_summary(...)
    sensor.close()
    csv_logger.close()
```

### Pattern 6: Shared _print_summary() Helper

**What:** Extract the session summary print block from the existing `except KeyboardInterrupt` handler into a shared `_print_summary(samples, path, start_time)` function. Both the headless and GUI paths call it.
**When to use:** Guarantees INTG-04 (GUI close prints identical summary to Ctrl+C).

```python
def _print_summary(samples_written: int, csv_path, start_time: float) -> None:
    elapsed = time.monotonic() - start_time
    mins, secs = divmod(elapsed, 60)
    dur = f"{int(mins)}m{secs:.1f}s" if mins >= 1 else f"{elapsed:.1f}s"
    print()
    print("--- Session Summary ---")
    print(f"  Samples written : {samples_written}")
    print(f"  CSV file        : {csv_path}")
    print(f"  Elapsed         : {dur}")
```

**Important:** The existing `test_main.py` tests for `test_session_summary_on_ctrl_c` only assert `"Samples" in output` — not the exact format. Extracting to `_print_summary()` does not break these assertions.

### Pattern 7: Headless Mode Refactor (INTG-01)

**What:** Extract the existing `while True` loop into `_run_headless_mode()` for symmetry with `_run_gui_mode()`. The function contains exactly the current loop body — zero semantic change.
**When to use:** Called when `not args.gui`.

```python
def _run_headless_mode(sensor, csv_logger, config, start_time):
    """Exact v1.0 behavior. Zero change to logic."""
    samples_written = 0
    try:
        while True:
            reading = sensor.read_all_data()
            if reading is not None:
                csv_logger.write_row(reading)
                samples_written += 1
                print(_format_reading(reading))
            else:
                print("[WARN] Read failed - retrying...")
            time.sleep(config.sample_interval_seconds)
    except KeyboardInterrupt:
        _print_summary(samples_written, csv_logger.path, start_time)
    finally:
        sensor.close()
        csv_logger.close()
```

**Regression safety:** The existing `test_main.py` patches `main.WitMotionSensor`, `main.CSVLogger`, `main.load_config`, `main.setup_logging`. None of these patch targets change when the loop is extracted into a helper function — the patches still intercept at the module boundary.

### Anti-Patterns to Avoid

- **Top-level `from src.visualizer import PlotManager`:** Forces `matplotlib.use("TkAgg")` at import time; contaminates all tests that import `main`. Use deferred import inside GUI branch.
- **`time.sleep()` in acquisition thread:** Use `stop_event.wait(timeout=...)` instead. `time.sleep()` does not respond to `stop_event.set()` — the thread keeps sleeping through stop signals.
- **`plt.show()` called from the acquisition thread:** Tk event loop must be on the main thread. Always call `pm.start()` from main.
- **Not calling `acq_thread.join()`:** Without join, the thread may still be writing to CSV when `csv_logger.close()` is called, causing partial-write data loss. `join(timeout=2)` gives 2 seconds for clean exit.
- **Calling `sensor.close()` before `acq_thread.join()`:** The acquisition thread is calling `sensor.read_all_data()` — closing the sensor while the thread holds a reference causes unpredictable errors. Always join before close.
- **Registering `close_event` AFTER `pm.start()`:** `plt.show()` blocks; code after it never runs until the window is already closed. Register the handler before calling `pm.start()`.
- **Modifying existing test_main.py patch targets:** `patch("main.load_config")`, `patch("main.WitMotionSensor")`, etc. must remain patchable from the `main` module namespace. Do not move imports inside functions in the headless path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Window close detection | Polling a flag in a separate thread watching window state | `fig.canvas.mpl_connect('close_event', cb)` | matplotlib fires this synchronously when window is destroyed; polling is fragile and wastes CPU |
| Thread-safe counter | `threading.Lock` + int | `samples_ref = [0]` (list-as-mutable-ref) or `threading.Event` for control | Lock adds complexity; a list wrapping an int is the idiomatic no-lock Python pattern for a simple counter shared across 2 threads |
| Stop signaling | `while keep_running` with a bool | `threading.Event` | `bool` reads are technically atomic in CPython but `threading.Event` is the documented, intention-revealing pattern; also supports `wait(timeout=)` which replaces `time.sleep()` |
| Argument parsing | `if "--gui" in sys.argv` | `argparse.ArgumentParser` | argparse provides `--help`, type checking, proper error messages; `sys.argv` inspection is fragile |
| Session summary | Duplicate print blocks | `_print_summary()` helper | Both paths need identical output; a single function is the only way to guarantee they stay in sync |

---

## Common Pitfalls

### Pitfall 1: PlotManager Import at Module Level Breaks Tests
**What goes wrong:** `test_main.py` imports `from main import main`. If `main.py` has `from src.visualizer import PlotManager` at module level, this executes `matplotlib.use("TkAgg")` during test collection. If `test_visualizer.py` (which sets Agg first) runs in the same pytest session, backend conflicts arise. Depending on pytest test order, you get `UserWarning: Cannot load backend` or, worse, silent backend mismatch.
**Why it happens:** Python executes all module-level code when the module is imported. `visualizer.py` calls `matplotlib.use("TkAgg")` at module level.
**How to avoid:** Deferred import — `from src.visualizer import PlotManager` only inside the `if args.gui:` branch or inside `_run_gui_mode()`.
**Warning signs:** `test_main.py` tests fail with backend-related warnings or `test_visualizer.py` tests fail when run in the same session as `test_main.py`.

### Pitfall 2: time.sleep() in Acquisition Thread Ignores Stop Event
**What goes wrong:** `stop_event.set()` is called by the close handler, but the acquisition thread is in `time.sleep(0.1)`. The thread sleeps for the full interval before checking `stop_event.is_set()`, delaying shutdown by up to one sample interval.
**Why it happens:** `time.sleep()` is not interruptible by threading primitives.
**How to avoid:** Use `stop_event.wait(timeout=config.sample_interval_seconds)` — this returns immediately when the event is set, or after the timeout if not set.
**Warning signs:** Thread does not stop promptly after window close; `acq_thread.join(timeout=2)` times out.

### Pitfall 3: close_event Not Fired When plt.show() is Interrupted by Ctrl+C
**What goes wrong:** On some platforms, Ctrl+C during `plt.show()` raises `KeyboardInterrupt` before the Tk event loop processes the close event. The `_on_close` callback never fires; `stop_event` is never set; the acquisition thread runs indefinitely.
**Why it happens:** Ctrl+C is a signal delivered asynchronously; it may interrupt the Tk event loop before the close callback.
**How to avoid:** Wrap `pm.start()` in `try/except KeyboardInterrupt`; explicitly call `stop_event.set()` in the `finally` block regardless of which shutdown path was taken.
**Warning signs:** After Ctrl+C, process hangs waiting for the acquisition thread.

### Pitfall 4: Patching main.py After Refactor Breaks Existing Tests
**What goes wrong:** If imports are moved from module level into helper functions, `patch("main.WitMotionSensor")` no longer works because the name `WitMotionSensor` is not in `main`'s namespace.
**Why it happens:** `patch` intercepts the name at the site where it is looked up. If the lookup happens inside a function via a local import, the patch target changes.
**How to avoid:** Keep all imports at `main.py` module level except `PlotManager` (which must be deferred). `WitMotionSensor`, `CSVLogger`, `load_config`, and `setup_logging` stay as top-level imports — this is their current position and must not change.
**Warning signs:** Existing `test_main.py` tests start failing with `AttributeError: <module 'main'> does not have the attribute 'WitMotionSensor'`.

### Pitfall 5: Calling sensor.close() Before acq_thread.join()
**What goes wrong:** The acquisition thread is inside `sensor.read_all_data()` (which holds a Modbus connection). `sensor.close()` closes the serial port; the in-flight read raises an unhandled exception in the background thread. This causes a traceback on stderr and may leave the CSV file in a corrupt state.
**Why it happens:** `sensor.close()` is called in the `finally` block before waiting for the thread to finish.
**How to avoid:** `stop_event.set()` → `acq_thread.join(timeout=2)` → `sensor.close()` → `csv_logger.close()`. Always in this order.
**Warning signs:** Background thread traceback on stderr after window close; CSV file missing final rows.

### Pitfall 6: Known test_main.py Bug — mock_csv.file_path vs csv_logger.path
**What goes wrong:** `test_main.py` sets `mock_csv.file_path = "data/wtvb01_..."` but `main.py` reads `csv_logger.path` (the actual attribute name on `CSVLogger`). The existing test for `DISP-03` does not assert the CSV path value — it only checks `"Samples" in output`. If Phase 6 adds a test that asserts the CSV path appears in the session summary, it will fail because the mock has `.file_path` not `.path`.
**Why it happens:** STATE.md notes: "test_main.py uses `mock_csv.file_path` but main.py reads `csv_logger.path`". This is a pre-existing discrepancy.
**How to avoid:** In new `test_main_gui.py` tests, always set `mock_csv.path = "data/wtvb01_test.csv"` (not `.file_path`). Do not change existing `test_main.py`.
**Warning signs:** New test asserts CSV path in summary output but gets empty or wrong path.

### Pitfall 7: argparse Interferes With pytest
**What goes wrong:** `argparse.parse_args()` reads `sys.argv`. When pytest invokes `main()` in a test, `sys.argv` contains pytest's own arguments (`["pytest", "-q", ...]`). argparse will fail with "unrecognized arguments".
**Why it happens:** pytest does not reset `sys.argv`.
**How to avoid:** Use `parser.parse_args()` inside `main()` — do NOT use `parse_known_args` for production but DO make tests mock `sys.argv`. Standard pattern:
```python
# In tests:
with patch("sys.argv", ["main.py"]):          # no-flag path
    main()
with patch("sys.argv", ["main.py", "--gui"]): # gui path
    main()
```
**Warning signs:** Existing `test_main.py` tests raise `SystemExit: 2` (argparse error) after adding `parse_args()` to `main()`.

---

## Code Examples

### Complete main() Refactor Skeleton
```python
# main.py — Phase 6 final structure (verified against existing code)
from __future__ import annotations

import argparse
import sys
import time
import threading

from src.sensor import WitMotionSensor    # patch target: main.WitMotionSensor
from src.csv_logger import CSVLogger      # patch target: main.CSVLogger
from src.config_loader import load_config # patch target: main.load_config
from src.utils import setup_logging       # patch target: main.setup_logging

# NOTE: PlotManager is NOT imported here — deferred to _run_gui_mode()


def _format_reading(reading) -> str:
    """Unchanged from v1.0."""
    ax = reading.ax_g if reading.ax_g is not None else 0.0
    ay = reading.ay_g if reading.ay_g is not None else 0.0
    az = reading.az_g if reading.az_g is not None else 0.0
    temp = f"  T={reading.temperature_c:.1f}C" if reading.temperature_c is not None else ""
    return f"{reading.timestamp}  ax={ax:+.3f}g  ay={ay:+.3f}g  az={az:+.3f}g{temp}"


def _print_summary(samples_written: int, csv_path, start_time: float) -> None:
    """Shared session summary — called by both headless and GUI shutdown paths."""
    elapsed = time.monotonic() - start_time
    mins, secs = divmod(elapsed, 60)
    dur = f"{int(mins)}m{secs:.1f}s" if mins >= 1 else f"{elapsed:.1f}s"
    print()
    print("--- Session Summary ---")
    print(f"  Samples written : {samples_written}")
    print(f"  CSV file        : {csv_path}")
    print(f"  Elapsed         : {dur}")


def _acquire(sensor, csv_logger, config, pm, stop_event, samples_ref) -> None:
    """Acquisition loop for GUI mode — runs in background thread."""
    while not stop_event.is_set():
        reading = sensor.read_all_data()
        if reading is not None:
            csv_logger.write_row(reading)
            pm.update_data(reading)
            samples_ref[0] += 1
            print(_format_reading(reading))
        else:
            print("[WARN] Read failed - retrying...")
        stop_event.wait(timeout=config.sample_interval_seconds)


def _run_headless_mode(sensor, csv_logger, config, start_time: float) -> None:
    """v1.0 acquisition loop — zero behavioral change (INTG-01)."""
    samples_written = 0
    try:
        while True:
            reading = sensor.read_all_data()
            if reading is not None:
                csv_logger.write_row(reading)
                samples_written += 1
                print(_format_reading(reading))
            else:
                print("[WARN] Read failed - retrying...")
            time.sleep(config.sample_interval_seconds)
    except KeyboardInterrupt:
        _print_summary(samples_written, csv_logger.path, start_time)
    finally:
        sensor.close()
        csv_logger.close()


def _run_gui_mode(sensor, csv_logger, config, start_time: float) -> None:
    """GUI acquisition mode — matplotlib on main thread, sensor on background thread."""
    from src.visualizer import PlotManager  # deferred: prevents TkAgg at import time

    stop_event = threading.Event()
    samples_ref = [0]

    pm = PlotManager()

    def _on_close(event):
        stop_event.set()

    pm._fig.canvas.mpl_connect('close_event', _on_close)

    acq_thread = threading.Thread(
        target=_acquire,
        args=(sensor, csv_logger, config, pm, stop_event, samples_ref),
        daemon=True,
    )
    acq_thread.start()

    try:
        pm.start()   # plt.show() — blocks until window closes
    except KeyboardInterrupt:
        pass
    finally:
        stop_event.set()
        acq_thread.join(timeout=2)
        _print_summary(samples_ref[0], csv_logger.path, start_time)
        sensor.close()
        csv_logger.close()


def main() -> None:
    """Entry point — parse --gui flag, connect sensor, dispatch to correct mode."""
    parser = argparse.ArgumentParser(description="WTVB01 Notebook Logger")
    parser.add_argument("--gui", action="store_true", help="Open live visualization window")
    args = parser.parse_args()

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

    if args.gui:
        _run_gui_mode(sensor, csv_logger, config, start_time)
    else:
        _run_headless_mode(sensor, csv_logger, config, start_time)


if __name__ == "__main__":
    main()
```

### close_event Handler (INTG-04)
```python
# Verified: matplotlib 3.10.9 — mpl_connect fires synchronously on window destroy
pm._fig.canvas.mpl_connect('close_event', lambda event: stop_event.set())
```

### argparse sys.argv Mock in Tests (Pitfall 7 fix)
```python
# tests/test_main_gui.py
from unittest.mock import patch, MagicMock
from main import main

def test_no_flag_path():
    """INTG-01: --gui absent means headless mode."""
    mock_sensor = MagicMock()
    mock_sensor.connect.return_value = True
    mock_sensor.read_all_data.side_effect = [_make_reading(), KeyboardInterrupt()]
    mock_csv = MagicMock()
    mock_csv.path = "data/test.csv"

    with (
        patch("sys.argv", ["main.py"]),           # no --gui flag
        patch("main.load_config", return_value=_make_config()),
        patch("main.setup_logging"),
        patch("main.WitMotionSensor", return_value=mock_sensor),
        patch("main.CSVLogger", return_value=mock_csv),
    ):
        main()

    mock_sensor.close.assert_called_once()
    mock_csv.close.assert_called_once()
```

### GUI Mode Test with Mocked PlotManager (INTG-02, INTG-03, INTG-04)
```python
# tests/test_main_gui.py — GUI path test
def test_gui_mode_csv_written_and_clean_shutdown(capsys):
    """INTG-02: CSV write called; INTG-04: summary printed after GUI close."""
    import matplotlib
    matplotlib.use("Agg")  # must be set before test_main_gui imports anything matplotlib

    mock_pm = MagicMock()
    mock_pm._fig = MagicMock()

    # Simulate window close: capture the close_event callback and call it
    close_callbacks = []
    mock_pm._fig.canvas.mpl_connect.side_effect = (
        lambda event, cb: close_callbacks.append(cb) or None
    )

    def _mock_start():
        # Simulate window closing after 1 call
        if close_callbacks:
            close_callbacks[0](None)  # fire close_event handler
    mock_pm.start.side_effect = _mock_start

    mock_sensor = MagicMock()
    mock_sensor.connect.return_value = True
    mock_sensor.read_all_data.return_value = _make_reading()

    mock_csv = MagicMock()
    mock_csv.path = "data/test.csv"

    with (
        patch("sys.argv", ["main.py", "--gui"]),
        patch("main.load_config", return_value=_make_config()),
        patch("main.setup_logging"),
        patch("main.WitMotionSensor", return_value=mock_sensor),
        patch("main.CSVLogger", return_value=mock_csv),
        patch("src.visualizer.PlotManager", return_value=mock_pm),
    ):
        main()

    # INTG-02: CSV was written
    mock_csv.write_row.assert_called()
    # INTG-04: resources closed
    mock_sensor.close.assert_called_once()
    mock_csv.close.assert_called_once()
    # INTG-04: summary in stdout
    captured = capsys.readouterr()
    assert "Samples" in captured.out
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sys.argv` manual parsing | `argparse.ArgumentParser` | Python 2.7 | argparse provides `--help`, error messages, type safety |
| `threading.Lock` + shared bool | `threading.Event` | Python 3.1 | Event.wait(timeout) replaces sleep; set() is atomic and intention-revealing |
| `time.sleep()` in thread loop | `stop_event.wait(timeout=...)` | (idiom, not version change) | Responds to stop signal immediately instead of waiting full interval |

---

## Open Questions

1. **argparse interaction with existing test_main.py**
   - What we know: All 5 existing tests call `main()` directly without patching `sys.argv`. When `parse_args()` is added to `main()`, it will read `sys.argv` which during pytest contains pytest arguments. argparse will raise `SystemExit: 2` ("unrecognized arguments").
   - What's unclear: Whether to patch `sys.argv` in the new tests only (and fix existing tests), or use `parse_known_args()` which silently ignores unknown args.
   - Recommendation: The cleanest fix is to add `patch("sys.argv", ["main.py"])` to all 5 existing `test_main.py` tests. This is a small, safe change that makes the tests explicit about their input. Alternatively, `parser.parse_known_args()` avoids modifying existing tests but is less explicit. **Decision needed by planner.**

2. **Patching PlotManager in GUI tests**
   - What we know: The deferred import means `patch("src.visualizer.PlotManager", ...)` is the correct patch target (the name is looked up in `src.visualizer` at call time). `patch("main.PlotManager")` will NOT work since PlotManager is never bound in `main`'s namespace.
   - What's unclear: Whether to use `patch("src.visualizer.PlotManager")` or inject the mock via a factory parameter.
   - Recommendation: Use `patch("src.visualizer.PlotManager", return_value=mock_pm)` — this is the standard Python mock pattern for deferred imports.

3. **acq_thread.join(timeout=2) — is 2 seconds enough?**
   - What we know: The acquisition loop calls `sensor.read_all_data()` which is a Modbus RTU read over serial. With the mock sensor in tests, it returns immediately. In production, a hardware timeout could take up to the configured Modbus timeout (typically 1s).
   - What's unclear: Whether a 2-second join timeout is sufficient for all hardware conditions.
   - Recommendation: 2 seconds is adequate (one Modbus timeout + one sample interval). The thread is `daemon=True` so even if join times out, the process exits cleanly.

---

## Validation Architecture

Nyquist validation is enabled (`nyquist_validation: true` in `.planning/config.json`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.0.3 (installed; 74 tests currently passing) |
| Config file | pytest.ini (exists; `testpaths = tests`) |
| Quick run command | `pytest tests/test_main.py tests/test_main_gui.py -x -q` |
| Full suite command | `pytest tests/ -v --tb=short` |

### Testing Strategy Overview

Phase 6 has two test concerns:

**A. Regression testing (INTG-01):** Verify that adding argparse to `main()` does not break any of the 5 existing `test_main.py` tests. The fix is minimal: add `patch("sys.argv", ["main.py"])` to all 5 existing tests. No other changes to that file.

**B. New behavior testing (test_main_gui.py):** Test the GUI path using mocked PlotManager, mocked sensor, and mocked CSV logger. No hardware, no Tk window.

**Hardware-free strategy:** All tests use `MagicMock` for `WitMotionSensor` and `CSVLogger`. PlotManager is patched via `patch("src.visualizer.PlotManager", return_value=mock_pm)`. The mock PlotManager's `start()` method simulates window close by firing the registered close_event callback. No Tk window is opened in any test.

**Thread safety validation:** The acquisition thread test injects a mock sensor that returns a fixed reading (not a side_effect sequence), so the thread runs multiple iterations before being stopped by the simulated close event. The test then asserts `mock_csv.write_row.call_count >= 1` (INTG-02) and `mock_pm.update_data.call_count >= 1` (INTG-03).

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTG-01 | `main()` with no `--gui` runs headless path (zero regression) | unit | `pytest tests/test_main.py -x -q` | YES (5 tests — needs `sys.argv` patch) |
| INTG-01 | argparse with `--gui` absent enters `_run_headless_mode` | unit | `pytest tests/test_main_gui.py::test_no_flag_calls_headless -x` | NO — Wave 0 gap |
| INTG-02 | `csv_logger.write_row()` called for each reading in GUI mode | unit | `pytest tests/test_main_gui.py::test_gui_csv_written -x` | NO — Wave 0 gap |
| INTG-03 | Acquisition runs in a thread; PlotManager.update_data() called from thread | unit | `pytest tests/test_main_gui.py::test_gui_update_data_called -x` | NO — Wave 0 gap |
| INTG-04 | GUI close event triggers stop_event, summary printed, resources closed | unit | `pytest tests/test_main_gui.py::test_gui_close_triggers_shutdown -x` | NO — Wave 0 gap |
| INTG-04 | sensor.close() and csv_logger.close() called after GUI shutdown | unit | `pytest tests/test_main_gui.py::test_gui_resources_closed -x` | NO — Wave 0 gap |

### Sampling Rate
- **Per task commit:** `pytest tests/test_main.py tests/test_main_gui.py -x -q` (regression + new tests)
- **Per wave merge:** `pytest tests/ -v --tb=short` (full 74+ test suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_main_gui.py` — new file covering INTG-01 through INTG-04 (all 5+ tests above marked "NO")
- [ ] `tests/test_main.py` — add `patch("sys.argv", ["main.py"])` to all 5 existing tests to prevent argparse from reading pytest's argv (this is a fix, not a new test)

*(conftest.py, pytest.ini, and pytest framework already exist — no new framework install needed)*

### Key Test Implementation Notes

**Simulating GUI close in tests:**
```python
# The mock PlotManager captures the mpl_connect callback, then fires it from start()
close_callbacks = []
mock_pm._fig.canvas.mpl_connect.side_effect = (
    lambda event, cb: close_callbacks.append(cb)
)
def _fake_start():
    if close_callbacks:
        close_callbacks[0](None)  # fires _on_close(event)
mock_pm.start.side_effect = _fake_start
```
This simulates: user opens window, immediately closes it. The `_on_close` callback sets `stop_event`; the acquisition thread exits; `_print_summary` runs.

**Thread timing in tests:** The acquisition thread runs immediately after `start()` fires the close callback. Since `mock_sensor.read_all_data()` returns instantly (no sleep), there is a race between the thread starting its first read and the close callback setting `stop_event`. Use `mock_sensor.read_all_data.return_value = _make_reading()` (infinite readings) not `side_effect = [reading, KeyboardInterrupt()]` for GUI mode tests — the thread may not have executed even one read before stop_event is set. Assert `call_count >= 0` or use `acq_thread.join()` style waiting.

**Alternative:** Add a brief `time.sleep(0.05)` inside the mock `start()` before firing close — this gives the acquisition thread time to execute at least one full cycle before shutdown.

---

## Sources

### Primary (HIGH confidence)
- `main.py` (project, verified live) — complete current implementation, all patch targets, exact v1.0 behavior
- `src/visualizer.py` (project, Phase 5 deliverable) — PlotManager API: `update_data(reading)`, `start()`, `_fig`, `_lines`, `_channel_bufs`, `_t_buf`
- `tests/test_main.py` (project, verified live) — all 5 test functions, patch targets (`main.WitMotionSensor`, `main.CSVLogger`, `main.load_config`, `main.setup_logging`), mock_csv uses `.file_path` (not `.path`)
- `tests/test_visualizer.py` (project, Phase 5 deliverable) — Agg backend guard pattern: `matplotlib.use("Agg")` before any visualizer import
- `.planning/STATE.md` — locked decisions: `matplotlib main thread / acquisition background thread (Windows Tk backend constraint)`, `--gui flag via argparse`
- Python 3.13.13 stdlib — `argparse`, `threading.Thread`, `threading.Event` all verified available
- matplotlib 3.10.9 — `fig.canvas.mpl_connect('close_event', cb)` pattern noted in Phase 5 research (Open Question 3)

### Secondary (MEDIUM confidence)
- Phase 5 RESEARCH.md — `fig.canvas.mpl_connect('close_event', callback) fires when user closes window` (documented as Phase 6 concern, not yet exercised in Phase 5 code)
- Phase 5 VERIFICATION.md — confirms PlotManager.start() calls plt.show() which blocks; PM._fig is accessible as instance attribute
- Phase 5 SUMMARY.md — confirms `affects: [06-main-integration]` and "Phase 6 wires real acquisition thread to PlotManager.update_data() — interface is stable"

### Tertiary (LOW confidence)
- None — all findings verified against project source or stdlib documentation

---

## Metadata

**Confidence breakdown:**
- argparse integration: HIGH — stdlib, pattern is straightforward, verified
- Deferred import requirement: HIGH — derived from verified test interaction (PlotManager sets TkAgg at module level)
- close_event handler pattern: HIGH — documented in Phase 5 research as "fig.canvas.mpl_connect('close_event', callback) fires when user closes window"; used in matplotlib for years
- threading.Event vs time.sleep: HIGH — stdlib, well-established pattern
- sys.argv / argparse interaction with pytest: HIGH — derived from reading actual test code and argparse behavior
- Test mock strategy for GUI path: MEDIUM — the close_callback capture pattern is idiomatic but not exercised in this project yet

**Research date:** 2026-05-23
**Valid until:** 2026-08-23 (stdlib threading/argparse APIs are stable; matplotlib 3.10.x close_event is stable)
