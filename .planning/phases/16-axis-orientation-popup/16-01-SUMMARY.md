---
phase: 16-axis-orientation-popup
plan: 01
subsystem: site
tags: [webp, base64, pillow, help]
requires: []
provides:
  - "site/js/app/axisimage.js exporting AXIS_IMAGE (WebP data URI)"
  - "tools/gen_axis_image.py reproducible generator"
affects: [16-02]
tech-stack:
  added: [Pillow==12.2.0 (dev-only)]
  patterns: [generated ES module with write_bytes for LF]
key-files:
  created: [tools/gen_axis_image.py, site/js/app/axisimage.js, tests/test_gen_axis_image.py]
  modified: [tests/test_site_static.py, requirements-dashboard.txt, .gitattributes, .planning/REQUIREMENTS.md]
key-decisions:
  - "WebP quality 78, width 1024 (1024x683)"
requirements-completed: []
duration: 10min
completed: 2026-10-14
---

# Phase 16 Plan 01: Embedded axis image Summary

Reproducible generator shrinks the 2.6 MB axis PNG to a 1024x683 WebP (quality 78) embedded as a base64 data URI in `site/js/app/axisimage.js`.

- Decoded WebP: 108,042 bytes; module file: 144,189 bytes; LF only.
- Tests: generator test (skips without Pillow) and `test_axis_image_embedded` static guard; full pytest suite passes.
- HELP-01 registered in REQUIREMENTS.md (coverage 50), left Pending until the popup UI (16-02) ships.

Commits: e48298a (generator, module, pin), 044ad43 (static guard, HELP-01).

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
