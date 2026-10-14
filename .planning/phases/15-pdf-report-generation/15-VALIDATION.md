---
phase: 15
slug: pdf-report-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| **Quick run command** | `node --test tests/js/report.test.js tests/js/mapshot.test.js tests/js/pdf_smoke.test.js` |
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

*Filled in by the planner/executor per task. Requirement-level map from research:*

| Behavior | Requirement | Test Type | Automated Command | File Exists | Status |
|----------|-------------|-----------|-------------------|-------------|--------|
| Model: full run, filters ignored, current params, basis and sort | REPORT-01 | unit | `node --test tests/js/report.test.js` | ❌ W0 | ⬜ pending |
| Matrix shading, class/IQ/priority colours, sem Crítico, top-50 rule, link cell | REPORT-01 | unit | `node --test tests/js/report.test.js` | ❌ W0 | ⬜ pending |
| Filename, "Gerado em" (America/Sao_Paulo), method note, "Dados enviados" block | REPORT-01 | unit | `node --test tests/js/report.test.js` | ❌ W0 | ⬜ pending |
| `pdfText` sanitiser (→ − ≥ ≤ …) over all bundled/route names | REPORT-01 | unit | `node --test tests/js/report.test.js` | ❌ W0 | ⬜ pending |
| Mercator projection, fit zoom, tile plan, heat grid | REPORT-01 | unit | `node --test tests/js/mapshot.test.js` | ❌ W0 | ⬜ pending |
| PDF renders in node: `%PDF-`, A4 landscape, multi-page, repeated header, links, page numbers, no-map path | REPORT-01 | integration | `node --test tests/js/pdf_smoke.test.js` | ❌ W0 | ⬜ pending |
| Vendor pinning + licences, lazy load, `#report` wiring, no-network, purity, colour tokens | REPORT-01 | static | `python -m pytest tests/test_site_static.py -q` | extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/js/report.test.js` — report model, formatting, colours, filename, method note, pdfText
- [ ] `tests/js/mapshot.test.js` — pure map maths and heat grid
- [ ] `tests/js/pdf_smoke.test.js` — PDF rendering under node with the vendored UMD
- [ ] Extend `tests/test_site_static.py` — report wiring, vendor pinning, no-network, purity

*Framework install: none (node built-ins; vendored jsPDF 4.2.1 + jspdf-autotable 5.0.8 are the only new inputs).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Button busy state, download name, map raster with tiles and with network blocked, live map unchanged, uploaded-run report, selectable text, working links, pt-BR | REPORT-01 | Needs canvas, DOM, OSM network and visual comparison | Serve `site/`, generate the PDF for the bundled run and an uploaded run, block tiles and regenerate, compare with the page |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
