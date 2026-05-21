---
phase: 04-documentation-hardening
plan: "02"
subsystem: docs-hardening
tags: [readme, documentation, sensor, hardening, modbus]
dependency_graph:
  requires: [04-01]
  provides: [README.md, sensor-hardening]
  affects: [tests/test_docs.py]
tech_stack:
  added: []
  patterns: [troubleshooting-guide, modbus-rtu-documentation]
key_files:
  created:
    - README.md
  modified:
    - src/sensor.py
decisions:
  - "_REG_COUNT expressed as 0x46 - 0x34 + 1 so the register range is self-documenting"
  - "slave_id documented as decimal 80 (not hex 0x50) with explicit YAML note"
  - "angle_x/y/z documented as always empty (RESERVED registers) — expected behaviour, not a bug"
metrics:
  duration: "2 min"
  completed_date: "2026-05-21"
  tasks_completed: 2
  files_modified: 2
---

# Phase 04 Plan 02: Documentation & Hardening — README + sensor fix Summary

README.md written from scratch (280 lines, 12 troubleshooting scenarios) and sensor.py _REG_COUNT changed from bare literal to arithmetic expression, turning all 9 RED tests GREEN with 64/64 full-suite passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Apply _REG_COUNT hardening fix | 944de97 | src/sensor.py |
| 2 | Write README.md full user guide | 3c5ca28 | README.md |

## Deliverables

### README.md (280 lines)

Full user guide covering the journey from zero hardware to first CSV:

- **Step 0** — CH340 driver install from `wch-ic.com/products/CH340.html` (before any pip command)
- **Step 1** — `pip install -r requirements.txt`
- **Step 2** — Serial port identification for Windows (Device Manager), Linux (`/dev/ttyUSB*`), macOS (`/dev/tty.usbserial*`) with `list_serial_ports.py` as universal fallback
- **Step 3** — Annotated `config.yaml` example with `slave_id: 80` and all settings explained
- **Step 4** — Run `python main.py` with expected terminal output and Ctrl+C stop procedure
- **Output Files** — 18-column CSV table; angle_x/y/z documented as always empty (RESERVED)
- **Troubleshooting** — 12 `### Scenario` headings covering all specified failure modes

### src/sensor.py

Line 35 changed from:
```python
_REG_COUNT = 19      # Reads 0x34 through 0x46 inclusive
```
to:
```python
_REG_COUNT = 0x46 - 0x34 + 1  # = 19; reads 0x34 through 0x46 inclusive
```

## Test Results

Full suite: **64 passed, 0 failed** in 0.63 s

test_docs.py breakdown:
- test_readme_exists: PASSED
- test_readme_ch340_driver: PASSED
- test_readme_serial_port_os_coverage: PASSED
- test_readme_list_serial_ports: PASSED
- test_readme_troubleshooting_count: PASSED (12 scenarios found)
- test_reg_count_arithmetic: PASSED
- test_no_naive_datetime: PASSED
- test_csv_flush_present: PASSED
- test_signed16_on_signed_channels: PASSED

## Deviations from Plan

None — plan executed exactly as written.

## Success Criteria Verification

- DOC-01: README.md Step 0 instructs CH340 driver install from wch-ic.com/products/CH340.html before any Python command. VERIFIED.
- DOC-02: README.md documents Device Manager (Windows), /dev/ttyUSB* (Linux), /dev/tty.usbserial* (macOS), and list_serial_ports.py. VERIFIED.
- DOC-03: README.md contains 12 "### Scenario" troubleshooting headings. VERIFIED.
- Hardening: src/sensor.py _REG_COUNT = 0x46 - 0x34 + 1. VERIFIED.
- Tests: pytest -q --tb=short reports 0 failures (64 passed). VERIFIED.

## Self-Check: PASSED

- README.md exists: FOUND (280 lines)
- src/sensor.py contains "0x46 - 0x34 + 1": FOUND
- Commit 944de97 exists: FOUND
- Commit 3c5ca28 exists: FOUND
