# Architecture Patterns

**Domain:** Python Modbus RTU industrial data acquisition logger
**Project:** WTVB01 Notebook Logger (WitMotion WTVB01-485)
**Researched:** 2026-05-19
**Confidence:** HIGH — pymodbus and Python serial patterns are stable and well-documented

---

## Recommended Architecture

```
main.py
  |
  +--> load_config()          (config_loader.py)
  |         |
  |         v
  +--> WitMotionSensor        (sensor.py)        <-- Modbus RTU lifecycle
  |         |
  |         | SensorReading dataclass (utils.py)
  |         v
  +--> acquisition_loop()     (main.py)
            |
            +--> CSVLogger.write()   (csv_logger.py)
            +--> console_print()     (main.py or utils.py)
            +--> [future: callbacks] (see extension section)
```

Data flows in ONE direction: Sensor → Reading → Consumers. Consumers never talk back to Sensor.

---

## Component Boundaries

| Component | File | Responsibility | Does NOT do |
|-----------|------|---------------|-------------|
| Config loader | `config_loader.py` | Load YAML, merge defaults, validate types | Never touches serial/Modbus |
| Sensor | `sensor.py` | Modbus connection lifecycle, raw register read, unit conversion | Never writes CSV or prints |
| CSV Logger | `csv_logger.py` | Open file, write header, append rows, flush strategy | Never knows about Modbus |
| Utils | `utils.py` | SensorReading dataclass, signed-16 conversion, serial port discovery | Pure functions only, no I/O |
| Main | `main.py` | Wire components together, acquisition loop, signal handler | Minimal logic — orchestration only |

---

## Data Flow Direction

```
config.yaml
    |
    v
AppConfig (dataclass)
    |
    v
WitMotionSensor.connect()
    |
    v
WitMotionSensor.read_all() --> raw_registers (list[int])
    |
    v
_convert_registers()       --> SensorReading (dataclass, typed, in physical units)
    |
    v
[acquisition loop dispatches to all consumers]
    |
    +----> CSVLogger.write(reading)
    +----> print_to_console(reading)
    +----> [future: MQTTPublisher.publish(reading)]
    +----> [future: InfluxDBWriter.write(reading)]
```

`SensorReading` is the contract between the sensor layer and all consumers. It must never contain raw register integers — only converted, typed physical values plus a timezone-aware timestamp.

---

## Component Design Details

### 1. WitMotionSensor class (sensor.py)

**Separation of concerns principle:** The class knows about Modbus and the WTVB01 register map. It knows nothing about CSV, logging destinations, or display format.

```python
# Conceptual structure — not implementation code
class WitMotionSensor:
    def __init__(self, port, baudrate, slave_id, timeout, retries)
    def connect() -> None          # raises ConnectionError if fails
    def disconnect() -> None       # always safe to call, even if not connected
    def read_all() -> SensorReading  # raises ModbusReadError on failure
    def is_connected() -> bool
    # private:
    def _read_registers(start, count) -> list[int]
    def _convert(raw_registers) -> SensorReading
```

**Connection lifecycle:**
- `connect()` creates the `ModbusSerialClient` and calls `.connect()`. pymodbus 3.x returns `bool` from `.connect()` — check it explicitly. Do not swallow False silently.
- Store `self._client` as instance variable. Do NOT create a new client on every read — that causes serial port thrashing.
- `disconnect()` calls `self._client.close()` inside a `try/except` so it is always safe in `finally` blocks.
- `is_connected()` returns `self._client is not None and self._client.connected` (pymodbus 3.x exposes `.connected` property).

**Read pattern (pymodbus 3.x):**
```python
# pymodbus 3.x synchronous pattern
result = self._client.read_holding_registers(
    address=0x34,
    count=19,           # 0x34 through 0x46 = 19 registers in one burst
    slave=self._slave_id
)
if result.isError():
    raise ModbusReadError(str(result))
return result.registers   # list of 19 unsigned 16-bit ints
```

Read all registers in a SINGLE burst (0x34 to 0x46, count=19) rather than individual reads. This minimizes round-trips on a 9600-baud RS-485 link. At 9600 baud, each Modbus RTU frame takes ~10-20ms; a burst read costs ~30ms total vs ~570ms for 19 individual reads.

**pymodbus version note:** pymodbus 3.x changed the API significantly from 2.x. The synchronous client is `ModbusSerialClient` from `pymodbus.client`. The `slave=` parameter replaces the old `unit=` parameter. In 3.x, `.connect()` returns `bool` (not None). Confidence: HIGH based on pymodbus 3.x changelog and stable API since 3.0.

### 2. Retry / Reconnect Pattern (main.py acquisition loop)

Do NOT put retry logic inside `WitMotionSensor.read_all()`. Keep the sensor class simple. Handle retries in the acquisition loop:

```python
# Acquisition loop retry pattern (conceptual)
consecutive_failures = 0
MAX_CONSECUTIVE_FAILURES = 5

while running:
    loop_start = time.monotonic()
    try:
        reading = sensor.read_all()
        consecutive_failures = 0
        csv_logger.write(reading)
        print_reading(reading)
    except ModbusReadError as e:
        consecutive_failures += 1
        logger.warning(f"Read failure {consecutive_failures}/{MAX_CONSECUTIVE_FAILURES}: {e}")
        if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
            logger.error("Too many failures, attempting reconnect...")
            sensor.disconnect()
            time.sleep(2.0)
            sensor.connect()   # let ConnectionError propagate if unrecoverable
            consecutive_failures = 0

    # Timing: sleep for remainder of interval to maintain sample rate
    elapsed = time.monotonic() - loop_start
    sleep_time = max(0.0, config.interval_seconds - elapsed)
    time.sleep(sleep_time)
```

**Why `time.monotonic()` for timing:** `time.time()` can jump backward (NTP sync, DST). `time.monotonic()` is guaranteed monotonic. Use it for interval timing; use `datetime.now(tz)` only for the human-readable timestamp stored in SensorReading.

**Blocking vs async:** Use blocking/synchronous for this project. Reasons:
- 9600 baud Modbus RTU is inherently slow; async adds complexity with no benefit at this throughput
- pymodbus 3.x sync client is simpler and more stable for RTU
- `time.sleep()` in a loop is perfectly adequate for 1-10Hz sampling
- Async becomes worthwhile only when polling multiple devices simultaneously (out of scope)

### 3. Signed 16-bit Conversion (utils.py)

This is a common industrial sensor gotcha. Modbus registers return unsigned 16-bit integers (0 to 65535). The WitMotion sensor stores signed values in two's complement.

**Canonical Python pattern:**

```python
import struct

def to_signed16(raw: int) -> int:
    """Convert unsigned 16-bit Modbus register value to signed int."""
    # struct.pack/unpack is the most readable and reliable method
    return struct.unpack('>h', struct.pack('>H', raw))[0]

# Alternative (pure arithmetic, same result):
def to_signed16_alt(raw: int) -> int:
    return raw if raw < 32768 else raw - 65536
```

The `struct` approach is preferred because it is explicit about byte order and width, making the intent obvious to readers unfamiliar with two's complement arithmetic.

**Physical unit conversion table (from PROJECT.md register map):**

```python
# In utils.py
ACCEL_SCALE    = 16.0 / 32768.0   # g  (registers 0x34-0x36)
VIBVEL_SCALE   = ???               # mm/s (0x3A-0x3C) — NEEDS VALIDATION
ANGLE_SCALE    = ???               # degrees (0x3D-0x3F) — NEEDS VALIDATION
TEMP_SCALE     = 1.0 / 100.0      # °C  (0x40) — common WitMotion convention
DISPLACEMENT_SCALE = ???          # µm  (0x41-0x43) — NEEDS VALIDATION
FREQUENCY_SCALE    = ???          # Hz  (0x44-0x46) — NEEDS VALIDATION
```

CRITICAL: The acceleration scale (`/ 32768 * 16`) is confirmed in PROJECT.md. The scales for vibration velocity, displacement, and frequency are NOT documented in PROJECT.md. These MUST be validated against the WitMotion WTVB01-485 datasheet during Phase 1 implementation. Do not assume they share the same divisor as acceleration.

### 4. SensorReading dataclass (utils.py)

```python
from dataclasses import dataclass
from datetime import datetime

@dataclass
class SensorReading:
    timestamp: datetime            # timezone-aware, America/Sao_Paulo
    accel_x: float                 # g
    accel_y: float                 # g
    accel_z: float                 # g
    vibvel_x: float                # mm/s
    vibvel_y: float                # mm/s
    vibvel_z: float                # mm/s
    angle_x: float                 # degrees
    angle_y: float                 # degrees
    angle_z: float                 # degrees
    temperature: float             # °C
    displacement_x: float          # µm
    displacement_y: float          # µm
    displacement_z: float          # µm
    frequency_x: float             # Hz
    frequency_y: float             # Hz
    frequency_z: float             # Hz
```

Use `@dataclass` (not `@dataclass(frozen=True)`) to keep it mutable for testing. All fields are typed. No raw register values exposed — the dataclass is the public contract.

### 5. CSVLogger (csv_logger.py)

**File corruption risk:** The main risk is a partial row being written if the process is killed mid-write. The mitigation is: write complete rows atomically (a single `csv.writer.writerow()` call) and flush after every row.

```python
# csv_logger.py pattern (conceptual)
import csv
import io
from pathlib import Path

class CSVLogger:
    def __init__(self, output_dir: Path, filename_prefix: str):
        # Generate filename with date: "wtvb01_2026-05-19.csv"
        # Create parent directories with parents=True, exist_ok=True
        self._file = open(path, 'a', newline='', encoding='utf-8', buffering=1)
        # buffering=1 = line-buffered (flush on every newline)
        self._writer = csv.writer(self._file)
        if path.stat().st_size == 0:
            self._writer.writerow(HEADER_COLUMNS)

    def write(self, reading: SensorReading) -> None:
        self._writer.writerow(reading_to_row(reading))
        # buffering=1 handles flush automatically for text files

    def close(self) -> None:
        self._file.flush()
        self._file.close()
```

**Flush strategy:** `buffering=1` (line-buffered) is correct for text-mode files on CPython. It flushes on every newline, which `csv.writer.writerow()` always appends. This gives corruption safety without the overhead of `file.flush()` after every write.

**File naming:** `wtvb01_YYYY-MM-DD.csv` — one file per day, created fresh each run for the current date, opened in append mode (`'a'`) so a restart does not overwrite existing data from the same day.

**Header idempotency:** Check `path.stat().st_size == 0` after opening in append mode to decide whether to write the header. This prevents duplicate headers when restarting mid-day.

**newline='':** Required by the Python csv module docs. Without it, csv.writer double-writes `\r\n` on Windows.

### 6. Config Loader (config_loader.py)

**Pattern: load with defaults, validate, return typed dataclass.**

```python
# Defaults defined in code, not in YAML — YAML only overrides
DEFAULTS = {
    "serial": {
        "port": "COM3",
        "baudrate": 9600,
        "timeout": 1.0,
    },
    "modbus": {
        "slave_id": 80,   # 0x50
    },
    "acquisition": {
        "interval_seconds": 1.0,
        "max_retries": 5,
        "retry_delay_seconds": 2.0,
    },
    "output": {
        "directory": "data",
        "filename_prefix": "wtvb01",
    },
    "logging": {
        "level": "INFO",
        "file": "logs/wtvb01.log",
        "max_bytes": 5_242_880,   # 5 MB
        "backup_count": 3,
    },
}

def load_config(path: Path = Path("config.yaml")) -> AppConfig:
    raw = {}
    if path.exists():
        with open(path) as f:
            raw = yaml.safe_load(f) or {}
    merged = deep_merge(DEFAULTS, raw)
    return AppConfig.from_dict(merged)
```

**Why defaults in code not YAML:** If config.yaml is deleted or malformed, the application runs with safe defaults rather than crashing. The user can start with a minimal config.yaml that only overrides the port.

**Use `yaml.safe_load` not `yaml.load`:** `yaml.load` can execute arbitrary Python. `yaml.safe_load` is always correct for config files.

**`deep_merge` function:** A simple recursive dict merge where `raw` values override `DEFAULTS`. Available as a pure function in `utils.py`.

### 7. Serial Port Detection (list_serial_ports.py)

**Cross-platform pattern using `serial.tools.list_ports` from pyserial:**

```python
import serial.tools.list_ports

def list_ports():
    ports = serial.tools.list_ports.comports()
    for p in sorted(ports):
        print(f"{p.device:15s}  {p.description}  [{p.hwid}]")
```

`serial.tools.list_ports.comports()` works on Windows (COM*), Linux (`/dev/ttyUSB*`, `/dev/ttyACM*`), and macOS (`/dev/tty.usbserial-*`, `/dev/cu.*`) without any platform branching. pyserial handles the platform detection internally.

**In config_loader.py for auto-detection fallback:** If `config.yaml` does not specify a port, attempt to find the first port whose description matches known USB-RS485 chip signatures: `CH340`, `CP210`, `FTDI`, `USB Serial`. Offer it as a suggestion in the warning message but do not auto-connect without explicit confirmation — unexpected port selection is a worse failure mode than a clear error.

### 8. Logging Configuration (main.py setup)

Configure logging once at application startup in `main.py`, before any other imports initialize their loggers:

```python
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

def setup_logging(config):
    log_path = Path(config.logging.file)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)   # root captures all; handlers filter

    # Console: INFO and above, human-readable
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(logging.Formatter("%(levelname)-8s %(message)s"))
    root.addHandler(console)

    # File: DEBUG and above, with timestamps — rotating to prevent unbounded growth
    file_handler = RotatingFileHandler(
        log_path,
        maxBytes=config.logging.max_bytes,
        backupCount=config.logging.backup_count,
        encoding='utf-8',
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)-8s %(name)s: %(message)s")
    )
    root.addHandler(file_handler)
```

Each module then uses `logger = logging.getLogger(__name__)` — no configuration at module level, just name acquisition. This is the standard Python logging architecture.

**Do NOT use `logging.basicConfig()` if any RotatingFileHandler is needed.** `basicConfig()` is only for the simplest cases and cannot be reconfigured after the first call.

### 9. Graceful Shutdown (main.py)

```python
import signal

running = True

def handle_shutdown(signum, frame):
    global running
    running = False

signal.signal(signal.SIGINT, handle_shutdown)
signal.signal(signal.SIGTERM, handle_shutdown)

# ... acquisition loop checks `while running: ...`

# After loop exits:
finally:
    sensor.disconnect()
    csv_logger.close()
    logging.info("Shutdown complete.")
```

On Windows, `SIGTERM` may not arrive (process kill), but `SIGINT` (Ctrl+C) always does. The `finally` block in `main()` is the safety net.

---

## Extension Architecture: Observer/Callback Pattern

**Recommendation: Use a simple callback list (not full Observer pattern, not pub/sub).**

The callback list pattern is the correct choice for this project size. It adds zero dependencies, is trivially testable, and supports all planned extensions (MQTT, InfluxDB, REST).

```python
# In main.py (conceptual wiring)
consumers = [
    csv_logger.write,
    print_reading,
    # future: mqtt_publisher.publish,
    # future: influxdb_writer.write,
]

# In acquisition loop:
for consumer in consumers:
    try:
        consumer(reading)
    except Exception as e:
        logger.error(f"Consumer {consumer.__name__} failed: {e}")
        # One consumer failing must NOT stop others
```

**Why NOT a full Observer pattern (EventEmitter/subscribe/notify):** The overhead is unjustified for a list of 2-4 consumers. The callback list is explicit, debuggable, and avoids the magic of dynamic dispatch.

**Why NOT async pub/sub (e.g., asyncio.Queue):** This project is synchronous. Adding asyncio to support a single MQTT publisher would require converting the entire acquisition loop. The correct approach for future MQTT is a synchronous MQTT client (paho-mqtt) called directly as a callback, or a simple threading.Queue if network I/O latency becomes a concern.

**Extension contract:** Any future consumer must accept a single `SensorReading` argument and return None. Errors must not propagate — catch internally or let the loop's try/except catch them.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Mixing Modbus logic with output logic in sensor.py
**What goes wrong:** Adding `csv_writer.write()` calls inside `WitMotionSensor.read_all()` makes the sensor class untestable in isolation and impossible to reuse with different output backends.
**Instead:** Sensor returns `SensorReading`. Caller decides what to do with it.

### Anti-Pattern 2: Reading registers one at a time
**What goes wrong:** At 9600 baud, reading 19 individual registers takes ~570ms. The acquisition interval must be >600ms just to complete one read cycle.
**Instead:** One burst read from 0x34 to 0x46 (count=19) takes ~30ms.

### Anti-Pattern 3: Creating a new ModbusSerialClient per read
**What goes wrong:** Opening and closing the serial port on every read causes Windows to occasionally fail to reopen (port not released fast enough), and adds 100-300ms latency per open.
**Instead:** Connect once in `WitMotionSensor.connect()`, reuse `self._client` for the session lifetime.

### Anti-Pattern 4: Writing timestamps in UTC without explicit timezone
**What goes wrong:** Industrial CBM data with ambiguous timestamps becomes useless during DST transitions. "2026-11-01 01:30:00" is ambiguous — it occurs twice in Sao Paulo.
**Instead:** Always use `datetime.now(ZoneInfo('America/Sao_Paulo'))` and format with UTC offset included: `2026-05-19T14:30:00-03:00`.

### Anti-Pattern 5: `csv.writer` without `newline=''` on Windows
**What goes wrong:** Python's csv.writer appends `\r\n`; if the file is opened in text mode (default), Python adds another `\r`, resulting in blank rows in Excel.
**Instead:** `open(path, 'a', newline='', encoding='utf-8')` — always.

### Anti-Pattern 6: `yaml.load()` instead of `yaml.safe_load()`
**What goes wrong:** `yaml.load()` can deserialize arbitrary Python objects. A malformed config.yaml could execute code.
**Instead:** Always `yaml.safe_load()` for config files.

### Anti-Pattern 7: Global `logging.basicConfig()` in modules
**What goes wrong:** Any module that calls `basicConfig()` before `main.py` sets up logging will freeze the configuration, causing RotatingFileHandler to be silently ignored.
**Instead:** Modules only call `logging.getLogger(__name__)`. Only `main.py` configures handlers.

---

## Build Order Implications

The dependency graph drives the implementation order:

```
Phase 1 (foundation — no dependencies):
  utils.py        --> SensorReading dataclass, to_signed16(), deep_merge()
  config_loader.py --> AppConfig dataclass, load_config(), DEFAULTS

Phase 2 (depends on Phase 1):
  sensor.py       --> WitMotionSensor (needs AppConfig, SensorReading, utils)
  csv_logger.py   --> CSVLogger (needs SensorReading, AppConfig)

Phase 3 (depends on all above):
  main.py         --> wires everything together, acquisition loop, signal handler
  list_serial_ports.py --> standalone utility, no internal deps

Phase 4 (validation):
  Connect hardware, validate register scales, adjust conversion constants in utils.py
```

`utils.py` and `config_loader.py` can be written and unit-tested entirely without hardware. `sensor.py` requires either hardware or a Modbus simulator for testing. This ordering means progress is possible without the WTVB01 connected.

---

## Scalability Considerations

| Concern | Current (1 sensor, CSV) | Future (MQTT/InfluxDB) | Requires redesign? |
|---------|------------------------|------------------------|-------------------|
| Multiple consumers | Callback list in main.py | Add to callback list | No |
| Multiple sensors | Out of scope | New WitMotionSensor instances | No (sensor.py stays) |
| Higher sample rate | Reduce interval in config | Consider threading if >10Hz | Maybe at >50Hz |
| MQTT publishing | Not applicable | paho-mqtt as callback | No |
| InfluxDB writing | Not applicable | influxdb-client as callback | No |
| Dashboard | Not applicable | REST/WebSocket layer in main.py | No (sensor.py stays) |

The key insight: `sensor.py` does not change for any of these extensions. The acquisition loop in `main.py` gains additional consumers. `SensorReading` may gain fields but existing fields do not change.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| pymodbus 3.x API (ModbusSerialClient, .connect(), .read_holding_registers(), slave=) | HIGH | Stable since pymodbus 3.0; well-documented; matches training data |
| Burst register read pattern | HIGH | Standard Modbus best practice, independent of library version |
| Signed 16-bit struct pattern | HIGH | Python stdlib, deterministic behavior |
| csv module newline='' behavior on Windows | HIGH | Documented in Python csv module docs |
| RotatingFileHandler logging pattern | HIGH | Python stdlib, stable API |
| ZoneInfo for Sao Paulo timezone | HIGH | Available Python 3.9+; project requires 3.8+, needs `backports.zoneinfo` on 3.8 |
| WitMotion register scale factors (non-acceleration) | LOW | Only acceleration scale confirmed in PROJECT.md; others need datasheet validation |
| callback list as extension mechanism | HIGH | Well-established pattern for this scale of application |

**Important 3.8 compatibility note:** `ZoneInfo` is in the stdlib only from Python 3.9+. For 3.8 compatibility (stated in PROJECT.md constraints), add `backports.zoneinfo` to `requirements.txt` and use:
```python
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo
```

---

## Sources

- pymodbus 3.x documentation and API design (training data, HIGH confidence)
- Python csv module documentation — newline parameter behavior (training data, HIGH confidence)
- Python logging HOWTO — handler configuration pattern (training data, HIGH confidence)
- Python dataclasses documentation (training data, HIGH confidence)
- pyserial serial.tools.list_ports cross-platform behavior (training data, HIGH confidence)
- Modbus RTU protocol specification — burst register read efficiency (training data, HIGH confidence)
- WitMotion WTVB01-485 register map — acceleration scale confirmed in PROJECT.md; other scales LOW confidence pending datasheet
