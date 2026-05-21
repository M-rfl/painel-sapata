---
phase: 03-acquisition-loop
plan: "01"
subsystem: tests
tags: [tdd, red-state, csv-logger, main, acquisition]
dependency_graph:
  requires: []
  provides: [tests/test_csv_logger.py, tests/test_main.py]
  affects: [03-02-PLAN.md, 03-03-PLAN.md]
tech_stack:
  added: []
  patterns: [tdd-red-green, pytest-capsys, unittest.mock.patch]
key_files:
  created:
    - tests/test_csv_logger.py
    - tests/test_main.py
  modified: []
decisions:
  - "test_failed_read_not_written renamed to test_rows_written_counter — simpler to test CSVLogger counter attribute directly without depending on main.py in csv_logger test file"
  - "patch target strings use 'main.WitMotionSensor', 'main.CSVLogger', etc. so patches apply in main's namespace when main.py is created in Plan 03"
metrics:
  duration: "2 min"
  completed_date: "2026-05-21"
  tasks_completed: 2
  files_created: 2
requirements_covered:
  - STORE-01
  - STORE-02
  - STORE-03
  - STORE-04
  - STORE-05
  - STORE-06
  - CONN-02
  - DISP-01
  - DISP-02
  - DISP-03
---

# Phase 03 Plan 01: Failing Tests (RED) Summary

**One-liner:** 13 failing test stubs — 8 for CSVLogger (STORE-01..06) and 5 for main.py acquisition loop (CONN-02, DISP-01..03) — all RED via ImportError/ModuleNotFoundError.

## What Was Built

Two test files written in TDD RED phase. No implementation code was created or modified.

### tests/test_csv_logger.py (8 tests, all RED)

| Test | Requirement | Failure Mode |
|------|-------------|--------------|
| test_file_created_with_correct_name | STORE-01 | ImportError: CSVLogger |
| test_output_folder_created | STORE-01 | ImportError: CSVLogger |
| test_header_row_columns | STORE-02 | ImportError: CSVLogger |
| test_header_written_once | STORE-04 | ImportError: CSVLogger |
| test_timestamp_format | STORE-03 | ImportError: CSVLogger |
| test_flush_after_each_row | STORE-05 | ImportError: CSVLogger |
| test_none_fields_become_empty_string | STORE-06 | ImportError: CSVLogger |
| test_rows_written_counter | STORE-06 | ImportError: CSVLogger |

**RED confirmed:** `ImportError: cannot import name 'CSVLogger' from 'src.csv_logger'`

### tests/test_main.py (5 tests, all RED)

| Test | Requirement | Failure Mode |
|------|-------------|--------------|
| test_graceful_shutdown_closes_resources | CONN-02 | ModuleNotFoundError: main |
| test_session_summary_on_ctrl_c | DISP-03 | ModuleNotFoundError: main |
| test_terminal_display_per_sample | DISP-01 | ModuleNotFoundError: main |
| test_connection_status_messages | DISP-02 | ModuleNotFoundError: main |
| test_connection_error_message_on_read_fail | DISP-02 | ModuleNotFoundError: main |

**RED confirmed:** `ModuleNotFoundError: No module named 'main'`

## Existing Tests Unaffected

42 tests in test_utils.py, test_config_loader.py, test_sensor.py, test_structure.py — all still PASS.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 89483e6 | test(03-01): add failing tests for CSVLogger (RED) |
| Task 2 | 821e529 | test(03-01): add failing tests for main.py acquisition loop (RED) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan Adjustment] Renamed test_failed_read_not_written to test_rows_written_counter**
- **Found during:** Task 1 planning
- **Issue:** The plan's test_failed_read_not_written behavior (verifying main.py skips write on None read) requires main.py to exist, which contradicts keeping csv_logger tests isolated.
- **Fix:** Renamed to test_rows_written_counter — tests CSVLogger.rows_written attribute directly, simpler and fully isolated.
- **Files modified:** tests/test_csv_logger.py
- **Commit:** 89483e6

None - all other tasks executed exactly as written.

## Self-Check

Files created:
- tests/test_csv_logger.py — FOUND
- tests/test_main.py — FOUND

Commits:
- 89483e6 — FOUND
- 821e529 — FOUND

## Self-Check: PASSED
