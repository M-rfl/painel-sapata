---
phase: 11-public-site-overview-controls
plan: 05
subsystem: site-ui
tags: [javascript, dom, pt-BR, static-site, kpi]
requires:
  - phase: 11-01
    provides: formatters, T strings, state store
  - phase: 11-02
    provides: buildView
  - phase: 11-03
    provides: stats, quality modules
provides:
  - site/index.html shell (pt-BR, relative paths)
  - main.js pipeline with memoized analyze
  - overview, classes, stats, quality panels
  - tests/test_site_static.py
affects: [11-06, 11-07]
tech-stack:
  added: []
  patterns: ["panel contract render(el, ctx)", "h() DOM helper using text nodes only"]
key-files:
  created:
    - site/index.html
    - site/css/app.css
    - site/js/app/dom.js
    - site/js/app/main.js
    - site/js/app/panels/overview.js
    - site/js/app/panels/classes.js
    - site/js/app/panels/stats.js
    - site/js/app/panels/quality.js
    - tests/test_site_static.py
  modified: []
key-decisions:
  - "analyze memoized on paramsKey; buildView/stats recomputed per state change; quality computed once"
  - "Badge rendered by overview panel into #badge"
  - "Controls mount hook left as a comment in main.js for 11-06"
requirements-completed: [PUB-01, PUB-03, KPI-01, KPI-02, KPI-03, KPI-04, KPI-05]
duration: 25min
completed: 2026-10-09
---

# Phase 11 Plan 05: Page Shell and Overview Panels Summary

**Static pt-BR dashboard shell with four DOM-safe panels (KPI cards plus conforme badge, class bars with axis breakdown, means/maxima and per-axis stats, data quality) driven by the pure engine, using only relative URLs.**

## Tasks
1. Page shell, DOM helper, main wiring, static test - ccb7608
2. Overview, classes, stats, quality panels - 955561b

## Verification
- `tests/test_site_static.py`: 6 pass; `node --test tests/js/*.test.js`: 88 pass.
- Local http.server returned 200 for `/`, `js/app/main.js` and the data JSON.
- Node smoke with a fake DOM rendered all panels from run 1: 23.383 / 2.352 / 1.749 / 99, top trecho Pereira Reis – Vila Olímpica 427, GPS 91,4%, turnaround 9 min 26,7 s at PXV, badge "Conforme planilha". Real-browser visual check is batched into the 11-06 checkpoint.

## Deviations from Plan
None. Task 1 main.js initially had no panel imports (wired in Task 2 as the plan specifies). The pontos note is only shown when `run.reference.pontos` exists and no filters are active; run 1 shows it only if the reference carries pontos.

## Self-Check: PASSED
