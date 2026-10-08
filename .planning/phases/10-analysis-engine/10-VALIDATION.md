---
phase: 10
slug: analysis-engine
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-08
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | JS: `node --test` (built-in, Node >= 22.7); Python: pytest (existing) |
| **Config file** | none for JS (no package.json); `pytest.ini` exists |
| **Quick run command** | `node --test "tests/js/*.test.js"` and `python -m pytest tests/test_dashboard_converter_analysis.py tests/test_dashboard_site_json.py -q` |
| **Full suite command** | `node --test` and `python -m pytest -q` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test "tests/js/*.test.js"` plus the relevant pytest file(s)
- **After every plan wave:** Run `node --test` and `python -m pytest -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 10-01 | 1 | CORE-01, CORE-02, CORE-03 (oracle) | pytest | `python -m pytest tests/test_dashboard_converter_analysis.py tests/test_dashboard_site_json.py tests/test_dashboard_converter_validate.py tests/test_dashboard_converter_cli.py -q` | ✅ extend | ⬜ pending |
| 10-01-02 | 10-01 | 1 | CORE-04, CORE-06 (oracle priority/digest) | pytest | `python -m pytest tests/test_dashboard_converter_analysis.py -q` | ✅ extend | ⬜ pending |
| 10-02-01 | 10-02 | 1 | CORE-05 (source_runs, workbook_reference) | pytest | `python -m pytest tests/test_dashboard_converter_writer.py tests/test_dashboard_converter_cli.py -q` | ✅ extend | ⬜ pending |
| 10-02-02 | 10-02 | 1 | CORE-05 (regenerated JSON, file split) | pytest | `python -m pytest tests/test_dashboard_site_json.py tests/test_dashboard_converter_writer.py tests/test_dashboard_converter_cli.py -q` | ✅ extend | ⬜ pending |
| 10-03-01 | 10-03 | 1 | CORE-01 (decode) | unit | `node --test "tests/js/*.test.js"` | ❌ W0 (created by task) | ⬜ pending |
| 10-03-02 | 10-03 | 1 | CORE-01, CORE-02 | unit | `node --test "tests/js/*.test.js"` | ❌ W0 (created by 10-03-01) | ⬜ pending |
| 10-03-03 | 10-03 | 1 | CORE-03, CORE-06 (golden) | unit + golden | `node --test "tests/js/*.test.js"` | ❌ W0 (created by task) | ⬜ pending |
| 10-04-01 | 10-04 | 2 | CORE-04 | unit + golden | `node --test "tests/js/*.test.js"` | ✅ (from 10-03) | ⬜ pending |
| 10-04-02 | 10-04 | 2 | CORE-05 | unit + golden | `node --test "tests/js/*.test.js"` | ✅ (from 10-03) | ⬜ pending |
| 10-05-01 | 10-05 | 3 | CORE-06 (fixture) | generator | `python -m tools.dashboard_converter.gen_parity --out tests/fixtures/parity_cases.json` | ❌ W0 (created by task) | ⬜ pending |
| 10-05-02 | 10-05 | 3 | CORE-06 (parity + freshness) | parity + pytest | `node --test && python -m pytest -q` | ❌ W0 (created by task) | ⬜ pending |

Note: `node --test tests/js/` (directory argument) fails on Node 24; use `node --test` at the repo root or the quoted glob `node --test "tests/js/*.test.js"`.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/js/helpers.js` — `loadRun()`, digest, typed-array deep-equal helpers
- [ ] `tests/js/golden.test.js`, `tests/js/unit.test.js`, `tests/js/parity.test.js`
- [ ] `tests/fixtures/parity_cases.json` + generator script (committed, offline)
- [ ] `tests/test_parity_fixture.py` — freshness guard
- [ ] Extend `analysis_ref.py` (manual offset, gap, time-jump, priority) and its tests
- [ ] Converter: `source_runs` + `meta.workbook_reference`; regenerate site JSON
- [ ] No framework install (Node built-in); document minimum Node 22.7

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
