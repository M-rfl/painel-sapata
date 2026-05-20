# Phase 1: Foundation - Research

**Researched:** 2026-05-19
**Domain:** Python project scaffolding — config loading, timezone-aware timestamps, serial port enumeration, pinned dependencies
**Confidence:** HIGH — all Phase 1 work uses Python stdlib and well-documented third-party packages with no hardware dependency

---

## Summary

Phase 1 builds the zero-hardware foundation that every subsequent phase depends on. The work divides cleanly into four areas: (1) project file structure and pinned `requirements.txt`, (2) config loader with YAML validation, (3) `to_signed16()` and timezone utilities in `utils.py`, and (4) `list_serial_ports.py` as a standalone diagnostic tool. None of these require the physical sensor — all success criteria can be verified on a plain Windows machine with Python installed.

The biggest Phase 1 risks are not architectural. They are operational traps: `tzdata` must be explicitly listed in `requirements.txt` or `ZoneInfo("America/Sao_Paulo")` raises `ZoneInfoNotFoundError` on Windows at runtime; `yaml.safe_load()` must be used rather than `yaml.load()` to avoid a security-relevant deprecation; and the `to_signed16()` boundary at 32768 must be tested with all five specified boundary values because partial testing passes while the actual bug (treating 65535 as positive) survives. The domain research (SUMMARY.md, STACK.md, PITFALLS.md) was thorough and pre-researched — this RESEARCH.md compiles those findings into the Phase 1-specific planning artifact.

**Primary recommendation:** Build and test in dependency order: `src/utils.py` (pure functions, no I/O) → `src/config_loader.py` (YAML load + validation) → `list_serial_ports.py` (uses pyserial, no Modbus) → `requirements.txt` (verified by clean-venv install). Write tests for `utils.py` and `config_loader.py` before writing the production code.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONN-04 | `list_serial_ports.py` lists all serial ports with device description (e.g., "COM3 - USB-SERIAL CH340") | pyserial `serial.tools.list_ports.comports()` cross-platform API; `p.device`, `p.description`, `p.hwid` fields |
| STORE-03 | Timestamp in ISO 8601 with explicit UTC offset and microseconds using timezone America/Sao_Paulo | `datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat()` pattern; `tzdata` mandatory on Windows; try/except import guard for 3.8 |
| CFG-01 | `config.yaml` with fields: `serial_port`, `baudrate`, `slave_id`, `sample_interval_seconds`, `output_folder`, `csv_filename_prefix` | YAML schema design; `yaml.safe_load()` usage; DEFAULTS dict in code |
| CFG-02 | Config validated at startup with human-readable errors; exit code 1 before any serial I/O | Validation pattern: type checks, range checks, required-key checks; `sys.exit(1)` on error |
| CFG-03 | Default values: `baudrate=9600`, `slave_id=80`, `sample_interval_seconds=0.1`, `output_folder="data"` | DEFAULTS dict in `config_loader.py`; `deep_merge()` in `utils.py` |
| UTIL-01 | Log errors and status to rotating file (`RotatingFileHandler`) | `logging.handlers.RotatingFileHandler`; `maxBytes=5MB`, `backupCount=3` |
| UTIL-02 | Configurable log level; Modbus communication errors always logged with timestamp | Dual-handler pattern (console INFO, file DEBUG); `logging.getLogger(__name__)` in every module |
| UTIL-03 | Modules in `src/` (`sensor.py`, `config_loader.py`, `csv_logger.py`, `utils.py`) with `src/__init__.py` | Package structure; `__init__.py` as empty file |
| DOC-04 | `requirements.txt` with pinned versions for all dependencies; `pip install -r requirements.txt` completes cleanly | Exact pins: `pymodbus==3.13.0`, `pyserial==3.5`, `PyYAML==6.0.3`, `tzdata>=2025.3`, `backports.zoneinfo==0.2.1` |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python | 3.9+ (3.8 min) | Runtime | Explicit project target; 3.8 EOL Oct 2024 but compatible |
| PyYAML | 6.0.3 | `config.yaml` loading | `yaml.safe_load()` handles all standard YAML types; no arbitrary code execution |
| pyserial | 3.5 | `serial.tools.list_ports.comports()` in `list_serial_ports.py` | Only library exposing cross-platform COM port enumeration with VID/PID |
| zoneinfo | stdlib (3.9+) | `ZoneInfo("America/Sao_Paulo")` timezone | Built-in since 3.9; PEP 615 replacement for pytz |
| backports.zoneinfo | 0.2.1 | zoneinfo backport for Python 3.8 only | Required when `from zoneinfo import ZoneInfo` raises `ImportError` |
| tzdata | >=2025.3 | IANA timezone database | MANDATORY on Windows — without it `ZoneInfo("America/Sao_Paulo")` raises `ZoneInfoNotFoundError` |
| logging | stdlib | Rotating file + console logging | `RotatingFileHandler` prevents unbounded log growth |
| pathlib | stdlib | Cross-platform filesystem paths | Cleaner than `os.path`; `/` operator for joining; `mkdir(parents=True, exist_ok=True)` |
| dataclasses | stdlib (3.7+) | `AppConfig` and `SensorReading` typed containers | Zero dependency; IDE autocomplete; enforces field types |
| struct | stdlib | Bit-exact signed 16-bit conversion in `to_signed16()` | Explicit byte-order, no ambiguity; alternative to arithmetic approach |

### Supporting (Phase 1 — not yet needed but pinned in requirements.txt)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pymodbus | 3.13.0 | Modbus RTU client | Phase 2 — pinned now in requirements.txt for consistency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `yaml.safe_load()` | `yaml.load()` | `yaml.load()` is unsafe (arbitrary code execution); never use without `Loader=yaml.SafeLoader` |
| `zoneinfo` + `tzdata` | `pytz` | `pytz` requires `.localize()` non-standard API; maintenance mode; superseded by PEP 615 |
| arithmetic `to_signed16` | `struct.unpack` version | Both correct; arithmetic is 2 lines and more readable; struct is explicit about byte order |
| `RotatingFileHandler` | `TimedRotatingFileHandler` | Rotating by size is simpler for this use case; time rotation adds complexity with marginal benefit |

**Installation:**
```bash
pip install PyYAML==6.0.3 pyserial==3.5 tzdata pymodbus==3.13.0 backports.zoneinfo==0.2.1
```

---

## Architecture Patterns

### Recommended Project Structure
```
wtvb01_notebook_logger/
├── list_serial_ports.py       # standalone — no src/ import, only pyserial
├── config.yaml                # user-editable; loaded by config_loader.py
├── requirements.txt           # all pinned versions
├── src/
│   ├── __init__.py            # empty — makes src/ a package
│   ├── config_loader.py       # CFG-01, CFG-02, CFG-03
│   └── utils.py               # STORE-03, UTIL-02, to_signed16(), deep_merge()
├── logs/                      # created by setup_logging() at first run
└── tests/
    ├── test_utils.py           # to_signed16() boundary tests, timezone tests
    └── test_config_loader.py   # valid YAML, missing keys, invalid values
```

Note: `sensor.py` and `csv_logger.py` appear in UTIL-03 but are built in Phase 2 and Phase 3 respectively. Phase 1 creates their stubs as empty files with docstrings so the `src/` package is complete from day one.

### Pattern 1: Config Loader with Defaults
**What:** Load YAML with `yaml.safe_load()`, merge with code-defined DEFAULTS, validate, return typed `AppConfig` dataclass. Exit with code 1 on any validation failure.
**When to use:** Always — config errors must block startup before any I/O.
**Example:**
```python
# src/config_loader.py
import sys
import yaml
from dataclasses import dataclass
from pathlib import Path
from src.utils import deep_merge

DEFAULTS = {
    "serial_port": None,         # required — no default
    "baudrate": 9600,
    "slave_id": 80,              # 0x50 hex
    "sample_interval_seconds": 0.1,
    "output_folder": "data",
    "csv_filename_prefix": "wtvb01",
    "log_level": "INFO",
}

@dataclass
class AppConfig:
    serial_port: str
    baudrate: int
    slave_id: int
    sample_interval_seconds: float
    output_folder: str
    csv_filename_prefix: str
    log_level: str

def load_config(path: Path = Path("config.yaml")) -> AppConfig:
    raw = {}
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}
    merged = deep_merge(DEFAULTS, raw)
    _validate(merged, path)
    return AppConfig(**merged)

def _validate(cfg: dict, path: Path) -> None:
    errors = []
    if not cfg.get("serial_port"):
        errors.append("serial_port is required — edit config.yaml and set your COM port (e.g., serial_port: COM3)")
    if not isinstance(cfg.get("baudrate"), int) or cfg["baudrate"] not in (1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200):
        errors.append(f"baudrate must be a standard baud rate integer (e.g., 9600), got: {cfg.get('baudrate')!r}")
    if not isinstance(cfg.get("slave_id"), int) or not (1 <= cfg["slave_id"] <= 247):
        errors.append(f"slave_id must be an integer 1-247 (default: 80 = 0x50 hex), got: {cfg.get('slave_id')!r}")
    if not isinstance(cfg.get("sample_interval_seconds"), (int, float)) or cfg["sample_interval_seconds"] <= 0:
        errors.append(f"sample_interval_seconds must be a positive number, got: {cfg.get('sample_interval_seconds')!r}")
    if errors:
        print(f"Configuration error in {path}:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)
```

### Pattern 2: ZoneInfo Import Guard (Python 3.8/3.9+ compatibility)
**What:** Try stdlib `zoneinfo` first; fall back to `backports.zoneinfo` on Python 3.8.
**When to use:** Everywhere `ZoneInfo` is imported — exactly one place (top of `utils.py`).
**Example:**
```python
# src/utils.py — top of file
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo  # Python 3.8

TZ_SAO_PAULO = ZoneInfo("America/Sao_Paulo")

def now_local():
    """Return current datetime with America/Sao_Paulo timezone."""
    from datetime import datetime
    return datetime.now(tz=TZ_SAO_PAULO)
```

### Pattern 3: to_signed16() — Two's Complement Conversion
**What:** Convert unsigned 16-bit Modbus register value to signed Python int.
**When to use:** Before every scale factor multiplication applied to a Modbus register.
**Example:**
```python
# src/utils.py
def to_signed16(value: int) -> int:
    """Convert unsigned 16-bit int (0-65535) to signed int (-32768 to 32767).

    Modbus registers are unsigned 16-bit. Sensors encode negative values using
    two's complement: 0x8000 (32768) = -32768, 0xFFFF (65535) = -1.

    Args:
        value: Unsigned integer in range 0-65535.

    Returns:
        Signed integer in range -32768 to 32767.
    """
    if value >= 32768:
        return value - 65536
    return value
```

Boundary truth table (must match unit tests exactly):
| Input | Expected | Explanation |
|-------|----------|-------------|
| 0 | 0 | Positive zero — unchanged |
| 1 | 1 | Small positive — unchanged |
| 32767 | 32767 | Maximum positive (0x7FFF) — unchanged |
| 32768 | -32768 | Minimum negative (0x8000) — sign bit set |
| 65535 | -1 | Maximum unsigned = -1 signed (0xFFFF) |

### Pattern 4: deep_merge() for Config Defaults
**What:** Recursively merge two dicts, with right dict overriding left (user overrides defaults).
**When to use:** In `config_loader.py` to merge DEFAULTS with raw YAML content.
**Example:**
```python
# src/utils.py
def deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge override into base. override keys win on conflict."""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result
```

### Pattern 5: list_serial_ports.py Standalone Script
**What:** Enumerate serial ports and print device name, description, and hardware ID.
**When to use:** Run manually before first hardware connection to identify COM port.
**Example:**
```python
# list_serial_ports.py — top-level, no src/ import needed
import serial.tools.list_ports

def list_ports() -> None:
    ports = serial.tools.list_ports.comports()
    if not ports:
        print("No serial ports found.")
        print("  Windows: check Device Manager -> Ports (COM & LPT)")
        print("  Linux: check /dev/ttyUSB* — ensure user is in 'dialout' group")
        return
    print(f"Found {len(ports)} serial port(s):")
    for p in sorted(ports):
        print(f"  {p.device:15s}  {p.description}")
        print(f"  {'':15s}  HW: {p.hwid}")

if __name__ == "__main__":
    list_ports()
```

### Pattern 6: Logging Setup
**What:** Dual-handler logging — INFO to console, DEBUG to rotating file. Called once in `main.py` or `setup_logging()` helper in `utils.py`.
**When to use:** Phase 1 sets up the logging infrastructure even though only Phase 3 has `main.py`. Config loader and utils should use `logging.getLogger(__name__)` from day one.
**Example:**
```python
# src/utils.py (or called from main.py in Phase 3)
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

def setup_logging(log_dir: Path = Path("logs"), level: str = "INFO") -> None:
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "wtvb01.log"

    numeric_level = getattr(logging, level.upper(), logging.INFO)
    root = logging.getLogger()
    root.setLevel(logging.DEBUG)

    fmt = logging.Formatter(
        "%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    ch = logging.StreamHandler()
    ch.setLevel(numeric_level)
    ch.setFormatter(fmt)
    root.addHandler(ch)

    fh = RotatingFileHandler(
        log_path,
        maxBytes=5 * 1024 * 1024,  # 5 MB
        backupCount=3,
        encoding="utf-8",
    )
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)
    root.addHandler(fh)
```

### Anti-Patterns to Avoid

- **`yaml.load()` without Loader:** Use `yaml.safe_load()` always. `yaml.load()` can execute arbitrary Python objects embedded in YAML. PyYAML 6.x raises an error if `Loader` is omitted.
- **Hardcoded `-03:00` offset instead of `ZoneInfo`:** Brazil abolished DST in 2019 so the offset is currently stable, but using `ZoneInfo("America/Sao_Paulo")` is the correct practice for IANA timezone handling and historical data correctness.
- **`datetime.now()` without timezone:** Produces a naive datetime — no offset in ISO string output. Always use `datetime.now(tz=TZ_SAO_PAULO)`.
- **`logging.basicConfig()` in modules:** Any module calling `basicConfig()` before `main.py` sets up handlers will lock the logging configuration, silently preventing `RotatingFileHandler` from being added. Modules only call `logging.getLogger(__name__)`.
- **`dict | other` merge syntax:** Python 3.9+ only. Use `deep_merge()` or `{**a, **b}` for 3.8 compatibility.
- **`list[int]` lowercase type hints in function signatures:** Python 3.9+ only. Use `from typing import List` and `List[int]` for 3.8 compatibility.
- **match/case statements:** Python 3.10+ only. Use `if/elif` chains.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing | Custom INI/JSON parser | `yaml.safe_load()` from PyYAML | YAML handles comments, nested keys, type coercion; PyYAML is battle-tested |
| Serial port enumeration | `subprocess("mode")` or registry queries | `serial.tools.list_ports.comports()` | Cross-platform; returns structured objects with VID/PID; works on Windows/Linux/macOS |
| Rotating log files | Manual `os.rename()` + size checks | `logging.handlers.RotatingFileHandler` | Handles file locking, rotation, backup naming atomically |
| Timezone-aware timestamps | Hardcoded UTC offset arithmetic | `ZoneInfo` + `tzdata` | Handles DST edge cases, historical dates, IANA database updates |
| Signed 16-bit conversion | No custom bit manipulation beyond the one-liner | `to_signed16()` in `utils.py` (2 lines) | The arithmetic is trivial once written correctly; the risk is in not testing it |
| Config merging | No recursive merge from scratch | `deep_merge()` utility (8 lines) | The stdlib `dict.update()` is shallow-only and overwrites nested dicts entirely |

**Key insight:** Phase 1 is pure Python scaffolding. Every problem here has a stdlib or single-library solution. The value is in assembling them correctly and testing boundaries — not in custom implementations.

---

## Common Pitfalls

### Pitfall 1: `ZoneInfoNotFoundError` on Windows (tzdata missing)
**What goes wrong:** `ZoneInfo("America/Sao_Paulo")` raises `ZoneInfoNotFoundError` at import time. Windows does not ship the IANA timezone database. Linux and macOS have it in `/usr/share/zoneinfo`; Windows has nothing equivalent.
**Why it happens:** Developer tests on Linux where it works, then deploys to Windows where it fails immediately at startup.
**How to avoid:** `tzdata` in `requirements.txt` unconditionally (not just for Windows). Verified locally: `tzdata==2026.2` + `ZoneInfo("America/Sao_Paulo")` works correctly on this machine.
**Warning signs:** `ZoneInfoNotFoundError: No time zone found with key America/Sao_Paulo` at startup.

### Pitfall 2: `yaml.load()` without Loader (security + deprecation)
**What goes wrong:** In PyYAML 6.x, calling `yaml.load(f)` without a Loader argument raises `TypeError`. In earlier versions it emits a warning and silently allows arbitrary Python object construction from YAML.
**Why it happens:** Old tutorials and StackOverflow answers from pre-2020 show `yaml.load(f)`.
**How to avoid:** Always `yaml.safe_load(f)`. It handles all standard YAML types and is safe for config files.
**Warning signs:** `TypeError: load() missing 1 required positional argument: 'Loader'` in PyYAML 6.x.

### Pitfall 3: Config validation silent on wrong types
**What goes wrong:** PyYAML parses `baudrate: "9600"` (quoted string) as a Python string, not int. Later code does `baudrate=config["baudrate"]` and passes a string to pymodbus, which raises a cryptic `TypeError` in Phase 2.
**Why it happens:** YAML type coercion: unquoted `9600` → int, quoted `"9600"` → str. Users editing config.yaml may add quotes accidentally.
**How to avoid:** Explicit `isinstance()` checks in `_validate()` with human-readable error messages listing the expected type and valid range.
**Warning signs:** `TypeError: an integer is required` deep in pymodbus code — hard to trace back to YAML.

### Pitfall 4: Python 3.8 type hint syntax
**What goes wrong:** Using `list[int]` (lowercase) in a type annotation raises `TypeError: 'type' object is not subscriptable` on Python 3.8.
**Why it happens:** The `list[int]` syntax was added in Python 3.9. On 3.8, only `List[int]` from `typing` works (or `from __future__ import annotations` to defer evaluation).
**How to avoid:** In `src/utils.py` and `src/config_loader.py`, import `from typing import List, Optional, Dict` and use those for all type hints. Or add `from __future__ import annotations` at the top of every module.
**Warning signs:** `TypeError: 'type' object is not subscriptable` at module import on Python 3.8.

### Pitfall 5: `to_signed16()` tested only for positive inputs
**What goes wrong:** Testing `to_signed16(0)`, `to_signed16(1)`, `to_signed16(100)` all pass. The bug — treating 32768 as positive — is only caught by testing values >= 32768.
**Why it happens:** Developers write the test after writing the function and unconsciously test the happy path.
**How to avoid:** Write tests for all five specified boundary values: `0, 1, 32767, 32768, 65535` — specifically including both sides of the 32768 boundary. The requirement mandates these five exactly.
**Warning signs:** Accelerometer reads ~32g at rest in Phase 2 (gravity is ~1g on Z axis).

### Pitfall 6: `slave_id: 0x50` read as hex in YAML, but `slave_id: "0x50"` read as string
**What goes wrong:** PyYAML parses unquoted `0x50` as integer 80 (correct). Quoted `"0x50"` is parsed as string (incorrect — causes TypeError in pymodbus). Some users write `slave_id: 50` (decimal confusion — 0x50 hex = 80 decimal, not 50).
**How to avoid:** Use `slave_id: 80` in config.yaml with comment `# 0x50 hex = 80 decimal`. Validate with `assert isinstance(slave_id, int) and 1 <= slave_id <= 247`.
**Warning signs:** `TypeError` when slave_id passed to Modbus call; or Phase 2 complete silence with slave ID 50.

---

## Code Examples

Verified patterns from official sources and project domain research:

### requirements.txt (pinned)
```
# requirements.txt
pymodbus==3.13.0       # pin exact — API changed within 3.x series
pyserial==3.5          # pin exact — used by pymodbus and list_serial_ports.py
PyYAML==6.0.3          # pin exact — safe_load API stable
tzdata>=2025.3         # MANDATORY on Windows for ZoneInfo("America/Sao_Paulo")
backports.zoneinfo==0.2.1  # Required on Python 3.8 only; harmless on 3.9+
```

### config.yaml (minimal with all CFG-01/02/03 fields)
```yaml
# config.yaml — WTVB01 Notebook Logger configuration

# REQUIRED — identify your port by running: python list_serial_ports.py
serial_port: COM3

# Connection parameters (defaults shown)
baudrate: 9600          # WTVB01-485 factory default — do not change unless reconfigured
slave_id: 80            # 0x50 hex = 80 decimal — WitMotion WTVB01-485 factory default

# Sampling
sample_interval_seconds: 0.1  # 10 Hz — minimum effective rate is ~0.02s on Windows

# Output
output_folder: data
csv_filename_prefix: wtvb01

# Logging (DEBUG, INFO, WARNING, ERROR, CRITICAL)
log_level: INFO
```

### ZoneInfo timestamp pattern (STORE-03)
```python
# src/utils.py
from datetime import datetime

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo  # Python 3.8

TZ_SAO_PAULO = ZoneInfo("America/Sao_Paulo")

def now_local() -> datetime:
    """Return current local datetime with America/Sao_Paulo timezone."""
    return datetime.now(tz=TZ_SAO_PAULO)

def timestamp_iso(dt: datetime) -> str:
    """Format datetime as ISO 8601 with UTC offset and microseconds.

    Returns string like: '2026-05-19T14:32:01.123456-03:00'
    """
    return dt.isoformat()
```

### src/__init__.py (UTIL-03)
```python
# src/__init__.py
# Package marker — intentionally empty.
# Do not add imports here; each module imports what it needs explicitly.
```

### Stub files for Phase 2/3 (UTIL-03 — src/ package completeness)
```python
# src/sensor.py — STUB, implemented in Phase 2
"""WitMotionSensor: Modbus RTU connection and register reading. Built in Phase 2."""

# src/csv_logger.py — STUB, implemented in Phase 3
"""CSVLogger: timestamped CSV append with flush-per-row. Built in Phase 3."""
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pytz.timezone().localize(dt)` | `datetime.now(ZoneInfo("America/Sao_Paulo"))` | Python 3.9 (PEP 615, 2021) | Simpler API; no `.localize()` footgun; stdlib |
| `yaml.load(f)` | `yaml.safe_load(f)` | PyYAML 5.1 (2019) | Security fix; PyYAML 6.x errors on unsafe load |
| `os.path.join("logs", "app.log")` | `Path("logs") / "app.log"` | Python 3.4 (pathlib) | Cleaner, cross-platform, object-oriented |
| `from pymodbus.client.sync import ModbusSerialClient` | `from pymodbus.client import ModbusSerialClient` | pymodbus 3.0 (2022) | Old path removed entirely in 3.x |
| `unit=80` in Modbus calls | `slave=80` | pymodbus 3.5 (within 3.x) | `unit=` removed (not deprecated — removed) |

**Deprecated/outdated:**
- `pytz`: Maintenance mode. PEP 615 (zoneinfo) is the official replacement. Do not add to requirements.
- `yaml.load()` without Loader: Unsafe. PyYAML 6.x raises `TypeError`. Use `yaml.safe_load()`.
- `from pymodbus.client.sync import ...`: Removed in pymodbus 3.x. Use `from pymodbus.client import ...`.

---

## Open Questions

1. **Python version to target: 3.8 exactly, or 3.9+?**
   - What we know: Project says "3.8+" but 3.8 reached EOL October 2024. The research (STACK.md) recommends 3.9+ in practice.
   - What's unclear: Whether the target machine (user's Windows notebook) actually has Python 3.9+ available.
   - Recommendation: Write the code with the `backports.zoneinfo` try/except guard and `from typing import List` so it is compatible with 3.8, but target and test against the Python version actually installed on the user's machine. The guard costs nothing.

2. **`sensor_id` field — where does it come from in Phase 1?**
   - What we know: STORE-03 (Phase 1) establishes the timestamp utility. STORE-02 (Phase 3) specifies the `sensor_id` CSV column. `SensorReading` dataclass is Phase 1's `utils.py`.
   - What's unclear: Should the `SensorReading` dataclass be fully defined with all 17 fields in Phase 1, or defined minimally and expanded in Phase 2?
   - Recommendation: Define the full `SensorReading` dataclass in Phase 1 `utils.py` (it is pure data, no I/O dependency). Include `sensor_id: str` field. This lets Phase 2 populate it immediately without modifying `utils.py`.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true` in `.planning/config.json`).
Phase 1 is pure Python scaffolding — no hardware. All validation is automated or shell-executable.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (latest compatible with Python 3.8+) |
| Config file | `pytest.ini` or `pyproject.toml [tool.pytest.ini_options]` — Wave 0 gap |
| Quick run command | `pytest tests/ -x -q` |
| Full suite command | `pytest tests/ -v --tb=short` |

pytest is not yet in `requirements.txt` (it is a dev dependency). Add it to a `requirements-dev.txt` or add as `pytest` to requirements.txt with a `# dev` comment.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| UTIL-03 / structural | `src/` package structure exists with `__init__.py` | smoke | `python -c "from src.utils import to_signed16; from src.config_loader import load_config"` | Wave 0 gap |
| CFG-01 | `config.yaml` defines all required fields | manual | Open `config.yaml` and verify all 6 fields present with comments | Wave 0 gap |
| CFG-02 | Missing `serial_port` produces human-readable error and exits with code 1 | unit | `pytest tests/test_config_loader.py::test_missing_serial_port -x` | Wave 0 gap |
| CFG-02 | Invalid `baudrate` type produces human-readable error and exits with code 1 | unit | `pytest tests/test_config_loader.py::test_invalid_baudrate -x` | Wave 0 gap |
| CFG-02 | Invalid `slave_id` range produces human-readable error and exits with code 1 | unit | `pytest tests/test_config_loader.py::test_invalid_slave_id -x` | Wave 0 gap |
| CFG-03 | Loading minimal YAML applies all defaults | unit | `pytest tests/test_config_loader.py::test_defaults_applied -x` | Wave 0 gap |
| CFG-03 | Loading empty YAML (no file) applies all defaults except serial_port | unit | `pytest tests/test_config_loader.py::test_no_config_file -x` | Wave 0 gap |
| STORE-03 | `datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat()` produces `-03:00` offset | unit | `pytest tests/test_utils.py::test_timezone_offset -x` | Wave 0 gap |
| STORE-03 | Timestamp includes microseconds in ISO 8601 output | unit | `pytest tests/test_utils.py::test_timestamp_has_microseconds -x` | Wave 0 gap |
| UTIL-01 | `setup_logging()` creates `logs/` directory and log file | unit | `pytest tests/test_utils.py::test_setup_logging_creates_dir -x` | Wave 0 gap |
| UTIL-02 | `RotatingFileHandler` configured with 5 MB max and 3 backups | unit | `pytest tests/test_utils.py::test_rotating_handler_params -x` | Wave 0 gap |
| CONN-04 | `list_serial_ports.py` runs without error (no hardware) | smoke | `python list_serial_ports.py` (exits 0 even if no ports found) | Wave 0 gap |
| DOC-04 | `pip install -r requirements.txt` completes cleanly | manual | Run in a fresh virtualenv: `python -m venv .venv && .venv/Scripts/pip install -r requirements.txt` | Wave 0 gap |

### `to_signed16()` Boundary Test Specification

The success criterion mandates exactly five boundary values. Tests must use `assert` statements (not range checks) to pin exact expected values:

```python
# tests/test_utils.py
import pytest
from src.utils import to_signed16

@pytest.mark.parametrize("raw,expected", [
    (0,     0),       # zero — unchanged
    (1,     1),       # small positive — unchanged
    (32767, 32767),   # maximum positive (0x7FFF) — unchanged
    (32768, -32768),  # minimum negative (0x8000) — sign bit boundary
    (65535, -1),      # maximum unsigned = -1 signed (0xFFFF)
])
def test_to_signed16_boundary_values(raw, expected):
    assert to_signed16(raw) == expected

def test_to_signed16_mid_negative():
    """Additional: mid-range negative value should convert correctly."""
    assert to_signed16(32769) == -32767  # 0x8001

def test_to_signed16_does_not_modify_zero_to_32767():
    """All values below sign bit must be returned unchanged."""
    for v in (0, 1, 100, 32767):
        assert to_signed16(v) == v
```

### Config Loader Test Specification

```python
# tests/test_config_loader.py
import pytest
import sys
from pathlib import Path
from src.config_loader import load_config

def test_defaults_applied(tmp_path):
    """Minimal config applies all CFG-03 defaults."""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text("serial_port: COM3\n")
    cfg = load_config(cfg_file)
    assert cfg.baudrate == 9600
    assert cfg.slave_id == 80
    assert cfg.sample_interval_seconds == 0.1
    assert cfg.output_folder == "data"

def test_missing_serial_port_exits(tmp_path):
    """Missing serial_port must exit with code 1."""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text("baudrate: 9600\n")
    with pytest.raises(SystemExit) as exc:
        load_config(cfg_file)
    assert exc.value.code == 1

def test_invalid_baudrate_type_exits(tmp_path):
    """String baudrate must exit with code 1."""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text("serial_port: COM3\nbaudrate: '9600'\n")
    with pytest.raises(SystemExit) as exc:
        load_config(cfg_file)
    assert exc.value.code == 1

def test_slave_id_out_of_range_exits(tmp_path):
    """slave_id=300 (>247) must exit with code 1."""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text("serial_port: COM3\nslave_id: 300\n")
    with pytest.raises(SystemExit) as exc:
        load_config(cfg_file)
    assert exc.value.code == 1

def test_user_values_override_defaults(tmp_path):
    """User-supplied baudrate overrides default."""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text("serial_port: COM3\nbaudrate: 19200\n")
    cfg = load_config(cfg_file)
    assert cfg.baudrate == 19200
```

### Sampling Rate
- **Per task commit:** `pytest tests/ -x -q` (fails fast on first error)
- **Per wave merge:** `pytest tests/ -v --tb=short` (full verbose output)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
All of the following must be created before implementation begins:
- [ ] `tests/__init__.py` — empty, makes `tests/` a package
- [ ] `tests/test_utils.py` — covers `to_signed16()` boundaries, timezone offset, logging setup
- [ ] `tests/test_config_loader.py` — covers defaults, missing keys, type validation, range validation
- [ ] `pytest.ini` (or `pyproject.toml`) — minimal pytest config pointing to `tests/` directory
- [ ] `requirements-dev.txt` (or add `pytest` to `requirements.txt` with `# dev` comment)
- [ ] Framework install: `pip install pytest` — if not already installed

---

## Sources

### Primary (HIGH confidence)
- Domain research `SUMMARY.md`, `STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md` — pre-researched on 2026-05-19 with live PyPI version queries; directly applicable to Phase 1
- Python stdlib documentation (zoneinfo, logging, csv, pathlib, dataclasses, struct) — stdlib APIs are stable
- PyYAML 6.0.x documentation — `safe_load()` API; security implications of `yaml.load()` without Loader

### Secondary (MEDIUM confidence)
- PyPI live queries (pymodbus 3.13.0, pyserial 3.5, PyYAML 6.0.3, tzdata 2026.2, backports.zoneinfo 0.2.1) — executed 2026-05-19 on this machine; confirmed current latest versions

### Tertiary (LOW confidence)
- Python 3.8 typing compatibility constraints — from training knowledge (knowledge cutoff August 2025); stable since 3.8 release; low risk of change

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed via live PyPI queries on 2026-05-19
- Architecture: HIGH — pure Python stdlib patterns; no hardware dependency in Phase 1
- Pitfalls: HIGH for items 1-4 (tzdata, yaml.load, type checking, to_signed16 testing); MEDIUM for item 6 (YAML hex parsing — well-known but not live-verified)

**Research date:** 2026-05-19
**Valid until:** 2026-08-19 (stable stdlib patterns; check PyPI for tzdata/pyserial updates if significantly later)
