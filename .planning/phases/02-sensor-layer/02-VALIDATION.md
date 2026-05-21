---
phase: 2
slug: sensor-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest >=7.0 (already in requirements.txt) |
| **Config file** | none — pytest auto-discovers tests/ |
| **Quick run command** | `pytest tests/test_sensor.py -x -q` |
| **Full suite command** | `pytest tests/ -v --tb=short` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_sensor.py -x -q`
- **After every plan wave:** Run `pytest tests/ -v --tb=short`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | CONN-01 | unit (mock) | `pytest tests/test_sensor.py::test_connect_success -x` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 0 | CONN-01 | unit (mock) | `pytest tests/test_sensor.py::test_connect_failure -x` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | ACQ-01 | unit (mock) | `pytest tests/test_sensor.py::test_burst_read_single_call -x` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | ACQ-02, ACQ-08 | unit (mock) | `pytest tests/test_sensor.py::test_acceleration_conversion -x` | ❌ W0 | ⬜ pending |
| 2-01-05 | 01 | 1 | ACQ-08 | unit (mock) | `pytest tests/test_sensor.py::test_signed16_applied_to_acceleration -x` | ❌ W0 | ⬜ pending |
| 2-01-06 | 01 | 1 | ACQ-09 | unit (mock) | `pytest tests/test_sensor.py::test_returns_sensor_reading_dataclass -x` | ❌ W0 | ⬜ pending |
| 2-01-07 | 01 | 1 | CONN-03 | unit (mock) | `pytest tests/test_sensor.py::test_modbus_exception_logged_as_warning -x` | ❌ W0 | ⬜ pending |
| 2-01-08 | 01 | 1 | CONN-03 | unit (mock) | `pytest tests/test_sensor.py::test_error_response_logged_as_warning -x` | ❌ W0 | ⬜ pending |
| 2-01-09 | 01 | 1 | CONN-03 | unit (mock) | `pytest tests/test_sensor.py::test_consecutive_errors_logs_error -x` | ❌ W0 | ⬜ pending |
| 2-01-10 | 01 | 1 | CONN-03 | unit (mock) | `pytest tests/test_sensor.py::test_exception_returns_none -x` | ❌ W0 | ⬜ pending |
| 2-01-11 | 01 | 1 | ACQ-03–07 | unit (mock) | `pytest tests/test_sensor.py::test_non_acceleration_channels_present -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_sensor.py` — stubs for CONN-01, CONN-03, ACQ-01, ACQ-02, ACQ-08, ACQ-09, ACQ-03–07

*Existing infrastructure covers pytest runner; only test_sensor.py needs to be created.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `az_g ≈ 1.0 g` with sensor resting flat | Success criterion 2 | Requires live hardware (WitMotion WTVB01-485 connected via USB-RS485) | Place sensor flat on table; run `python -m src.sensor`; verify log shows `az_g` ≈ 1.0 and `ax_g`, `ay_g` ≈ 0.0 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
