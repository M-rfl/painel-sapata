---
phase: 13-matrix-ranking-shareable-state
plan: 05
subsystem: ui
tags: [matrix, ranking, csv, panels]
requires: [13-02, 13-03, 13-04]
provides:
  - mountMatrix(el, store) -> { render(ctx) }
  - mountRanking(el, store, { onRowClick }) -> { render(ctx) }
affects: [13-06, 13-07]
tech-stack:
  added: []
  patterns: [mount-once panels, delegated click handler, render cache by identity/key]
key-files:
  created:
    - site/js/app/panels/matrix.js
    - site/js/app/panels/ranking.js
  modified:
    - site/index.html
    - site/js/app/main.js
    - site/js/app/i18n.js
    - site/css/app.css
    - tests/js/info.test.js
    - tests/test_site_static.py
key-decisions:
  - "Matrix tables rebuilt only on run/analysis/basis/{sentidos,eixos,tFrom,tTo} change; trecho/classe clicks only toggle .selected so focus is kept"
  - "CSV button and its info button grouped in a .rank-csv span"
requirements-completed: [MTX-01, MTX-02, RANK-01, RANK-02, RANK-03, KPI-06]
duration: 20min
completed: 2026-10-14
---

# Phase 13 Plan 05: Matrix and Ranking Panels Summary

Two mount-once panels after the charts: trecho x severidade matrices (basis selector, class-shaded clickable cells driving the store) and a ranking section with the trecho priority table plus sortable top-50 pontos table, both with CSV export.

## Tasks

1. Matrix panel and page sections - 5b72178
2. Ranking panel (trecho table, top-50 pontos, CSV) - 46771f2

## Deviations from Plan

None - plan executed as written. The `csv` info key is shown beside each CSV button so the info test's usage check passes.

## Verification

node --test: 160 pass; pytest green (section order test updated).

## Self-Check: PASSED
