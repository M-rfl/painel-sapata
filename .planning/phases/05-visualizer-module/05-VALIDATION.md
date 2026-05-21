---
phase: 5
slug: visualizer-module
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.3 (already installed; existing suite passes) |
| **Config file** | pytest.ini (already exists) |
| **Quick run command** | `pytest tests/test_visualizer.py -x -q` |
| **Full suite command** | `pytest tests/ -v --tb=short` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_visualizer.py -x -q`
- **After every plan wave:** Run `pytest tests/ -v --tb=short`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | VIZ-02 | unit | `pytest tests/test_visualizer.py::test_five_subplots_created -x` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 0 | VIZ-03 | unit | `pytest tests/test_visualizer.py::test_line_count_per_subplot -x` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 0 | VIZ-03 | unit | `pytest tests/test_visualizer.py::test_subplot_legends -x` | ❌ W0 | ⬜ pending |
| 5-01-04 | 01 | 0 | VIZ-06 | unit | `pytest tests/test_visualizer.py::test_ylabel_units -x` | ❌ W0 | ⬜ pending |
| 5-01-05 | 01 | 0 | VIZ-06 | unit | `pytest tests/test_visualizer.py::test_xlabel_time -x` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | VIZ-04 | unit | `pytest tests/test_visualizer.py::test_update_data_appends -x` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 1 | VIZ-04 | unit | `pytest tests/test_visualizer.py::test_buffer_maxlen_enforced -x` | ❌ W0 | ⬜ pending |
| 5-02-03 | 02 | 1 | VIZ-05 | unit | `pytest tests/test_visualizer.py::test_animation_interval -x` | ❌ W0 | ⬜ pending |
| 5-02-04 | 02 | 1 | VIZ-04 | unit | `pytest tests/test_visualizer.py::test_animate_sets_line_data -x` | ❌ W0 | ⬜ pending |
| 5-02-05 | 02 | 1 | VIZ-03 | unit | `pytest tests/test_visualizer.py::test_temperature_subplot_one_line -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_visualizer.py` — all VIZ-02 through VIZ-06 unit tests using Agg backend
- [ ] `matplotlib` added to `requirements.txt` — currently missing

Wave 0 test file header (MUST appear before any visualizer import):
```python
import matplotlib
matplotlib.use("Agg")

import pytest
from src.visualizer import PlotManager, MAX_POINTS, INTERVAL_MS
from src.utils import SensorReading
```

*conftest.py, pytest.ini, and pytest framework already exist — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Window opens with 5 visible subplots on `python src/visualizer.py` | VIZ-01 | Requires GUI display (Tk window cannot be verified headlessly) | Run `python src/visualizer.py`; verify 5 labeled subplots appear with animated mock data |
| X-axis scrolls after 30 seconds | VIZ-04 | Animation timeline requires real-time observation | Run `python src/visualizer.py`, wait 35 seconds; verify oldest data drops off left edge |
| Animation updates visibly at ≥ 1 Hz | VIZ-05 | Visual confirmation of frame rate | Observe lines moving at least once per second in the Tk window |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
