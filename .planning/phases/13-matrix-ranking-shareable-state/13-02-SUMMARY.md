---
phase: 13-matrix-ranking-shareable-state
plan: 02
subsystem: core
tags: [gps-filter, matrix, js-core]
requires: []
provides:
  - core/gpsfilter.js (haversineM, gpsKey, rejectedFixes, applyGpsFilter)
  - core/matrix.js (matrixMask, buildMatrix, cellClick, isCellSelected)
affects: [13 UI plans]
tech-stack:
  added: []
  patterns: [derived run for GPS filter, matrix ignores trecho/classe filters]
key-files:
  created:
    - site/js/core/gpsfilter.js
    - site/js/core/matrix.js
    - tests/js/gpsfilter.test.js
    - tests/js/matrix.test.js
  modified: []
key-decisions:
  - "GPS jump filter runs outside analyze() as a derived run; run 1 at defaults rejects fix 31 (pontos 98 derived, 99 raw). Flag to user at 13-07 checkpoint."
metrics:
  duration: 10min
  completed: 2026-10-14
---

# Phase 13 Plan 02: GPS filter and matrix Summary

Pure core modules: a GPS jump filter producing a derived run (rejected fixes become sem GPS, raw run untouched) and a trecho x severidade matrix with per-basis counts and a click reducer.

## Results
- Run 1 at 50 km/h / 120 s: fix 31 rejected (185 rows); class counts, eventos, impactos unchanged; pontos 98 derived, 99 raw.
- Matrix sums tie to analyze() totals for medicoes, impactos, pontos; cell click consistent with buildView.
- Tests: gpsfilter 5 + matrix 7 pass, golden green, test_site_static green.

## Commits
- fa6e506: GPS jump filter
- f4cb605: matrix and reducer

## Deviations from Plan
None - plan executed exactly as written.

## Self-Check: PASSED
