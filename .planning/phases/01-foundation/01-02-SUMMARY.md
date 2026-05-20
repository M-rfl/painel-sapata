---
phase: 01-foundation
plan: 02
subsystem: config
tags: [config-loader, yaml, validation, serial-port, dataclass, tdd, pytest]

# Dependency graph
requires:
  - src/utils.py (deep_merge from plan 01-01)
provides:
  - src/config_loader.py with load_config(), AppConfig dataclass, DEFAULTS, _validate()
  - config.yaml with all 7 fields and comments
  - list_serial_ports.py standalone diagnostic script
  - tests/test_config_loader.py with 8 tests covering CFG-01/02/03
affects: [03-sensor, 04-csv-logger, 05-main]

# Tech tracking
tech-stack:
  added:
    - PyYAML (yaml.safe_load — already in requirements.txt from plan 01)
  patterns:
    - AppConfig dataclass field names match DEFAULTS keys exactly so AppConfig(**merged) works without remapping
    - _validate() collects ALL errors before sys.exit(1) — one exit, full error report
    - load_config() accepts Path arg for testability (no hardcoded cwd dependency)
    - list_serial_ports.py imports nothing from src/ — fully standalone diagnostic

key-files:
  created:
    - src/config_loader.py
    - config.yaml
    - list_serial_ports.py
    - tests/test_config_loader.py
  modified:
    - .planning/phases/01-foundation/01-VALIDATION.md (nyquist_compliant and wave_0_complete set to true)

key-decisions:
  - "_validate() collects all errors before calling sys.exit(1) once — user sees every problem in one run, not one at a time"
  - "AppConfig field names match DEFAULTS keys exactly: AppConfig(**{k: merged[k] for k in AppConfig.__dataclass_fields__}) requires zero remapping"
  - "load_config(path) takes a Path argument so tests can use tmp_path fixtures without touching the real config.yaml"
  - "list_serial_ports.py has no src/ imports — safe to run before dependencies are installed"

requirements-completed: [CFG-01, CFG-02, CFG-03, CONN-04]

# Metrics
duration: 3min
completed: 2026-05-20
---

# Phase 1 Plan 02: Config Loader Summary

**YAML config loader with typed AppConfig dataclass, human-readable exit-1 validation for missing/invalid fields, and standalone serial port diagnostic — 31 tests green (8 new)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-20T11:43:16Z
- **Completed:** 2026-05-20T11:46:13Z
- **Tasks:** 2
- **Files modified:** 5 (4 new, 1 modified)

## Accomplishments

- tests/test_config_loader.py written first (TDD RED): 8 tests covering CFG-01/02/03 defaults, missing file, missing serial_port, invalid baudrate type, out-of-range slave_id, negative sample_interval — all initially fail with ImportError
- src/config_loader.py implemented (TDD GREEN): AppConfig dataclass, DEFAULTS dict, load_config(path), _validate() with human-readable errors and sys.exit(1)
- config.yaml: all 7 fields with inline comments explaining valid values and factory defaults
- list_serial_ports.py: standalone script, exits 0 with no hardware connected (prints "No serial ports found." + troubleshooting guide)
- 01-VALIDATION.md frontmatter updated: nyquist_compliant: true, wave_0_complete: true
- Full suite: 31 tests passing (8 test_config_loader + 7 test_structure + 16 test_utils)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing tests for config loader** - `085ebc7` (test)
2. **Task 1 GREEN: Implement src/config_loader.py** - `0966e82` (feat)
3. **Task 2: Add config.yaml, list_serial_ports.py; mark VALIDATION.md complete** - `156e30e` (feat)

_Note: TDD task 1 split into test commit (RED) and implementation commit (GREEN)._

## Files Created/Modified

- `src/config_loader.py` — load_config(path)->AppConfig; DEFAULTS dict; _validate() with sys.exit(1) on errors; exports: load_config, AppConfig, DEFAULTS
- `config.yaml` — 7 fields: serial_port (required), baudrate, slave_id, sample_interval_seconds, output_folder, csv_filename_prefix, log_level; all with comments
- `list_serial_ports.py` — Standalone; serial.tools.list_ports.comports(); exits 0 regardless of hardware; includes OS-specific troubleshooting
- `tests/test_config_loader.py` — 8 unit tests: 3 for CFG-01/03 (defaults/overrides/all-fields), 5 for CFG-02 (missing file, missing serial_port, bad baudrate type, slave_id OOR, negative interval)
- `.planning/phases/01-foundation/01-VALIDATION.md` — nyquist_compliant: true, wave_0_complete: true

## Decisions Made

- `_validate()` collects all errors before calling `sys.exit(1)` once — user sees all configuration problems in a single run rather than fixing one at a time.
- AppConfig field names exactly match DEFAULTS keys so `AppConfig(**{k: merged[k] for k in AppConfig.__dataclass_fields__})` requires zero key remapping.
- `load_config(path)` accepts a `Path` argument for testability — no hardcoded `cwd` reference, tests use `tmp_path` fixtures cleanly.
- `list_serial_ports.py` imports nothing from `src/` — safe to run on a fresh checkout before all dependencies are confirmed installed.

## Deviations from Plan

None — plan executed exactly as written.

## Phase 1 Completion Note

All 9 Phase 1 requirements satisfied across plans 01-01 and 01-02:
- **CONN-04** (WTVB01-485 port enumeration) — list_serial_ports.py
- **STORE-03** (SensorReading dataclass) — src/utils.py (plan 01-01)
- **CFG-01** (config.yaml with all fields) — config.yaml + AppConfig
- **CFG-02** (validation errors exit 1) — _validate() in config_loader.py
- **CFG-03** (defaults for optional fields) — DEFAULTS + deep_merge in config_loader.py
- **UTIL-01** (dual-handler logging) — setup_logging() in utils.py (plan 01-01)
- **UTIL-02** (rotating file handler) — setup_logging() in utils.py (plan 01-01)
- **UTIL-03** (project structure importable) — src/ package (plan 01-01)
- **DOC-04** (pinned requirements.txt) — requirements.txt (plan 01-01)

---
*Phase: 01-foundation*
*Completed: 2026-05-20*
