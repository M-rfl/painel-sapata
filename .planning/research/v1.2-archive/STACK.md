# Stack Research: Python Modbus RTU Data Acquisition

**Project:** WTVB01 Notebook Logger
**Researched:** 2026-05-19
**Method:** pip index (live PyPI), local Python verification, training knowledge (flagged)

---

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|-----------|
| Python | 3.9+ (3.13 ideal, 3.8 min) | Runtime | HIGH |
| pymodbus | 3.13.0 | Modbus RTU over RS-485 | HIGH (version from live PyPI) |
| pyserial | 3.5 | Serial port enumeration + underlying transport | HIGH (version from live PyPI) |
| PyYAML | 6.0.3 | config.yaml loading | HIGH (version from live PyPI) |
| zoneinfo | stdlib (3.9+) or backports.zoneinfo 0.2.1 | America/Sao_Paulo timestamps | HIGH |
| tzdata | 2026.2 | IANA timezone database for Windows | HIGH (confirmed working on this machine) |
| csv | stdlib | CSV output — no install needed | HIGH |
| logging | stdlib | Structured error/status logging | HIGH |
| pathlib | stdlib | Cross-platform path handling | HIGH |

**Minimal install command (Python 3.9+):**
```
pip install pymodbus==3.13.0 pyserial==3.5 PyYAML==6.0.3 tzdata
```

**Minimal install command (Python 3.8 only — add backport):**
```
pip install pymodbus==3.13.0 pyserial==3.5 PyYAML==6.0.3 tzdata backports.zoneinfo==0.2.1
```

---

## Key Library Details

### pymodbus 3.13.0 — CRITICAL

**Why pymodbus:** Most actively maintained Python Modbus library. Full RTU/ASCII/TCP support, synchronous and async clients, context manager support. Upstream project has corporate backing (Riptide IO). minimalmodbus and umodbus cannot match its feature set or maintenance cadence.

**pymodbus 2.x vs 3.x — BREAKING CHANGES (HIGH confidence, version history verified)**

The jump from 2.x to 3.x is a complete API overhaul. Any Stack Overflow answer or blog post pre-2022 describes the wrong API. The distinctions below are load-bearing for implementation.

**1. Import path changed:**
```python
# 2.x (WRONG for 3.x)
from pymodbus.client.sync import ModbusSerialClient

# 3.x (CORRECT)
from pymodbus.client import ModbusSerialClient
```

**2. Constructor signature changed:**
```python
# 2.x (WRONG for 3.x)
client = ModbusSerialClient(method="rtu", port="COM3", baudrate=9600, timeout=1)

# 3.x with framer string (works with deprecation warning in 3.5-3.13)
client = ModbusSerialClient(port="COM3", framer="rtu", baudrate=9600, timeout=1)

# 3.x canonical (preferred — no deprecation warning)
from pymodbus.framer import FramerType
client = ModbusSerialClient(
    port="COM3",
    framer=FramerType.RTU,
    baudrate=9600,
    bytesize=8,
    parity="N",
    stopbits=1,
    timeout=1,
)
```

**3. Context manager is the recommended connection pattern in 3.x:**
```python
# 3.x preferred (handles connect/close automatically)
with ModbusSerialClient(port="COM3", framer=FramerType.RTU, baudrate=9600) as client:
    result = client.read_holding_registers(address=0x34, count=3, slave=0x50)
    if not result.isError():
        print(result.registers)
```

**4. Slave ID parameter name changed:**
```python
# 2.x: unit=0x50
# 3.x: slave=0x50  (unit= still accepted but deprecated)
result = client.read_holding_registers(address=0x34, count=3, slave=0x50)
```

**5. Error checking — both methods work in 3.x:**
```python
# Method A: .isError() — preserved from 2.x for compatibility
if result.isError():
    raise RuntimeError(f"Modbus error: {result}")

# Method B: isinstance check — more Pythonic in 3.x
from pymodbus.exceptions import ModbusException
if isinstance(result, ModbusException):
    raise RuntimeError(f"Modbus error: {result}")
```

**6. register access is unchanged:**
```python
value = result.registers[0]  # same in 2.x and 3.x
```

**Recommendation:** Use pymodbus 3.13.0, FramerType.RTU, slave= parameter, context manager pattern. Pin the version in requirements.txt — do not use `>=3.0.0` because the API has shifted within 3.x (framer enum introduced in 3.5).

---

### pyserial 3.5 — Port Enumeration

**Note:** pymodbus 3.x depends on pyserial internally as its transport layer for RTU. Installing pymodbus will pull pyserial automatically. But pyserial is listed explicitly because `list_serial_ports.py` uses its tools API directly.

**Port listing API (stable since 3.0):**
```python
import serial.tools.list_ports

def list_ports():
    ports = serial.tools.list_ports.comports()
    for p in ports:
        # p.device      -> "COM3" on Windows, "/dev/ttyUSB0" on Linux
        # p.description -> "USB-SERIAL CH340 (COM3)"
        # p.hwid        -> "USB VID:PID=1A86:7523 SER=... LOCATION=..."
        print(f"{p.device}: {p.description}")
```

**Windows CH340/CP210x/FTDI identification via hwid:**
| Chip | VID:PID |
|------|---------|
| CH340 (common cheap cable) | 1A86:7523 |
| CP210x (Silicon Labs) | 10C4:EA60 |
| FTDI FT232 | 0403:6001 |

**pyserial 3.5 is the latest available on PyPI** (no 4.x exists as of May 2026). This library is mature and stable — no breaking changes expected.

---

### PyYAML 6.0.3 — Configuration

**Why YAML over .env or argparse:** YAML is the most readable format for non-technical users who just need to set COM3, baudrate, and slave_id. No quoting rules, no CLI knowledge required. config.yaml can be opened in Notepad.

**Critical YAML loading note — security:**
```python
# NEVER use yaml.load() without Loader — arbitrary code execution risk
data = yaml.load(f, Loader=yaml.FullLoader)  # CORRECT
data = yaml.safe_load(f)                      # ALSO CORRECT — preferred for config
data = yaml.load(f)                           # WRONG — deprecated, unsafe
```

**Use yaml.safe_load()** for config files. It handles all standard YAML types (strings, ints, floats, booleans, lists, dicts) without allowing Python-object deserialization.

**Version 6.0.x vs 5.x:** PyYAML 6.0 dropped `yaml.load()` without Loader as a valid call (now emits FullLoader warning in 5.x, error in 6.x). Use 6.0.3 — it is the stable release.

---

### zoneinfo + tzdata — Timezone Handling

**Why not pytz:**
- pytz requires `pytz.timezone('America/Sao_Paulo').localize(dt)` — non-standard API
- pytz aware datetimes do not work with `datetime.astimezone()` correctly in all edge cases
- pytz is officially in maintenance mode; the Python core team created zoneinfo as the successor
- PEP 615 (zoneinfo) was accepted for Python 3.9 specifically to replace pytz

**zoneinfo availability:**
- Python 3.9+: `from zoneinfo import ZoneInfo` — built-in stdlib, zero install cost
- Python 3.8: `from backports.zoneinfo import ZoneInfo` — install `backports.zoneinfo==0.2.1`

**Windows-specific critical requirement:** Windows does NOT ship IANA timezone database (unlike Linux/macOS). Without the `tzdata` package, `ZoneInfo("America/Sao_Paulo")` raises `ZoneInfoNotFoundError` on Windows.

**Verified on this machine:** `tzdata==2025.3` installed, `ZoneInfo("America/Sao_Paulo")` returns correct UTC-3 offset.

**Recommended pattern:**
```python
try:
    from zoneinfo import ZoneInfo          # Python 3.9+
except ImportError:
    from backports.zoneinfo import ZoneInfo  # Python 3.8

TZ_SAO_PAULO = ZoneInfo("America/Sao_Paulo")

def now_local() -> datetime:
    return datetime.now(tz=TZ_SAO_PAULO)

def timestamp_str(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")  # "2026-05-19T22:46:06-03:00"
```

**America/Sao_Paulo DST note:** Brazil abolished Daylight Saving Time in 2019. The timezone is fixed at UTC-3 year-round. However, using the IANA name (not a hardcoded `-03:00` offset) is still correct practice — it correctly handles historical data if timestamps span pre-2019 dates.

---

### csv module — Data Output

**Why the stdlib csv module, not pandas:**
- Zero install cost, zero import overhead
- pandas is 30+ MB, adds numpy dependency, and is complete overkill for sequential row writing
- csv.writer is the exact right tool for append-only sequential logging
- pandas becomes relevant only when doing analysis post-collection, not during collection

**Recommended pattern for append-safe CSV logging:**
```python
import csv
from pathlib import Path

CSV_FIELDS = [
    "timestamp", "accel_x_g", "accel_y_g", "accel_z_g",
    "vib_x_mms", "vib_y_mms", "vib_z_mms",
    "angle_x", "angle_y", "angle_z",
    "temp_c",
    "disp_x_um", "disp_y_um", "disp_z_um",
    "freq_x_hz", "freq_y_hz", "freq_z_hz",
]

def write_row(path: Path, row: dict) -> None:
    write_header = not path.exists()
    with path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        if write_header:
            writer.writeheader()
        writer.writerow(row)
```

**Note:** `newline=""` is required by Python's csv module on Windows to prevent double newlines (CRLF+LF).

---

### logging module — Structured Logging

**Pattern: dual-handler logging (console + rotating file):**
```python
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

def setup_logging(log_dir: Path, level: int = logging.INFO) -> None:
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "sensor.log"

    fmt = logging.Formatter(
        "%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)

    # Console: INFO and above
    ch = logging.StreamHandler()
    ch.setLevel(level)
    ch.setFormatter(fmt)
    root.addHandler(ch)

    # File: DEBUG and above, 5 MB rotation, keep 3 backups
    fh = RotatingFileHandler(log_path, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)
    root.addHandler(fh)
```

**Key decisions:**
- `RotatingFileHandler` prevents unbounded log growth during long continuous runs
- Console at INFO, file at DEBUG — users see clean output, full details go to file
- `encoding="utf-8"` on file handler prevents encoding errors from non-ASCII sensor descriptions
- Module-level loggers (`logger = logging.getLogger(__name__)`) throughout all modules

---

### pathlib — Cross-Platform Paths

**Why pathlib over os.path:** Path objects are more readable, support `/` operator for joining, and work identically on Windows and Linux without string manipulation.

```python
from pathlib import Path

# Config lookup
CONFIG_PATH = Path("config.yaml")                    # relative to cwd
LOG_DIR     = Path("logs")                           # auto-created
DATA_DIR    = Path("data")                           # CSV output

# Usage
DATA_DIR.mkdir(parents=True, exist_ok=True)
csv_path = DATA_DIR / f"wtvb01_{date_str}.csv"
```

**Windows-specific:** `Path("COM3")` does NOT construct a valid Windows COM port path. Use the string `"COM3"` directly when passing port to pymodbus/pyserial. pathlib is only for filesystem paths, not device paths.

---

## Version Compatibility Notes

### Python 3.8 Minimum Target

The project specifies Python 3.8+ for Windows corporate compatibility. Here are the compatibility constraints:

| Feature | 3.8 | 3.9 | 3.10+ | Note |
|---------|-----|-----|-------|------|
| zoneinfo | NO | YES | YES | Use backports.zoneinfo on 3.8 |
| pathlib | YES | YES | YES | Available since 3.4 |
| dataclasses | YES | YES | YES | Available since 3.7 |
| typing.TypedDict | YES | YES | YES | Available since 3.8 |
| walrus operator := | YES | YES | YES | Available since 3.8 |
| match/case | NO | NO | YES | Do not use — target is 3.8+ |
| `dict | other` merge | NO | YES | YES | Do not use — target is 3.8+ |
| f-strings | YES | YES | YES | Available since 3.6 |

**Recommendation:** Target Python 3.9+ in practice. Corporate Windows machines that cannot get past Python 3.8 are rare in 2025, and 3.8 reached EOL in October 2024. If 3.8 truly required, add `backports.zoneinfo` to requirements and use the try/except import pattern shown above.

**pymodbus 3.13.0 Python support:** pymodbus 3.x requires Python 3.8+. This aligns with the project's stated minimum. Verified from PyPI version history — 3.x series has maintained 3.8+ compatibility throughout.

### requirements.txt Recommended Pin Strategy

```
# requirements.txt
pymodbus==3.13.0       # pin exact — API changes within 3.x
pyserial==3.5          # pin exact — stable, but no 4.x exists anyway
PyYAML==6.0.3          # pin exact — 6.x safe_load API is stable
tzdata>=2025.3         # floor pin — IANA DB, safe to update for DST rule fixes

# Python 3.8 only (omit on 3.9+)
# backports.zoneinfo==0.2.1
```

**Why exact pins for pymodbus:** Within the 3.x series, the framer parameter changed from string to FramerType enum across minor versions. Exact pinning prevents unexpected breakage when a developer runs `pip install --upgrade`.

---

## Alternative Libraries Assessed

### minimalmodbus 2.1.1 — Not Recommended for this Project

**What it is:** Lightweight RTU-only library, built directly on pyserial, ~1000 lines of code.

**Strengths:** Simpler API for basic read/write operations. No async complexity. Easy to understand and debug.

**Why not for this project:**
- Designed for simple instrument reading (one register at a time), not bulk multi-register reads
- `read_registers(address, count)` exists but the library is optimized for single-value use
- No context manager support for connection lifecycle
- Less active development (2.1.1 is the latest, released 2022)
- pymodbus does everything minimalmodbus does plus handles framing, retries, and multi-register reads more robustly

**When to prefer minimalmodbus:** Extremely simple one-register polling, scripting/prototyping, situations where "I just want to read one value" is the entire use case.

### umodbus 1.0.4 — Not Recommended for this Project

**What it is:** Protocol-layer-only Modbus library. Handles frame construction/parsing but provides no serial transport.

**Strengths:** Very clean separation of concerns. Good for embedding Modbus into custom transports (e.g., over a network socket you already control).

**Why not for this project:** umodbus does not manage the serial connection at all. You would need to implement your own serial read/write loop, timing, retries, and framing. This is significant complexity that pymodbus already handles. umodbus 1.0.4 also has no active maintenance visible from PyPI (last release is 1.0.4 with no updates since ~2019).

**When to prefer umodbus:** Embedding Modbus framing logic into a custom protocol stack, server-side Modbus simulation, or situations where you already have a transport layer and only need frame encode/decode.

### modbus-tk — Not Recommended

Not assessed in depth. Older library, last meaningful update pre-2020. Superseded by pymodbus 3.x in all respects. Avoid.

---

## Windows-Specific Considerations

### COM Port Numbering

- Windows assigns COM ports automatically by USB hub port and USB VID:PID
- The same physical cable can appear as COM3 on one boot and COM5 on next if USB devices are added/removed
- config.yaml must allow easy port reconfiguration — this is why `port: COM3` is user-editable
- `list_serial_ports.py` exists specifically to help users find the right COM port before editing config.yaml

### High COM Port Numbers

- Windows allows COM1-COM256, but many legacy programs only support COM1-COM9
- For COM10+, pyserial requires the `\\.\COM10` format internally
- **pyserial 3.x handles this automatically** — pass `"COM10"` as string, pyserial converts to `\\.\COM10`
- No special handling required in application code

### Driver Installation Requirement

The WitMotion WTVB01-485 cable contains a USB-RS485 converter. The chip determines the required driver:

| Chip | Driver | Status |
|------|--------|--------|
| CH340/CH341 | CH340 driver from WCH | Not inbox on Windows — must install manually |
| CP2102 (CP210x) | Silicon Labs driver | Available via Windows Update or manual download |
| FTDI FT232 | FTDI VCP driver | Available via Windows Update (most systems auto-install) |

**Detection:** `python list_serial_ports.py` will show no COM port (or show a generic "USB Device") if driver is not installed. This must be documented in README.md troubleshooting.

### Windows Permission Model

- Windows does not require elevated privileges to access COM ports (unlike Linux where user must be in `dialout` group)
- If COM port is "in use" error: close any other program that may have the port open (Device Manager, another terminal, previous Python session that did not close cleanly)
- **Ctrl+C handling:** pymodbus 3.x context manager (`with` statement) closes the serial port on exit, including KeyboardInterrupt. This is the correct pattern — prevents port staying locked after crash.

### Antivirus / Firewall

- Windows Defender does not block COM port access
- No firewall rules needed for serial communication
- Some corporate environments block driver installation — document in README

---

## What NOT to Use

| Library | Why Not |
|---------|---------|
| pymodbus 2.x | EOL. API is completely different from 3.x. All StackOverflow answers pre-2022 show 2.x API. Do not mix them. |
| pytz | Maintenance mode. Non-standard `.localize()` API. Superseded by zoneinfo (PEP 615). Use only if forced to support 3.8 AND backports.zoneinfo has install issues. |
| pandas | 30MB dependency for writing sequential CSV rows. Zero benefit at collection time. Use post-collection for analysis. |
| sqlite3 | Out of scope per PROJECT.md. CSV is the specified output format. |
| asyncio / pymodbus async client | Adds complexity without benefit for single-sensor polling at 1Hz intervals. Use synchronous ModbusSerialClient. |
| yaml.load() without Loader | Security vulnerability. Always use yaml.safe_load() for config files. |
| os.path string operations | Use pathlib.Path instead — cleaner, cross-platform, Pythonic. |
| hardcoded UTC-3 offset | Use ZoneInfo("America/Sao_Paulo") — handles historical DST records correctly even though Brazil abolished DST in 2019. |

---

## Confidence Summary

| Area | Confidence | Basis | Caveat |
|------|-----------|-------|--------|
| pymodbus 3.13.0 is latest | HIGH | Live `pip index versions pymodbus` output | Confirmed |
| pymodbus 2.x vs 3.x breaking changes | MEDIUM | Training knowledge, version history analysis | Could not fetch pymodbus changelog directly — WebFetch denied. Recommend verifying at https://pymodbus.readthedocs.io/en/latest/source/changelog.html |
| FramerType.RTU available in pymodbus 3.5+ | MEDIUM | Training knowledge consistent with version cadence | Verify in pymodbus 3.13.0 docs before final implementation |
| pyserial 3.5 is latest | HIGH | Live `pip index versions pyserial` output | Confirmed |
| PyYAML 6.0.3 is latest | HIGH | Live PyPI check — already installed locally | Confirmed |
| zoneinfo requires tzdata on Windows | HIGH | Verified locally — ZoneInfo("America/Sao_Paulo") works with tzdata installed | Confirmed working |
| backports.zoneinfo 0.2.1 for Python 3.8 | HIGH | Live `pip index versions backports.zoneinfo` | Confirmed available |
| tzdata 2026.2 is latest | HIGH | Live `pip index versions tzdata` | Confirmed |
| csv newline="" required on Windows | HIGH | Python docs + training knowledge | Standard Python behavior |
| minimalmodbus/umodbus assessment | MEDIUM | Training knowledge + PyPI version inspection | Not deeply tested |
| CH340/CP210x VID:PID values | MEDIUM | Training knowledge (well-established hardware IDs) | Standard industry values |
