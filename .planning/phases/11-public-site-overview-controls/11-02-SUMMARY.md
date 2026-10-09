---
phase: 11-public-site-overview-controls
plan: 02
subsystem: ui-core
tags: [javascript, filters, kpi, node-test]
requires:
  - phase: 10-analysis-engine
    provides: analyze() result, pointsByLocation
provides:
  - "site/js/core/view.js: normalizeFilters, rowMask, buildView"
affects: [11-03, 11-04]
tech-stack:
  added: []
  patterns: ["filters applied on top of analyze(); never feed it"]
key-files:
  created: [site/js/core/view.js, tests/js/view.test.js]
  modified: []
key-decisions:
  - "classPct denominator = classified masked rows; nao classificadas reported separately"
  - "Runs without sentido field treat every row as sentido 0"
  - "Unclassified rows excluded once an eixo or classe filter is set"
  - "view.js not re-exported from index.js (consumers import ./view.js directly)"
requirements-completed: [KPI-01, KPI-02, PARAM-02]
duration: 15min
completed: 2026-10-09
---

# Phase 11 Plan 02: Filter mask and KPI view Summary

Pure `view.js` layer: row mask from sentido/trecho/eixo/classe/time filters plus filtered KPIs (registros, eventos, impactos by peak row, pontos, class counts/%, class x axis breakdown, top trecho), verified on synthetic data and run-1 golden.

## Tasks
1. rowMask + buildView with synthetic tests - 3e3b215
2. Run-1 golden and invariance tests - see git log (`test(11-02)`)

## Verification
`node --test "tests/js/*.test.js"`: 88 pass. Unfiltered view gives 23.383 / 2.352 / 1.749, golden class counts, pontos 99; top trecho 'Pereira Reis – Vila Olímpica' 427 (workbook 'Vila Olímpica – Central' 304 is the known Phase 9 deviation, recorded as a diagnostic, not asserted). Sentido split 11.835 + rest = 23.383; analysis.conforme and priority unchanged by filtered views.

## Deviations from Plan
None - plan executed as written. (Git Bash lacked PATH tools; commands run through Windows PowerShell.)

## Self-Check: PASSED
