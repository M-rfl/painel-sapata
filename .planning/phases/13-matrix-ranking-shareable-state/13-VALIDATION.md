---
phase: 13
slug: matrix-ranking-shareable-state
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-14
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node 24) for JS core/app-pure modules; pytest 8 for static site checks |
| **Config file** | none for Node (no package.json); `pytest.ini` for pytest |
| **Quick run command** | `node --test "tests/js/*.test.js"` |
| **Full suite command** | `python -m pytest && node --test "tests/js/*.test.js"` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test "tests/js/*.test.js"`
- **After every plan wave:** Run `python -m pytest && node --test "tests/js/*.test.js"`
- **Before `/gsd:verify-work`:** Full suite must be green, plus manual browser checklist (`python -m tools.serve_site`)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-T1 | 01 | 1 | PARAM-04 | unit | `node --test tests/js/state.test.js tests/js/format.test.js tests/js/golden.test.js tests/js/parity.test.js` | state/format ✅ extend | ✅ green |
| 13-01-T2 | 01 | 1 | SHARE-01 | unit | `node --test tests/js/urlstate.test.js` | ❌ W0 (created in task) | ✅ green |
| 13-02-T1 | 02 | 1 | PARAM-04 (GPS filter) | unit | `node --test tests/js/gpsfilter.test.js tests/js/golden.test.js` | ❌ W0 (created in task) | ✅ green |
| 13-02-T2 | 02 | 1 | MTX-01, MTX-02 | unit | `node --test tests/js/matrix.test.js` | ❌ W0 (created in task) | ✅ green |
| 13-03-T1 | 03 | 1 | KPI-06, RANK-02 | unit | `node --test tests/js/quality_index.test.js tests/js/ranking.test.js` | ❌ W0 (created in task) | ✅ green |
| 13-03-T2 | 03 | 1 | RANK-01 | unit | `node --test tests/js/ranking.test.js` | ❌ W0 (created in 13-03-T1) | ✅ green |
| 13-03-T3 | 03 | 1 | RANK-03 | unit | `node --test tests/js/csv.test.js` | ❌ W0 (created in task) | ✅ green |
| 13-04-T1 | 04 | 2 | KPI-06 | static | `node --test "tests/js/*.test.js" && python -m pytest tests/test_site_static.py -q` | ✅ extend info.test | ✅ green |
| 13-04-T2 | 04 | 2 | PARAM-04 | static | `node --test "tests/js/*.test.js" && python -m pytest tests/test_site_static.py -q` | ✅ extend info.test | ✅ green |
| 13-05-T1 | 05 | 3 | MTX-01, MTX-02 | static | `node --test "tests/js/*.test.js" && python -m pytest tests/test_site_static.py -q` | ✅ extend section order | ✅ green |
| 13-05-T2 | 05 | 3 | RANK-01, RANK-02, RANK-03, KPI-06 | static | `node --test "tests/js/*.test.js" && python -m pytest -q` | ✅ extend info.test | ✅ green |
| 13-06-T1 | 06 | 4 | PARAM-04, RANK-01 | static | `python -m pytest tests/test_site_static.py -q && node --test "tests/js/*.test.js"` | ✅ extend map contract | ✅ green |
| 13-06-T2 | 06 | 4 | SHARE-01 | static | `python -m pytest -q && node --test "tests/js/*.test.js"` | ✅ new test_share_wiring | ✅ green |
| 13-07-T1 | 07 | 5 | all | full suite | `python -m pytest -q && node --test "tests/js/*.test.js"` | ✅ | ✅ green |
| 13-07-T2 | 07 | 5 | all (visual) | manual checkpoint | browser checklist (`python -m tools.serve_site`) | manual | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/js/quality_index.test.js` — KPI-06
- [x] `tests/js/gpsfilter.test.js` — PARAM-04 (GPS jump filter)
- [x] `tests/js/matrix.test.js` — MTX-01, MTX-02
- [x] `tests/js/ranking.test.js` — RANK-01, RANK-02
- [x] `tests/js/csv.test.js` — RANK-03
- [x] `tests/js/urlstate.test.js` — SHARE-01
- [x] Update `tests/js/state.test.js`, `tests/js/info.test.js`, `tests/test_site_static.py` as needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| IQ card first in KPI row, colour bands | KPI-06 | DOM, no browser runner | Load run 1 at defaults → card shows 96,4 % Regular (amber; bands >=98 Bom, 90-98 Regular, <90 Ruim) - approved |
| Matrix shading, cell click filters map/charts/KPIs | MTX-01, MTX-02 | DOM/Leaflet/uPlot | Click a cell → all views filter; click again clears |
| Ranking row click pans map / zooms charts | RANK-01 | Leaflet/uPlot | Click a ponto row |
| CSV opens in Excel pt-BR | RANK-03 | Excel | Export, double-click, check columns and decimals |
| Copiar link restores identical view | SHARE-01 | Browser history/clipboard | Change params, copy link, open in fresh tab |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** automated gates green; manual browser checklist (10 checks) approved by engineer (13-07-T2). GPS baseline accepted: 98 pontos at defaults 50 km/h / 120 s.
