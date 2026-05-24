---
phase: 06-main-py-integration
plan: 01
subsystem: testing
tags: [pytest, tdd, matplotlib, argparse, sys-argv]

# Dependency graph
requires:
  - phase: 05-visualizer-module
    provides: PlotManager with update_data/start API and Agg backend pattern
  - phase: 04-main-py-loop
    provides: main() function structure, test_main.py with 5 GREEN tests
provides:
  - "tests/test_main_gui.py with 5 RED stub tests (Wave 0 TDD scaffold for INTG-01 to INTG-04)"
  - "tests/test_main.py updated with sys.argv patch in all 5 tests (regression guard for argparse)"
affects:
  - 06-main-py-integration plan 02 (implements main.py changes that make stubs GREEN)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "matplotlib.use('Agg') as first import statement in test files to prevent Tk windows in CI"
    - "Wave 0 TDD scaffold: stub tests raise NotImplementedError to establish RED state before implementation"
    - "sys.argv patch added as first item in with-block to guard against argparse SystemExit(2)"

key-files:
  created:
    - tests/test_main_gui.py
  modified:
    - tests/test_main.py

key-decisions:
  - "mock_csv.path used in test_main_gui.py (correct CSVLogger attribute) vs mock_csv.file_path kept in test_main.py (pre-existing discrepancy, not changed)"
  - "NotImplementedError stubs show as FAILED in pytest (both FAILED and ERROR are valid RED states for Wave 0)"

patterns-established:
  - "Wave 0 scaffold pattern: create stubs first, commit RED, then implement GREEN in next plan"
  - "sys.argv regression guard: patch sys.argv before argparse is added to prevent test breakage on upgrade"

requirements-completed: [INTG-01]

# Metrics
duration: 3min
completed: 2026-05-24
---

# Phase 06 Plan 01: Wave 0 test scaffold — 5 RED GUI stubs + sys.argv regression guard in test_main.py

**Wave 0 TDD scaffold: 5 NotImplementedError stubs for GUI mode (test_main_gui.py) and sys.argv patch added to all 5 headless tests (test_main.py) to prevent argparse SystemExit(2) regression when Plan 02 adds --gui flag**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-24T00:07:29Z
- **Completed:** 2026-05-24T00:09:35Z
- **Tasks:** 2 of 2
- **Files modified:** 2

## Accomplishments

- Created tests/test_main_gui.py with 5 stub tests (INTG-01 through INTG-04) — all RED (NotImplementedError)
- Updated tests/test_main.py with sys.argv patch as first item in all 5 with-blocks — all still GREEN
- Full suite: 74 original tests GREEN, 5 new stubs FAILED with NotImplementedError (no regressions)
- matplotlib.use("Agg") set before any visualizer import to prevent Tk windows in CI

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tests/test_main_gui.py with 5 RED stub tests** - `c1d3af1` (test)
2. **Task 2: Add sys.argv patch to all 5 tests in tests/test_main.py** - `d836a6c` (chore)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `tests/test_main_gui.py` - 5 Wave 0 stub tests for GUI mode; matplotlib Agg backend; helpers _make_reading/_make_config; mock_csv.path (correct attribute)
- `tests/test_main.py` - sys.argv patch added as first item in all 5 with-blocks (regression guard for argparse)

## Decisions Made

- mock_csv.path used in test_main_gui.py (correct CSVLogger attribute name) — kept mock_csv.file_path in test_main.py as-is (pre-existing discrepancy, plan explicitly said do not fix)
- NotImplementedError stubs show as FAILED in pytest rather than ERROR — both are non-passing RED states and satisfy the Wave 0 requirement

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (06-02) can now implement main.py --gui flag and argparse integration
- When Plan 02 ships, the 5 stubs in test_main_gui.py must be replaced with real assertions
- The sys.argv patch in test_main.py will silently protect all 5 headless tests from argparse SystemExit(2)
- No blockers or concerns

---
*Phase: 06-main-py-integration*
*Completed: 2026-05-24*
