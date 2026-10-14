---
phase: 12-time-series-map
plan: 01
subsystem: ui
tags: [uplot, leaflet, leaflet-heat, vendor, static-site]
requires: []
provides:
  - "Vendored uPlot 1.6.32, Leaflet 1.9.4, leaflet.heat 0.2.0 under site/vendor"
  - "#map and #charts mount sections between #overview and #classes"
  - "Static pytest guards for vendor presence, load order, section order, no innerHTML"
affects: [12-02, 12-03, 12-04]
tech-stack:
  added: [uPlot 1.6.32, Leaflet 1.9.4, leaflet.heat 0.2.0]
  patterns: ["no CDN, no build step; classic vendor scripts load before the deferred module entry"]
key-files:
  created: [site/vendor/README.md, site/vendor/uplot/, site/vendor/leaflet/, site/vendor/leaflet-heat/]
  modified: [site/index.html, site/css/app.css, tests/test_site_static.py]
key-decisions:
  - "Leaflet images/ not vendored: only circleMarker and custom controls are used"
requirements-completed: [CHART-01, CHART-04, MAP-01]
duration: 8min
completed: 2026-10-13
---

# Phase 12 Plan 01: Vendor libraries and page shell Summary

Vendored uPlot, Leaflet and leaflet.heat (pinned, sha256 in README), added #map/#charts sections and base CSS, and added five static pytest guards.

## Tasks
1. Vendor libraries: commit 53e261d
2. Sections, tags, CSS, tests: commit 40c2ace

## Deviations from Plan
None - plan executed exactly as written. `tests/test_site_static.py` passes (12 tests). The JS test suite and the browser check were not run because no JS changed.

## Self-Check: PASSED
