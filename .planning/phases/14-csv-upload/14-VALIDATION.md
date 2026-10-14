---
phase: 14
slug: csv-upload
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-14
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner (Node 24, ESM) for JS; pytest for Python generators/guards |
| **Config file** | none for JS (CI glob `node --test "tests/js/*.test.js"`); `pytest.ini` |
| **Quick run command** | `node --test tests/js/convert_recover.test.js tests/js/convert_reader.test.js tests/js/convert_geofence.test.js tests/js/convert_parity.test.js` |
| **Full suite command** | `node --test "tests/js/*.test.js"` then `python -m pytest` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant `node --test tests/js/convert_*.test.js` file(s)
- **After every plan wave:** Run `node --test "tests/js/*.test.js"` + `python -m pytest tests/test_site_static.py tests/test_upload_fixture.py tests/test_parity_fixture.py`
- **Before `/gsd:verify-work`:** Full suite must be green, plus local run-1 parity test (`tests/js/convert_run1.test.js`, skipped in CI) and the manual browser checkpoint
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Filled in by the planner/executor per task. Requirement-level map from research:*

| Behavior | Requirement | Test Type | Automated Command | File Exists | Status |
|----------|-------------|-----------|-------------------|-------------|--------|
| Comma and `;` files accepted; multi-file merge; output decodes and `analyze()` runs | UPLOAD-01 (SC1) | unit + integration | `node --test tests/js/convert_reader.test.js tests/js/convert_build.test.js` | ❌ W0 | ⬜ pending |
| Cell recovery equals Python on generated cases | UPLOAD-01 (SC2a) | parity (fixture) | `node --test tests/js/convert_recover.test.js` | ❌ W0 | ⬜ pending |
| Geofence trecho/sentido/flag equals Python on synthetic routes | UPLOAD-01 (SC2b) | parity (fixture) | `node --test tests/js/convert_geofence.test.js` | ❌ W0 | ⬜ pending |
| JS schema-v1 JSON deep-equals Python for `run_mini` | UPLOAD-01 (SC2c) | parity (CI) | `node --test tests/js/convert_parity.test.js` | ❌ W0 | ⬜ pending |
| Run-1 raw CSVs → JS JSON deep-equals committed run JSON | UPLOAD-01 (SC2d) | parity (local-only) | `node --test tests/js/convert_run1.test.js` | ❌ W0 | ⬜ pending |
| Invalid files → Portuguese `ConvertError` | UPLOAD-01 (SC3a) | unit | `node --test tests/js/convert_errors.test.js` | ❌ W0 | ⬜ pending |
| Failed upload leaves view intact; share disabled for uploads | UPLOAD-01 (SC3b, share) | unit | `node --test tests/js/upload_controller.test.js` | ❌ W0 | ⬜ pending |
| No network APIs in upload/convert sources | UPLOAD-01 (SC3c) | static | `python -m pytest tests/test_site_static.py -x` | extend | ⬜ pending |
| `stations.json` / `upload_parity.json` fresh vs Python | UPLOAD-01 | pytest | `python -m pytest tests/test_upload_fixture.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tools/dashboard_converter/gen_upload_parity.py` — writes `site/data/stations.json` and `tests/fixtures/upload_parity.json`
- [ ] `tests/test_upload_fixture.py` — freshness guard (pattern: `tests/test_parity_fixture.py`)
- [ ] `tests/js/convert_*.test.js` (recover, reader, geofence, build, parity, errors, run1) and `tests/js/upload_controller.test.js`
- [ ] Extend `tests/test_site_static.py` — no-network guard on convert/upload sources; `site/data/stations.json` exists

*Framework install: none (Node 24 + pytest present; `pages.yml` runs both).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Upload button, drop overlay, busy status, error notice, banner, return-to-example, repeated uploads, charts/map re-created without leaks | UPLOAD-01 | DOM/Leaflet/uPlot not testable under node | Serve `site/`, upload run-1 CSVs (comma and `;`), drop an invalid file, confirm Portuguese error + view intact, return to example, repeat upload 3× |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
