---
phase: 3
slug: acquisition-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.3 (already installed; 42 tests green) |
| **Config file** | pytest.ini (already exists) |
| **Quick run command** | `pytest tests/test_csv_logger.py tests/test_main.py -x -q` |
| **Full suite command** | `pytest tests/ -v --tb=short` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_csv_logger.py -x -q` (CSVLogger tasks) or `pytest tests/test_main.py -x -q` (main.py tasks)
- **After every plan wave:** Run `pytest tests/ -v --tb=short`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | STORE-01..06 | unit stub | `pytest tests/test_csv_logger.py -x -q` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 0 | CONN-02, DISP-01..03 | unit stub | `pytest tests/test_main.py -x -q` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | STORE-01, STORE-05 | unit | `pytest tests/test_csv_logger.py::test_file_created_with_correct_name tests/test_csv_logger.py::test_output_folder_created -x` | ❌ W0 | ⬜ pending |
| 3-01-04 | 01 | 1 | STORE-02 | unit | `pytest tests/test_csv_logger.py::test_header_row_columns tests/test_csv_logger.py::test_header_written_once -x` | ❌ W0 | ⬜ pending |
| 3-01-05 | 01 | 1 | STORE-03, STORE-06 | unit | `pytest tests/test_csv_logger.py::test_timestamp_format tests/test_csv_logger.py::test_none_fields_become_empty_string -x` | ❌ W0 | ⬜ pending |
| 3-01-06 | 01 | 1 | STORE-04 | unit | `pytest tests/test_csv_logger.py::test_flush_after_each_row -x` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 2 | CONN-02, DISP-03 | unit | `pytest tests/test_main.py::test_graceful_shutdown_closes_resources tests/test_main.py::test_session_summary_on_ctrl_c -x` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 2 | DISP-01, DISP-02 | unit | `pytest tests/test_main.py::test_terminal_display_per_sample tests/test_main.py::test_connection_status_messages -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_csv_logger.py` — stubs for STORE-01, STORE-02, STORE-03, STORE-04, STORE-05, STORE-06
- [ ] `tests/test_main.py` — stubs for CONN-02, DISP-01, DISP-02, DISP-03

*conftest.py and pytest framework already exist — no framework installation needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSV opens correctly in Excel with no blank rows | STORE-04 | Requires human visual inspection of spreadsheet rendering | Open CSV in Excel; confirm no blank rows between data rows |
| Live sensor data flows to CSV at configured Hz | STORE-01, DISP-01 | Requires physical hardware (COM10, WTVB01-485) | Run `python main.py`; confirm CSV grows and terminal updates |
| Ctrl+C session summary is readable and accurate | DISP-03 | Requires interactive terminal | Run `python main.py`, press Ctrl+C after ~10s; verify summary shows correct counts |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
