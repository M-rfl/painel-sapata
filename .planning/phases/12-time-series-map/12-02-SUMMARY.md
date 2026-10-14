---
phase: 12-time-series-map
plan: 02
subsystem: ui
tags: [uplot, chart-data, pure-core, gps]
requires: []
provides:
  - decodeRun t0Ms, fixLat, fixLon, fixRow, priorFix
  - stats axisConverters, resultant, LSB_PER_G exports
  - core/series.js pure chart derivation
affects: [12-03, 12-04, 12-05, 12-06]
tech-stack:
  added: []
  patterns: [null-break gap rows, no decimation]
key-files:
  created: [site/js/core/series.js, tests/js/series.test.js, tests/js/decode.test.js]
  modified: [site/js/core/data.js, site/js/core/stats.js]
key-decisions:
  - "Thresholds use analysis.th2/off2 so lines sit on exact classification boundaries; medido lines offset by off2"
  - "Synthetic null entries only for time gaps > maxJumpMs; invalid samples are per-axis nulls"
requirements-completed: [CHART-01, CHART-02, CHART-03, CHART-04, CHART-05]
duration: 15min
completed: 2026-10-13
---

# Phase 12 Plan 02: Chart data derivation Summary

Pure, node-tested chart data layer: decodeRun fix tables plus `core/series.js` (gap-aware x frame, medido/dinâmico axis series, filter split, threshold lines, secondary channels) with no decimation.

## Tasks
1. decodeRun fix tables + exported converters - 6681fb8
2. series.js + tests - f3392d3

## Deviations from Plan
None - plan executed exactly as written.

## Verification
JS suite 104 pass; test_site_static and test_parity_fixture pass.

## Self-Check: PASSED
