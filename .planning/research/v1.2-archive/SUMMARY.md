# Research Summary: WTVB01 Notebook Logger

**Project:** WTVB01 Notebook Logger
**Synthesized:** 2026-05-19
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Executive Summary

The WTVB01 Notebook Logger is a Windows-first Python application that polls a WitMotion WTVB01-485 vibration sensor over RS-485/Modbus RTU and writes time-series data to CSV for Condition-Based Maintenance (CBM) analysis. The domain is well-understood: Python Modbus RTU acquisition is a solved problem with a clear, minimal stack (pymodbus + pyserial + PyYAML + zoneinfo/tzdata), and the synchronous single-sensor case at 1 Hz is straightforward to implement correctly.

The dominant risk in this project is not architecture. It is a cluster of silent-failure traps at the protocol and data-representation layer. Signed 16-bit conversion errors produce physically plausible but wrong values that survive testing. pymodbus 2.x vs 3.x API confusion causes cryptic TypeErrors. Missing tzdata on Windows causes ZoneInfoNotFoundError at runtime. The CH340 driver must be manually installed before any code runs. All of these pitfalls share one trait: they look like wiring or hardware problems rather than software bugs, making them expensive to diagnose without prior awareness.

The recommended approach is a five-module synchronous architecture (utils, config_loader, sensor, csv_logger, main) built bottom-up in dependency order. The SensorReading dataclass is the central contract that decouples the Modbus layer from all consumers. A callback list in the acquisition loop provides zero-dependency extensibility for future InfluxDB or MQTT sinks. The most important open question -- which blocks correct implementation of 13 out of 17 CSV columns -- is the scale factors for vibration velocity, angle, displacement, and frequency registers. These are not in PROJECT.md and must be sourced from the WitMotion WTVB01-485 datasheet before Phase 2 register parsing can be finalized.

---

## Recommended Stack

Pin all versions exactly. The pymodbus API has shifted within the 3.x series; unpinned upgrades will break code silently.

| Library | Version | Purpose |
|---------|---------|---------|
| Python | 3.9+ (3.8 min) | Runtime |
| pymodbus | **3.13.0** | Modbus RTU over RS-485 |
| pyserial | **3.5** | Serial port enumeration + RTU transport (pulled by pymodbus) |
| PyYAML | **6.0.3** | config.yaml loading |
| zoneinfo | stdlib (3.9+) | America/Sao_Paulo timezone (built-in) |
| backports.zoneinfo | **0.2.1** | zoneinfo backport for Python 3.8 only |
| tzdata | **>=2025.3** | IANA timezone database -- MANDATORY on Windows |
| csv, logging, pathlib | stdlib | Output, logging, paths (built-in) |

**requirements.txt (Python 3.9+):**
```
pymodbus==3.13.0
pyserial==3.5
PyYAML==6.0.3
tzdata>=2025.3
```

**For Python 3.8, add:** `backports.zoneinfo==0.2.1`

**Rejected alternatives:** minimalmodbus (no robust burst reads), pytz (maintenance mode, non-standard `.localize()` API), pandas (30 MB with no collection-time benefit), asyncio client (complexity with no benefit at 1 Hz single-sensor).

---

## Critical Discoveries

These 10 findings MUST influence implementation. Each one has caused real project failures when ignored.

### 1. pymodbus 3.x API break -- all pre-2023 examples are wrong

pymodbus 3.0 (released late 2022) is a ground-up rewrite incompatible with 2.x.

```python
# WRONG (2.x -- do not use)
from pymodbus.client.sync import ModbusSerialClient
client = ModbusSerialClient(method="rtu", port="COM3", baudrate=9600)
result = client.read_holding_registers(address=0x34, count=19, unit=80)

# CORRECT (3.x)
from pymodbus.client import ModbusSerialClient
from pymodbus.framer import FramerType
client = ModbusSerialClient(port="COM3", framer=FramerType.RTU, baudrate=9600, timeout=1)
result = client.read_holding_registers(address=0x34, count=19, slave=80)
```

`unit=` was removed in pymodbus 3.5 (not deprecated -- removed). Pin `pymodbus==3.13.0` and write exclusively to the 3.x API.

### 2. tzdata is mandatory on Windows

Without the `tzdata` package, `ZoneInfo("America/Sao_Paulo")` raises `ZoneInfoNotFoundError` on Windows. Include `tzdata` in requirements.txt unconditionally. Verified working on this machine.

### 3. backports.zoneinfo for Python 3.8

`zoneinfo` is stdlib only from Python 3.9+. Import guard for 3.8 compatibility:

```python
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo
```

### 4. Single burst read -- 0x34 to 0x46 (count=19)

Read all 19 sensor registers in ONE `read_holding_registers` call. Individual per-register reads cost ~570 ms at 9600 baud; a single burst costs ~30 ms.

```python
REG_START = 0x34
REG_END   = 0x46
REG_COUNT = REG_END - REG_START + 1  # = 19 (off-by-one is common -- include last register)
result = client.read_holding_registers(address=REG_START, count=REG_COUNT, slave=80)
```

### 5. Signed 16-bit conversion is the most common data corruption bug

`result.registers` returns unsigned 16-bit ints (0-65535). Negative values (e.g., -1g) are stored as two's complement: 0x8000 = 32768 unsigned. Treating them as unsigned gives +16g instead of -16g. The wrong value looks plausible and survives casual testing.

```python
def to_signed16(value: int) -> int:
    return value if value < 32768 else value - 65536
```

Apply `to_signed16()` to every register before scaling. Unit tests for: 0, 1, 32767, 32768, 65535.
Acceleration scale (confirmed): `signed_16 / 32768 * 16` -> g. All other scales: UNKNOWN (see Discovery 10).

### 6. sensor_id column from day 1, even with 1 sensor

Adding `sensor_id` to the CSV schema costs nothing and prevents a breaking schema migration when a second sensor is added. Configure in config.yaml.

### 7. CH340 driver must be installed manually on Windows before any code runs

The WitMotion cable almost certainly uses a CH340G chip. Windows may install a generic driver with no COM port. Fix: install WCH driver from wch.cn. Correct result in Device Manager: `Ports (COM & LPT) -> USB-SERIAL CH340 (COM3)`. Document as README Step 1 -- before any Python setup.

### 8. Brazil has no DST since 2019 -- America/Sao_Paulo is permanently UTC-3

Use the IANA name `"America/Sao_Paulo"` (not a hardcoded `-03:00` offset) for correct handling of historical pre-2019 data. Never use `datetime.now()` (naive). Always use `datetime.now(ZoneInfo("America/Sao_Paulo"))`.

### 9. CSV flush after every row

At 1 Hz, a crash can lose up to 40 rows from the kernel buffer. Use `buffering=1` (line-buffered):

```python
file = open(path, "a", newline="", encoding="utf-8", buffering=1)
```

`newline=""` is also mandatory to prevent double CRLF on Windows.

### 10. Register scale factors for non-acceleration channels are UNKNOWN -- BLOCKER

| Channel | Registers | Scale | Status |
|---------|-----------|-------|--------|
| Acceleration X/Y/Z | 0x34-0x36 | signed_16 / 32768 * 16 -> g | CONFIRMED |
| Vibration velocity X/Y/Z | 0x3A-0x3C | unknown | NEEDS DATASHEET |
| Angle X/Y/Z | 0x3D-0x3F | unknown | NEEDS DATASHEET |
| Temperature | 0x40 | likely signed_16 / 100 -> C | UNVERIFIED |
| Displacement X/Y/Z | 0x41-0x43 | unknown | NEEDS DATASHEET |
| Frequency X/Y/Z | 0x44-0x46 | unknown | NEEDS DATASHEET |

WitMotion has released multiple firmware versions with different scale factors. Do not guess. On first hardware connection, log raw hex of all 19 registers and verify against known physical state.

---

## Architecture Pattern

Five modules, one-directional data flow, SensorReading as the central contract.

```
config.yaml -> AppConfig [config_loader.py]
    -> WitMotionSensor.read_all() [sensor.py]
        -> SensorReading (dataclass) [utils.py]
            -> acquisition loop [main.py]
                -> CSVLogger.write()    [csv_logger.py]
                -> print_reading()      [main.py]
                -> [future: mqtt, influxdb callbacks]
```

**Component ownership (strict -- crossing these boundaries causes untestable code):**

| Module | Owns | Never touches |
|--------|------|--------------|
| utils.py | SensorReading dataclass, to_signed16(), deep_merge() | No I/O |
| config_loader.py | YAML load, defaults, AppConfig dataclass | No Modbus, no serial |
| sensor.py | Modbus lifecycle, register read, unit conversion | No CSV, no printing |
| csv_logger.py | File open, header, append rows, flush | No Modbus knowledge |
| main.py | Wiring, loop, signal handler, console output | Minimal logic |

**Two timing systems:** `time.monotonic()` for interval sleep (never drifts backward); `datetime.now(ZoneInfo(...))` for CSV timestamps.

**Extension via callback list** (zero dependencies, trivially testable):

```python
consumers = [csv_logger.write, print_reading]
for consumer in consumers:
    try:
        consumer(reading)
    except Exception as e:
        logger.error(f"Consumer {consumer.__name__} failed: {e}")
```

**Build order:** utils.py -> config_loader.py -> sensor.py + csv_logger.py -> main.py -> list_serial_ports.py

---

## Table Stakes Features (12 must-haves for Phase 1)

All 12 must ship together. Partial delivery produces a non-functional logger.

 1. config.yaml loader with validation -- human-readable error on missing/invalid keys; exit code 1 before touching serial
 2. list_serial_ports.py utility -- shows device name, description, VID:PID; built and tested before main logger
 3. Modbus RTU connection -- pymodbus 3.x, FramerType.RTU, slave=80, timeout=1
 4. Single burst register read -- read_holding_registers(0x34, count=19, slave=80)
 5. Signed 16-bit conversion + physical scaling -- to_signed16() applied to all registers; scale factors from datasheet
 6. Timestamped CSV append with flush-per-row -- ISO 8601 with UTC offset, newline="", header once, flush each row
 7. sensor_id column -- configurable in config.yaml, present from first row
 8. Terminal output (one line per sample) -- timestamp, accel X/Y/Z, vib velocity X/Y/Z, temperature, error count
 9. Graceful Ctrl+C shutdown with session summary -- flush CSV, close Modbus, print duration/samples/errors
10. Transient error retry + consecutive error counter -- resets on success; pause after N consecutive failures
11. Rotating file log -- RotatingFileHandler, 5 MB max, 3 backups, DEBUG to file, INFO to console
12. Date-stamped output filenames + auto-create output dir -- wtvb01_2026-05-19.csv

**CBM column naming (non-negotiable for downstream tooling):**

```
timestamp, sensor_id,
accel_x_g, accel_y_g, accel_z_g,
vib_vel_x_mm_s, vib_vel_y_mm_s, vib_vel_z_mm_s,
angle_x_deg, angle_y_deg, angle_z_deg,
temp_c,
disp_x_um, disp_y_um, disp_z_um,
freq_x_hz, freq_y_hz, freq_z_hz
```

Units in column names. No units row. Empty string for failed reads (not "NaN" or "ERROR").

---

## Top Pitfalls to Avoid

Ranked by consequence severity combined with how non-obvious the cause is.

**P1 -- CRITICAL: Signed 16-bit not applied (silent data corruption)**
Symptom: Accelerometer reads ~32g at rest. Temperature reads ~600C. Values look plausible but are wrong.
Prevention: to_signed16() before every scale multiplication. Unit tests for 0, 1, 32767, 32768, 65535.

**P2 -- CRITICAL: pymodbus 2.x API used (crash or wrong-slave communication)**
Symptom: TypeError on "method" or "unit" kwarg, or silent wrong-slave reads.
Prevention: Pin pymodbus==3.13.0. Use correct 3.x imports, framer=FramerType.RTU, slave=80.

**P3 -- CRITICAL: tzdata missing on Windows (runtime error before first read)**
Symptom: ZoneInfoNotFoundError at startup.
Prevention: tzdata in requirements.txt. Verify installed in dev environment.

**P4 -- CRITICAL: Scale factors assumed without datasheet (wrong values for 13/17 columns)**
Symptom: All values read with no Python error, but most physical values are wrong by an unknown factor.
Prevention: Obtain datasheet. Log raw hex on first hardware connection and verify manually.

**P5 -- HIGH: CH340 driver not installed (no COM port appears)**
Symptom: list_serial_ports.py shows nothing. Device Manager shows "USB Serial Device" without COM number.
Prevention: README Step 1 = install WCH CH340 driver from wch.cn before connecting.

**P6 -- HIGH: Slave ID hex/decimal confusion (complete silence from sensor)**
Symptom: Every read times out. Looks like wiring or baud rate problem.
Prevention: config.yaml uses slave_id: 80 with comment # 0x50 hex. Startup log prints both.

**P7 -- HIGH: CSV buffer not flushed on crash (data loss up to 40 rows)**
Symptom: Last N rows missing from CSV after power loss or process kill.
Prevention: buffering=1 on file open. newline="" always.

**P8 -- MEDIUM: Naive timestamps in CSV (useless for CBM correlation)**
Symptom: CSV timestamps have no timezone suffix.
Prevention: datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat() -- never datetime.now().

**P9 -- MEDIUM: Duplicate CSV header on restart (breaks pd.read_csv)**
Symptom: Header row appears multiple times in the middle of the data file.
Prevention: Check path.stat().st_size == 0 after opening in append mode before writing header.

**P10 -- MEDIUM: Register count off-by-one (last channel always missing)**
Symptom: freq_z column always empty. No error raised. 18 registers read instead of 19.
Prevention: REG_COUNT = 0x46 - 0x34 + 1  # = 19  -- define as named constant.

---

## Implications for Roadmap

### Suggested Phase Structure

**Phase 0: Hardware Setup (pre-code)**
Rationale: All subsequent phases fail if the physical layer is not working.
Deliverables: confirmed COM port; confirmed scale factors table from datasheet.
Tasks: install CH340 driver; connect 12V power; run list_serial_ports.py; obtain WitMotion datasheet.

**Phase 1: Foundation Modules (no hardware needed)**
Rationale: utils.py and config_loader.py have zero I/O dependencies; validate logic before hardware.
Deliverables: utils.py, config_loader.py, list_serial_ports.py; unit tests passing on Python 3.8+.
Pitfalls to avoid: Python 3.8 compatibility (typing.List, backports.zoneinfo import guard).

**Phase 2: Modbus Communication Layer**
Rationale: Validate hardware communication in isolation before building the acquisition loop.
Deliverables: sensor.py; confirmed scale factors from live hardware; raw hex log of all 19 registers.
Pitfalls to avoid: 2.x API, unit= parameter, FC04 vs FC03, RS-485 timing (timeout=1), burst vs individual reads.

**Phase 3: Data Output Layer**
Rationale: Finalize CSV schema and logging before connecting to acquisition loop.
Deliverables: csv_logger.py; logging setup; final column list with sensor_id.
Pitfalls to avoid: newline="" on Windows, naive timestamps, buffer not flushed, duplicate headers.

**Phase 4: Integration -- Acquisition Loop**
Rationale: Wire all modules only after each is individually validated.
Deliverables: main.py; 60-second end-to-end run with verified CSV output.
Pitfalls to avoid: monotonic timer for interval, KeyboardInterrupt handling, per-consumer error isolation.

**Phase 5: Hardening and Validation**
Rationale: Production-readiness beyond basic functionality.
Deliverables: reconnect-on-port-loss; unit test suite; README with troubleshooting guide.
Defer: InfluxDB/MQTT exporter, multi-sensor, signal analysis, dashboard.

### Research Flags

| Phase | Needs deeper research | Reason |
|-------|----------------------|--------|
| Phase 0 | YES -- datasheet retrieval | Scale factors for 13/17 columns are unknown. Highest-priority open item. |
| Phase 1 | No | Python stdlib patterns are fully documented |
| Phase 2 | Conditional | If first hardware connection produces unexpected results, pause and verify register map |
| Phase 3 | No | csv + logging patterns are fully documented |
| Phase 4 | No | pymodbus 3.x synchronous acquisition loop is a solved pattern |
| Phase 5 | Maybe | Reconnect recovery has WitMotion-specific quirks; may require empirical testing |

---

## Confidence Assessment

| Area | Confidence | Key Caveat |
|------|------------|-----------|
| pymodbus 3.13.0 version | HIGH | Live PyPI query confirmed |
| pymodbus 3.x API (imports, constructor, slave=) | HIGH | FramerType.RTU available in 3.5+; verify import path in 3.13.0 |
| pyserial 3.5, PyYAML 6.0.3 | HIGH | Live PyPI query confirmed |
| tzdata mandatory on Windows | HIGH | Verified working on this machine |
| zoneinfo / backports.zoneinfo pattern | HIGH | Python stdlib docs |
| csv newline="" on Windows | HIGH | Python csv module docs |
| Signed 16-bit conversion | HIGH | Apply to ALL registers before scaling |
| Acceleration scale (signed_16 / 32768 * 16 -> g) | HIGH | Confirmed in PROJECT.md |
| Vibration vel, angle, displacement, freq scales | LOW | BLOCKER -- must get datasheet |
| Single burst read (0x34, count=19) | HIGH | Modbus RTU best practice + WitMotion class patterns |
| WitMotion slave ID = 80 (0x50) | HIGH | Documented in PROJECT.md |
| CH340 driver requirement | HIGH | Standard hardware pattern |
| Brazil DST abolished 2019, permanent UTC-3 | HIGH | Government decree 9.772/2019 |
| ISO 10816 vibration alarm thresholds | MEDIUM | Standard is paywalled; secondary sources only |
| WitMotion firmware quirks | MEDIUM | Device class patterns; verify empirically on physical unit |

**Overall:** HIGH for architecture and stack. LOW for non-acceleration register scales -- the only genuine implementation blocker.

---

## Open Questions / Blockers

### BLOCKER: Scale factors for non-acceleration channels

Must be resolved before Phase 2 register parsing can be finalized.

Priority order for resolution:
1. WitMotion WTVB01-485 datasheet PDF (request from WitMotion or locate in product package)
2. WitMotion GitHub repositories (some models have open register maps)
3. Empirical validation: sensor at rest on flat surface -- accel_z ~= 1.0g, accel_x ~= 0.0g, temp ~= ambient room temperature

Interim approach: in Phase 2, log raw signed_16 values alongside tentative physical values before committing to scale constants.

### SHOULD CONFIRM: USB chip model on WitMotion cable

Verify CH340G vs CP2102 vs FTDI. Run `list_serial_ports.py` with hwid output and look for VID:PID 1A86:7523 (CH340), 10C4:EA60 (CP210x), or 0403:6001 (FTDI).

### SHOULD CONFIRM: pymodbus 3.13.0 FramerType import path

Verify before Phase 2: `from pymodbus.framer import FramerType` should work in 3.13.0. If not available, `framer="rtu"` is accepted with a deprecation warning as fallback.

### NICE TO HAVE: Effective minimum polling interval on Windows

Windows timer resolution defaults to 15.6 ms. Measure actual achieved interval at `sample_interval_s=0.1` empirically during Phase 2 hardware validation and document in config.yaml comments.

---

## Sources

All findings based on training data (knowledge cutoff August 2025) except PyPI version queries executed live on 2026-05-19.

| Source | Confidence |
|--------|-----------|
| PyPI live queries (pymodbus, pyserial, PyYAML, tzdata, backports.zoneinfo) | HIGH -- confirmed on this machine |
| pymodbus 3.x documentation and changelog | HIGH -- changelog not directly fetched (WebFetch unavailable during research) |
| Python stdlib docs (csv, logging, zoneinfo, pathlib, dataclasses) | HIGH |
| Modbus RTU specification (Modbus.org) | HIGH |
| WitMotion WTVB01-485 register map in PROJECT.md | HIGH (acceleration scale only) / LOW (all other channels) |
| ISO 10816 / ISO 20816 vibration alarm thresholds | MEDIUM -- paywalled standard, secondary sources used |
| Windows serial port / CH340 driver behavior | HIGH |
| Brazil DST abolition (Decree 9.772/2019) | HIGH |
