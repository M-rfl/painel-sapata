---
phase: 07-gps-reader-data-model
plan: "03"
subsystem: gps
tags: [gps, threading, winsdk, windows-location-api, background-thread, poll-cache]

# Dependency graph
requires:
  - phase: 07-01
    provides: GPSReader class with get_location() / poll() / status / _fetch()
  - phase: 07-02
    provides: SensorReading.gps_lat, gps_lon, gps_speed_mps fields (Optional[float])
provides:
  - GPSReader wired into main.py as a daemon background thread at 1 Hz
  - GPS status line printed at startup (GPS: fix acquired / no fix / denied)
  - GPS fields populated from cache in every SensorReading in both headless and GUI modes
  - 3 new unit tests for GPS startup behavior (GPS-04, GPS-09) and poll/cache split
affects: [08-csv-logger-gps, integration-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "poll/cache split: poll() does I/O in background thread; get_location() returns cached tuple instantly"
    - "GPS daemon thread: threading.Thread(daemon=True, name='gps-thread') + threading.Event for stop"
    - "try/except ImportError guard at module level for optional GPSReader import in main.py"
    - "gps_stop.set() in finally blocks to cleanly stop GPS thread on shutdown"

key-files:
  created: []
  modified:
    - src/gps_reader.py
    - main.py
    - tests/test_gps_reader.py
    - tests/test_main.py
    - tests/test_main_gui.py

key-decisions:
  - "poll/cache split chosen over per-call asyncio.run(): get_location() is now a pure cache read (nanosecond), poll() does the I/O — ensures 10 Hz acquisition loop is never blocked"
  - "GPS startup poll is synchronous (one poll() call before thread start) to establish status before printing startup message"
  - "gps_stop event passed to _run_headless_mode and _run_gui_mode so GPS thread is stopped in finally blocks alongside sensor.close() and csv_logger.close()"
  - "gps_reader=None default parameters on _acquire/_run_headless_mode/_run_gui_mode for backward compatibility with existing tests that do not patch GPSReader"

patterns-established:
  - "Background daemon thread pattern: threading.Thread(daemon=True) + threading.Event(stop_event) + stop_event.wait(timeout=N) in loop body"
  - "Import guard for optional dependency: try: from src.X import Y; except ImportError: Y = None"
  - "Test patch pattern for GPSReader: patch('main.GPSReader', return_value=mock_gps) with mock_gps.status, mock_gps.get_location, mock_gps.poll set"

requirements-completed: [GPS-03, GPS-04]

# Metrics
duration: 25min
completed: 2026-05-24
---

# Phase 7 Plan 03: GPS main.py Wiring Summary

**GPSReader poll/cache refactor + daemon thread in main.py with startup status line and per-reading GPS field population — 92 tests GREEN, zero regressions**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-24T23:30:00Z
- **Completed:** 2026-05-24T23:55:00Z
- **Tasks:** 2 (automated) + 1 checkpoint pending user verify
- **Files modified:** 5

## Accomplishments
- Refactored GPSReader: `get_location()` is now an instant cache read; `poll()` does the Windows Location API I/O — guarantees 10 Hz acquisition loop is never blocked by GPS
- Wired GPSReader into `main.py` as a 1 Hz daemon background thread with `gps_stop` threading.Event for clean shutdown
- GPS status line printed at startup before acquisition loop: "GPS: fix acquired", "GPS: no fix — CSV columns will be empty", or "GPS: location access denied — enable in Windows Settings › Privacy › Location"
- GPS fields (`gps_lat`, `gps_lon`, `gps_speed_mps`) populated from cache on every `SensorReading` in both headless and GUI modes
- Updated `test_gps_reader.py`: all 8 original tests migrated from `get_location()` fetch pattern to `poll()`, plus new `test_get_location_returns_cache` (Test 9) confirming cache-only behavior
- Patched `main.GPSReader` in all 5 `test_main.py` and 5 `test_main_gui.py` tests to prevent real GPS polling
- Added `test_gps_no_fix_message_at_startup` (GPS-04) and `test_gps_permission_denied_message_at_startup` (GPS-09)

## Task Commits

1. **Task 1+2: Wire GPSReader, refactor poll/cache, add all tests** - `785c4ad` (feat)

**Plan metadata:** TBD (docs commit)

## Files Created/Modified
- `src/gps_reader.py` — Added `poll()` method; `get_location()` now returns `self._cache` instantly; `_cache` attribute initialized in `__init__`
- `main.py` — Added `try/except ImportError` for GPSReader, `_gps_poll_loop()`, GPS block in `main()`, GPS params in `_run_headless_mode`/`_run_gui_mode`/`_acquire`
- `tests/test_gps_reader.py` — Migrated to `poll()` pattern; added Test 9 (`test_get_location_returns_cache`)
- `tests/test_main.py` — Added `mock_gps` patch to all 5 existing tests; added 2 new GPS startup message tests
- `tests/test_main_gui.py` — Added `mock_gps` patch to all 5 existing tests

## Decisions Made
- **poll/cache split**: The original `get_location()` did `asyncio.run(self._fetch())` on every call. At 1 Hz this was fine, but at 10 Hz it would block the acquisition loop. Splitting into `poll()` (I/O) + `get_location()` (cache read) guarantees zero blocking.
- **Synchronous startup poll**: One `gps_reader.poll()` call is made synchronously before the background thread starts so the startup status message is meaningful (not just "no_fix" due to no poll having run yet).
- **Default None parameters**: `_acquire`, `_run_headless_mode`, `_run_gui_mode` use `gps_reader=None` defaults for clean backward compatibility — existing tests that patch only some things still work.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] GPS startup tests included in Task 1 commit**
- **Found during:** Task 1 (while writing all test updates in a single pass)
- **Issue:** Plan separated GPS startup message tests into Task 2, but since `test_main.py` was being completely rewritten for Task 1, writing them together avoided a partial-file state
- **Fix:** All 7 additions to `test_main.py` written and committed together in Task 1
- **Files modified:** tests/test_main.py
- **Verification:** All 92 tests GREEN after combined commit
- **Committed in:** 785c4ad (Task 1 commit)

---

**Total deviations:** 1 minor (combined Task 1+2 commit for test_main.py)
**Impact on plan:** No scope creep, no missing functionality. All done criteria met for both Task 1 and Task 2.

## Issues Encountered
None — all code changes produced passing tests on first attempt.

## User Setup Required
None — no external service configuration required. GPS hardware optional; app starts normally without GPS fix.

## Next Phase Readiness
- All Phase 7 GPS implementation complete (GPSReader + SensorReading GPS fields + main.py wiring)
- Phase 8 (`csv-logger-gps`) can proceed: CSV header extension and row serialization for gps_lat, gps_lon, gps_speed_mps columns
- The `None → ""` serialization pattern from CSVLogger is already established and ready to reuse

---
*Phase: 07-gps-reader-data-model*
*Completed: 2026-05-24*
