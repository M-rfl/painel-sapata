---
phase: 15-pdf-report-generation
plan: 04
subsystem: ui
tags: [pdf, jspdf, autotable, renderer, node-smoke-test]
requires:
  - phase: 15-01
    provides: vendored jsPDF/autotable UMD, resolvePdfLib
  - phase: 15-02
    provides: buildReport model
provides:
  - "site/js/app/pdf.js: renderReportPdf(model, { jsPDF, autoTable, mapImage, compress }) -> { bytes, pages, links }; toAutoCell; PAGE"
  - "tests/js/pdf_smoke.test.js: node render of run-1 model with the real vendored UMD files"
affects: [15-05, 15-06]
tech-stack:
  added: []
  patterns: ["Dumb mapper over pure model; libs injected; autotable didParseCell/didDrawCell hooks read cell.raw for badge/swatch/link"]
key-files:
  created: [site/js/app/pdf.js, tests/js/pdf_smoke.test.js]
  modified: []
key-decisions:
  - "Link count asserted via '/S /URI' (jsPDF writes /URI twice per annotation)"
  - "Test sandbox passes the host Date into the vm context, else jsPDF.setCreationDate rejects a cross-realm Date"
requirements-completed: [REPORT-01]
duration: 25min
completed: 2026-10-14
---

# Phase 15 Plan 04: PDF Renderer Summary

**A4-landscape renderer that maps the 15-02 report model to jsPDF + autotable (header, KPI cards, map image/placeholder, side-by-side matrices, trecho and pontos tables with badge, swatches and clickable "abrir" links, per-page chrome), proven under node with the real vendored UMD files.**

## Accomplishments
- `renderReportPdf` never reads the clock (creation date from `model.now`), takes jsPDF/autoTable injected, returns `{ bytes, pages, links }`.
- Map section handles image, failed basemap (note) and missing image (placeholder); legend and notes are PDF text/vector.
- Matrices rendered in pairs side by side (single full width, odd tail handled); headers repeat on continuation pages.
- 8 smoke tests: structure/MediaBox, chrome on every page, KPIs, map variants, link annotation count == pontos urls, badge count, section order, header repeat, 1 and 3 matrix tables. No byte, date or /ID assertions.

## Task Commits
Both tasks implemented in one commit (renderer written whole): 73a2716

## Deviations from Plan
- TDD RED commits not separate; both tasks committed together (pdf.js is one cohesive file).
- [Rule 3] Smoke test needed `Date` in the vm sandbox and a WinAnsi/paren-escaping helper for text assertions (em dash is `\x97`, parens are escaped in PDF strings); MediaBox compared numerically since jsPDF prints 841.8899999999999864.

## Issues Encountered
`gsd-tools state advance-plan` fails to parse STATE.md (known); STATE updated by other commands. Visual layout not eyeballed (no PDF viewer in this run); real-browser check is planned in 15-06.

## Self-Check: PASSED
