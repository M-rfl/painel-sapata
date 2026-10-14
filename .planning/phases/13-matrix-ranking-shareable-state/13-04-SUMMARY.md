---
phase: 13-matrix-ranking-shareable-state
plan: 04
subsystem: ui
tags: [quality-index, controls, analysis-params, i18n]
requires:
  - phase: 13-01
    provides: state setters (setOffsetMode, setOffsetText, setAnalysisText, offsetPrefill)
  - phase: 13-03
    provides: qualityIndex
provides:
  - IQ card as first KPI card with Bom/Regular/Ruim band colours
  - Collapsible "Parâmetros de análise" control group
affects: [13-06]
tech-stack:
  added: []
  patterns: [details group mounted once and synced without rewriting matching fields]
key-files:
  created: []
  modified:
    - site/js/app/panels/overview.js
    - site/js/app/panels/controls.js
    - site/js/app/i18n.js
    - site/css/app.css
    - tests/js/info.test.js
key-decisions:
  - "Band label stored as flat T.iqBom/iqRegular/iqRuim because the i18n test requires every T value to be a string"
requirements-completed: [KPI-06, PARAM-04]
duration: 15min
completed: 2026-10-14
---

# Phase 13 Plan 04: IQ card and analysis parameters Summary

IQ card (pt-BR %, band-coloured, "—" when empty) is now first in the KPI row, and a closed-by-default "Parâmetros de análise" group edits offset (Mediana/Manual with prefilled medians), agrupamento, separação de impactos and the two GPS limits, each with an (i) button.

## Tasks
1. IQ card first in KPI row - c14fd98 (also holds all i18n strings and INFO texts for both tasks)
2. Parâmetros de análise control group - 2b02513

## Deviations from Plan
**[Rule 1 - Bug]** `T.iqBands` nested object failed the i18n "all strings" test; replaced with flat `iqBom/iqRegular/iqRuim`.

## Notes
GPS limit changes alter state only; they take effect once 13-06 wires the derived run.

Verification: 160 JS tests pass, test_site_static passes, no innerHTML in controls.js.

## Self-Check: PASSED
