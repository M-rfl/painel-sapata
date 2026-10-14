---
phase: 16-axis-orientation-popup
plan: 02
subsystem: site
tags: [dialog, a11y, i18n, header]
requires: ["16-01"]
provides:
  - "mountAxes(el): header icon button + lazily built native <dialog>"
  - "T.axes, T.axesClose, T.axesAlt, T.axesLegend (pt-BR)"
affects: [16-03]
tech-stack:
  added: []
  patterns: [native showModal dialog, backdrop click via ev.target === dlg, no innerHTML]
key-files:
  created: [site/js/app/panels/axes.js, tests/js/axes_strings.test.js]
  modified: [site/js/app/i18n.js, site/js/app/main.js, site/index.html, site/css/app.css, tests/test_site_static.py]
key-decisions:
  - "Esc handled by native dialog cancel; no keydown handler; focus returned to the icon on close"
  - "mountAxes is the first statement of start() so help works even if data fails to load"
requirements-completed: [HELP-01]
duration: 10min
completed: 2026-10-14
---

# Phase 16 Plan 02: Axis popup UI Summary

Header axis icon (after "Gerar PDF") opens a native modal `<dialog>` "Orientação dos eixos" with the embedded WebP and a pt-BR legend; closes by Fechar, Esc or backdrop click.

- Tests: `tests/test_site_static.py` 25 passed (includes new `test_axes_wiring`); `node --test tests/js/*.test.js` 296 pass, 0 fail. Files are LF.
- Real-browser behaviour is verified in 16-03.

Commits: 911c865 (strings + test), 8fafa81 (panel, slot, mount, CSS, guard).

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
