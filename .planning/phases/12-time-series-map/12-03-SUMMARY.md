---
phase: 12-time-series-map
plan: 03
subsystem: ui
tags: [geo, leaflet-data, pure-js, node-test]
requires:
  - phase: 12-02
    provides: run fix fields, axisConverters, epochMs
provides:
  - Pure map derivations in site/js/core/geo.js
affects: [12-05 map panel]
tech-stack:
  added: []
  patterns: [pure derivation from (run, analysis, view)]
key-files:
  created: [site/js/core/geo.js, tests/js/geo.test.js]
  modified: []
key-decisions:
  - "Track breaks at sentido change or fix gap > max_fix_gap_s; short tunnels stay joined by a straight line"
  - "unplacedCounts returns both pontos and eventos"
  - "Heat weight = min(1, metricG / (Critico threshold) * intensity), filter-independent scale"
requirements-completed: [MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, SYNC-01]
duration: 10min
completed: 2026-10-13
---

# Phase 12 Plan 03: Map Data Derivation Summary

Pure, node-tested geo.js: track segments, impact markers with popup fields, fixed-scale heat points, sem-GPS counts and row/fix lookups.

## Accomplishments
- fixMatched, trackSegments, hoverPosition, nearestFix, googleMapsUrl (run 1 yields 4 segments).
- pontoMarkers, unplacedCounts, heatPoints following the same view/mask as the KPI panels.
- Full JS suite 117 passing; test_site_static.py green (geo.js pure).

## Task Commits
1. Task 1 - f51271a
2. Task 2 - 1de5a28

## Deviations from Plan
None. Test for intensity compares weights by index (coordinate keys collide for duplicate fixes).

Requirements are delivered at the data layer here; the UI panel (Plan 05) completes their visible behaviour.

## Self-Check: PASSED
