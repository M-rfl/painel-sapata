---
phase: 15
slug: pdf-report-generation
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-14
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node --test` (Node 24) for `tests/js/*.test.js`; pytest for static checks |
| **Config file** | none (CI runs `node --test "tests/js/*.test.js"` and `python -m pytest`) |
| **Quick run command** | `node --test tests/js/pdflib.test.js tests/js/report.test.js tests/js/mapshot.test.js tests/js/pdf_smoke.test.js tests/js/report_action.test.js` |
| **Full suite command** | `node --test "tests/js/*.test.js"` then `python -m pytest` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run `node --test "tests/js/*.test.js"` + `python -m pytest tests/test_site_static.py`
- **Before `/gsd:verify-work`:** Full suite must be green, plus the manual browser checkpoint
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Per-task map (planner, 2026-10-14). Executors update Status.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-T1 | 01 | 1 | REPORT-01 | static | `sha256sum site/vendor/jspdf/jspdf.umd.min.js site/vendor/jspdf-autotable/jspdf.plugin.autotable.min.js && python -m pytest tests/test_site_static.py -q` | extend | ✅ green |
| 15-01-T2 | 01 | 1 | REPORT-01 | unit (real UMD in vm) | `node --test tests/js/pdflib.test.js` | ✅ | ✅ green |
| 15-02-T1 | 02 | 1 | REPORT-01 | unit | `node --test tests/js/report.test.js tests/js/info.test.js` | ✅ | ✅ green |
| 15-02-T2 | 02 | 1 | REPORT-01 | unit | `node --test tests/js/report.test.js && node --test "tests/js/*.test.js"` | ✅ after T1 | ✅ green |
| 15-03-T1 | 03 | 1 | REPORT-01 | unit | `node --test tests/js/mapshot.test.js` | ✅ | ✅ green |
| 15-03-T2 | 03 | 1 | REPORT-01 | unit (fake canvas) + static | `node --test tests/js/mapshot.test.js && python -m pytest tests/test_site_static.py -q` | ✅ after T1 | ✅ green |
| 15-04-T1 | 04 | 2 | REPORT-01 | integration (vendored UMD) | `node --test tests/js/pdf_smoke.test.js` | ✅ | ✅ green |
| 15-04-T2 | 04 | 2 | REPORT-01 | integration | `node --test tests/js/pdf_smoke.test.js && node --test "tests/js/*.test.js"` | ✅ after T1 | ✅ green |
| 15-05-T1 | 05 | 3 | REPORT-01 | unit (fakes) | `node --test tests/js/report_action.test.js` | ✅ | ✅ green |
| 15-05-T2 | 05 | 3 | REPORT-01 | static | `python -m pytest tests/test_site_static.py -q && node --test "tests/js/*.test.js"` | extend | ✅ green |
| 15-06-T1 | 06 | 4 | REPORT-01 | full gates | `python -m pytest -q && node --test "tests/js/*.test.js"` | ✅ | ✅ green |
| 15-06-T2 | 06 | 4 | REPORT-01 | manual checkpoint | n/a (browser) | n/a | ✅ green (approved 2026-10-14) |

Determinism rules (Phase 14 CI lessons): tests inject the clock (`now`), never assert on whole PDF bytes, `/CreationDate` (local TZ offset) or `/ID` (random); Mercator results compared with tolerances, tile-plan assertions as ranges; no dependence on platform libm or the Python patch version. New files are LF; vendored jsPDF files are byte-guarded by `.gitattributes` (`-text`).

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/js/report.test.js` — report model, formatting, colours, filename, method note, pdfText
- [x] `tests/js/mapshot.test.js` — pure map maths and heat grid
- [x] `tests/js/pdf_smoke.test.js` — PDF rendering under node with the vendored UMD
- [x] `tests/js/pdflib.test.js` — lazy loader resolver + autotable browser global (real UMD in a vm sandbox)
- [x] `tests/js/report_action.test.js` — click controller (ok / warning / error / skipped)
- [x] Extend `tests/test_site_static.py` — report wiring, vendor pinning, no-network, purity

*Framework install: none (node built-ins; vendored jsPDF 4.2.1 + jspdf-autotable 5.0.8 are the only new inputs).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Button busy state, download name, map raster with tiles and with network blocked, live map unchanged, uploaded-run report, selectable text, working links, pt-BR | REPORT-01 | Needs canvas, DOM, OSM network and visual comparison | Serve `site/`, generate the PDF for the bundled run and an uploaded run, block tiles and regenerate, compare with the page | **Approved 2026-10-14**: all 13 browser checks passed (lazy-load, busy state, live map untouched, page 1 header/KPIs, map raster, matrices, tables, links, footers, selectable pt-BR text, tiles-blocked fallback, uploaded run, total-failure message, double-click guard). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** automated gates green (pytest, 295 node tests); manual browser checkpoint approved 2026-10-14
