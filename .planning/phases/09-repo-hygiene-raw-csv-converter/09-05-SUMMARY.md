---
phase: 09-repo-hygiene-raw-csv-converter
plan: 05
subsystem: converter
tags: [cli, validation, report, openpyxl]
requires: [09-03, 09-04]
provides:
  - "python -m tools.dashboard_converter <run_dir> one-command conversion"
  - "validate.py: golden checks, workbook comparison, Portuguese markdown report"
affects: [09-06]
tech-stack:
  added: []
  patterns: ["lazy openpyxl import confined to validate.read_workbook", "exit codes 0/1/2"]
key-files:
  created:
    - tools/dashboard_converter/validate.py
    - tools/dashboard_converter/cli.py
    - tools/dashboard_converter/__main__.py
    - tools/dashboard_converter/README.md
    - tests/test_dashboard_converter_validate.py
    - tests/test_dashboard_converter_cli.py
key-decisions:
  - "Workbook row-level mismatches (rows, accel, GPS key, class) are exact checks (exit 2); pontos and per-trecho stay side by side only"
  - "Workbook per-trecho numbers are recomputed with the same reference rules on workbook accel/GPS/trecho columns, then tunnel trecho folded"
  - "Boundary comparison restricts workbook run starts to the converter's sentido window"
requirements-completed: [CONV-01, CONV-07]
duration: ~30min
completed: 2026-10-08
---

# Phase 9 Plan 05: CLI and Validation Report Summary

One-command converter (`python -m tools.dashboard_converter`) that writes the site JSON and a Portuguese markdown validation report with exact golden/workbook checks and side-by-side pontos, per-trecho and boundary tables with explanations.

## Tasks

| Task | Commit |
|------|--------|
| 1 validate.py (golden checks, workbook reader/comparison, report) | e7cde0c |
| 2 cli.py, __main__.py, README, end-to-end tests | 2ad9214 |

## Notes
- Real workbook headers were probed (encoding of sheet '02' columns such as `AX — Longitudinal (g)`, `CLASSIFICAÇÃO`, `Latitude (num., cálculo)`); matching is accent/case-insensitive prefix based and picks the first match, so the later text `LATITUDE` column is ignored.
- A real-workbook run was not executed here (plan 06).
- Exit 0/1/2 verified on synthetic run folders; `--help` via `python -m` works.
- `openpyxl` imported only in `validate.read_workbook`.

## Deviations from Plan
None - plan executed as written. TDD red commits were not made separately (tests written alongside implementation).

## Issues Encountered
None. Full suite green.

## Self-Check: PASSED
