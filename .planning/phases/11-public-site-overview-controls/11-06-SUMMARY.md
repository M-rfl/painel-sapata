---
phase: 11-public-site-overview-controls
plan: 06
subsystem: ui
tags: [controls, thresholds, filters, state-store, info-buttons, readme, preview-server]

requires:
  - phase: 11-01
    provides: state store (setThresholdText, setFilter, setDisplay, resetState)
  - phase: 11-05
    provides: page shell, overview panels, main.js update() pipeline
provides:
  - Control column (thresholds, filters, display options, reset) bound to the store
  - Info (i) buttons explaining every card and control (34 buttons, text in INFO in i18n.js)
  - README dashboard section with local preview, tests and deploy notes
  - No-cache local preview server (python -m tools.serve_site)
affects: [11-07, 12-map, 14-csv-upload]

tech-stack:
  added: []
  patterns:
    - "Controls mounted once, updated via renderControls (no rebuild, focused input never overwritten)"
    - "Local preview via tools/serve_site.py sending no-cache headers (stale ES modules otherwise)"

key-files:
  created:
    - site/js/app/panels/controls.js
    - tools/serve_site.py
  modified:
    - site/js/app/main.js
    - site/js/app/i18n.js
    - site/css/app.css
    - README.md

key-decisions:
  - "Local preview command is python -m tools.serve_site (no-cache) instead of python -m http.server"
  - "Map, filter-driven map and CSV upload deferred: map to Phase 12 (MAP-06), CSV upload to new Phase 14 (UPLOAD-01)"

patterns-established:
  - "Info text for every card/control lives in INFO in i18n.js"

requirements-completed: [PARAM-01, PARAM-02, PARAM-03, PARAM-05, KPI-01]

duration: checkpoint-driven (2026-10-09 to 2026-10-13)
completed: 2026-10-13
---

# Phase 11 Plan 06: Controls Panel Summary

**Store-bound control column (4 comma/dot-tolerant thresholds, sentido/trecho/eixo/classe/time filters, display options, reset) plus info buttons on every card and a no-cache local preview server; user approved the local site.**

## Performance

- **Tasks:** 3 of 3 (plus 2 checkpoint-driven fixes)
- **Completed:** 2026-10-13

## Accomplishments
- Controls panel bound to the state store and wired into main.js (b280e08)
- README "Painel da corrida (site/)" section (93ee3da)
- Info (i) buttons on every card and control, 34 buttons (0a2fee8)
- No-cache preview server tools/serve_site.py (aba6cab)
- Human verification approved by user

## Task Commits

1. Task 1: Controls panel bound to store, wired into main.js - b280e08
2. Task 2: README dashboard section - 93ee3da
3. Task 3: Human verification - approved (no commit)
4. Fix (user request at checkpoint): info buttons - 0a2fee8
5. Fix: no-cache preview server - aba6cab

## Deviations from Plan

### Auto-fixed / user-requested

**1. [Checkpoint request] Info (i) buttons on every card and control**
- **Found during:** Task 3 checkpoint
- **Fix:** 34 buttons, explanation text in INFO in i18n.js
- **Commit:** 0a2fee8

**2. [Rule 3 - Blocking] Info buttons not displayed in browser**
- **Issue:** Root cause was the browser caching stale ES modules under `python -m http.server`
- **Fix:** tools/serve_site.py with no-cache headers; README preview command is now `python -m tools.serve_site`
- **Commit:** aba6cab

### Scope routing (not implemented in this plan)
At checkpoint round 1 the user asked for a real map, filters driving the map, and CSV upload. The orchestrator routed them: map and filter-to-map to Phase 12 (new requirement MAP-06), CSV upload to new Phase 14 (UPLOAD-01). Commit fbc2f5e.

## Deferred Issues
- Known polish, not yet requested by user: CSS capitalises every word of card labels ("Pontos De Impacto"); the trecho card's (i) wraps onto its own line.

## Issues Encountered
Stale browser cache of ES modules (see deviation 2).

## Next Phase Readiness
Ready for 11-07 (publish). The plan's README mentions the http.server preview; the current command is tools.serve_site.

## Self-Check: PASSED
