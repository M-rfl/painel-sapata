---
phase: 14-csv-upload
plan: 02
subsystem: ui
tags: [session, lifecycle, uplot, leaflet, share]
requires: []
provides:
  - "session.js: createSession/createDisposers/isShareable (pure swap controller)"
  - "mountDashboard(run, { uploaded, fresh }) -> { destroy }"
  - "charts.destroy(), map.destroy(), share.setEnabled()"
affects: [14-06]
tech-stack:
  added: []
  patterns: [generation token for stale results, disposer stack with rollback on partial mount]
key-files:
  created: [site/js/app/session.js, tests/js/upload_controller.test.js]
  modified: [site/js/app/main.js, site/js/app/panels/charts.js, site/js/app/panels/map.js, site/js/app/panels/share.js, site/js/app/i18n.js, tests/test_site_static.py]
key-decisions:
  - "Section elements are replaced by cloneNode(false) per mount to drop old listeners/children"
  - "Uploaded or restored-example mounts start from defaultState() and clear the hash once; no hash read/write for uploads"
  - "Share control is created once; setEnabled(isShareable(run)) per mount"
metrics:
  duration: ~20min
  completed: 2026-10-14
---

# Phase 14 Plan 02: Mount/destroy lifecycle and session controller Summary

A DOM-free session controller (generation token, disposer stack) now drives a destroyable `mountDashboard`, so a decoded Run can be swapped in atomically and the example restored. No upload UI yet.

## Tasks

| Task | Commit | Notes |
| --- | --- | --- |
| 1 (RED) | 2bb81c7 | 14 failing tests |
| 1 (GREEN) | b38e134 | session.js, all 14 pass |
| 2 | a2a37aa | main.js lifecycle, charts/map destroy, share enable/disable, static test |

## Verification

- `pytest tests/test_site_static.py`: all pass (incl. new `test_dashboard_lifecycle`).
- `node --test tests/js/*.test.js`: 174 pass, 0 fail.
- Browser smoke not run in this plan (covered by 14-07).

## Deviations from Plan

None. `store.subscribe` already returned an unsubscribe function, so state.js was untouched.

## Self-Check: PASSED
