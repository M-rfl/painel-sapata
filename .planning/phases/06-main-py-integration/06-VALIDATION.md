---
phase: 6
slug: main-py-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.3 (installed; 74 tests currently passing) |
| **Config file** | pytest.ini (exists; `testpaths = tests`) |
| **Quick run command** | `pytest tests/test_main.py tests/test_main_gui.py -x -q` |
| **Full suite command** | `pytest tests/ -v --tb=short` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_main.py tests/test_main_gui.py -x -q`
- **After every plan wave:** Run `pytest tests/ -v --tb=short`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 0 | INTG-01 | unit | `pytest tests/test_main_gui.py -x -q` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 0 | INTG-01 | unit | `pytest tests/test_main.py -x -q` | ✅ (needs sys.argv patch) | ⬜ pending |
| 6-02-01 | 02 | 1 | INTG-01 | unit | `pytest tests/test_main.py tests/test_main_gui.py -x -q` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 1 | INTG-02 | unit | `pytest tests/test_main_gui.py::test_gui_csv_written -x` | ❌ W0 | ⬜ pending |
| 6-02-03 | 02 | 1 | INTG-03 | unit | `pytest tests/test_main_gui.py::test_gui_update_data_called -x` | ❌ W0 | ⬜ pending |
| 6-02-04 | 02 | 1 | INTG-04 | unit | `pytest tests/test_main_gui.py::test_gui_close_triggers_shutdown -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_main_gui.py` — stub tests for INTG-01 through INTG-04 (no-flag path, GUI CSV write, GUI thread, GUI shutdown)
- [ ] `tests/test_main.py` — add `patch("sys.argv", ["main.py"])` to all 5 existing tests to prevent argparse from reading pytest argv

*conftest.py, pytest.ini, and framework already exist — no new install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `python main.py --gui` opens live window with real sensor | INTG-02, INTG-03 | Hardware required; Tk window cannot be scripted headlessly | Connect WTVB01, run `python main.py --gui`, confirm window opens and data flows at 10 Hz |
| Window X button triggers summary in terminal | INTG-04 | Requires interactive Tk window | With window open, click X; confirm terminal prints session summary identical to Ctrl+C format |
| `python main.py` (no flag) unchanged with real sensor | INTG-01 | Hardware regression test | Run headless path end-to-end; confirm CSV written, terminal output same as v1.0 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
