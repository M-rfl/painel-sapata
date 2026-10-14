---
phase: 13
slug: matrix-ranking-shareable-state
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| TBD (filled by planner) | — | — | KPI-06 | unit | `node --test tests/js/quality_index.test.js` | ❌ W0 | ⬜ pending |
| TBD | — | — | MTX-01, MTX-02 | unit | `node --test tests/js/matrix.test.js` | ❌ W0 | ⬜ pending |
| TBD | — | — | RANK-01, RANK-02 | unit | `node --test tests/js/ranking.test.js` | ❌ W0 | ⬜ pending |
| TBD | — | — | RANK-03 | unit | `node --test tests/js/csv.test.js` | ❌ W0 | ⬜ pending |
| TBD | — | — | PARAM-04 | unit | `node --test tests/js/state.test.js tests/js/gpsfilter.test.js tests/js/golden.test.js` | state ✅ / gpsfilter ❌ W0 | ⬜ pending |
| TBD | — | — | SHARE-01 | unit | `node --test tests/js/urlstate.test.js` | ❌ W0 | ⬜ pending |
| TBD | — | — | (all UI) | static | `node --test tests/js/info.test.js` + `python -m pytest tests/test_site_static.py -q` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/js/quality_index.test.js` — KPI-06
- [ ] `tests/js/gpsfilter.test.js` — PARAM-04 (GPS jump filter)
- [ ] `tests/js/matrix.test.js` — MTX-01, MTX-02
- [ ] `tests/js/ranking.test.js` — RANK-01, RANK-02
- [ ] `tests/js/csv.test.js` — RANK-03
- [ ] `tests/js/urlstate.test.js` — SHARE-01
- [ ] Update `tests/js/state.test.js`, `tests/js/info.test.js`, `tests/test_site_static.py` as needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| IQ card first in KPI row, colour bands | KPI-06 | DOM, no browser runner | Load run 1 at defaults → card shows 96,4 % Bom |
| Matrix shading, cell click filters map/charts/KPIs | MTX-01, MTX-02 | DOM/Leaflet/uPlot | Click a cell → all views filter; click again clears |
| Ranking row click pans map / zooms charts | RANK-01 | Leaflet/uPlot | Click a ponto row |
| CSV opens in Excel pt-BR | RANK-03 | Excel | Export, double-click, check columns and decimals |
| Copiar link restores identical view | SHARE-01 | Browser history/clipboard | Change params, copy link, open in fresh tab |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
