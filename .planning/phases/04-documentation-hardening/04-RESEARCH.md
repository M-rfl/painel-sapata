# Phase 4: Documentation & Hardening - Research

**Researched:** 2026-05-21
**Domain:** Technical writing (README), code correctness review
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-01 | README.md with installation instructions (pip install -r requirements.txt) for Windows, Linux, macOS — Step 0: CH340 driver install from wch.cn before any hardware connection | CH340 driver URL confirmed; three-OS install pattern documented below |
| DOC-02 | README.md covers serial port identification for all three OS and list_serial_ports.py usage | list_serial_ports.py already handles all three OS; Windows Device Manager path, Linux dialout group, macOS tty.usbserial patterns confirmed from existing code |
| DOC-03 | README.md troubleshooting section with all 12 specified scenarios | All 12 scenarios mapped to root cause + fix; see Troubleshooting Coverage section |
</phase_requirements>

---

## Summary

Phase 4 has two distinct workstreams: (1) writing README.md from scratch and (2) a targeted code review against four specific correctness criteria. The codebase was inspected against all four hardening criteria and the findings are definitive — three pass cleanly, one requires a one-line fix.

The README must be written entirely from scratch; no README.md exists yet. All content for it is available in the existing source code, config.yaml, list_serial_ports.py, and the requirements.txt. The troubleshooting section is the most time-consuming part: 12 scenarios must be addressed with root cause, symptoms, and step-by-step resolution.

The code review is straightforward: three of four criteria pass as-is; the sole gap is that `_REG_COUNT = 19` in sensor.py should express the value as `0x46 - 0x34 + 1` (= 19) to make the register range self-documenting and reduce the risk of off-by-one errors if the range ever changes.

**Primary recommendation:** Write README.md in a single plan (one wave), then run the code-review checklist as a second task in the same plan. The README is the deliverable; the code review is a verification step that produces at most one one-line patch.

---

## Codebase State (Code Review Pre-Flight)

This section documents the results of the four hardening checks against the live codebase so the planner does not need to re-inspect.

### Check 1: to_signed16() applied before every scale factor

**Status: PASS — no fix needed**

In `src/sensor.py _parse_registers()`:
- `ax_g = to_signed16(regs[0]) * SCALE_ACC` (line 209)
- `ay_g = to_signed16(regs[1]) * SCALE_ACC` (line 210)
- `az_g = to_signed16(regs[2]) * SCALE_ACC` (line 211)
- `temperature_c = to_signed16(regs[12]) * SCALE_TEMP` (line 224)

Velocity (`regs[6-8]`), displacement (`regs[13-15]`), and frequency (`regs[16-18]`) correctly do NOT use `to_signed16()` because they are unsigned magnitudes per the manual.

### Check 2: flush() or buffering=1 on every CSV write

**Status: PASS — no fix needed**

In `src/csv_logger.py`:
- `self._file.flush()` on line 79 — after header write
- `self._file.flush()` on line 119 — after every `writerow()` call

The file is opened with standard `open()` (no `buffering=` arg), but explicit `flush()` after every write fully satisfies the requirement. The success criterion explicitly permits "buffering=1 OR explicit flush()".

### Check 3: No naive datetime.now() calls

**Status: PASS — no fix needed**

Two `datetime.now()` calls exist in `src/`:
- `utils.py:80` — `datetime.now(tz=TZ_SAO_PAULO).isoformat()` — timezone-aware
- `csv_logger.py:72` — `datetime.now(tz=TZ_SAO_PAULO).strftime(...)` — timezone-aware

Neither is naive. Both pass `tz=TZ_SAO_PAULO`.

### Check 4: REG_COUNT defined as named constant using register arithmetic

**Status: NEEDS ONE-LINE FIX**

Current code (`src/sensor.py`, line 35):
```python
_REG_COUNT = 19      # Reads 0x34 through 0x46 inclusive
```

Required form:
```python
_REG_COUNT = 0x46 - 0x34 + 1  # = 19; reads 0x34 through 0x46 inclusive
```

The value is correct (19), but the self-documenting arithmetic form is required by the success criterion. This is a one-line change with no risk of regression — the constant is only used once, in the `read_holding_registers` call on line 145.

---

## README Structure

The README must guide a Windows-naive user from zero hardware to first CSV. The structure below is prescriptive — the planner should follow this order.

### Required Sections and Content

**Section order (top to bottom):**

1. **Title + one-line description** — "WTVB01 Notebook Logger — Modbus RTU data logger for WitMotion WTVB01-485 vibration sensor"

2. **Hardware prerequisites** (before any install steps)
   - WitMotion WTVB01-485 sensor
   - USB-RS485 adapter with WCH CH340 chip (the adapter that ships with the sensor)
   - RS-485 A/B wiring to sensor

3. **Step 0: Install CH340 driver (Windows only)**
   - This MUST come before `pip install`. A Windows user who plugs in the adapter before installing the driver gets a "USB Serial Device" in Device Manager with no COM port.
   - URL: https://www.wch-ic.com/products/CH340.html (official WCH download page)
   - Instruction: Download the latest Windows driver zip, run `SETUP.EXE`, restart if prompted, then plug in the adapter.
   - Verification: Device Manager > Ports (COM & LPT) should show "USB-SERIAL CH340 (COM3)" or similar.

4. **Step 1: Install Python dependencies**
   ```
   pip install -r requirements.txt
   ```
   - Note: on Windows, `pip` may need to be `py -m pip` or `python -m pip`
   - Note: `tzdata` is mandatory on Windows; it is in requirements.txt

5. **Step 2: Identify serial port**
   - Windows: Device Manager > Ports (COM & LPT) — look for "USB-SERIAL CH340 (COM3)"
   - Linux: `ls /dev/ttyUSB*` — look for `/dev/ttyUSB0`
   - macOS: `ls /dev/tty.usbserial*` — look for `/dev/tty.usbserial-...` or `/dev/tty.wchusbserial*`
   - Or run: `python list_serial_ports.py` (lists all ports with device description)

6. **Step 3: Configure config.yaml**
   - Set `serial_port:` to the port found in Step 2
   - All other fields have sensible defaults (baudrate: 9600, slave_id: 80)
   - Show the annotated config.yaml example

7. **Step 4: Run the logger**
   ```
   python main.py
   ```
   - Expected output: connection message, CSV path, then one line per sample
   - Stop with Ctrl+C; session summary prints

8. **Output files**
   - CSV written to `data/wtvb01_YYYYMMDD_HHMMSS.csv`
   - 18 columns: timestamp, ax_g, ay_g, az_g, vx_mm_s, vy_mm_s, vz_mm_s, angle_x (always empty), angle_y (always empty), angle_z (always empty), temperature_c, dx_um, dy_um, dz_um, freq_x_hz, freq_y_hz, freq_z_hz, sensor_id

9. **Troubleshooting** (see full coverage below)

---

## Troubleshooting Coverage

All 12 required scenarios, with root cause and resolution for each:

### Scenario 1: Sensor not responding (consecutive read errors in terminal)
- **Symptoms:** "[WARN] Read failed — retrying..." repeats; no data in CSV
- **Root cause:** Wiring problem, wrong slave ID, or wrong baud rate
- **Fix:** Check A/B wiring polarity first; verify `slave_id: 80` and `baudrate: 9600` in config.yaml; test with WitMotion software (see Scenario 12)

### Scenario 2: COM port not found / config error at startup
- **Symptoms:** `[config error] serial_port is required` or `Cannot connect to COMx`
- **Root cause:** COM port not set in config.yaml, or wrong port number
- **Fix:** Run `python list_serial_ports.py` to see available ports; update `serial_port:` in config.yaml

### Scenario 3: Port busy / "Access is denied" on Windows
- **Symptoms:** `Cannot connect to COM3` immediately after a previous run, or when another application has the port open
- **Root cause:** Only one process can hold a serial port at a time on Windows
- **Fix:** Close any other serial terminal, WitMotion software, or previous Python process; check Task Manager for zombie Python processes

### Scenario 4: Permission error (Linux/macOS)
- **Symptoms:** `[Errno 13] Permission denied: '/dev/ttyUSB0'`
- **Root cause:** User is not in the `dialout` group (Linux) or `uucp` group (macOS)
- **Fix (Linux):** `sudo usermod -aG dialout $USER` then log out and back in
- **Fix (macOS):** Usually not required; if it occurs, `sudo chmod a+rw /dev/tty.usbserial-*` as a temporary workaround

### Scenario 5: Zero values on all channels
- **Symptoms:** All CSV fields read 0.0; no errors in terminal
- **Root cause:** Sensor is responding but returning register values of 0 — may indicate wrong slave ID (different sensor on bus) or sensor is powered but not vibrating (some channels legitimately read 0 at rest)
- **Fix:** Confirm `slave_id: 80` in config.yaml; accelerometer az_g should read ~1.0 g with sensor at rest — if it reads exactly 0.0, the slave ID is wrong

### Scenario 6: A/B inversion (Modbus errors, no data)
- **Symptoms:** Constant read errors despite correct port and slave ID; adapter shows TX/RX LED activity but no valid responses
- **Root cause:** RS-485 A and B terminals are swapped
- **Fix:** Swap the two wires at either the sensor terminal or the adapter terminal; RS-485 is polarity-sensitive

### Scenario 7: Wrong baud rate
- **Symptoms:** Consistent read errors; adapter LEDs blink but no valid Modbus frames
- **Root cause:** `baudrate:` in config.yaml does not match the sensor configuration (factory default is 9600)
- **Fix:** Set `baudrate: 9600` in config.yaml; if the sensor was previously reconfigured, use WitMotion software to check

### Scenario 8: Wrong slave ID
- **Symptoms:** Modbus exception or "Device error response" in logs; all channels read 0 or get error responses
- **Root cause:** `slave_id:` in config.yaml does not match sensor configuration (factory default is 80 = 0x50)
- **Fix:** Set `slave_id: 80` in config.yaml; WTVB01-485 factory default is 80 decimal

### Scenario 9: USB-RS485 driver not installed
- **Symptoms (Windows):** Device Manager shows "USB Serial Device" or "Unknown Device" under "Other devices" — no COM port assigned
- **Root cause:** WCH CH340 driver not installed
- **Fix:** Download and install driver from https://www.wch-ic.com/products/CH340.html; reconnect adapter; verify COM port appears in Device Manager

### Scenario 10: COM3 vs COM4 confusion (adapter appears on different port after replug)
- **Symptoms:** Logger worked yesterday on COM3; today `python list_serial_ports.py` shows COM4
- **Root cause:** Windows assigns COM port numbers based on USB port; using a different USB port gives a different number
- **Fix:** Always plug into the same USB port; or update `serial_port:` in config.yaml; run `python list_serial_ports.py` after every replug to confirm

### Scenario 11: Wrong slave ID — specifically the 0x50 vs 80 confusion
- **Note:** This is addressed in Scenario 8 above but deserves explicit mention in the README because it is a common mistake — some documentation shows the slave address as "0x50" (hex) but config.yaml expects a decimal integer.
- **Fix:** `slave_id: 80` in config.yaml (not `slave_id: "0x50"` — YAML strings are not parsed as hex)

### Scenario 12: How to test with WitMotion software before Python
- **Purpose:** Verifies the physical hardware chain (wiring, power, driver) independently of the Python code
- **Tool:** WitMotion provides "WTRTK232" or "WitMotion Serial Debug Assistant" software (Windows only)
- **URL:** https://github.com/WITMOTION/WitStandardProtocol_JY61/tree/master or search "WitMotion software download" on witmotion.hk
- **Steps:**
  1. Install WitMotion software
  2. Select COM port and baud rate 9600
  3. If sensor registers appear in the software, hardware is confirmed good
  4. If not, check wiring, driver, and slave ID in the WitMotion software settings before debugging Python

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Serial port enumeration | Custom port scanner | `pyserial serial.tools.list_ports` (already used in list_serial_ports.py) | Handles all OS, VID:PID, descriptions |
| Markdown formatting | Custom renderer | Plain markdown — GitHub renders automatically | No added tooling needed |
| README versioning | Custom changelog | Git history is the changelog | Unnecessary complexity |

---

## Common Pitfalls (for README writing)

### Pitfall 1: Step 0 placed after pip install
**What goes wrong:** Windows users install packages first, plug in the adapter, get no COM port, and spend an hour debugging pyserial before realising the driver is missing.
**Prevention:** CH340 driver install is Step 0 — explicitly before any Python command.

### Pitfall 2: Assuming macOS path is /dev/ttyUSB*
**What goes wrong:** Linux uses `/dev/ttyUSB*`; macOS uses `/dev/tty.usbserial-*` or `/dev/tty.wchusbserial*`. Mixing them up leaves macOS users stuck.
**Prevention:** Three separate OS-specific commands in the port identification section.

### Pitfall 3: slave_id documented in hex
**What goes wrong:** User sets `slave_id: "0x50"` (a string) in config.yaml; validator rejects it because it expects an integer.
**Prevention:** Always show `slave_id: 80` in all examples; note in troubleshooting that "0x50" is wrong YAML.

### Pitfall 4: Missing dialout group instruction for Linux
**What goes wrong:** User gets `Permission denied` on `/dev/ttyUSB0`; they try `sudo python main.py` which is an antipattern.
**Prevention:** Explicit `sudo usermod -aG dialout $USER` instruction with "log out and back in" note.

### Pitfall 5: angle_x/y/z columns always empty — users think it's broken
**What goes wrong:** User opens CSV, sees three empty columns, and thinks the logger is broken.
**Prevention:** README explains that registers 0x3D-0x3F are RESERVED on the WTVB01-485; angle columns are always empty for this sensor model.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest >= 7.0 |
| Config file | pytest.ini (exists at project root) |
| Quick run command | `pytest -q --tb=short` |
| Full suite command | `pytest -q --tb=short` (same — all tests in tests/) |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | README.md file exists and contains CH340 driver URL | smoke | `pytest tests/test_docs.py::test_readme_exists -x` | Wave 0 |
| DOC-01 | README.md Step 0 mentions wch-ic.com/products/CH340.html | content | `pytest tests/test_docs.py::test_readme_ch340_driver -x` | Wave 0 |
| DOC-02 | README.md mentions Device Manager, /dev/ttyUSB*, /dev/tty.usbserial* | content | `pytest tests/test_docs.py::test_readme_serial_port_os_coverage -x` | Wave 0 |
| DOC-02 | README.md mentions list_serial_ports.py | content | `pytest tests/test_docs.py::test_readme_list_serial_ports -x` | Wave 0 |
| DOC-03 | README.md troubleshooting section has at least 12 headings | content | `pytest tests/test_docs.py::test_readme_troubleshooting_count -x` | Wave 0 |
| DOC-03 | Hardening: _REG_COUNT expressed as register arithmetic | unit | `pytest tests/test_docs.py::test_reg_count_arithmetic -x` | Wave 0 |
| DOC-03 | Hardening: all datetime.now() calls are timezone-aware | unit | `pytest tests/test_docs.py::test_no_naive_datetime -x` | Wave 0 |
| DOC-03 | Hardening: csv_logger flushes after every write | unit | `pytest tests/test_docs.py::test_csv_flush_present -x` | Wave 0 |
| DOC-03 | Hardening: to_signed16 applied to acceleration and temperature | unit | `pytest tests/test_docs.py::test_signed16_on_signed_channels -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest -q --tb=short`
- **Per wave merge:** `pytest -q --tb=short`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_docs.py` — covers DOC-01, DOC-02, DOC-03 content checks and all 4 hardening assertions

---

## Sources

### Primary (HIGH confidence)
- Live codebase inspection — `src/sensor.py`, `src/csv_logger.py`, `src/utils.py`, `src/config_loader.py`, `main.py`, `list_serial_ports.py`, `config.yaml`, `requirements.txt`
- `.planning/REQUIREMENTS.md` — DOC-01, DOC-02, DOC-03 exact text
- `.planning/ROADMAP.md` — Phase 4 success criteria (4 code-review checks + 3 README checks)

### Secondary (MEDIUM confidence)
- WCH CH340 driver URL: https://www.wch-ic.com/products/CH340.html — cited in existing list_serial_ports.py comment (line 14), consistent with WCH official product page
- WTVB01-485 manual references — cross-confirmed from sensor.py inline comments citing manual V251216 sections (§6.4.5 through §6.4.10)

### Tertiary (LOW confidence)
- WitMotion software download location — "WTRTK232" or serial debug assistant; URL to official repository mentioned but not independently verified in this session; planner should include a note that the exact software name may vary

---

## Metadata

**Confidence breakdown:**
- Code review findings: HIGH — based on direct source code inspection, findings are definitive
- README content requirements: HIGH — requirements are exact and enumerable (DOC-01/02/03 are fully specified)
- Troubleshooting scenarios: HIGH — all 12 are explicitly listed in REQUIREMENTS.md; root causes derived from project's own code and decisions log
- WitMotion software URL: LOW — cited from partial evidence; planner should add a note to verify

**Research date:** 2026-05-21
**Valid until:** Until codebase changes — code-review findings reflect snapshot at this date
