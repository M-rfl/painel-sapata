# Roadmap: WTVB01 Notebook Logger

## Overview

Four phases build bottom-up in dependency order: Foundation lays the project skeleton and all zero-I/O utilities; Sensor Layer wires Modbus RTU and delivers verified readings from real hardware; Acquisition Loop assembles the running logger (CSV, display, shutdown); Documentation & Hardening finalises the README and performs a final correctness review. Every requirement maps to exactly one phase. By Phase 3 the core value is fully delivered: sensor connects, reads, and saves reliable CSV data.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Project skeleton, config loader, timezone utility, list_serial_ports — no hardware needed (completed 2026-05-20)
- [ ] **Phase 2: Sensor Layer** - WitMotionSensor class with Modbus RTU connection, burst register read, all channel conversions
- [x] **Phase 3: Acquisition Loop** - main.py wiring everything together: CSV logger, terminal display, graceful shutdown (completed 2026-05-21)
- [x] **Phase 4: Documentation & Hardening** - Complete README.md with troubleshooting, pinned requirements.txt, code review (completed 2026-05-21)

## Phase Details

### Phase 1: Foundation
**Goal**: The project scaffold exists, configuration loads and validates cleanly, timezone-aware timestamps work on Windows, and a developer can identify serial ports — all verifiable without any hardware.
**Depends on**: Nothing (first phase)
**Requirements**: CONN-04, STORE-03, CFG-01, CFG-02, CFG-03, UTIL-01, UTIL-02, UTIL-03, DOC-04
**Success Criteria** (what must be TRUE):
  1. Running `python list_serial_ports.py` prints available serial ports with device description (e.g., "COM3 - USB-SERIAL CH340") without error
  2. `config.yaml` loads with all defaults applied; missing or invalid keys produce a human-readable error and exit with code 1 before any serial I/O
  3. `utils.to_signed16(32768)` returns -32768 and `utils.to_signed16(0)` returns 0 — unit tests pass for the five boundary values (0, 1, 32767, 32768, 65535)
  4. `datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat()` runs without error on Windows (tzdata installed), producing an ISO 8601 string with `-03:00` offset
  5. `requirements.txt` contains pinned versions for pymodbus==3.13.0, pyserial, PyYAML, tzdata, and backports.zoneinfo; `pip install -r requirements.txt` completes cleanly
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffold, requirements.txt, src/utils.py (to_signed16, get_timestamp_br, setup_logging, SensorReading), test suite
- [x] 01-02-PLAN.md — src/config_loader.py (AppConfig, validation), config.yaml, list_serial_ports.py, test suite

### Phase 2: Sensor Layer
**Goal**: The WitMotionSensor class connects to the physical sensor, reads all 19 registers in a single burst call, converts them to correct physical units, and handles transient errors gracefully — verified against live hardware.
**Depends on**: Phase 1
**Requirements**: CONN-01, CONN-03, ACQ-01, ACQ-02, ACQ-03, ACQ-04, ACQ-05, ACQ-06, ACQ-07, ACQ-08, ACQ-09
**Success Criteria** (what must be TRUE):
  1. `sensor.read_all_data()` returns a `SensorReading` dataclass with all 17 physical fields populated after a single Modbus burst read (0x34, count=19) — confirmed by log showing one RTU transaction per sample
  2. Accelerometer reads ~0.0 g on X/Y and ~1.0 g on Z with the sensor resting flat — signed 16-bit conversion is correct (no ~32 g anomaly)
  3. A simulated timeout or CRC error triggers a logged warning and a retry; the process does not exit; after N consecutive failures the loop pauses and logs a consecutive-error count
  4. All pymodbus calls use the 3.x API exclusively: `framer=FramerType.RTU`, `device_id=80` — no `method=`, no `unit=`, no `slave=` keyword arguments appear anywhere in sensor.py
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — TDD: tests/test_sensor.py (11 mock-based tests, RED then GREEN) + src/sensor.py (WitMotionSensor class, full implementation)
- [ ] 02-02-PLAN.md — Hardware checkpoint: live gravity verification (az_g ~1.0 g at rest)

### Phase 3: Acquisition Loop
**Goal**: Running `python main.py` starts continuous logging: every sample is written to a timestamped CSV file with all columns and an explicit UTC offset, displayed on the terminal, and the file survives a hard Ctrl+C without losing the last written rows.
**Depends on**: Phase 2
**Requirements**: CONN-02, STORE-01, STORE-02, STORE-03, STORE-04, STORE-05, STORE-06, DISP-01, DISP-02, DISP-03
**Success Criteria** (what must be TRUE):
  1. On startup, a CSV file named `wtvb01_YYYYMMDD_HHMMSS.csv` is created in the configured output folder (folder auto-created if absent) with the correct 18-column header on the first row only — no duplicate header on restart
  2. Each row in the CSV contains a timezone-aware ISO 8601 timestamp with `-03:00` offset, a `sensor_id` value, and numeric data for all 17 sensor channels; failed-read channels appear as empty string (not "NaN" or "ERROR")
  3. After pressing Ctrl+C, the terminal prints a session summary (samples written, CSV path, elapsed duration) and the CSV file is fully readable — no truncated or buffered rows missing
  4. Terminal output updates once per sample interval showing timestamp and formatted channel values; connection status messages (connected, error, reconnecting) appear as they occur
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Wave 0: test stubs tests/test_csv_logger.py (8 tests RED) + tests/test_main.py (5 tests RED)
- [x] 03-02-PLAN.md — CSVLogger implementation: src/csv_logger.py (STORE-01..06 GREEN)
- [x] 03-03-PLAN.md — main.py acquisition loop (CONN-02, DISP-01..03 GREEN) + hardware checkpoint

### Phase 4: Documentation & Hardening
**Goal**: A Windows-naive user can follow the README from zero — CH340 driver install through first successful CSV — and all 12 troubleshooting scenarios are addressed. The codebase is reviewed for robustness against the documented pitfalls.
**Depends on**: Phase 3
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):
  1. README.md Step 0 instructs Windows users to install the WCH CH340 driver from wch.cn before connecting any hardware or running any Python command
  2. README.md covers serial port identification for all three OS (Windows Device Manager, `ls /dev/ttyUSB*` on Linux, `ls /dev/tty.usbserial*` on macOS) and `list_serial_ports.py` usage
  3. README.md troubleshooting section addresses all 12 specified scenarios: sensor not responding, COM port not found, port busy, permission error, zero values, A/B inversion, wrong baud rate, wrong slave ID, USB-RS485 driver not installed, COM3 vs COM4 confusion, how to test with WitMotion software before Python
  4. Code review confirms: `to_signed16()` applied before every scale factor; `buffering=1` (or explicit `flush()`) on every CSV write; no naive `datetime.now()` calls; `REG_COUNT = 0x46 - 0x34 + 1` defined as a named constant
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Wave 0 TDD: tests/test_docs.py (9 RED tests) — DOC-01, DOC-02, DOC-03 content checks + 4 hardening assertions
- [ ] 04-02-PLAN.md — README.md (full user guide, 12 scenarios) + _REG_COUNT hardening fix in src/sensor.py

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete   | 2026-05-20 |
| 2. Sensor Layer | 0/2 | Not started | - |
| 3. Acquisition Loop | 3/3 | Complete   | 2026-05-21 |
| 4. Documentation & Hardening | 2/2 | Complete   | 2026-05-21 |
