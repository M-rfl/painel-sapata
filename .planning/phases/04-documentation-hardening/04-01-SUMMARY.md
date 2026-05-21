---
phase: 04-documentation-hardening
plan: "01"
subsystem: testing
tags: [pytest, tdd, documentation, pathlib, red-phase]

# Dependency graph
requires:
  - phase: 03-acquisition-loop
    provides: src/sensor.py, src/csv_logger.py, src/main.py — all source files under test

provides:
  - tests/test_docs.py with 9 RED tests covering DOC-01, DOC-02, DOC-03 acceptance criteria

affects:
  - 04-02 (README.md creation — must make tests pass GREEN)
  - 04-03 (sensor.py hardening — _REG_COUNT arithmetic expression)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD Wave 0: write failing tests before any production change"
    - "pathlib.Path(__file__).parent.parent for project-root-relative file reads in tests"
    - "_read_readme() helper with pytest.skip() to avoid cascade failures on absent files"

key-files:
  created:
    - tests/test_docs.py
  modified: []

key-decisions:
  - "test_readme_exists does NOT use pytest.skip — asserts directly so it FAILs, not SKIPs"
  - "Tests 2-5 use _read_readme() helper with pytest.skip() to skip gracefully when README absent, avoiding cascade AttributeErrors"
  - "Tests 7-9 (no_naive_datetime, csv_flush_present, signed16_on_signed_channels) PASS in RED phase — codebase already compliant; this is acceptable TDD behaviour"

patterns-established:
  - "File-read tests: no src imports, no conftest fixtures — pure pathlib.Path reads only"
  - "RED phase tolerance: pre-existing compliant code is allowed to pass; only targeted new functionality must fail"

requirements-completed:
  - DOC-01
  - DOC-02
  - DOC-03

# Metrics
duration: 5min
completed: 2026-05-21
---

# Phase 4 Plan 01: Documentation & Hardening — TDD RED Scaffold Summary

**9-test pytest scaffold checking README.md content (DOC-01), register arithmetic (DOC-02), and runtime-hardening invariants (DOC-03) — all written before any production change**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-21T20:27:11Z
- **Completed:** 2026-05-21T20:32:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created tests/test_docs.py with exactly 9 test functions, no collection errors
- Verified RED phase: test_readme_exists FAILS, test_reg_count_arithmetic FAILS (as required)
- Verified SKIP phase: 4 README content tests skip gracefully via _read_readme() helper
- Verified 3 hardening tests (datetime/flush/signed16) PASS — src/ already compliant
- Existing 55-test suite still passes unmodified

## Task Commits

Each task was committed atomically:

1. **Task 1: Write tests/test_docs.py — 9 RED tests** — `b0840f2` (test)

**Plan metadata:** (see final docs commit below)

## Files Created/Modified

- `tests/test_docs.py` — 9 TDD RED tests for Phase 4 documentation and hardening acceptance criteria

## Decisions Made

- test_readme_exists asserts directly (no skip) so it FAILS visibly in RED phase — makes the missing README unmissable in CI output
- _read_readme() helper uses pytest.skip() for tests 2-5 to avoid cascade failures that would hide the real signal
- Tests 7-9 are intentionally GREEN in RED phase — pre-existing codebase compliance is correct, not a problem

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- tests/test_docs.py is the acceptance gate for Plan 04-02 (README.md creation)
- Plan 04-02 must make test_readme_exists, test_readme_ch340_driver, test_readme_serial_port_os_coverage, test_readme_list_serial_ports, and test_readme_troubleshooting_count all pass GREEN
- Plan 04-03 must make test_reg_count_arithmetic pass by changing _REG_COUNT = 19 to _REG_COUNT = 0x46 - 0x34 + 1 in sensor.py

## Self-Check

- [x] tests/test_docs.py exists and has 128 lines (> 80 minimum)
- [x] Commit b0840f2 exists in git log
- [x] pytest tests/test_docs.py: 2 FAILED, 3 PASSED, 4 SKIPPED — matches RED-phase spec
- [x] Full suite: 55 passed — no regression

## Self-Check: PASSED

---
*Phase: 04-documentation-hardening*
*Completed: 2026-05-21*
