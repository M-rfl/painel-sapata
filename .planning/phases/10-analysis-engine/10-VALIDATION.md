---
phase: 10
slug: analysis-engine
status: draft
nyquist_compliant: false
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
| **Quick run command** | `node --test tests/js/` and `python -m pytest tests/test_dashboard_converter_analysis.py tests/test_dashboard_site_json.py -q` |
| **Full suite command** | `node --test` and `python -m pytest -q` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/js/` plus the relevant pytest file(s)
- **After every plan wave:** Run `node --test` and `python -m pytest -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD (filled by planner) | — | — | CORE-01 | unit | `node --test tests/js/unit.test.js` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-02 | unit + golden | `node --test tests/js/unit.test.js tests/js/golden.test.js` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-03 | golden + unit | `node --test tests/js/golden.test.js` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-04 | unit + golden | `node --test tests/js/unit.test.js tests/js/golden.test.js` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-05 | unit + golden | `node --test tests/js/golden.test.js tests/js/unit.test.js` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-06 | parity | `node --test tests/js/parity.test.js` + `python -m pytest tests/test_parity_fixture.py -q` | ❌ W0 | ⬜ pending |
| TBD | — | — | support | pytest | `python -m pytest tests/test_dashboard_converter_analysis.py tests/test_dashboard_site_json.py tests/test_dashboard_converter_writer.py -q` | ✅ extend | ⬜ pending |

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
