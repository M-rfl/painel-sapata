---
phase: 4
slug: documentation-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest >= 7.0 |
| **Config file** | pytest.ini (exists at project root) |
| **Quick run command** | `pytest -q --tb=short` |
| **Full suite command** | `pytest -q --tb=short` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest -q --tb=short`
- **After every plan wave:** Run `pytest -q --tb=short`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-00-01 | 00 | 0 | DOC-01 | smoke | `pytest tests/test_docs.py::test_readme_exists -x` | ❌ W0 | ⬜ pending |
| 4-00-02 | 00 | 0 | DOC-01 | content | `pytest tests/test_docs.py::test_readme_ch340_driver -x` | ❌ W0 | ⬜ pending |
| 4-00-03 | 00 | 0 | DOC-02 | content | `pytest tests/test_docs.py::test_readme_serial_port_os_coverage -x` | ❌ W0 | ⬜ pending |
| 4-00-04 | 00 | 0 | DOC-02 | content | `pytest tests/test_docs.py::test_readme_list_serial_ports -x` | ❌ W0 | ⬜ pending |
| 4-00-05 | 00 | 0 | DOC-03 | content | `pytest tests/test_docs.py::test_readme_troubleshooting_count -x` | ❌ W0 | ⬜ pending |
| 4-00-06 | 00 | 0 | DOC-03 | unit | `pytest tests/test_docs.py::test_reg_count_arithmetic -x` | ❌ W0 | ⬜ pending |
| 4-00-07 | 00 | 0 | DOC-03 | unit | `pytest tests/test_docs.py::test_no_naive_datetime -x` | ❌ W0 | ⬜ pending |
| 4-00-08 | 00 | 0 | DOC-03 | unit | `pytest tests/test_docs.py::test_csv_flush_present -x` | ❌ W0 | ⬜ pending |
| 4-00-09 | 00 | 0 | DOC-03 | unit | `pytest tests/test_docs.py::test_signed16_on_signed_channels -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_docs.py` — 9 tests covering DOC-01, DOC-02, DOC-03 content checks and all 4 hardening assertions

*All tests are file-read + regex based; no hardware or network required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WitMotion software download link works | DOC-03 (Scenario 12) | External URL — cannot automate without network access in CI | Click the WitMotion software URL in README troubleshooting Scenario 12 and confirm the download page loads |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
