---
phase: 10-analysis-engine
plan: 04
subsystem: analysis-engine
tags: [javascript, aggregate, priority, conforme]
requires: [10-02, 10-03]
provides:
  - perTrecho, trechoPriority, regionSplit (site/js/core/aggregate.js)
  - conformeCheck (site/js/core/conforme.js)
  - analyze() returns perTrecho, priority, regionSplit, conforme
affects: [11-dashboard]
tech-stack:
  added: []
  patterns: [full-run-only priority and conforme; Portuguese reason strings with pt-BR number format]
key-files:
  created: [site/js/core/aggregate.js, site/js/core/conforme.js]
  modified: [site/js/core/engine.js, site/js/core/index.js, tests/js/unit.test.js, tests/js/golden.test.js]
key-decisions:
  - "Priority is impact-basis (peak trecho), by class index; intentionally not workbook parity"
  - "conforme takes reference from the JSON, so run 1 ok:true is data-driven, not hard-coded"
requirements-completed: [CORE-04, CORE-05]
duration: 15min
completed: 2026-10-08
---

# Phase 10 Plan 04: Aggregates, priority and conforme Summary

Impact-basis trecho priority (1 Alta to 4 Monitorar) and a "conforme planilha" check driven by `meta.workbook_reference`, both wired into `analyze()`.

## Tasks
1. aggregate.js (perTrecho, trechoPriority, regionSplit): commit 9319817
2. conforme.js and analyze() wiring plus JSDoc of all Result fields: commit 7190644

## Verification
- `node --test "tests/js/*.test.js"`: 31 pass, 0 fail
- Run 1 defaults: conforme `{available:true, ok:true, reasons:[]}`; 15 level-1 trechos, level 2 for idx 7/14/16, level 4 for idx 1/4; region split 10839/12544 records, 1262/1090 eventos
- Thresholds, manual offset, gap and maxJumpMs changes give the expected Portuguese reasons; no reference gives available:false

## Deviations from Plan
None. Tests were added together with the implementation within each task rather than strictly red-first.

## Issues
`gsd-tools state advance-plan` could not parse STATE.md; position was updated manually.

## Self-Check: PASSED
