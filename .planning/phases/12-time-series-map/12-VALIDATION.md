---
phase: 12
slug: time-series-map
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| TBD | TBD | TBD | CHART-01 | unit | `node --test tests/js/series.test.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHART-02 | unit | `node --test tests/js/series.test.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHART-03 | unit | `node --test tests/js/series.test.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHART-04 | unit + static | `node --test tests/js/series.test.js`; `python -m pytest tests/test_site_static.py` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CHART-05 | unit | `node --test tests/js/series.test.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MAP-01 | unit | `node --test tests/js/geo.test.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MAP-02 | unit | `node --test tests/js/geo.test.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MAP-03 | unit | `node --test tests/js/geo.test.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MAP-04 | unit | `node --test tests/js/geo.test.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MAP-05 | unit | `node --test tests/js/geo.test.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MAP-06 | unit | `node --test tests/js/geo.test.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SYNC-01 | unit | `node --test tests/js/geo.test.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | (infra) | static | `python -m pytest tests/test_site_static.py -x` | ⚠ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/js/series.test.js` — CHART-01..05 (needs the extended `decodeRun`)
- [ ] `tests/js/geo.test.js` — MAP-01..06, SYNC-01 lookups
- [ ] Extend `tests/test_site_static.py` — vendor files, section order, `<details>` closed, README versions
- [ ] Extend existing data/decode tests for new `run.fixLat/fixLon/priorFix/channels` fields (golden/parity tests unaffected)
- [ ] No new framework install needed

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
