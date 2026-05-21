---
phase: 03-acquisition-loop
plan: "03"
subsystem: acquisition
tags: [python, main.py, csv, polling-loop, keyboard-interrupt, hardware-verification]

# Dependency graph
requires:
  - phase: 03-01
    provides: RED test stubs for main.py (tests/test_main.py, 5 tests)
  - phase: 03-02
    provides: CSVLogger class (src/csv_logger.py, STORE-01..06)
  - phase: 02-01
    provides: WitMotionSensor class (src/sensor.py, connect/read_all_data/close)
provides:
  - main.py acquisition loop entry point (KeyboardInterrupt + finally pattern)
  - Hardware-verified end-to-end logging at 10 Hz to CSV
  - Session summary (samples written, CSV path, elapsed duration) on Ctrl+C
affects:
  - 04-documentation-hardening

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "KeyboardInterrupt at the outermost try level (not inside the polling while loop) so session summary always prints"
    - "finally block unconditionally calls sensor.close() + csv_logger.close() regardless of exit path"
    - "time.monotonic() for elapsed measurement (not time.time()) — monotonic is immune to clock adjustments"
    - "sys.exit(1) called before resource setup (only for failed connect) so finally block is not needed at that point"

key-files:
  created:
    - main.py
  modified: []

key-decisions:
  - "KeyboardInterrupt caught outside the while loop so the session summary line always executes before falling through to finally"
  - "sys.exit(1) used only for failed sensor.connect() — at that point no resources are open so bypassing finally is safe"
  - "time.monotonic() used for elapsed duration — not time.time() — to avoid clock-skew artifacts on long sessions"
  - "_format_reading() is a module-level helper (not a method) so tests can patch it independently"

patterns-established:
  - "Graceful shutdown pattern: try/except KeyboardInterrupt/finally wrapping the entire session body"
  - "_format_reading(reading) helper: one-line terminal display with ax/ay/az in g and temperature in C"

requirements-completed:
  - CONN-02
  - DISP-01
  - DISP-02
  - DISP-03

# Metrics
duration: ~25min (Task 1 automated + Task 2 hardware verification)
completed: 2026-05-21
---

# Phase 03 Plan 03: Acquisition Loop (main.py) Summary

**main.py polling loop wiring config/sensor/CSVLogger into 10 Hz live logging with flush-per-row CSV, per-sample terminal display, and clean Ctrl+C session summary — hardware-verified on COM10**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-21
- **Completed:** 2026-05-21
- **Tasks:** 2 (Task 1 automated TDD, Task 2 hardware checkpoint)
- **Files modified:** 1 (main.py created)

## Accomplishments

- Implemented main.py acquisition loop: config load → sensor connect → polling → CSV write → terminal print → Ctrl+C session summary
- All 55 automated tests pass (42 foundation + 8 csv_logger + 5 main); no regressions
- Hardware-verified on COM10: sensor connected, 10 Hz logging confirmed, per-sample terminal lines correct with timestamp/ax/ay/az/temperature
- Phase 3 complete: CONN-02, STORE-01..06, DISP-01..03 all satisfied

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement main.py acquisition loop** - `f961edf` (feat)
2. **Task 2: Hardware verification checkpoint** - Approved by user (no code commit — verification only)

**Plan metadata:** _(this docs commit)_

## Files Created/Modified

- `main.py` — Acquisition loop entry point; KeyboardInterrupt + finally pattern; imports WitMotionSensor and CSVLogger from src/ namespace for test patchability

## Decisions Made

- **KeyboardInterrupt at outermost level:** `except KeyboardInterrupt` wraps the entire session body (not inside the `while True` loop). This guarantees the session summary block executes before the `finally` block runs cleanup. If it were inside the loop, `finally` would still run but the summary would be skipped.
- **sys.exit(1) for failed connect only:** `sensor.connect()` returning `False` triggers `sys.exit(1)` before the `try` block is entered. At that point neither `sensor` nor `csv_logger` have open file handles, so bypassing `finally` is safe and avoids a confusing double-error path.
- **time.monotonic() for elapsed:** Monotonic clocks are immune to NTP adjustments and DST changes. `time.time()` could produce a negative elapsed on rare clock rollbacks.
- **Import-level patching targets:** `from src.sensor import WitMotionSensor` and `from src.csv_logger import CSVLogger` at module top-level keeps patch targets as `main.WitMotionSensor` and `main.CSVLogger` — consistent with the patch strings already committed in `tests/test_main.py`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Hardware Verification Results

**Session:** COM10, config.yaml serial_port=COM10
**Outcome:** PASS — all checkpoint criteria met

- Startup messages appeared: `[INFO] CSV: data\wtvb01_YYYYMMDD_HHMMSS.csv`, `[INFO] Connecting to COM10...`, `[INFO] Connected. Logging at 10.0 Hz. Ctrl+C to stop.`
- Per-sample lines appeared at ~0.1 s intervals with correct format: `timestamp  ax=+X.XXXg  ay=+X.XXXg  az=+X.XXXg  T=XX.XC`
- Ctrl+C produced clean session summary: samples written, CSV path, elapsed time
- DISP-01 (per-sample terminal line), DISP-02 (warn on failed read), DISP-03 (session summary) confirmed visually

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 3 is complete. All core value delivery requirements are satisfied:
- Sensor connects (CONN-01, CONN-02, CONN-03)
- CSV writes reliably with all 18 columns, no buffered-row loss (STORE-01..06)
- Terminal display and graceful shutdown work (DISP-01..03)

Phase 4 (Documentation & Hardening) can begin immediately:
- README.md with Windows CH340 driver install, serial port identification, troubleshooting (12 scenarios)
- Final code review: to_signed16 coverage, flush discipline, no naive datetime.now(), named register constants

---
*Phase: 03-acquisition-loop*
*Completed: 2026-05-21*
