---
phase: 09-repo-hygiene-raw-csv-converter
plan: 04
subsystem: converter
tags: [json-schema, gps, reference-analysis]
requires: [09-02]
provides: [site-json-schema-v1, gps-fixes, reference-analysis]
affects: [09-05, 09-06, phase-10]
tech-stack:
  added: []
  patterns: [run-length encoding, integer-quantized channels, doubled-LSB integer arithmetic]
key-files:
  created:
    - tools/dashboard_converter/gps.py
    - tools/dashboard_converter/writer.py
    - tools/dashboard_converter/analysis_ref.py
    - tests/test_dashboard_converter_gps.py
    - tests/test_dashboard_converter_writer.py
    - tests/test_dashboard_converter_analysis.py
key-decisions:
  - "GPS precision in public JSON is 6 decimals (pontos-key parity with workbook); re-confirm at the Phase 11 push checkpoint since it is public location data"
  - "6-dp key uses Decimal ROUND_HALF_UP, not Python round()"
  - "Reference analysis works in doubled LSB units so .5 medians have no float edge errors"
requirements-completed: [CONV-06]
duration: 20min
completed: 2026-10-08
---

# Phase 9 Plan 04: Site JSON schema v1, GPS fixes, reference analysis Summary

Frozen site JSON schema v1 (compact UTF-8, drift-free dt_ms, integer-quantized accel and channels), GPS fixes with half-up 6-dp location ids and estimated speed, and a stdlib reference analysis oracle.

## Tasks
1. GPS fixes/keys/speed - f6c9845
2. Schema v1 writer, loader, decoder - 918d4f7
3. Reference analysis - f3f8933

## Deviations from Plan
None - plan executed exactly as written. Tests were written together with the implementation in a single commit per task (no separate RED commit).

## Notes
- Full test suite green after this plan.
- GPS 6-dp public precision must be re-confirmed at the Phase 11 push checkpoint.
- Reference analysis per-axis medians use the non-None values of each axis; rows with any None accel are unclassified.

## Self-Check: PASSED
