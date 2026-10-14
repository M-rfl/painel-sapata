---
phase: 15-pdf-report-generation
plan: 02
subsystem: ui
tags: [pdf, report-model, pure-js, winansi, i18n]
requires:
  - phase: 12-14
    provides: core view/ranking/matrix/geo modules, app format/i18n/state
provides:
  - "site/js/app/report.js: pure buildReport model, pdfText, colour constants, reportFilename, methodNote"
  - "T.report* strings and INFO.report in i18n.js"
affects: [15-03, 15-04, 15-05]
tech-stack:
  added: []
  patterns: ["Pure data model decides all strings/colours; renderer is a dumb mapper", "CSS colour drift guard test parsing app.css"]
key-files:
  created: [site/js/app/report.js, tests/js/report.test.js]
  modified: [site/js/app/i18n.js]
key-decisions:
  - "Glyph mapping: arrow right becomes » (U+00BB) and arrow left becomes «, keeping source spacing; minus/non-breaking hyphen become '-', >= / <= spelled out"
  - "Model lives in app/ (not core/) because it needs app/format.js and i18n; same purity as app/csv.js"
  - "CONTEXT 'full run, no filters' supersedes ROADMAP 'current filters': buildView/trechoRows/buildMatrix always called with {}"
requirements-completed: [REPORT-01]
duration: 20min
completed: 2026-10-14
---

# Phase 15 Plan 02: Report Model Summary

**Pure, node-tested report model (`buildReport`) that always covers the full run with current params, matrix basis and ranking sort, with WinAnsi-safe strings and app.css-drift-guarded colours.**

## Accomplishments
- `report.js`: `pdfText`, `mixWhite`, `hexToRgb`, colour constants, `reportFilename`, `methodNote`, `buildReport` (header, 5 KPIs, map input/legend/notes, both matrices, trecho table, top-50 pontos in current sort).
- i18n: all `T.report*` strings and `INFO.report`.
- 17 tests in `tests/js/report.test.js`: glyph sanitiser (incl. all route/sentido names), colour drift against `site/css/app.css`, filters provably ignored, params/basis/sort honoured, uploaded-run header and filename.

## Task Commits
1. Task 1 (strings, pdfText, colours, filename, method note): 3828d3d
2. Task 2 (buildReport): e997ace

## Deviations from Plan
None in behaviour. Notes:
- The drift test reads the IQ regular colour from `.iq-cell.iq-regular` (app.css has no bare `.iq-regular` rule).
- TDD RED step was not committed separately: tests and implementation were written together and committed per task.

## Issues Encountered
None. Full JS suite (278) and `tests/test_site_static.py` pass; files are LF.

## Next
15-03/15-04 consume the model contract exactly as specified in the plan.

## Self-Check: PASSED
