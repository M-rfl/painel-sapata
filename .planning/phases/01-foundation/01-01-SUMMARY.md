---
phase: 01-foundation
plan: 01
subsystem: testing
tags: [pymodbus, pyserial, tzdata, zoneinfo, pytest, dataclass, logging]

# Dependency graph
requires: []
provides:
  - requirements.txt with pymodbus==3.13.0 exact pin and all runtime deps
  - src/ Python package (importable)
  - src/utils.py with to_signed16, get_timestamp_br, setup_logging, deep_merge, SensorReading
  - src/sensor.py stub (Phase 2 placeholder)
  - src/csv_logger.py stub (Phase 3 placeholder)
  - logs/.gitkeep directory committed
  - tests/ package with conftest, test_utils.py (16 tests), test_structure.py (7 tests)
  - pytest.ini configuration
affects: [02-config-loader, 03-sensor, 04-csv-logger, 05-main]

# Tech tracking
tech-stack:
  added:
    - pymodbus==3.13.0 (Modbus RTU client, exact pin)
    - pyserial>=3.5 (serial port enumeration)
    - PyYAML>=6.0 (config loading)
    - tzdata>=2024.1 (IANA timezone database for Windows)
    - pytest>=7.0 (test runner, pytest-9.0.3 installed)
  patterns:
    - TDD red-green cycle for all implementation tasks
    - ZoneInfo import guard (try zoneinfo / except backports.zoneinfo) for Py3.8 compat
    - Dual-handler logging: RotatingFileHandler(DEBUG) + StreamHandler(WARNING)
    - deep_merge never mutates inputs — returns new dict
    - SensorReading as pure dataclass in utils.py (zero I/O) to avoid circular imports

key-files:
  created:
    - requirements.txt
    - src/__init__.py
    - src/utils.py
    - src/sensor.py
    - src/csv_logger.py
    - logs/.gitkeep
    - tests/__init__.py
    - tests/conftest.py
    - tests/test_utils.py
    - tests/test_structure.py
    - pytest.ini
  modified: []

key-decisions:
  - "SensorReading defined in utils.py (not sensor.py) to break circular import: sensor.py and csv_logger.py can both import SensorReading without depending on each other"
  - "to_signed16 implementation: value - 65536 for values >= 32768 (not struct.unpack) — explicit, dependency-free, fast"
  - "setup_logging takes log_dir parameter (not hardcoded) to allow tmp_path fixture in tests without touching project logs/"
  - "StreamHandler filter in test uses type() is exact match to exclude pytest LogCaptureHandler subclass (which has level NOTSET)"

patterns-established:
  - "TDD: write failing test, commit as test(), implement, commit as feat(), verify all pass"
  - "Import guard pattern for zoneinfo/backports.zoneinfo compatibility"
  - "Root logger configuration: setLevel(DEBUG), file handler at DEBUG, console at WARNING"

requirements-completed: [UTIL-01, UTIL-02, UTIL-03, STORE-03, DOC-04]

# Metrics
duration: 5min
completed: 2026-05-20
---

# Phase 1 Plan 01: Project Scaffold Summary

**src/utils.py with two's-complement to_signed16, ZoneInfo(-03:00) timestamps, dual-handler rotating logging, recursive deep_merge, and 19-field SensorReading dataclass — 23 tests green**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-20T11:34:26Z
- **Completed:** 2026-05-20T11:39:46Z
- **Tasks:** 2
- **Files modified:** 11 (all new)

## Accomplishments

- Pinned requirements.txt (pymodbus==3.13.0, pyserial, PyYAML, tzdata, pytest) installed and verified
- src/utils.py fully implemented: to_signed16 (2's complement), get_timestamp_br (ZoneInfo -03:00), setup_logging (RotatingFileHandler 1MB/5bkp), deep_merge (non-mutating recursive), SensorReading (19 fields matching STORE-02)
- 23 tests passing: 16 unit tests in test_utils.py, 7 structure tests in test_structure.py

## Task Commits

Each task was committed atomically:

1. **Task 1: Create requirements.txt and project skeleton** - `77b2dd5` (feat)
2. **Task 2 RED: Add failing tests for src/utils.py** - `0f8d8b0` (test)
3. **Task 2 GREEN: Implement src/utils.py** - `530c01e` (feat)

_Note: TDD task 2 split into test commit (RED) and implementation commit (GREEN)._

## Files Created/Modified

- `requirements.txt` - Pinned deps: pymodbus==3.13.0, pyserial>=3.5, PyYAML>=6.0, tzdata>=2024.1, backports.zoneinfo conditional, pytest>=7.0
- `src/__init__.py` - Package marker (intentionally empty, no re-exports)
- `src/utils.py` - to_signed16, get_timestamp_br, setup_logging, deep_merge, SensorReading dataclass
- `src/sensor.py` - Phase 2 stub (docstring only)
- `src/csv_logger.py` - Phase 3 stub (docstring only)
- `logs/.gitkeep` - Committed logs/ directory placeholder
- `tests/__init__.py` - Tests package marker
- `tests/conftest.py` - reset_logging_handlers autouse fixture, minimal_config_yaml fixture
- `tests/test_utils.py` - 16 unit tests covering all utils.py exports
- `tests/test_structure.py` - 7 structure tests (files exist, src importable)
- `pytest.ini` - testpaths=tests, -q --tb=short

## Decisions Made

- SensorReading lives in utils.py (not sensor.py) to prevent circular imports between sensor.py and csv_logger.py — both will need to import it.
- to_signed16 uses `value - 65536` (not struct.unpack) — explicit, no imports, O(1), matches the boundary truth table exactly.
- setup_logging accepts `log_dir` parameter instead of hardcoding `logs/` — allows tests to use tmp_path without polluting the project log directory.
- StreamHandler filter in test_setup_logging_console_handler_level uses `type(h) is logging.StreamHandler` (exact type match) to exclude pytest's internal LogCaptureHandler (a subclass with level NOTSET=0 that would otherwise fail the assertion).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed StreamHandler test filter to exclude pytest's LogCaptureHandler**
- **Found during:** Task 2 GREEN phase (first test run)
- **Issue:** The plan's test code used `not hasattr(h, 'maxBytes')` to exclude RotatingFileHandler, but pytest's LogCaptureHandler (a StreamHandler subclass with level NOTSET=0) also lacks maxBytes. The filter picked up LogCaptureHandler first, causing `assert 0 >= 30` to fail.
- **Fix:** Changed filter from `isinstance(h, logging.StreamHandler) and not hasattr(h, 'maxBytes')` to `type(h) is logging.StreamHandler` (exact type match — excludes all subclasses including both RotatingFileHandler and LogCaptureHandler).
- **Files modified:** tests/test_utils.py
- **Verification:** pytest tests/test_utils.py passes 16/16 after fix
- **Committed in:** `530c01e` (Task 2 feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix necessary for test correctness on Windows with pytest's log capture. No scope creep. The implementation in utils.py is exactly as specified.

## Issues Encountered

- pytest not on PATH (expected on Windows Store Python) — invoked via `python -m pytest` throughout. No impact on test results.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 02 (config_loader.py) can proceed immediately:
- `from src.utils import deep_merge` — ready to use for merging DEFAULTS with user YAML
- `from src.utils import SensorReading` — available for type annotations in sensor.py (Phase 2)
- `from src.utils import get_timestamp_br, setup_logging` — ready for main.py (Phase 3)

Blockers inherited from planning (not introduced here):
- [Phase 2] Scale factors for velocity, angle, displacement, frequency channels are UNKNOWN — need WitMotion WTVB01-485 datasheet
- [Phase 2] Verify `from pymodbus.framer import FramerType` import path in pymodbus 3.13.0

---
*Phase: 01-foundation*
*Completed: 2026-05-20*
