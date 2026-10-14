---
phase: 12-time-series-map
plan: 05
subsystem: ui
tags: [leaflet, leaflet-heat, openstreetmap, map, link-bus]
requires:
  - phase: 12-03
    provides: core/geo.js map derivations
  - phase: 12-04
    provides: link bus and mounted charts
provides:
  - Mount-once Leaflet map panel (mountMap) wired into main.js
  - Map/heat info texts and Portuguese map strings
affects: [12-06]
tech-stack:
  added: []
  patterns: [mount-once panel with cache keys, fixed-scale heat via maxZoom 0]
key-files:
  created: [site/js/app/panels/map.js]
  modified: [site/js/app/main.js, site/js/app/i18n.js, tests/js/info.test.js, tests/test_site_static.py]
key-decisions:
  - "Map view is fitted once at mount; render never moves it"
  - "Heat layer toggle state is local to the panel, recomputed on toggle-on from last ctx"
requirements-completed: [MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, SYNC-01]
duration: 20min
completed: 2026-10-14
---

# Phase 12 Plan 05: Map Panel Summary

Leaflet map with OSM tiles, sentido-coloured track faded outside the filter, station dots, severity markers with DOM popups and Google Maps links, fixed-scale heat toggle, sem-GPS note, and two-way chart/map linking through the link bus.

## Tasks
1. Map mount, strings, main.js wiring, removal of Phase 11 "sem efeito" notes: 934b80a
2. Info keys and static contract tests: 8df9ec8 (render logic lives in map.js from 934b80a)

## Deviations from Plan
- Empty-fix fallback uses `map.fitWorld()` so `setView(` never appears. Layout CSS from Plan 01 was sufficient, so app.css was unchanged.
- Both tasks' map.js code was written together and committed in the first commit.
- No in-browser smoke test was run. Verification was JS and Python test suites only (117 JS tests, full pytest green).

## Self-Check: PASSED
