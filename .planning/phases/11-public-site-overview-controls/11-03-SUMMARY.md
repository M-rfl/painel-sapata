---
phase: 11-public-site-overview-controls
plan: 03
subsystem: site-core
tags: [stats, quality, kpi, javascript]
requires: [engine.js analyze, data.js decodeRun]
provides: [stats.js, quality.js, run.channels/quality/flagBits]
affects: [11 overview panels]
tech-stack:
  added: []
  patterns: [pure core modules, LSB integers converted at the end]
key-files:
  created:
    - site/js/core/stats.js
    - site/js/core/quality.js
    - tests/js/stats.test.js
    - tests/js/quality.test.js
  modified:
    - site/js/core/data.js
decisions:
  - "Percentiles use Excel PERCENTILE.INC (rank p*(n-1)); workbook method assumed (MEDIUM confidence)"
  - "Maior = maior valor absoluto, sinal preservado"
  - "Quality summary is full-run, not filter-dependent"
requirements-completed: [KPI-03, KPI-04, KPI-05]
metrics:
  duration: 15min
  tasks: 2
  files: 5
  completed: 2026-10-09
---

# Phase 11 Plan 03: Stats and Data-Quality Modules Summary

Pure `stats.js` (PERCENTILE.INC, means/maxima, per-axis table, medido/dinâmico) and `quality.js` (GPS coverage, turnaround gap, station warnings, channel emptiness), with `decodeRun` now keeping `channels`, `quality` and `flagBits`.

## Results
- Run 1 means/maxima match the workbook goldens (mean AX/AY/AZ, resultante 1.06105, dinâmica 0.27438, maxima 17.7306 / 17.1108).
- Quality summary on run 1: GPS 21363/2020, gap 566,7 s (PXV), no station warnings, no empty channels.
- Full JS suite: 82 tests pass.

## Commits
- e17f05b: stats module
- 0954a59: quality module and decodeRun extension

## Deviations from Plan
None. Tests import `analyze` from `engine.js` directly since `index.js` does not export it. GPS coverage is tested numerically; pt-BR formatting is in `app/format.js`.

## Self-Check: PASSED
