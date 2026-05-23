---
phase: 05-visualizer-module
plan: "01"
subsystem: testing
tags: [matplotlib, pytest, tdd, agg-backend, visualizer]

requires: []
provides:
  - "10-function pytest scaffold for VIZ-02 through VIZ-06 in RED state (ImportError)"
  - "matplotlib>=3.10 declared as runtime dependency in requirements.txt"
  - "Agg backend configured before any visualizer import (CI-safe headless pattern)"
affects:
  - 05-visualizer-module plan 02 (PlotManager implementation depends on this scaffold)

tech-stack:
  added: [matplotlib>=3.10]
  patterns:
    - "Agg backend set at module top before any src.visualizer import to prevent Tk in headless CI"
    - "PlotManager tests use pm fixture for structural tests; mock_reading for data/animation tests"

key-files:
  created:
    - tests/test_visualizer.py
  modified:
    - requirements.txt

key-decisions:
  - "TDD Wave 0: scaffold written before implementation — all 10 tests fail with ImportError until Plan 02 ships"
  - "Agg backend set as first statement in test file to prevent Tk window in CI/headless environments"
  - "mock_reading fixture uses angle_x/y/z=None to match RESERVED registers (always None per v1.1 arch decision)"

patterns-established:
  - "Agg-first pattern: import matplotlib; matplotlib.use('Agg') before any src.visualizer import"
  - "pm fixture scope: function-scoped for isolation between structural tests"

requirements-completed: [VIZ-02, VIZ-03, VIZ-04, VIZ-05, VIZ-06]

duration: 3min
completed: 2026-05-23
---

# Phase 5 Plan 01: Visualizer Module Test Scaffold Summary

**Wave 0 TDD scaffold: 10 pytest unit tests for VIZ-02 through VIZ-06 with Agg backend, all in RED state pending PlotManager implementation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-23T19:50:45Z
- **Completed:** 2026-05-23T19:53:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created tests/test_visualizer.py with exactly 10 test functions covering all Wave 0 behaviors
- Agg backend set as first matplotlib statement — prevents Tk window in headless/CI environments
- Added matplotlib>=3.10 to requirements.txt; already installed at 3.10.9
- Confirmed RED state: ImportError on test_visualizer.py; all 64 other tests remain green

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test scaffold (tests/test_visualizer.py)** - `ea31f44` (test)
2. **Task 2: Add matplotlib to requirements.txt** - `690413c` (chore)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `tests/test_visualizer.py` — 10-function pytest scaffold for visualizer unit tests (Wave 0, RED state)
- `requirements.txt` — matplotlib>=3.10 added under Core runtime dependencies section

## Decisions Made

- Agg backend set at module top before src.visualizer import — this is the mandatory CI-safe pattern established in VALIDATION.md
- angle_x/y/z set to None in mock_reading fixture — matches architecture decision that these are RESERVED registers (always None)
- Tests written as module-level imports (not lazy) per VALIDATION.md Wave 0 spec — ImportError during collection is the intended RED state

## Deviations from Plan

None - plan executed exactly as written.

**Note on collection behavior:** The plan states "pytest --collect-only finds 10 test items even though they all fail with ImportError". In practice, a module-level ImportError prevents pytest from enumerating test functions during collection. The scaffold contains exactly 10 functions (verified via AST parse). This is the correct Wave 0 state; Plan 02 will create src/visualizer.py and transition these tests to GREEN.

## Issues Encountered

None — pkg_resources module not available in Python 3.13 (used for the plan's verify command), confirmed matplotlib version directly via `import matplotlib; print(matplotlib.__version__)` instead. Result: 3.10.9, satisfies >=3.10.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 0 complete: test file exists, matplotlib declared, RED state confirmed
- Plan 02 (PlotManager implementation) can now proceed — it has automated verify commands that require this scaffold
- All 64 pre-existing tests remain green — zero regressions introduced

---
*Phase: 05-visualizer-module*
*Completed: 2026-05-23*
