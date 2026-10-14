---
phase: 13-matrix-ranking-shareable-state
plan: 03
subsystem: dashboard-core
tags: [quality-index, ranking, csv, pt-BR]
requires: [core/view.js, core/events.js, core/geo.js, core/stats.js]
provides: [qualityIndex, trechoRows, pontoRows, topPontos, sortPontos, AXIS_NAMES, toCsv, pontosCsv, trechosCsv, csvFilename, downloadCsv]
affects: [13-04, 13-05]
tech-stack:
  added: []
  patterns: [pure core modules tested with node --test]
key-files:
  created:
    - site/js/core/quality_index.js
    - site/js/core/ranking.js
    - site/js/app/csv.js
    - tests/js/quality_index.test.js
    - tests/js/ranking.test.js
    - tests/js/csv.test.js
  modified: []
key-decisions:
  - "Classe filter applies to trecho-table counts and IQ; only the trecho filter is ignored (marks rows as selected)"
  - "sem Critico computed from full-run top-class medicoes, not perTrecho.topCount"
duration: 15min
completed: 2026-10-14
---

# Phase 13 Plan 03: Quality Index, Ranking and CSV Summary

Pure modules for the integer-exact quality index (96,4 % Bom on run 1), trecho/ponto ranking rows with stable top-50 sorting, and an Excel pt-BR CSV export (BOM, ';', ',' decimal, CRLF).

## Tasks

| Task | Commit |
| ---- | ------ |
| 1 and 2: qualityIndex, trechoRows, pontoRows, topPontos, sortPontos (same files, one commit) | 7de5acd |
| 3: csv.js | 7a7820a |

## Deviations from Plan

Tasks 1 and 2 share ranking.js and its test file, so they were committed together in a single commit. Otherwise none.

## Verification

`node --test "tests/js/*.test.js"`: 151 pass, 0 fail. `pytest tests/test_site_static.py`: green.

## Self-Check: PASSED
