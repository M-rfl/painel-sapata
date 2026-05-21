---
phase: 02-sensor-layer
plan: "01"
subsystem: sensor
tags: [modbus, tdd, sensor, pymodbus, mock]
dependency_graph:
  requires:
    - 01-01  # utils.py: SensorReading, to_signed16, get_timestamp_br
    - 01-02  # config_loader.py: AppConfig
  provides:
    - WitMotionSensor  # connect(), close(), read_all_data() -> SensorReading
  affects:
    - 03-csv-logger    # reads SensorReading produced here
    - 03-main          # calls WitMotionSensor in polling loop
tech_stack:
  added:
    - pymodbus==3.13.0  # already installed; FramerType.RTU, ModbusSerialClient, ModbusException
    - unittest.mock     # stdlib; MagicMock, patch for hardware-free tests
  patterns:
    - TDD (RED -> GREEN)
    - Mock-based hardware substitution via @patch("src.sensor.ModbusSerialClient")
    - Two-level error handling: ModbusException + response.isError()
    - Consecutive error counter with dual-level logging (WARNING + ERROR at threshold)
    - getattr fallback for optional config fields (sensor_id)
key_files:
  created:
    - tests/test_sensor.py   # 11 mock-based unit tests; all GREEN
    - src/sensor.py          # WitMotionSensor class (replaces Phase 1 stub)
  modified: []
decisions:
  - id: USE_DEVICE_ID
    summary: "Use device_id= (pymodbus 3.13.0 API) — not slave= (removed 3.10) or unit= (removed 3.5)"
  - id: NONE_SCALE_CONSTANTS
    summary: "Non-acceleration SCALE_* constants set to None pending WTVB01-485 datasheet; fields remain None rather than wrong values"
  - id: SENSOR_ID_GETATTR
    summary: "sensor_id read via getattr(config, 'sensor_id', 'wtvb01') — AppConfig unchanged, no Phase 1 re-testing needed"
  - id: ERROR_ON_THRESHOLD
    summary: "ERROR logged when _consecutive_errors >= _MAX_CONSECUTIVE_ERRORS; WARNING logged on every failure"
metrics:
  duration: "3 minutes"
  completed_date: "2026-05-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 02 Plan 01: WitMotionSensor TDD Implementation Summary

**One-liner:** WitMotionSensor class with Modbus RTU burst read using pymodbus 3.13.0 device_id= API, to_signed16 on all registers, and mock-based unit tests.

## What Was Built

`src/sensor.py` — Full `WitMotionSensor` class replacing the Phase 1 stub, and `tests/test_sensor.py` with 11 mock-based unit tests covering all CONN and ACQ requirements.

### Files Created

| File | Purpose |
|------|---------|
| `tests/test_sensor.py` | 11 mock-based unit tests for WitMotionSensor |
| `src/sensor.py` | WitMotionSensor: connect(), close(), read_all_data(), _parse_registers() |

## Test Results

- **test_sensor.py**: 11 tests, all GREEN
- **Full suite**: 42 tests (31 Phase 1 + 11 Phase 2), all GREEN, zero regressions

```
tests/test_config_loader.py  8 passed
tests/test_sensor.py        11 passed
tests/test_structure.py      7 passed
tests/test_utils.py         16 passed
42 passed in 1.32s
```

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (RED) | b8cd42b | test(02-01): add failing tests for WitMotionSensor (RED) |
| 2 (GREEN) | 4941772 | feat(02-01): implement WitMotionSensor class (GREEN) |

## Decisions Made

### 1. device_id= API (not slave= or unit=)
- **Decision:** Use `device_id=self._config.slave_id` in all Modbus calls
- **Reason:** pymodbus 3.13.0 removed `slave=` at 3.10 and `unit=` at 3.5. Both raise `TypeError`.
- **Verified:** AST scan confirmed no `slave=` or `unit=` keyword arguments in production code (grep matches were only in comments).

### 2. None scale constants for non-acceleration channels
- **Decision:** `SCALE_VEL = SCALE_ANGLE = SCALE_TEMP = SCALE_DISP = SCALE_FREQ = None`
- **Reason:** Scale factors for velocity, angle, temperature, displacement, and frequency are not confirmed from the WTVB01-485 datasheet. Setting to None causes those SensorReading fields to be None rather than physically wrong values that would pass silently in CSV output.
- **Impact:** ACQ-03 through ACQ-07 fields will be None until datasheet is obtained.

### 3. getattr fallback for sensor_id
- **Decision:** `sensor_id=getattr(self._config, "sensor_id", "wtvb01")` in `_parse_registers()`
- **Reason:** AppConfig has no `sensor_id` field. Adding it would require modifying Phase 1 code and retesting. The getattr fallback avoids that churn — if `sensor_id` is added to AppConfig later, the fallback automatically picks it up.

### 4. ERROR logged at threshold (not only at exactly threshold)
- **Decision:** Log ERROR when `_consecutive_errors >= _MAX_CONSECUTIVE_ERRORS` (not `==`)
- **Reason:** Ensures ERROR is logged on the Nth failure and on every subsequent failure, providing continuous visibility during persistent outages. Test asserts at least one ERROR after exactly N failures.

## Open Questions Surfaced

1. **Scale factors for non-acceleration channels** (pre-existing blocker, now documented in code)
   - All six SCALE_* constants (VEL, ANGLE, TEMP, DISP, FREQ) are None
   - Must obtain WitMotion WTVB01-485 protocol PDF or datasheet
   - Google Drive folder ID from product page: `15p7ZJVKMsaV_eTzXRlOVxuf1tIH_RUPD`
   - Alternatively: run sensor with WitMotion PC software and compare channel readings

2. **Z-axis gravity test (ACQ-09 hardware criterion)** — cannot automate without physical sensor
   - Expected: `az_g ≈ 1.0 g` with sensor resting flat
   - Execute at first hardware session after scale factors are confirmed

## Deviations from Plan

None — plan executed exactly as written. The implementation follows the RESEARCH.md skeleton verbatim with all patterns applied as specified.
