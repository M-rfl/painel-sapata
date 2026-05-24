---
phase: 06-main-py-integration
plan: 02
subsystem: integration
tags: [argparse, threading, matplotlib, tdd, cli]

# Dependency graph
requires:
  - phase: 05-visualizer-module
    provides: PlotManager with update_data/start API and Agg backend pattern
  - phase: 06-main-py-integration-01
    provides: "5 RED stub tests (test_main_gui.py) + sys.argv patch in test_main.py"
  - phase: 04-main-py-loop
    provides: main() v1.0 headless loop, all resource cleanup patterns
provides:
  - "main.py refactored with argparse --gui flag, _run_headless_mode, _run_gui_mode, _acquire, _print_summary"
  - "5 test_main_gui.py stubs implemented and passing GREEN"
  - "79 total tests GREEN — full v1.1 test suite"
affects:
  - "v1.1 milestone complete — real-time visualization wired into acquisition entry point"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deferred import pattern: PlotManager imported inside _run_gui_mode() body, not at module level — prevents Tk activation on headless/test environments"
    - "Mutable list counter [0] as shared state between threads (avoids nonlocal across thread boundary)"
    - "stop_event.wait(timeout=...) replaces time.sleep() in acquisition thread — responds to stop signal immediately"
    - "Close-event simulation: mpl_connect.side_effect captures callback, _mock_start fires it after 0.05s delay"
    - "Daemon thread for acquisition: exits automatically if main thread dies; joined with timeout=2 for clean shutdown"

key-files:
  created: []
  modified:
    - main.py
    - tests/test_main_gui.py

key-decisions:
  - "Shutdown order in _run_gui_mode finally: stop_event.set() → acq_thread.join(timeout=2) → _print_summary → sensor.close() → csv_logger.close() — ensures summary is printed before resources close"
  - "patch('src.visualizer.PlotManager') not patch('main.PlotManager') — PlotManager is never bound in main namespace due to deferred import"
  - "mock_csv.path used in test assertions (not .file_path) — matches actual CSVLogger attribute name used by _print_summary"

patterns-established:
  - "Deferred import inside function body for GUI-only dependencies — prevents Tk side effects at import time"
  - "samples_ref=[0] mutable list for cross-thread counter — thread-safe in CPython via GIL, simpler than Lock"

requirements-completed: [INTG-01, INTG-02, INTG-03, INTG-04]

# Metrics
duration: 4min
completed: 2026-05-24
---

# Phase 06 Plan 02: main.py --gui integration — argparse dispatch, _acquire thread, PlotManager wiring, 5 GUI tests GREEN

**main.py refactored with argparse --gui flag: _run_headless_mode preserves v1.0 behavior exactly, _run_gui_mode runs PlotManager with background _acquire daemon thread using stop_event.wait(); 5 test_main_gui.py stubs implemented making 79 total tests GREEN**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-24T00:11:42Z
- **Completed:** 2026-05-24T00:15:50Z
- **Tasks:** 2 of 2
- **Files modified:** 2

## Accomplishments

- Refactored main.py with argparse --gui dispatch: 5 new functions (_print_summary, _acquire, _run_headless_mode, _run_gui_mode) + updated main()
- _run_headless_mode contains the exact v1.0 loop — zero semantic change from original 50-line main()
- _run_gui_mode: deferred PlotManager import, threading.Event stop signal, daemon acquisition thread, shutdown in correct order
- Implemented all 5 test_main_gui.py stubs — GREEN: INTG-01 through INTG-04 all verified
- Full suite: 79 tests GREEN (74 original + 5 new), 0 failed, 4 pre-existing warnings

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor main.py — argparse, helpers, headless/GUI dispatch** - `b7a5e46` (feat)
2. **Task 2: Implement 5 test_main_gui.py stubs — all GREEN** - `710ea4c` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `main.py` — Refactored entry point: import argparse/threading added, _format_reading unchanged, _print_summary extracted from KeyboardInterrupt handler, _acquire background thread loop with stop_event.wait(), _run_headless_mode (v1.0 loop), _run_gui_mode (deferred PlotManager, threading.Event, close handler, acq thread), main() with argparse dispatch
- `tests/test_main_gui.py` — All 5 NotImplementedError stubs replaced with full implementations using close_event simulation pattern; patch target is src.visualizer.PlotManager

## Decisions Made

- Shutdown order in _run_gui_mode finally: stop_event.set() → acq_thread.join(timeout=2) → _print_summary → sensor.close() → csv_logger.close() — this order ensures summary is printed with correct sample count after thread finishes
- patch("src.visualizer.PlotManager") not patch("main.PlotManager") — because PlotManager is imported inside _run_gui_mode(), it is never bound in main's module namespace; patching the source module is required
- mock_csv.path attribute used in all 5 GUI tests (not .file_path as in test_main.py) — aligns with actual CSVLogger.path attribute accessed by _print_summary

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- v1.1 milestone complete: all 79 tests GREEN, PlotManager wired into main.py via --gui flag
- `python main.py` — headless mode, identical to v1.0
- `python main.py --gui` — real-time matplotlib visualizer (requires physical sensor on COM port)
- Pre-existing matplotlib Animation GC warnings (3-4) in test_visualizer.py — out of scope, not introduced by this plan
- No blockers for milestone v1.1 release

---
*Phase: 06-main-py-integration*
*Completed: 2026-05-24*
