# Phase 2: Sensor Layer - Research

**Researched:** 2026-05-21
**Domain:** pymodbus 3.13.0 RTU client, WitMotion WTVB01-485 register map, hardware-free unit testing with mocks
**Confidence:** HIGH for pymodbus API (live source inspection on installed 3.13.0); MEDIUM for non-acceleration register scale factors (not publicly indexed — datasheet must be obtained at first hardware session)

---

## Summary

Phase 2 implements `src/sensor.py` — the `WitMotionSensor` class that opens a Modbus RTU connection, reads 19 registers in a single burst call (address `0x34`, count `19`), converts them to physical units, and handles transient communication errors gracefully. The class exposes one public method: `read_all_data()`, which returns a fully-populated `SensorReading` dataclass imported from `src/utils.py`.

The most critical research finding is a **direct conflict between the phase success criteria and the installed pymodbus 3.13.0 API**: the criteria specify `slave=80` in Modbus calls, but pymodbus 3.13.0 removed `slave=` at version 3.10.0 and replaced it with `device_id=`. Using `slave=` raises `TypeError: read_holding_registers() got an unexpected keyword argument 'slave'`. The correct call in 3.13.0 is `device_id=80`. The planner must choose one of the two resolution paths documented below.

The second major finding is that scale factors for the non-acceleration channels (velocity, angle, displacement, frequency, temperature) are **not publicly indexed** and must be confirmed from the physical WitMotion WTVB01-485 datasheet or protocol PDF before those conversions can be implemented. Acceleration is confirmed from the REQUIREMENTS.md itself: `signed_16 / 32768 * 16` → g. Placeholder formulas derived from product-page specs and sensor physics are provided with LOW confidence.

Testing without hardware is fully achievable using `unittest.mock.MagicMock` to patch `ModbusSerialClient`. All success criteria except the final one ("~1.0 g on Z with sensor resting flat") require only mock-based unit tests. The Z-axis gravity confirmation requires live hardware.

**Primary recommendation:** Implement `WitMotionSensor` using `device_id=80` (the correct 3.13.0 API), and acknowledge the `slave=80` criterion as a documentation artifact from the 3.5 era. Read the datasheet registers table before finalising non-acceleration scale factors.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONN-01 | Connect to WTVB01-485 via Modbus RTU on configured serial port | `ModbusSerialClient(port, framer=FramerType.RTU, baudrate=9600)` + `client.connect()` → bool |
| CONN-03 | Transient communication failures logged as warning; process does not exit; consecutive failure counter tracked | `try/except ModbusException` + `response.isError()` pattern; consecutive counter in class state |
| ACQ-01 | Read all 19 registers (0x34–0x46) in a single burst call per cycle | `client.read_holding_registers(0x34, count=19, device_id=80)` → `response.registers` list of 19 ints |
| ACQ-02 | Acceleration X/Y/Z: `signed_16 / 32768 * 16` → g | `to_signed16(reg) / 32768 * 16`; uses existing `to_signed16()` from `src/utils.py` |
| ACQ-03 | Vibration velocity X/Y/Z (registers 0x3A–0x3C) → mm/s | Scale factor UNKNOWN — must confirm from datasheet; placeholder: raw register value as mm/s (LOW confidence) |
| ACQ-04 | Vibration angle X/Y/Z (registers 0x3D–0x3F) → degrees | Scale factor UNKNOWN — must confirm from datasheet (LOW confidence) |
| ACQ-05 | Temperature (register 0x40) → °C | Scale factor UNKNOWN — commonly `signed_16 / 100` for WitMotion sensors (LOW confidence) |
| ACQ-06 | Displacement X/Y/Z (registers 0x41–0x43) → µm | Scale factor UNKNOWN — must confirm from datasheet; product page range 0–30,000 µm (LOW confidence) |
| ACQ-07 | Frequency X/Y/Z (registers 0x44–0x46) → Hz | Scale factor UNKNOWN — product page range 1–100 Hz (LOW confidence) |
| ACQ-08 | Signed 16-bit conversion correct; no ~32 g anomaly | `to_signed16()` already in `utils.py` and tested; must apply to ALL register reads before multiplication |
| ACQ-09 | `WitMotionSensor.read_all_data()` returns `SensorReading` dataclass with all 17 physical fields | `SensorReading` already defined in `utils.py`; all Optional[float] fields populated or set to None on error |
</phase_requirements>

---

## CRITICAL: pymodbus 3.13.0 API Conflict

**The phase success criteria specify `slave=80` but this parameter does not exist in pymodbus 3.13.0.**

### Confirmed Facts (live source inspection on installed 3.13.0)

```python
# Verified: read_holding_registers signature in pymodbus 3.13.0
(self, address: int, *, count: int = 1, device_id: int = 1, no_response_expected: bool = False) -> T
```

- `slave=` was removed at pymodbus **3.10.0** (changelog entry: "Change slave to device_id", PR #2600)
- `unit=` was removed earlier at **3.5.0**
- In 3.13.0: `client.read_holding_registers(0x34, count=19, slave=80)` raises `TypeError`
- The correct call is: `client.read_holding_registers(0x34, count=19, device_id=80)`

### Resolution Options for Planner

| Option | Approach | Implication |
|--------|----------|-------------|
| A (RECOMMENDED) | Use `device_id=80` in all Modbus calls | Correct 3.13.0 API; success criterion "no `unit=` anywhere" is satisfied; `slave=` criterion is a documentation artifact |
| B | Downgrade pymodbus to 3.5.x where `slave=` exists | Breaks pinned `pymodbus==3.13.0` in requirements.txt; introduces instability |

**The planner MUST choose Option A.** The success criterion "no `unit=`" is honoured. The `slave=80` criterion should be interpreted as "use the current API's device identifier parameter" = `device_id=80`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pymodbus | 3.13.0 (pinned) | Modbus RTU client — connect, read registers | Only maintained Python Modbus library; 3.x API is stable |
| pyserial | >=3.5 (pinned) | Serial port transport used by pymodbus internally | pymodbus depends on it; already in requirements.txt |
| src.utils.to_signed16 | (project) | Two's complement conversion for every register | Already implemented and tested in Phase 1 |
| src.utils.SensorReading | (project) | Return type of read_all_data() | Already defined in utils.py; all 17 fields present |
| unittest.mock | stdlib | Patch ModbusSerialClient in unit tests | No hardware needed for 95% of tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| logging | stdlib | Log warnings on transient errors, log consecutive count | Every Modbus exception and error response |
| dataclasses | stdlib | SensorReading already uses it | Do not redefine — import from utils |
| pytest | >=7.0 | Test runner | All sensor tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `unittest.mock.MagicMock` | `pytest-mock` `mocker` fixture | Both work; `unittest.mock` has zero additional dependency |
| `ModbusSerialClient` | `AsyncModbusSerialClient` | Async adds complexity with no benefit in a polling loop |

**Installation:** Already installed. No new packages required for Phase 2.

---

## Architecture Patterns

### Recommended Project Structure Addition

```
src/
├── sensor.py          # Phase 2 — WitMotionSensor class (replaces stub)
tests/
├── test_sensor.py     # Phase 2 — mock-based unit tests for WitMotionSensor
```

### Pattern 1: WitMotionSensor Class Structure

**What:** A class that wraps `ModbusSerialClient`, provides `connect()`, `close()`, and `read_all_data()` methods, tracks consecutive failures, and returns `SensorReading`.

**When to use:** Instantiated once in `main.py` (Phase 3); `read_all_data()` called in polling loop.

```python
# src/sensor.py
# Source: pymodbus 3.13.0 live API inspection + project utils.py
import logging
from pymodbus import FramerType, ModbusException
from pymodbus.client import ModbusSerialClient
from src.utils import SensorReading, to_signed16, get_timestamp_br

logger = logging.getLogger(__name__)

_REG_START = 0x34   # first register in burst
_REG_COUNT = 19     # 0x34 through 0x46 inclusive

class WitMotionSensor:
    def __init__(self, config):
        self._config = config
        self._client: ModbusSerialClient | None = None
        self._consecutive_errors = 0

    def connect(self) -> bool:
        self._client = ModbusSerialClient(
            self._config.serial_port,
            framer=FramerType.RTU,
            baudrate=self._config.baudrate,
            bytesize=8,
            parity="N",
            stopbits=1,
            timeout=3,
        )
        return self._client.connect()

    def close(self) -> None:
        if self._client:
            self._client.close()

    def read_all_data(self) -> SensorReading | None:
        ...
```

### Pattern 2: Burst Read with device_id (pymodbus 3.13.0 API)

**What:** Single Modbus RTU call reading 19 consecutive registers.

**When to use:** Once per poll cycle; replaces any multi-call approaches.

```python
# Source: pymodbus 3.13.0 live source inspection
# read_holding_registers(address, *, count, device_id, no_response_expected)
response = self._client.read_holding_registers(
    _REG_START,               # 0x34
    count=_REG_COUNT,         # 19
    device_id=self._config.slave_id,  # 80 (from config)
)
```

### Pattern 3: Two-Level Error Handling

**What:** Catch `ModbusException` (library exception) AND check `response.isError()` (device-level Modbus error). Both paths increment consecutive counter and log warning.

**When to use:** Wraps every `read_holding_registers` call.

```python
# Source: pymodbus 3.13.0 exception hierarchy (live inspection)
# ModbusException — base; ModbusIOException (timeout, CRC) subclass; ConnectionException subclass
try:
    response = self._client.read_holding_registers(
        _REG_START, count=_REG_COUNT, device_id=self._config.slave_id
    )
except ModbusException as exc:
    self._consecutive_errors += 1
    logger.warning(
        "Modbus exception (consecutive=%d): %s", self._consecutive_errors, exc
    )
    return None

if response.isError():
    self._consecutive_errors += 1
    logger.warning(
        "Device error response (consecutive=%d): %s",
        self._consecutive_errors, response
    )
    return None

# success
self._consecutive_errors = 0
regs = response.registers   # list of 19 unsigned ints
```

### Pattern 4: Register Extraction and Conversion

**What:** Index into `response.registers` list using offset from `_REG_START` (0x34 = 52 decimal). Apply `to_signed16()` before any multiplication.

**When to use:** After a successful burst read.

```python
# Register offsets (0-based from index 0 = address 0x34)
# Source: REQUIREMENTS.md register map + to_signed16() from utils.py
regs = response.registers  # [reg0x34, reg0x35, ..., reg0x46]

ax_g      = to_signed16(regs[0])  / 32768 * 16   # 0x34 ACQ-02
ay_g      = to_signed16(regs[1])  / 32768 * 16   # 0x35 ACQ-02
az_g      = to_signed16(regs[2])  / 32768 * 16   # 0x36 ACQ-02
# regs[3..5] = 0x37, 0x38, 0x39 — SKIPPED (angular velocity, not in SensorReading)
vx_mm_s   = to_signed16(regs[6])  * SCALE_VEL    # 0x3A ACQ-03 SCALE_VEL=TBD
vy_mm_s   = to_signed16(regs[7])  * SCALE_VEL    # 0x3B ACQ-03
vz_mm_s   = to_signed16(regs[8])  * SCALE_VEL    # 0x3C ACQ-03
angle_x   = to_signed16(regs[9])  * SCALE_ANGLE  # 0x3D ACQ-04 SCALE_ANGLE=TBD
angle_y   = to_signed16(regs[10]) * SCALE_ANGLE  # 0x3E ACQ-04
angle_z   = to_signed16(regs[11]) * SCALE_ANGLE  # 0x3F ACQ-04
temperature_c = to_signed16(regs[12]) * SCALE_TEMP  # 0x40 ACQ-05 SCALE_TEMP=TBD
dx_um     = to_signed16(regs[13]) * SCALE_DISP   # 0x41 ACQ-06 SCALE_DISP=TBD
dy_um     = to_signed16(regs[14]) * SCALE_DISP   # 0x42 ACQ-06
dz_um     = to_signed16(regs[15]) * SCALE_DISP   # 0x43 ACQ-06
freq_x_hz = to_signed16(regs[16]) * SCALE_FREQ   # 0x44 ACQ-07 SCALE_FREQ=TBD
freq_y_hz = to_signed16(regs[17]) * SCALE_FREQ   # 0x45 ACQ-07
freq_z_hz = to_signed16(regs[18]) * SCALE_FREQ   # 0x46 ACQ-07
```

**IMPORTANT NOTE on register 0x37–0x39:** The burst reads 19 registers starting at 0x34, which includes 0x37, 0x38, 0x39 (angular velocity — 3 registers not in SensorReading). These are skipped (offsets 3, 4, 5 in the list). Velocity starts at offset 6.

### Pattern 5: Consecutive Error Counter with Pause

**What:** After N consecutive failures, log a summary and pause to avoid tight error loops. Reset counter on success.

```python
_MAX_CONSECUTIVE_ERRORS = 5  # configurable constant

if self._consecutive_errors >= _MAX_CONSECUTIVE_ERRORS:
    logger.error(
        "Sensor: %d consecutive errors — pausing 5s before retry",
        self._consecutive_errors,
    )
    # caller (main.py) controls sleep; sensor just logs
```

### Pattern 6: Mock-Based Unit Test Setup

**What:** Patch `ModbusSerialClient` at class instantiation; inject fake `response.registers` list.

**When to use:** All unit tests in `tests/test_sensor.py` — no hardware required.

```python
# tests/test_sensor.py
# Source: Python stdlib unittest.mock live verification
from unittest.mock import MagicMock, patch
from src.sensor import WitMotionSensor
from src.config_loader import AppConfig

def _make_config(port="COM3"):
    return AppConfig(
        serial_port=port,
        baudrate=9600,
        slave_id=80,
        sample_interval_seconds=0.1,
        output_folder="data",
        csv_filename_prefix="wtvb01",
        log_level="WARNING",
    )

def _make_registers(ax_raw=0, ay_raw=0, az_raw=32768):
    """19 registers: acc(3) + ang_vel(3) + vel(3) + angle(3) + temp(1) + disp(3) + freq(3)."""
    return [ax_raw, ay_raw, az_raw,  # 0x34-0x36 acceleration
            0, 0, 0,                  # 0x37-0x39 angular velocity (skipped)
            0, 0, 0,                  # 0x3A-0x3C velocity
            0, 0, 0,                  # 0x3D-0x3F angle
            100,                      # 0x40 temperature (100 raw units)
            0, 0, 0,                  # 0x41-0x43 displacement
            0, 0, 0]                  # 0x44-0x46 frequency

@patch("src.sensor.ModbusSerialClient")
def test_read_all_data_returns_sensor_reading(MockClient):
    mock_client_instance = MagicMock()
    MockClient.return_value = mock_client_instance
    mock_client_instance.connect.return_value = True

    mock_response = MagicMock()
    mock_response.isError.return_value = False
    mock_response.registers = _make_registers(ax_raw=0, ay_raw=0, az_raw=0x8000)
    mock_client_instance.read_holding_registers.return_value = mock_response

    sensor = WitMotionSensor(_make_config())
    sensor.connect()
    reading = sensor.read_all_data()

    assert reading is not None
    # az_raw=0x8000=32768 → to_signed16=-32768 → -32768/32768*16 = -16.0 g
    # (this value confirms signed conversion; actual gravity test needs hardware)
    assert reading.az_g is not None
    assert reading.ax_g == 0.0
    assert reading.ay_g == 0.0
```

### Anti-Patterns to Avoid

- **`unit=80`:** Removed in pymodbus 3.5. Raises `TypeError` in 3.13.0. Never use.
- **`slave=80`:** Removed in pymodbus 3.10.0. Raises `TypeError` in 3.13.0. Use `device_id=80` instead.
- **`method='rtu'`:** Old 2.x API. Removed entirely in 3.0. Never use.
- **`from pymodbus.client.sync import ModbusSerialClient`:** Import path removed in 3.0. Use `from pymodbus.client import ModbusSerialClient`.
- **Forgetting `to_signed16()` before scale factor:** The ~32g anomaly (REQUIREMENTS.md, ACQ-08) occurs when raw unsigned value 32768 is multiplied without conversion: `32768 / 32768 * 16 = 16.0 g` instead of `-16.0 g`. Apply `to_signed16()` to EVERY register.
- **Multiple register reads per poll:** ACQ-01 explicitly requires a single burst call. Split reads would violate this and increase latency.
- **Catching bare `Exception`:** Catch only `ModbusException` (and its subclasses `ModbusIOException`, `ConnectionException`). Bare `Exception` masks programming errors.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modbus RTU framing | Custom serial byte packing | `ModbusSerialClient` + `FramerType.RTU` | CRC calculation, framing, timing, retries handled by library |
| Signed 16-bit conversion | New implementation | `to_signed16()` from `src/utils.py` | Already implemented, boundary-tested (5 values), Phase 1 complete |
| Retry/reconnect logic | Custom sleep-retry loop | pymodbus `retries=3` + own consecutive counter | Library handles low-level retries; class-level counter handles application-layer pause |
| Mock fixtures | Custom fake serial port | `unittest.mock.MagicMock` | stdlib, zero dependency, works on CI without hardware |

**Key insight:** Modbus RTU framing is non-trivial (CRC-16/MODBUS polynomial, timing constraints, half-duplex). The library handles all of it. The sensor class is thin: connect, call once, parse registers, return dataclass.

---

## Common Pitfalls

### Pitfall 1: Using `slave=` or `unit=` in pymodbus 3.13.0
**What goes wrong:** `TypeError: read_holding_registers() got an unexpected keyword argument 'slave'` at runtime.
**Why it happens:** The phase success criteria mention `slave=80` but pymodbus removed this at 3.10.0. Most online examples and Stack Overflow answers still show the old API.
**How to avoid:** Use `device_id=80` exclusively. Verified live on installed 3.13.0: `inspect.signature()` shows `device_id` as the only device-identifier parameter.
**Warning signs:** `TypeError` on the first actual Modbus call; never gets as far as the hardware.

### Pitfall 2: Missing `to_signed16()` on any register (the ~32g anomaly)
**What goes wrong:** Raw unsigned register value `0x8000` (32768) is multiplied directly: `32768 / 32768 * 16 = 16.0 g` instead of `to_signed16(32768) / 32768 * 16 = -16.0 g`. At rest on a flat surface, Z reads ~32g instead of ~1g.
**Why it happens:** Developer applies conversion to obvious cases (large values) but forgets to apply consistently, or applies sign conversion only to the acceleration channels.
**How to avoid:** Apply `to_signed16()` to ALL 19 registers before any multiplication, even if the channel is expected to be positive (frequency, displacement). Unsigned values above 32767 indicate negative physical quantities even for "positive-only" sensors that encode signed data.
**Warning signs:** Any channel reading near ±16g, ±50mm/s, or ±100Hz when the sensor is at rest; the ACQ-08 acceptance test.

### Pitfall 3: Off-by-one in register index (skipping angular velocity registers)
**What goes wrong:** `response.registers` has indices 0–18. Registers 0x37, 0x38, 0x39 (offsets 3, 4, 5) are angular velocity — not in `SensorReading`. If this gap is missed, velocity/angle/temperature reads from the wrong register.
**Why it happens:** Counting from 0x34 as offset 0 is correct, but the 3 skipped registers (0x37–0x39) between acceleration and velocity are easy to miss when writing index assignments.
**How to avoid:** Document register-to-index mapping as named constants or a comment table. Verify with a unit test using known synthetic register values that checks each field independently.
**Warning signs:** `vx_mm_s` has an unexpected value; `temperature_c` reads as ~1000°C or negative.

### Pitfall 4: `response.isError()` not checked (silent data corruption)
**What goes wrong:** Modbus error response (function code > 0x80) is silently accepted. `response.registers` attribute may not exist, raising `AttributeError`, or the list may be empty, raising `IndexError`.
**Why it happens:** Developer checks only for `ModbusException` but omits `response.isError()`.
**How to avoid:** Always call `response.isError()` immediately after the call and before accessing `response.registers`. Log and return `None` if true.
**Warning signs:** Intermittent `AttributeError: 'ExceptionResponse' object has no attribute 'registers'` during communication disturbances.

### Pitfall 5: Scale factors for non-acceleration channels unknown
**What goes wrong:** Velocity, angle, displacement, frequency constants are set to placeholder values (e.g., `/ 100.0`), data silently passes tests with mock registers, but reads physically wrong values in the field.
**Why it happens:** WitMotion WTVB01-485 protocol documentation is not publicly indexed. Scale factors must come from the PDF datasheet.
**How to avoid:** Treat all non-acceleration scale factors as `LOW confidence` placeholders. Add a `# UNVERIFIED: confirm from datasheet` comment to each. On first hardware session, validate each channel against the WitMotion PC software readings.
**Warning signs:** Velocity reads in g units, temperature reads as 1000°C, frequency off by 10x.

### Pitfall 6: Baudrate default mismatch
**What goes wrong:** `ModbusSerialClient` default `baudrate=19200` but the sensor factory default is 9600. Connection silently "succeeds" (no error) but all reads return garbage or timeout.
**Why it happens:** pymodbus constructor default is 19200; project config default is 9600 (from `config_loader.py`). If sensor class uses `ModbusSerialClient` without passing baudrate from config, wrong speed is used.
**How to avoid:** Always pass `baudrate=self._config.baudrate` explicitly to the constructor. Never rely on pymodbus defaults.
**Warning signs:** `connect()` returns True but every `read_holding_registers` raises `ModbusIOException` (timeout).

---

## Code Examples

### Complete WitMotionSensor Skeleton (pymodbus 3.13.0 API)

```python
# src/sensor.py
# Source: pymodbus 3.13.0 live source inspection on installed package
from __future__ import annotations

import logging
from typing import Optional

from pymodbus import FramerType, ModbusException
from pymodbus.client import ModbusSerialClient

from src.utils import SensorReading, get_timestamp_br, to_signed16

logger = logging.getLogger(__name__)

_REG_START  = 0x34   # first Modbus register in burst
_REG_COUNT  = 19     # reads 0x34 through 0x46 inclusive
_MAX_CONSECUTIVE_ERRORS = 5

# Scale factors — acceleration confirmed from REQUIREMENTS.md ACQ-02
# All others: LOW CONFIDENCE — confirm from WTVB01-485 protocol PDF
SCALE_ACC   = 1.0 / 32768 * 16   # signed_16 / 32768 * 16 → g
SCALE_VEL   = None    # TODO: confirm from datasheet → mm/s
SCALE_ANGLE = None    # TODO: confirm from datasheet → degrees
SCALE_TEMP  = None    # TODO: confirm from datasheet → °C (common: /100)
SCALE_DISP  = None    # TODO: confirm from datasheet → µm
SCALE_FREQ  = None    # TODO: confirm from datasheet → Hz


class WitMotionSensor:
    """Modbus RTU connection and burst register read for WitMotion WTVB01-485."""

    def __init__(self, config) -> None:
        self._config = config
        self._client: Optional[ModbusSerialClient] = None
        self._consecutive_errors: int = 0

    def connect(self) -> bool:
        """Open Modbus RTU connection. Returns True on success."""
        self._client = ModbusSerialClient(
            self._config.serial_port,
            framer=FramerType.RTU,
            baudrate=self._config.baudrate,
            bytesize=8,
            parity="N",
            stopbits=1,
            timeout=3,
        )
        connected = self._client.connect()
        if connected:
            logger.info("Connected to %s at %d baud", self._config.serial_port, self._config.baudrate)
        else:
            logger.error("Failed to connect to %s", self._config.serial_port)
        return connected

    def close(self) -> None:
        """Close Modbus RTU connection."""
        if self._client:
            self._client.close()
            logger.info("Disconnected from %s", self._config.serial_port)

    def read_all_data(self) -> Optional[SensorReading]:
        """Read 19 registers in single burst; return SensorReading or None on error."""
        if not self._client:
            logger.error("read_all_data() called before connect()")
            return None

        try:
            response = self._client.read_holding_registers(
                _REG_START,
                count=_REG_COUNT,
                device_id=self._config.slave_id,   # pymodbus 3.10+ API; NOT slave=
            )
        except ModbusException as exc:
            self._consecutive_errors += 1
            logger.warning(
                "Modbus exception reading sensor (consecutive=%d): %s",
                self._consecutive_errors, exc,
            )
            if self._consecutive_errors >= _MAX_CONSECUTIVE_ERRORS:
                logger.error(
                    "Sensor: %d consecutive errors — check cable and slave ID",
                    self._consecutive_errors,
                )
            return None

        if response.isError():
            self._consecutive_errors += 1
            logger.warning(
                "Device error response (consecutive=%d): %s",
                self._consecutive_errors, response,
            )
            return None

        self._consecutive_errors = 0
        return self._parse_registers(response.registers)

    def _parse_registers(self, regs: list) -> SensorReading:
        """Convert raw register list to SensorReading with physical units."""
        # Index layout (0-based from address 0x34):
        # [0-2]   0x34-0x36  Acceleration X/Y/Z
        # [3-5]   0x37-0x39  Angular velocity (SKIPPED — not in SensorReading)
        # [6-8]   0x3A-0x3C  Vibration velocity X/Y/Z
        # [9-11]  0x3D-0x3F  Angle X/Y/Z
        # [12]    0x40        Temperature
        # [13-15] 0x41-0x43  Displacement X/Y/Z
        # [16-18] 0x44-0x46  Frequency X/Y/Z
        return SensorReading(
            timestamp=get_timestamp_br(),
            sensor_id=getattr(self._config, "sensor_id", "wtvb01"),
            ax_g=to_signed16(regs[0])  * SCALE_ACC,
            ay_g=to_signed16(regs[1])  * SCALE_ACC,
            az_g=to_signed16(regs[2])  * SCALE_ACC,
            vx_mm_s=to_signed16(regs[6])  * SCALE_VEL  if SCALE_VEL else None,
            vy_mm_s=to_signed16(regs[7])  * SCALE_VEL  if SCALE_VEL else None,
            vz_mm_s=to_signed16(regs[8])  * SCALE_VEL  if SCALE_VEL else None,
            angle_x=to_signed16(regs[9])  * SCALE_ANGLE if SCALE_ANGLE else None,
            angle_y=to_signed16(regs[10]) * SCALE_ANGLE if SCALE_ANGLE else None,
            angle_z=to_signed16(regs[11]) * SCALE_ANGLE if SCALE_ANGLE else None,
            temperature_c=to_signed16(regs[12]) * SCALE_TEMP if SCALE_TEMP else None,
            dx_um=to_signed16(regs[13]) * SCALE_DISP  if SCALE_DISP else None,
            dy_um=to_signed16(regs[14]) * SCALE_DISP  if SCALE_DISP else None,
            dz_um=to_signed16(regs[15]) * SCALE_DISP  if SCALE_DISP else None,
            freq_x_hz=to_signed16(regs[16]) * SCALE_FREQ if SCALE_FREQ else None,
            freq_y_hz=to_signed16(regs[17]) * SCALE_FREQ if SCALE_FREQ else None,
            freq_z_hz=to_signed16(regs[18]) * SCALE_FREQ if SCALE_FREQ else None,
        )
```

### pymodbus 3.13.0 FramerType Import (Verified)

```python
# Source: live import test on installed pymodbus 3.13.0
from pymodbus import FramerType          # PRIMARY — works in 3.13.0
from pymodbus.framer import FramerType   # ALSO WORKS — alternate path
# Both resolve to the same enum; prefer `from pymodbus import FramerType`
```

### ModbusSerialClient Constructor (Verified Signature)

```python
# Source: inspect.signature() on installed pymodbus 3.13.0
ModbusSerialClient(
    port,                    # positional, required
    *,
    framer=FramerType.RTU,   # default is RTU for serial — can omit
    baudrate=19200,          # DEFAULT IS 19200 — always pass from config (9600)
    bytesize=8,
    parity='N',
    stopbits=1,
    handle_local_echo=False,
    name='comm',
    reconnect_delay=0.1,
    reconnect_delay_max=300,
    timeout=3,
    retries=3,
    ...
)
```

### Exception Hierarchy (Verified)

```python
# Source: live inspection of pymodbus.exceptions on installed 3.13.0
# ModbusException                   — base; .isError() returns True
#   ModbusIOException               — timeout, CRC error, invalid response
#   ConnectionException             — cannot open port, port busy
#   MessageRegisterException        — internal framing errors
#   NoSuchIdException
#   NotImplementedException
#   ParameterException

from pymodbus import ModbusException          # catches all subtypes
from pymodbus.exceptions import ConnectionException  # catch separately for connect()
```

---

## Register Map (Confirmed + Unconfirmed)

| Offset | Address | Register | Channel | Formula | Confidence |
|--------|---------|----------|---------|---------|------------|
| 0 | 0x34 | acc_x | Acceleration X | `to_signed16(r) / 32768 * 16` → g | HIGH (REQUIREMENTS.md ACQ-02) |
| 1 | 0x35 | acc_y | Acceleration Y | `to_signed16(r) / 32768 * 16` → g | HIGH |
| 2 | 0x36 | acc_z | Acceleration Z | `to_signed16(r) / 32768 * 16` → g | HIGH |
| 3 | 0x37 | ang_x | Angular velocity X | SKIP (not in SensorReading) | — |
| 4 | 0x38 | ang_y | Angular velocity Y | SKIP | — |
| 5 | 0x39 | ang_z | Angular velocity Z | SKIP | — |
| 6 | 0x3A | vel_x | Vibration velocity X | `to_signed16(r) * SCALE_VEL` → mm/s | LOW — confirm from datasheet |
| 7 | 0x3B | vel_y | Vibration velocity Y | same | LOW |
| 8 | 0x3C | vel_z | Vibration velocity Z | same | LOW |
| 9 | 0x3D | angle_x | Angle X | `to_signed16(r) * SCALE_ANGLE` → degrees | LOW |
| 10 | 0x3E | angle_y | Angle Y | same | LOW |
| 11 | 0x3F | angle_z | Angle Z | same | LOW |
| 12 | 0x40 | temp | Temperature | `to_signed16(r) * SCALE_TEMP` → °C | LOW (WitMotion convention: /100) |
| 13 | 0x41 | disp_x | Displacement X | `to_signed16(r) * SCALE_DISP` → µm | LOW |
| 14 | 0x42 | disp_y | Displacement Y | same | LOW |
| 15 | 0x43 | disp_z | Displacement Z | same | LOW |
| 16 | 0x44 | freq_x | Frequency X | `to_signed16(r) * SCALE_FREQ` → Hz | LOW |
| 17 | 0x45 | freq_y | Frequency Y | same | LOW |
| 18 | 0x46 | freq_z | Frequency Z | same | LOW |

**Burst read call:** `read_holding_registers(0x34, count=19, device_id=80)` returns all 19 registers in one transaction.

**Placeholder scale factor candidates** (LOW confidence — derive from product page range specs):
- `SCALE_VEL`: product page max 100 mm/s; if register max is 32767, then `/ 32768 * 100`. Common WitMotion pattern: `/ 1000.0` (mm/s already as integer mm/s×10 or ×1000). **Must confirm.**
- `SCALE_ANGLE`: product page max 180°; if register max 32767, then `/ 32768 * 180`. **Must confirm.**
- `SCALE_TEMP`: WitMotion convention on other sensors: `/ 100.0` → e.g., raw 2500 = 25.00°C. **Must confirm.**
- `SCALE_DISP`: product page max 30,000 µm; raw likely unsigned (unsigned 0–65535 maps to 0–30,000 µm). May not need `to_signed16`. **Must confirm.**
- `SCALE_FREQ`: product page range 1–100 Hz; may be raw integer = Hz. **Must confirm.**

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `from pymodbus.client.sync import ModbusSerialClient` | `from pymodbus.client import ModbusSerialClient` | pymodbus 3.0.0 (2022) | Old path removed; 3.x path required |
| `method='rtu'` constructor param | `framer=FramerType.RTU` | pymodbus 3.0.0 | `method=` removed entirely |
| `unit=80` in read calls | `device_id=80` | pymodbus 3.10.0 (2024) | `unit=` removed at 3.5; `slave=` removed at 3.10 |
| `slave=80` in read calls | `device_id=80` | pymodbus 3.10.0 (2024) | Breaking change; no backward alias |
| `from pymodbus.constants import Endian` | `from pymodbus.payload import BinaryPayloadDecoder` | Various | Not relevant here — 16-bit registers read directly |

**Deprecated/removed:**
- `slave=` parameter: Removed at pymodbus 3.10.0. `TypeError` in 3.13.0.
- `unit=` parameter: Removed at pymodbus 3.5.0. `TypeError` in 3.13.0.
- `method='rtu'`: Removed at pymodbus 3.0.0.
- `from pymodbus.client.sync import ...`: Removed at pymodbus 3.0.0.

---

## Open Questions

1. **Scale factors for velocity, angle, temperature, displacement, frequency**
   - What we know: acceleration formula is confirmed (`/ 32768 * 16`). Product page gives physical ranges. WitMotion typically uses `/100` for temperature.
   - What's unclear: exact divisor/multiplier for each channel; whether displacement is signed or unsigned; whether frequency is raw integer Hz or scaled.
   - Recommendation: Implement with `SCALE_*` module-level constants initially set to known value or `None`. On first hardware session, compare each channel against WitMotion PC software and compute correct scale. Mark all non-acceleration conversions with `# UNVERIFIED — confirm from datasheet` comment.

2. **`sensor_id` field in AppConfig**
   - What we know: `SensorReading.sensor_id` is defined as a string field. `AppConfig` (from `config_loader.py`) currently has no `sensor_id` field.
   - What's unclear: Should `sensor_id` come from config, or be hardcoded as `"wtvb01"` in `sensor.py`?
   - Recommendation: Add `sensor_id` field to `AppConfig` with default `"wtvb01"` in `config_loader.py`, or use `getattr(config, "sensor_id", "wtvb01")` fallback in `sensor.py` to avoid modifying Phase 1 code. The planner should decide which approach minimises Phase 1 re-testing.

3. **Datasheet acquisition path**
   - What we know: WitMotion documentation is on Google Drive (not public web). The Google Drive folder ID from product page is `15p7ZJVKMsaV_eTzXRlOVxuf1tIH_RUPD`.
   - What's unclear: Whether this folder is accessible; whether the Python SDK example code contains register definitions.
   - Recommendation: Before first hardware session, download the PDF from the Google Drive folder linked on the product page. The Python SDK listed there may include a register definition file with scale constants.

---

## Validation Architecture

Nyquist validation is enabled (`nyquist_validation: true` in `.planning/config.json`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest >=7.0 (already in requirements.txt) |
| Config file | none — pytest auto-discovers tests/ |
| Quick run command | `pytest tests/test_sensor.py -x -q` |
| Full suite command | `pytest tests/ -v --tb=short` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONN-01 | `connect()` returns True when `ModbusSerialClient.connect()` returns True | unit (mock) | `pytest tests/test_sensor.py::test_connect_success -x` | Wave 0 gap |
| CONN-01 | `connect()` returns False when `ModbusSerialClient.connect()` returns False | unit (mock) | `pytest tests/test_sensor.py::test_connect_failure -x` | Wave 0 gap |
| CONN-03 | `ModbusException` increments `_consecutive_errors` and logs WARNING | unit (mock) | `pytest tests/test_sensor.py::test_modbus_exception_logged_as_warning -x` | Wave 0 gap |
| CONN-03 | Device error response (`isError()=True`) increments counter and logs WARNING | unit (mock) | `pytest tests/test_sensor.py::test_error_response_logged_as_warning -x` | Wave 0 gap |
| CONN-03 | N consecutive errors logs ERROR with count | unit (mock) | `pytest tests/test_sensor.py::test_consecutive_errors_logs_error -x` | Wave 0 gap |
| CONN-03 | `read_all_data()` returns None on exception (does not raise) | unit (mock) | `pytest tests/test_sensor.py::test_exception_returns_none -x` | Wave 0 gap |
| ACQ-01 | `read_holding_registers` called with `address=0x34, count=19, device_id=80` | unit (mock) | `pytest tests/test_sensor.py::test_burst_read_single_call -x` | Wave 0 gap |
| ACQ-02 | `ax_g=0.0` when `regs[0]=0`; `az_g` for raw=32768 equals expected signed value | unit (mock) | `pytest tests/test_sensor.py::test_acceleration_conversion -x` | Wave 0 gap |
| ACQ-08 | Signed conversion applies: raw=32768 → -32768 → -16.0 g, not +16.0 g | unit (mock) | `pytest tests/test_sensor.py::test_signed16_applied_to_acceleration -x` | Wave 0 gap |
| ACQ-09 | `read_all_data()` returns `SensorReading` instance on success | unit (mock) | `pytest tests/test_sensor.py::test_returns_sensor_reading_dataclass -x` | Wave 0 gap |
| ACQ-09 | `read_all_data()` returns `None` on comm error | unit (mock) | (same as CONN-03 test above) | Wave 0 gap |
| ACQ-03–07 | Non-acceleration channels: values are float or None (not raises) | unit (mock) | `pytest tests/test_sensor.py::test_non_acceleration_channels_present -x` | Wave 0 gap |
| Success criterion 2 | `az_g ≈ 1.0 g` with sensor flat (gravity test) | manual/hardware | Run `python -m src.sensor` with live sensor and verify log | hardware required |

### Sampling Rate
- **Per task commit:** `pytest tests/test_sensor.py -x -q`
- **Per wave merge:** `pytest tests/ -v --tb=short`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_sensor.py` — all mock-based tests for `WitMotionSensor`; covers CONN-01, CONN-03, ACQ-01, ACQ-02, ACQ-08, ACQ-09

---

## Sources

### Primary (HIGH confidence)
- `pymodbus 3.13.0` installed package — `inspect.signature(ModbusSerialClient.read_holding_registers)` live source; confirmed `device_id` parameter, no `slave`
- `pymodbus 3.13.0` installed package — `inspect.signature(ModbusSerialClient.__init__)` confirmed `baudrate=19200` default, `framer=FramerType.RTU` default
- `pymodbus 3.13.0` installed package — `inspect.getsource(ModbusPDU.isError)` confirmed `function_code > 0x80` logic
- `pymodbus 3.13.0` installed package — `dir(pymodbus.exceptions)` confirmed exception hierarchy
- `src/utils.py` (Phase 1 complete) — `to_signed16()`, `SensorReading`, `get_timestamp_br()` all verified GREEN in 31 passing tests
- `src/config_loader.py` (Phase 1 complete) — `AppConfig` field names confirmed

### Secondary (MEDIUM confidence)
- pymodbus changelog (readthedocs.io/en/stable) — version 3.10.0 `slave→device_id` rename (PR #2600) confirmed
- REQUIREMENTS.md ACQ-02 — acceleration formula `signed_16 / 32768 * 16` is project-defined requirement, treated as authoritative
- WitMotion product page (witmotion-sensor.com) — physical range specs: velocity 0–100 mm/s, displacement 0–30,000 µm, frequency 1–100 Hz, angle 0–180°

### Tertiary (LOW confidence)
- WitMotion HWT9053-485 GitHub gist — acceleration formula `/ 32768 * 16 * 9.81` confirms WitMotion convention for acceleration registers (different sensor, same manufacturer convention)
- WitMotion temperature convention `/100.0` — from training knowledge based on other WitMotion sensor datasheets; not verified for WTVB01-485
- All non-acceleration scale factors — placeholders derived from product range specs; not from WTVB01-485 protocol PDF

---

## Metadata

**Confidence breakdown:**
- pymodbus 3.13.0 API: HIGH — live source inspection on installed package
- Acceleration register conversion: HIGH — confirmed in REQUIREMENTS.md ACQ-02
- Register address layout (0x34–0x46): HIGH — from REQUIREMENTS.md
- Angular velocity skip (0x37–0x39): MEDIUM — inferred from register range; confirm from datasheet
- Non-acceleration scale factors: LOW — placeholder values; datasheet required
- Error handling pattern: HIGH — live source inspection confirms exception types and isError()

**Research date:** 2026-05-21
**Valid until:** 2026-08-21 (pymodbus 3.13.0 pinned; API will not change until requirements.txt updated)
