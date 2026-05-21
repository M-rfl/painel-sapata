# Milestones

## v1.0 MVP (Shipped: 2026-05-21)

**Phases completed:** 4 phases | **Plans executed:** 8 of 9 | **Python LOC:** 2,064
**Timeline:** 2026-05-19 → 2026-05-21 (3 days) | **Git commits:** 46
**Git range:** `feat(01-01): implement src/utils.py` → `feat(04-02): write README.md`

**Delivered:** Python acquisition logger for WitMotion WTVB01-485 via Modbus RTU/RS-485 — connects, reads 19 registers in a single burst, converts to physical units, saves to timestamped CSV at 10 Hz, and exits cleanly on Ctrl+C.

**Key accomplishments:**
- Project scaffold with `SensorReading` dataclass (17 channels), `to_signed16()`, timezone-aware `get_timestamp_br()` (tzdata/Windows), rotating log handler — 31 tests GREEN
- Config loader with full YAML validation (collect-all-errors), `AppConfig` dataclass, `list_serial_ports.py` standalone script — 8 tests GREEN
- `WitMotionSensor` class: pymodbus 3.13.0 RTU burst read (0x34, count=19, device_id=80), confirmed scale factors from official manual, transient error handling with consecutive-error threshold — 11 mock tests GREEN; hardware-verified on COM10
- `CSVLogger`: 18-column format, Windows-safe CSV (`newline=''`), flush-on-write, `None→""` for RESERVED angle registers — 8 tests GREEN
- `main.py` acquisition loop: Ctrl+C session summary, `KeyboardInterrupt`+`finally` cleanup, hardware-verified end-to-end at 10 Hz
- `README.md` (281 lines): CH340 driver step, all 3 OS serial port paths, 12 troubleshooting scenarios; `_REG_COUNT = 0x46 - 0x34 + 1` arithmetic hardening — 64/64 tests GREEN

**Known gaps accepted at ship:**
- `02-02-PLAN.md` (hardware checkpoint) — deferred; az_g ≈ 1.0 g at rest verified indirectly during Phase 3 live run on COM10
- `angle_x/y/z` channels always `None` — RESERVED registers 0x3D-0x3F per official WTVB01-485 manual
- DISP-03 CSV-path component not asserted by automated test (`mock_csv.file_path` vs `.path` mismatch in test_main.py)

**Archive:**
- Roadmap: `.planning/milestones/v1.0-ROADMAP.md`
- Requirements: `.planning/milestones/v1.0-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.0-MILESTONE-AUDIT.md`

---
