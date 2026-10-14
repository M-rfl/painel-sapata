---
phase: 13-matrix-ranking-shareable-state
plan: 01
subsystem: ui
tags: [state, url-hash, validation, pt-BR]
requires:
  - phase: 11-dashboard
    provides: state.js store, threshold validation pattern
provides:
  - state.params analysis fields (manual offset, gap, time jump, GPS limits) with Portuguese validators
  - state.ui slice (heat, matrixBasis, rankSort)
  - pure urlstate serialize/parseHash/hashContext
affects: [13-02, 13-03, 13-04, 13-05, 13-06]
tech-stack:
  added: []
  patterns: [typed text kept per field, last valid value kept in params, hash applied through same validators as the controls]
key-files:
  created: [site/js/app/urlstate.js, tests/js/urlstate.test.js]
  modified: [site/js/core/defaults.js, site/js/app/format.js, site/js/app/state.js, tests/js/state.test.js, tests/js/format.test.js]
key-decisions:
  - "GPS limits live in params.gps and paramsKey, but DEFAULT_PARAMS and analyze are untouched"
  - "parseHash decodes each key/value after splitting on & (not the whole hash) and avoids URLSearchParams"
  - "Duplicate keys: last wins"
requirements-completed: [PARAM-04, SHARE-01]
duration: 20min
completed: 2026-10-14
---

# Phase 13 Plan 01: State model and shareable hash Summary

Extended the single state store with manual offset, gap, time-jump and GPS limit parameters (validated, Portuguese errors), a `ui` slice, and a pure tolerant URL-hash serializer/parser whose default view is the empty string.

## Tasks
1. State model: commit 3ef6ad5 (defaults, format, state, tests)
2. URL hash: commit 3a542a4 (urlstate.js, urlstate tests)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] setThresholdText dropped new inputs fields**
- **Issue:** It rebuilt `inputs` from scratch, which would erase offset/analysis fields.
- **Fix:** Spread `...state.inputs` first.
- **Files modified:** site/js/app/state.js
- **Commit:** 3ef6ad5

Otherwise the plan was executed as written.

## Verification
`node --test "tests/js/*.test.js"`: 160 pass. `pytest tests/test_site_static.py`: pass. Manual offset equal to run-1 medians reproduces default classCounts, eventos and impactos.

## Self-Check: PASSED
