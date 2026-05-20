---
phase: 1
slug: foundation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | tests/conftest.py (Wave 0 creates) |
| **Quick run command** | `pytest tests/ -x -q` |
| **Full suite command** | `pytest tests/ -v` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/ -x -q`
- **After every plan wave:** Run `pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | UTIL-03 | structure | `pytest tests/test_structure.py -x -q` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | DOC-04 | manual | `pip install -r requirements.txt` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | CFG-01/02/03 | unit | `pytest tests/test_config_loader.py -x -q` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | STORE-03 | unit | `pytest tests/test_utils.py -x -q` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 2 | CONN-04 | integration | `python list_serial_ports.py` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 2 | UTIL-01/02 | unit | `pytest tests/test_utils.py -x -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/__init__.py` — makes tests a package
- [ ] `tests/conftest.py` — shared fixtures (tmp_path, sample config dict)
- [ ] `tests/test_utils.py` — stubs for to_signed16() boundary tests (STORE-03)
- [ ] `tests/test_config_loader.py` — stubs for config validation (CFG-01/02/03)
- [ ] `tests/test_structure.py` — stubs for project structure (UTIL-03)
- [ ] `pytest` — install if not detected (add to requirements.txt dev section or test separately)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `pip install -r requirements.txt` installs pymodbus==3.13.0 | DOC-04 | Requires clean virtualenv, cannot automate in unit test | Create new venv, run pip install, verify `pip show pymodbus` shows 3.13.0 |
| `python list_serial_ports.py` prints ports without error | CONN-04 | Requires OS serial port enumeration | Run script, verify output (empty list is OK — no hardware needed) |
| `datetime.now(ZoneInfo("America/Sao_Paulo"))` shows `-03:00` on Windows | STORE-03 | Requires tzdata installed on Windows | Run `python -c "from src.utils import get_timestamp_br; print(get_timestamp_br())"` |

---

## Key Parameter Assertions

The following values are canonical across all plans and tests — any deviation is a bug:

| Parameter | Value | Where asserted |
|-----------|-------|----------------|
| RotatingFileHandler maxBytes | `1_048_576` (1 MB) | `test_setup_logging_rotating_handler_params` in tests/test_utils.py |
| RotatingFileHandler backupCount | `5` | `test_setup_logging_rotating_handler_params` in tests/test_utils.py |
| SensorReading field names | `ax_g, ay_g, az_g, vx_mm_s, vy_mm_s, vz_mm_s, angle_x, angle_y, angle_z, temperature_c, dx_um, dy_um, dz_um, freq_x_hz, freq_y_hz, freq_z_hz` | `test_sensor_reading_has_all_fields` in tests/test_utils.py |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter (updated by Plan 02 Task 2 after full suite passes)
- [ ] `wave_0_complete: true` set in frontmatter (updated by Plan 02 Task 2 after all Wave 0 files created)

**Approval:** pending
