---
phase: 15-pdf-report-generation
plan: 03
subsystem: ui
tags: [canvas, web-mercator, osm-tiles, leaflet-heat, pdf]
requires:
  - phase: 12-map
    provides: live map panel and heat conventions
provides:
  - mapshot.js data-only 2x map raster compositor (renderMapImage)
  - getRouteFeatures() on the live map handle
affects: [15-04, 15-05, 15-06]
tech-stack:
  added: []
  patterns: [injected browser dependencies, recording fake canvas tests]
key-files:
  created: [site/js/app/mapshot.js, tests/js/mapshot.test.js]
  modified: [site/js/app/panels/map.js]
key-decisions:
  - "Attribution box width estimated from text length (no measureText) so the compositor is testable with a fake context"
requirements-completed: [REPORT-01]
duration: 25min
completed: 2026-10-14
---

# Phase 15 Plan 03: Map raster compositor Summary

**Data-only 2x map raster (OSM tiles capped at 64, leaflet.heat grid merge, JPEG) with CORS/taint fallback, plus getRouteFeatures() on the live map handle.**

## Accomplishments
- Pure helpers: project, fitView, toCanvas, tilePlan (step-down cap), mergeHeat (leaflet.heat merge port).
- renderMapImage composes tiles, routes, stations, markers, heat, attribution in live-map z-order; pool of 6, 8 s timeout, no retries; basemapFailed on more than half tile failures or tainted canvas; heatMissing when simpleheat absent.
- Map handle returns a copy of loaded route features; still one fitBounds and one setView.
- 14 node tests green; tests/test_site_static.py green.

## Run-1 tile plan (for the browser checkpoint)
At 2000x840, ratio 2: z = 16, 36 tiles (cap 64).

## Task Commits
1. Task 1 (pure maths, plus the compositor in the same module): 335a73f
2. Task 2 (compositor tests, getRouteFeatures): 542277d

## Deviations from Plan
- The compositor was written together with the pure helpers, so commit 335a73f contains all of mapshot.js; compositor tests landed in the second commit.
- map.js was briefly CRLF after an edit; normalised back to LF before commit.

## Self-Check: PASSED
