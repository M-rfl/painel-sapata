---
phase: 09-repo-hygiene-raw-csv-converter
plan: 02
subsystem: converter
tags: [python, csv, pt-BR-recovery, dataclasses]
requires: [09-01]
provides:
  - tools.dashboard_converter.model shared contracts (RunData, Assignment, GpsFixes, flags)
  - recover.py per-cell recovery for mangled pt-BR values
  - sources.logger_csv.read_run(run_dir) -> RunData
  - tests/fixtures/golden_run1.json
affects: [09-03, 09-04, 09-05]
tech-stack:
  added: []
  patterns: [stdlib-only core, exact Fraction/Decimal arithmetic for grid checks]
key-files:
  created:
    - tools/dashboard_converter/model.py
    - tools/dashboard_converter/geo.py
    - tools/dashboard_converter/recover.py
    - tools/dashboard_converter/sources/logger_csv.py
    - requirements-dashboard.txt
    - tests/fixtures/golden_run1.json
    - tests/fixtures/run_mini/2. B-A.csv
    - tests/fixtures/run_mini/3. A-B.csv
  modified: [pytest.ini]
key-decisions:
  - "pytest default addopts deselects the slow marker; run with -m slow"
  - "Ambiguous accel readings are reported but never changed (workbook rule parity)"
requirements-completed: [CONV-02]
duration: 25min
completed: 2026-10-08
---

# Phase 9 Plan 02: Raw CSV Reader and Recovery Summary

Stdlib-only reader that merges clean ',' and pt-BR ';' logger CSVs by timestamp and recovers mangled accel, GPS and scaled values with exact arithmetic; unrecoverable cells become null plus a ValueIssue.

## Accomplishments
- Package scaffold and the shared contracts (model.py) used by plans 03 and 04, haversine helper, golden fixture, `slow` marker.
- recover.py: accel (k / k-1 rules), GPS (envelope-checked), scaled candidates resolved by neighbours or column median.
- read_run: sniffing, recovery, ambiguity audit, StructuralError cases. On the real run: 23383 rows, 21363 with GPS, no accel/GPS issues, first 10839 rows from the ';' file.

## Task Commits
1. Task 1 scaffold: 80374f0
2. Task 2 tests (RED): 01635ee; implementation (GREEN): 8075ab4
3. Task 3 reader: 834c8f0

## Deviations from Plan
None - plan executed as written. (A bash heredoc parse failure on first attempt had no effect; files were then created with the Write tool.)

## Issues Encountered
None. Full suite: 156 passed.

## Self-Check: PASSED
