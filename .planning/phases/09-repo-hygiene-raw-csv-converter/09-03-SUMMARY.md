---
phase: 09-repo-hygiene-raw-csv-converter
plan: 03
subsystem: converter
tags: [geofence, stations, trecho, sentido, gps]
requires: [09-02]
provides:
  - "stations.py: tolerant Stations_GEO parser, warnings, display names"
  - "geofence.py: score_lines, assign (sentido/trecho/flag runs), expand_runs"
affects: [09-04, 09-06]
tech-stack:
  added: []
  patterns: ["forward-only station-progress state machine", "run-length encoded per-sample assignments"]
key-files:
  created:
    - tools/dashboard_converter/stations.py
    - tools/dashboard_converter/geofence.py
    - tests/test_dashboard_converter_stations.py
    - tests/test_dashboard_converter_geofence.py
  modified: []
decisions:
  - "Dwell at a station and the terminal stays in the arriving trecho; an inferred station with no samples between neighbours gets boundary = next neighbour's entry"
  - "First hit of a run may be any station of the line (run can start mid-line); earlier stations are 'not_reached' and not listed in stations_not_hit"
  - "Samples after a terminal turnaround with no further station hit are flagged edge"
metrics:
  duration: ~40min
  completed: 2026-10-08
  tasks: 3
  files: 4
---

# Phase 9 Plan 03: Station Parser and Geofence Assignment Summary

Tolerant Stations_GEO parser plus a forward-only station-progress state machine that assigns sentido, trecho and sem GPS/edge/inferred flags to every sample, proven on synthetic tracks and the real Line 1 file.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 Station parser, warnings, display names | c60d04d | 6 tests; real files give no coordinate warnings |
| 2+3 Line scoring, segmentation, trecho runs, flags, Assignment | ebe6138 | 13 tests; implemented in one pass since Task 3 builds on the same state machine |

## Deviations from Plan

- Tasks 2 and 3 were implemented and committed together (single `geofence.py` module written end to end); behaviours of both were covered by tests. TDD red commits were not made separately.
- Pre-existing failure: `tests/test_visualizer.py::test_animate_sets_line_data` (tkinter/Tcl not available in this environment) is unrelated and untouched.

## Self-Check: PASSED
