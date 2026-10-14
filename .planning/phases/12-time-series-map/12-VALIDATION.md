---
phase: 12
slug: time-series-map
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-13
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node 24) for JS core; pytest 8 for static site checks |
| **Config file** | none for Node (no package.json); `pytest.ini` for pytest |
| **Quick run command** | `node --test "tests/js/*.test.js"` |
| **Full suite command** | `python -m pytest && node --test "tests/js/*.test.js"` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test "tests/js/*.test.js"` (plus `python -m pytest tests/test_site_static.py` when touching html/vendor)
- **After every plan wave:** Run `python -m pytest && node --test "tests/js/*.test.js"`
- **Before `/gsd:verify-work`:** Full suite must be green + manual browser checklist
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-T1 | 12-01 | 1 | (infra) vendor | static | `python -m pytest tests/test_site_static.py -x` | ✅ | ✅ green |
| 12-01-T2 | 12-01 | 1 | (infra) sections/order | static | `python -m pytest tests/test_site_static.py -x` | ✅ | ✅ green |
| 12-02-T1 | 12-02 | 1 | SYNC-01, MAP-02 (decode fix tables) | unit | `node --test tests/js/decode.test.js` | ✅ | ✅ green |
| 12-02-T2 | 12-02 | 1 | CHART-01, CHART-02, CHART-03, CHART-04, CHART-05 | unit | `node --test tests/js/series.test.js` | ✅ | ✅ green |
| 12-03-T1 | 12-03 | 2 | MAP-01, MAP-02, SYNC-01 | unit | `node --test tests/js/geo.test.js` | ✅ | ✅ green |
| 12-03-T2 | 12-03 | 2 | MAP-03, MAP-04, MAP-05, MAP-06 | unit | `node --test tests/js/geo.test.js` | ✅ | ✅ green |
| 12-04-T1 | 12-04 | 2 | SYNC-01 (link bus) | unit | `node --test tests/js/link.test.js` | ✅ | ✅ green |
| 12-04-T2 | 12-04 | 2 | CHART-01..05 (panel) | static + manual | `python -m pytest tests/test_site_static.py -q` | ✅ | ✅ green |
| 12-05-T1 | 12-05 | 3 | MAP-01, MAP-02, SYNC-01 (panel) | static + manual | `python -m pytest tests/test_site_static.py -q` | ✅ | ✅ green |
| 12-05-T2 | 12-05 | 3 | MAP-03..06 (panel) | static + manual | `node --test "tests/js/*.test.js"` | ✅ | ✅ green |
| 12-06-T2 | 12-06 | 4 | all (visual) | manual | `checkpoint checklist` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/js/series.test.js` — CHART-01..05 (needs the extended `decodeRun`)
- [x] `tests/js/geo.test.js` — MAP-01..06, SYNC-01 lookups
- [x] Extend `tests/test_site_static.py` — vendor files, section order, `<details>` closed, README versions
- [x] Extend existing data/decode tests for new `run.fixLat/fixLon/priorFix/channels` fields (golden/parity tests unaffected)
- [x] No new framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zoom/cursor sync feel, drag-zoom keeps peaks | CHART-02, CHART-05 | No headless browser infra | `python -m tools.serve_site`; drag-zoom on AX, confirm all charts follow and peaks stay visible |
| OSM tiles load, track colours, popup look | MAP-01..03 | Visual / network | Open site, inspect track, click marker, follow Google Maps link |
| Heat map toggle | MAP-04 | Visual | Toggle heat layer, change filters, confirm scale stays fixed |
| Chart hover → map marker; map click → chart cursor | SYNC-01 | Interaction | Hover AX chart, see map highlight; click track point, chart cursor moves |
| "Mais canais" open/close | CHART-04 | Lazy-init on `<details>` open | Open details, confirm secondary charts render at full width and synced |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
