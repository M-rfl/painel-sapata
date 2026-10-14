---
phase: 13-matrix-ranking-shareable-state
plan: 06
subsystem: ui
tags: [gps-filter, url-state, leaflet, share]
requires: [13-01, 13-02, 13-05]
provides:
  - derived GPS run feeding all panels
  - state-driven heat toggle and map focus(row)
  - live shareable URL hash with Copiar link
affects: [14]
tech-stack:
  added: []
  patterns: [memoized derived run, debounced replaceState writer]
key-files:
  created: [site/js/app/panels/share.js]
  modified: [site/js/app/main.js, site/js/app/panels/map.js, site/js/app/i18n.js, site/index.html, site/css/app.css, tests/js/info.test.js, tests/test_site_static.py]
key-decisions:
  - "Charts keep the mount-time run; only map/analysis/stats use the GPS-derived run"
  - "Hash is read before createStore; canonical form written once on load"
requirements-completed: [PARAM-04, SHARE-01, RANK-01]
duration: 20min
completed: 2026-10-14
---

# Phase 13 Plan 06: GPS wiring, ranking jump and shareable URL Summary

GPS jump-filter limits now drive pontos, map, ranking and matrix through a memoized derived run, ranking rows focus the map, and the whole view round-trips through a live URL hash with a Copiar link button.

## Tasks
1. Derived GPS run, map refactor, ranking to map focus: aac8545
2. Live URL hash, Copiar link, ignored-params notice: 0faf2b0

## Deviations from Plan
None. The browser smoke test (serve_site with hash URLs) was not run; verification was the automated suites (full pytest and 160 JS tests green).

## Self-Check: PASSED
