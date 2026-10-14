---
phase: 12-time-series-map
plan: 04
subsystem: ui
tags: [uplot, charts, pub-sub, javascript]
requires:
  - phase: 12-01
    provides: vendored uPlot, page shell, chart CSS
  - phase: 12-02
    provides: core/series.js chart data derivation
provides:
  - link.js hover/select bus for chart-map linking
  - panels/charts.js mount-once uPlot panel (3 axis charts + lazy 4 channel charts)
  - Portuguese chart strings and info texts
affects: [12-05 map panel, 12-06]
tech-stack:
  added: []
  patterns: [mount-once chart panel outside PANELS loop, setData(data,false) to keep zoom, deduped hover bus]
key-files:
  created: [site/js/app/link.js, site/js/app/panels/charts.js, tests/js/link.test.js]
  modified: [site/js/app/main.js, site/js/app/i18n.js, tests/js/info.test.js, tests/test_site_static.py]
key-decisions:
  - "Axis charts are created on first render() (container visible, data ready); channel charts on first details toggle"
  - "Threshold lines drawn in a draw hook with class colours resolved from CSS variables at mount"
requirements-completed: [CHART-01, CHART-02, CHART-03, CHART-04, CHART-05, SYNC-01]
duration: 20min
completed: 2026-10-13
---

# Phase 12 Plan 04: Time-series charts and link bus Summary

uPlot panel with three synced AX/AY/AZ charts (threshold lines, grey filter context, gap breaks, zoom kept across state changes), a lazy "Mais canais" group of four, and a deduped hover/select link bus.

## Tasks

1. Link bus + strings/info texts - c57a7ce
2. Charts panel + main.js wiring + static contract test - 55a821a

## Verification

- `node --test tests/js/*.test.js`: 117 pass; `pytest tests/test_site_static.py`: pass.
- Headless Edge smoke against `tools.serve_site`: 3 canvases rendered, no console errors, chart titles present.
- Not verified interactively (no real browser session): drag-zoom, `__painel.link.select(row)` cursor placement after setScale (rAF used), per-chart y autoscale after `setData(..., false)`, and the opened "Mais canais" group. These need a quick manual check.

## Deviations from Plan

None - plan executed as written. CSS already contained the chart styles from 12-01, so app.css was not modified.

## Self-Check: PASSED
