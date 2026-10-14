---
phase: 15-pdf-report-generation
plan: 01
subsystem: pdf-report
tags: [jspdf, jspdf-autotable, vendor, lazy-load, umd]
requires: []
provides:
  - "Vendored jsPDF 4.2.1 + jspdf-autotable 5.0.8 (byte-identical, sha256 pinned)"
  - "site/js/app/pdflib.js: PDF_SCRIPTS, resolvePdfLib(globals), loadPdfLib()"
affects: [15-04, 15-05, 15-06]
tech-stack:
  added: [jspdf 4.2.1, jspdf-autotable 5.0.8]
  patterns: [lazy script injection, pure resolver tested against real UMD in vm sandbox]
key-files:
  created:
    - site/vendor/jspdf/jspdf.umd.min.js
    - site/vendor/jspdf/LICENSE
    - site/vendor/jspdf-autotable/jspdf.plugin.autotable.min.js
    - site/vendor/jspdf-autotable/LICENSE
    - .gitattributes
    - site/js/app/pdflib.js
    - tests/js/pdflib.test.js
  modified:
    - site/vendor/README.md
    - tests/test_site_static.py
key-decisions:
  - "Autotable UMD loaded as a classic script exposes globals jspdf, autoTable, applyPlugin; resolver hits branch (a) global autoTable"
  - ".gitattributes -text on the two vendor dirs only (no global normalisation)"
requirements-completed: [REPORT-01]
duration: 15min
completed: 2026-10-14
---

# Phase 15 Plan 01: PDF libraries vendored + lazy loader Summary

jsPDF 4.2.1 and jspdf-autotable 5.0.8 vendored byte-identical (sha256 match research values), with a pure `resolvePdfLib` and memoised lazy `loadPdfLib`, verified against the real UMD files in a node vm sandbox.

## Open Question 1 (closed)
Running both real UMD files as classic scripts (no module/exports/define) in a vm context creates the globals `jspdf`, `autoTable` and `applyPlugin`. The resolver therefore takes branch (a): `g.autoTable` is a function. A 1-row table renders and `doc.lastAutoTable.finalY > 0`. The real-browser check is still planned in 15-06. The vm sandbox needed a `navigator` stub (`{ userAgent }`) in addition to the listed host globals; no fallback to a stub jsPDF was needed.

## Tasks
1. Vendor libs, README rows and hashes, `.gitattributes`, static tests (including `test_pdf_libs_lazy`) - 25ae443
2. pdflib.js and pdflib.test.js (6 tests pass) - the files were swept into commit 3828d3d (15-02) by a parallel agent's commit; content is as authored here.

## Deviations from Plan
- [Rule 3 - Blocking] Added `navigator` stub to the vm sandbox because jsPDF touches it at load.
- Task 2 commit hash is shared with plan 15-02 because of the parallel-execution index race.

## Verification
`node --test tests/js/pdflib.test.js` 6/6 pass; `pytest tests/test_site_static.py` pass; `git ls-files --eol` shows vendor files i/lf attr/-text.

## Self-Check: PASSED
