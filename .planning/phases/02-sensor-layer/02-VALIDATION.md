---
phase: 2
slug: sensor-layer
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-21
validated: 2026-05-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.3 (already installed) |
| **Config file** | pytest.ini (project root) |
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
| 2-01-01 | 01 | 0 | CONN-01 | unit (mock) | `pytest tests/test_sensor.py::test_connect_success -x` | ✅ | ✅ green |
| 2-01-02 | 01 | 0 | CONN-01 | unit (mock) | `pytest tests/test_sensor.py::test_connect_failure -x` | ✅ | ✅ green |
| 2-01-03 | 01 | 1 | ACQ-01 | unit (mock) | `pytest tests/test_sensor.py::test_burst_read_single_call -x` | ✅ | ✅ green |
| 2-01-04 | 01 | 1 | ACQ-02, ACQ-08 | unit (mock) | `pytest tests/test_sensor.py::test_acceleration_conversion -x` | ✅ | ✅ green |
| 2-01-05 | 01 | 1 | ACQ-08 | unit (mock) | `pytest tests/test_sensor.py::test_signed16_applied_to_acceleration -x` | ✅ | ✅ green |
| 2-01-06 | 01 | 1 | ACQ-09 | unit (mock) | `pytest tests/test_sensor.py::test_returns_sensor_reading_dataclass -x` | ✅ | ✅ green |
| 2-01-07 | 01 | 1 | CONN-03 | unit (mock) | `pytest tests/test_sensor.py::test_modbus_exception_logged_as_warning -x` | ✅ | ✅ green |
| 2-01-08 | 01 | 1 | CONN-03 | unit (mock) | `pytest tests/test_sensor.py::test_error_response_logged_as_warning -x` | ✅ | ✅ green |
| 2-01-09 | 01 | 1 | CONN-03 | unit (mock) | `pytest tests/test_sensor.py::test_consecutive_errors_logs_error -x` | ✅ | ✅ green |
| 2-01-10 | 01 | 1 | CONN-03 | unit (mock) | `pytest tests/test_sensor.py::test_exception_returns_none -x` | ✅ | ✅ green |
| 2-01-11 | 01 | 1 | ACQ-03–07 | unit (mock) | `pytest tests/test_sensor.py::test_non_acceleration_channels_present -x` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| `az_g ≈ 1.0 g` with sensor resting flat | ACQ-02, CONN-01 | Requires live hardware (WitMotion WTVB01-485 connected via USB-RS485) | Place sensor flat; run `python main.py` or probe script; verify log shows `az_g ≈ 1.0 g`, `ax_g, ay_g ≈ 0.0 g` | DEFERRED — verified via Phase 3 hardware checkpoint on COM10 (approved, documented in 03-03-SUMMARY.md) |
| Single RTU transaction per sample in debug log | ACQ-01 | Requires live hardware | Run with `logging.basicConfig(level=logging.DEBUG)`; each sample shows exactly one `Sending` and one `Processing` line | DEFERRED — confirmed during Phase 3 live hardware run |
| Scale factors for velocity, displacement, frequency | ACQ-03, ACQ-06, ACQ-07 | Requires reading from live sensor and comparing to known values | Connect sensor; observe vx_mm_s, dx_um, freq_x_hz vs WitMotion PC software readings | DEFERRED — scale factors confirmed from official manual (SCALE_VEL=1/100, SCALE_DISP=1.0, SCALE_FREQ=1/10) |

---

## Key Parameter Assertions

| Parameter | Value | Where asserted |
|-----------|-------|----------------|
| Burst read address | `0x34` | `test_burst_read_single_call` |
| Burst read count | `19` | `test_burst_read_single_call` |
| device_id (slave ID) | `80` (0x50) | `test_burst_read_single_call` |
| to_signed16 on acceleration | applied before SCALE_ACC | `test_signed16_applied_to_acceleration` |
| az_raw=32768 → az_g | `-16.0 g` (not +16.0 or +32.0) | `test_signed16_applied_to_acceleration` |
| _MAX_CONSECUTIVE_ERRORS | `5` (imported in tests) | `test_consecutive_errors_logs_error` |
| angle_x / angle_y / angle_z | `None` (RESERVED registers 0x3D-0x3F) | `test_non_acceleration_channels_present` |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (`tests/test_sensor.py` created)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter

**Approval:** PASSED — 2026-05-21 by gsd-validate-phase

---

## Validation Audit 2026-05-21

| Metric | Count |
|--------|-------|
| Tasks audited | 11 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated to manual-only | 3 (hardware checkpoint items) |

**Findings:**
- All 11 tasks from the per-task verification map have passing automated tests in `tests/test_sensor.py`
- `nyquist_compliant: false` frontmatter was stale — tests existed and passed since 2026-05-21
- Hardware checkpoint (02-02-PLAN.md) was deferred; live hardware verification occurred during Phase 3 Plan 3 execution on COM10
- Scale factors (SCALE_VEL, SCALE_TEMP, SCALE_DISP, SCALE_FREQ) were later confirmed from the official WitMotion WTVB01-485 protocol manual; sensor.py was updated accordingly; angle registers (0x3D-0x3F) confirmed RESERVED (always None by design)
- Full suite: **64 passed, 0 failed** in 0.46 s
