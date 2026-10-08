---
phase: 09-repo-hygiene-raw-csv-converter
plan: 06
subsystem: converter
tags: [real-data, golden-test, site-json, validation]
requires: [09-05]
provides:
  - "site/data/run-2026-10-02-l4-t102.json committed (schema v1)"
  - "CI golden test reproducing exact totals from the committed JSON"
  - "Real-data behaviour tests and slow workbook test"
affects: [10, 11]
key-files:
  created:
    - tests/test_dashboard_converter_real.py
    - tests/test_dashboard_site_json.py
    - site/data/run-2026-10-02-l4-t102.json
  modified:
    - tests/test_dashboard_converter_validate.py
    - tools/dashboard_converter/validate.py
key-decisions:
  - "Engineer approved the validation report with documented per-trecho deviations (see Known Issues)"
  - "Sentido split accepted at 11.835 under the locked dwell rule"
requirements-completed: [CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06, CONV-07]
completed: 2026-10-08
---

# Phase 9 Plan 06: Real-Data Run and Golden CI Test Summary

Ran the converter on the real run 1 raw CSVs, committed the schema v1 site JSON, and added a CI golden test that reproduces the exact golden totals from the committed JSON alone. The engineer approved the validation report.

## Tasks

| Task | Commit |
|------|--------|
| 1 Real-data run, real-data tests, slow workbook test | 7bc9d64 |
| 2 Commit site JSON and CI golden test | efde859 |
| 3 Engineer sign-off on validation report (human-verify) | approved |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Workbook AX column exclusion matched "Longitudinal"**
- **Found during:** Task 1
- **Issue:** The workbook header exclusion token "din" matched inside "Longitudinal", so the AX column was skipped.
- **Fix:** Changed the exclusion to "din." so only the intended column is excluded.
- **Files modified:** tools/dashboard_converter/validate.py
- **Commit:** 7bc9d64

## Known Issues / Deferred

The engineer approved the report with these known deviations:

- **Per-trecho collapse at inferred stations.** Inferred stations (CTR at 210 m, EQD at 159 m, SCT) collapse the following trecho. Vila Olímpica – Central has 1 record against 2.940 in the workbook, Rodoviária – Equador 1 against 295, Gamboa – Santo Cristo 326 against 1.468. Candidate fixes: a larger station radius, or placing an inferred station's boundary at the closest GPS approach. Revisit before the per-trecho dashboard views.
- **Sentido split** is at 11.835 against about 10.839 in the workbook, because of the dwell inside the 200 m PXV terminal radius. Accepted under the locked rule.
- **Pontos** are 99 against 101 in the workbook (side by side only).
- **Open:** re-confirm 6-dp public GPS precision at the Phase 11 push checkpoint.

## Self-Check: PASSED
