---
phase: 07-gps-reader-data-model
plan: 02
subsystem: data-model
tags: [python, dataclass, sensor-reading, gps, winsdk]

# Dependency graph
requires:
  - phase: 07-01
    provides: GPSReader class that will populate the GPS fields
provides:
  - SensorReading dataclass extended with gps_lat, gps_lon, gps_speed_mps fields
  - All GPS fields Optional[float] with field(default=None) for backward compatibility
affects:
  - 07-03-gps-wiring (wires GPSReader output into SensorReading fields)
  - 08-csv-gps-integration (reads gps_lat, gps_lon, gps_speed_mps for CSV column extension)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dataclasses.field(default=None) for optional GPS fields appended after required fields"
    - "TDD RED-GREEN: failing tests first, then minimal implementation to pass"

key-files:
  created: []
  modified:
    - src/utils.py
    - tests/test_utils.py

key-decisions:
  - "GPS fields appended as last 3 fields in SensorReading to preserve CSV column ordering for Phase 8"
  - "Used dataclasses.field(default=None) instead of = None to satisfy Python dataclass field ordering (defaults must come after non-defaults)"

patterns-established:
  - "Optional GPS fields pattern: always append at end of dataclass with field(default=None)"

requirements-completed: [GPS-05]

# Metrics
duration: 4min
completed: 2026-05-24
---

# Phase 7 Plan 2: GPS Data Model Extension Summary

**SensorReading dataclass extended with three GPS fields (gps_lat, gps_lon, gps_speed_mps) as Optional[float] with field(default=None), preserving all 81 existing test passes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-24T23:14:49Z
- **Completed:** 2026-05-24T23:18:52Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- SensorReading now carries GPS coordinates as the last 3 optional fields
- All existing callsites unaffected — no keyword arguments required for GPS fields
- 2 new tests verify default-None behavior and explicit float assignment
- 81 tests GREEN (79 pre-existing + 2 new GPS tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GPS fields to SensorReading — RED** - `200118f` (test)
2. **Task 1: Add GPS fields to SensorReading — GREEN** - `a1bb72a` (feat)

_Note: TDD tasks have multiple commits (test → feat)_

## Files Created/Modified

- `src/utils.py` - Added `gps_lat`, `gps_lon`, `gps_speed_mps` Optional[float] fields with `field(default=None)`; updated import and docstring
- `tests/test_utils.py` - Added `test_sensor_reading_gps_fields_default_to_none` and `test_sensor_reading_gps_fields_accept_floats`

## Decisions Made

- GPS fields appended as the last 3 fields to preserve STORE-02 CSV column ordering for Phase 8
- Used `dataclasses.field(default=None)` because Python requires fields with defaults to come after fields without defaults; all 17 original fields have no defaults so appending at end is valid

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The 8 failing tests in `test_gps_reader.py` are pre-existing (plan 07-01 RED state, awaiting 07-01 GREEN implementation) and are outside this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SensorReading data model is ready for Phase 07-03 GPS wiring (background thread populates these fields)
- GPS column order (last 3) is set for Phase 08 CSV extension
- All existing acquisition loop code continues to work unchanged

---
*Phase: 07-gps-reader-data-model*
*Completed: 2026-05-24*
