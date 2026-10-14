---
phase: 14-csv-upload
plan: 04
subsystem: converter-js
tags: [geofence, haversine, parity, csv-upload]
requires: ["14-01"]
provides:
  - "site/js/core/convert/geo.js: haversineM (CPython-faithful)"
  - "site/js/core/convert/stations.js: prepareLines(stationsJson)"
  - "site/js/core/convert/geofence.js: scoreLines, assign, expandRuns (snake_case Assignment shape)"
affects: [14-05]
tech-stack:
  added: []
  patterns: ["line-by-line port with variable names kept for 1:1 diff against Python"]
key-files:
  created:
    - site/js/core/convert/geo.js
    - site/js/core/convert/stations.js
    - site/js/core/convert/geofence.js
    - tests/js/convert_geofence.test.js
  modified: []
key-decisions:
  - "Algorithm ported unchanged (accepted deviations preserved); no line override in JS API"
  - "Float tolerance (1e-9 relative) only on min_dist_m and turnaround gap_s; everything else deep-equal"
  - "Python closures r/dd become live-variable arrow functions (equivalent, p is constant within an iteration)"
requirements-completed: []
duration: 15min
completed: 2026-10-14
---

# Phase 14 Plan 04: Geofence port to JS Summary

Python geofence (line scoring, forward-only station state machine, boundaries, flags, passages, turnarounds) now runs in pure JS and deep-equals the Python oracle on all 8 fixture routes (terminal turn, reversal, skip, dwell, tunnel, Line 1, noisy, no GPS).

## Accomplishments
- haversineM multiplies by the precomputed `PI/180` like `math.radians`; gpsfilter.js untouched.
- `assign(lat, lon, lines, {radiusM, terminalRadiusM, timestampsUs})` returns the asdict-shaped result.
- 17 tests (score + full assign per case, no-gps); full JS suite 191 pass; test_site_static green.

## Task Commits
1. Tasks 1 and 2 (implemented together as one unit because the port is a single module) - 2164942

## Deviations from Plan
- The no-gps test asserts notes equal the Python expectation instead of containing 'no station hit': Python skips `_initial_direction` when there are no coordinates, so that note is never emitted (the plan behavior text was inaccurate). Port matches Python exactly.
- Tasks committed once rather than per task.

## Issues Encountered
None; every case matched on the first run.

## Self-Check: PASSED
