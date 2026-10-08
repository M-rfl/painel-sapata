---
phase: 10-analysis-engine
plan: 03
subsystem: analysis-engine
tags: [javascript, esm, node-test, doubled-lsb, golden-test]
requires:
  - phase: 09
    provides: schema-v1 run JSON and golden_run1.json fixture
provides:
  - Pure-JS core under site/js/core (data, dynamics, classify, events, engine)
  - analyze(run, params) reproducing workbook exact values on run 1
  - node --test suite (unit + golden) with no package.json
affects: [10-04, 10-05, 11, 12, 13]
tech-stack:
  added: []
  patterns: [doubled-LSB integer arithmetic, typed arrays, ESM without package.json]
key-files:
  created:
    - site/js/core/defaults.js
    - site/js/core/data.js
    - site/js/core/dynamics.js
    - site/js/core/classify.js
    - site/js/core/events.js
    - site/js/core/engine.js
    - site/js/core/index.js
    - tests/js/helpers.js
    - tests/js/unit.test.js
    - tests/js/golden.test.js
  modified: []
key-decisions:
  - "Location identity is the toFixed(6) coordinate key mapped to dense ids; pontos = 99 on run 1 (workbook 101 is side by side only)"
  - "Mirrored the plan's rules block; analysis_ref.py extensions from 10-01 were still uncommitted while executing, so no oracle cross-check beyond the golden fixture"
requirements-completed: [CORE-01, CORE-02, CORE-03, CORE-06]
duration: ~15min
completed: 2026-10-08
---

# Phase 10 Plan 03: JS Analysis Core Summary

Pure ES-module engine in doubled-LSB integers that reproduces the workbook numbers exactly on run 1 (medians 94/-38/-2018, classes 21031/1611/512/173/56, eventos 2352, impactos 1749, by class 0/1112/423/159/55, pontos 99).

## Accomplishments
- Decoding (`expandRuns`, `fromArrays`, `decodeRun`) with explicit null mask, dense location ids, optional region/reference.
- `restOffset2`, `dominant`, `thresholds2`, `classify`, `groupImpacts`, `pointsByLocation`, `analyze` per the API contract, with a marked `// 10-04` extension spot.
- 23 tests green via `node --test` from the repo root (~9 s wall, mostly Node startup and loading run 1). No package.json.

## Task Commits
1. Task 1 defaults + data + helpers: 90ba145
2. Task 2 dynamics + classify: bba87dc
3. Task 3 events + engine + index + tests: 99ec6b6

## Deviations from Plan
- Tests were written together with the modules and committed with the final task rather than as separate RED commits (unit.test.js spans all three tasks).
- The `grep window|document|Math.round` check matches only the mandated "no DOM/window" header comment, no code.

## Issues Encountered
None. Parallel plans 10-01/10-02 had uncommitted edits in analysis_ref.py; I did not touch them.

## Self-Check: PASSED
