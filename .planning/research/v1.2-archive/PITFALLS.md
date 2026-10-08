# Domain Pitfalls: Python Modbus RTU / RS-485 Industrial Data Acquisition

**Domain:** Python serial Modbus RTU acquisition with pymodbus, targeting WitMotion WTVB01-485
**Researched:** 2026-05-19
**Confidence:** HIGH for items 1-9, 11-13 (well-documented in official sources and community);
               MEDIUM for item 10 (WitMotion-specific quirks based on device class patterns)

---

## Critical Pitfalls

Mistakes that cause silent failures, rewrites, or data corruption.

---

### Pitfall 1: pymodbus 3.x API is completely different from 2.x

**What goes wrong:**
Code written for pymodbus 2.x breaks entirely under 3.x, and vice versa. The two versions
are not source-compatible. Copy-pasted examples from Stack Overflow or tutorials dated
before 2023 are almost certainly 2.x code that will fail under 3.x with cryptic errors.

**Exact breaking changes (2.x → 3.x):**

1. **Client construction** — `ModbusSerialClient` constructor signature changed:
   - 2.x: `ModbusSerialClient(method='rtu', port='COM3', baudrate=9600, ...)`
   - 3.x: `ModbusSerialClient('COM3', baudrate=9600, framer=FramerType.RTU, ...)`
   - The `method='rtu'` keyword is gone. First positional argument is now the port directly.
   - In 3.x, framer is specified via `framer=FramerType.RTU` from `pymodbus.framer`.

2. **`unit` parameter renamed to `slave`** — Every read/write call affected:
   - 2.x: `client.read_holding_registers(address=0x34, count=3, unit=80)`
   - 3.x: `client.read_holding_registers(address=0x34, count=3, slave=80)`
   - Using `unit=` in 3.x raises `TypeError` or silently uses the wrong slave.
   - In 3.5+, `unit` was fully removed (not deprecated — removed).

3. **Return value handling** — Response objects changed:
   - 2.x: `result.registers` could be `None` on error, no exception raised.
   - 3.x: Raises `ModbusException` on bus errors. Must wrap in try/except.
   - `result.isError()` still works but is secondary to exception handling in 3.x.

4. **`connect()` / `close()` context manager** — 3.x encourages `with` statement:
   - 2.x: Manual `client.connect()` / `client.close()` was the norm.
   - 3.x: `with ModbusSerialClient(...) as client:` is preferred; bare connect() still works.

5. **Async client** — 3.x split sync and async completely:
   - 3.x sync: `pymodbus.client.ModbusSerialClient`
   - 3.x async: `pymodbus.client.AsyncModbusSerialClient` (requires `await`)
   - 2.x mixed these via `asyncio` parameter — that parameter is gone.

6. **`stopbits`, `bytesize`, `parity` parameters** — Still present in 3.x but must be
   passed as keyword arguments, not positional.

**Why it happens:**
pymodbus 3.0 (released late 2022) was a ground-up rewrite. The project acknowledged
it broke backward compatibility. `pip install pymodbus` installs 3.x by default since 2023.

**Consequences:**
- `TypeError: __init__() got an unexpected keyword argument 'method'` — obvious
- `TypeError: read_holding_registers() got an unexpected keyword argument 'unit'` — obvious
- Silent wrong-slave communication if `unit` kwarg is silently ignored — dangerous

**Prevention:**
- Pin version in `requirements.txt`: `pymodbus>=3.5,<4.0`
- Write code targeting 3.x exclusively; do not support 2.x.
- Verify installed version at startup: `import pymodbus; assert pymodbus.__version__.startswith('3')`
- Use the 3.x import path: `from pymodbus.client import ModbusSerialClient`

**Detection (warning signs):**
- Any `TypeError` mentioning `method=` or `unit=`
- `ModuleNotFoundError: No module named 'pymodbus.client.sync'` (that was a 2.x path)
- `AttributeError` on the client object for methods that should exist

**Phase:** Must be addressed in Phase 1 (serial connection foundation). Pin version before writing any code.

---

### Pitfall 2: Slave ID / Unit ID confusion — 0x50 = 80, not 50

**What goes wrong:**
The WitMotion WTVB01-485 uses slave ID `0x50` in hex, which is decimal `80`. Developers
who copy the datasheet hex value into code as the integer `50` (decimal) will always get
"No response" or Modbus exception code 0x04 (SLAVE_DEVICE_FAILURE) — the sensor simply
never responds because no device has ID 50.

Additionally, the pymodbus `slave` parameter (3.x) must be an integer. Passing `"0x50"` as
a string silently fails or raises `ValueError` depending on pymodbus version.

**The three representations:**
```
Hex in datasheet:  0x50
Decimal (correct): 80
Wrong decimal:     50   ← common mistake
```

**Why it happens:**
Datasheets list addresses in hex. Developers read `0x50`, mentally parse it as "fifty", and
type `50` in code. This is one of the most common Modbus commissioning mistakes.

**Consequences:**
- Complete silence from the sensor — no response, no error that explains why
- Timeout errors that look like wiring problems or baud rate mismatches
- Hours of debugging the wrong layer (RS-485 wiring) when the issue is the ID

**Prevention:**
- Store slave ID in config.yaml as decimal `80` with an explicit comment: `# 0x50 hex`
- Or store as `0x50` in YAML and let Python parse it: PyYAML parses `0x50` as int 80
- Add assertion in config loader: `assert 1 <= config.slave_id <= 247`
- Print slave ID at startup: `logger.info(f"Slave ID: {slave_id} (0x{slave_id:02X})")`

**Detection (warning signs):**
- Consistent timeout on every read attempt
- No response even after confirming wiring, power, baud rate
- Error message: `pymodbus.exceptions.ConnectionException: Failed to connect`
  or `ModbusIOException: [Input/Output] No Response received from the remote unit`

**Phase:** Phase 1. Document the hex/decimal table in config.yaml comment.

---

### Pitfall 3: RS-485 timing — turnaround delay, inter-frame gaps, silent failures

**What goes wrong:**
RS-485 is half-duplex. After the master sends a request, the bus driver must switch from
transmit to receive mode before the slave response arrives. If the timeout is too tight or
the inter-frame gap is too short, the master misses the response — and pymodbus reports a
timeout, not a timing problem.

**Specific timing issues:**

1. **RTS-controlled turnaround (hardware converters):**
   Some cheap USB-RS485 adapters (especially clone CH340 boards) rely on software RTS
   toggling to switch TX/RX direction. pymodbus 3.x has `rtscts=False` by default.
   If the adapter requires RTS toggling, every read will silently time out.
   The fix: `rts_level_for_tx=True, rts_level_for_rx=False` in `ModbusSerialClient` — but
   most modern adapters (CH340G, CP2102, FT232RL) are auto-direction; they do not need this.

2. **Inter-frame gap (Modbus RTU spec: 3.5 character times):**
   At 9600 baud, one character = ~1.04 ms. 3.5 chars = ~3.6 ms.
   pymodbus respects this internally, but if the host OS scheduler wakes the process late,
   the gap can be violated. On Windows, the default timer resolution is 15.6 ms — this means
   `time.sleep(0.004)` may actually sleep for 15+ ms. This is usually fine (longer gaps are
   acceptable; shorter ones cause framing errors), but it means the effective minimum poll
   interval on Windows is ~20-30 ms per register read, not ~5 ms.

3. **Timeout too short:**
   Default pymodbus timeout is 3 seconds. For a slow sensor or noisy line, this may actually
   be fine. The mistake is setting `timeout=0.1` or `timeout=0.5` trying to "speed up" the
   loop — at 9600 baud, a 3-register read response takes ~6 ms just for transmission. With
   processing time, 200-500 ms timeout is the safe minimum.

4. **Polling too fast — no rest between requests:**
   Sending back-to-back requests without any delay can overwhelm the sensor's UART buffer.
   WitMotion sensors are embedded devices with limited processing; they need a small gap
   (typically 50-100 ms) between sequential requests to process and respond.

**Why it happens:**
Developers optimize for throughput, not realizing that 9600 baud RS-485 has hard physical
limits. Unlike TCP/IP, there is no congestion control — packets just disappear.

**Consequences:**
- Intermittent `ModbusIOException: No Response` on seemingly random polls
- CRC errors logged by pymodbus (framing corruption from too-fast polling)
- Sensor appears to work for minutes, then stops responding (buffer overflow in sensor)

**Prevention:**
- Keep `timeout=1` (1 second) minimum at 9600 baud for this sensor
- Add `time.sleep(0.1)` between sequential Modbus calls in the same poll cycle
- Use `inter_char_timeout=0.005` in pymodbus if encountering framing errors
- Do not set polling interval below 500 ms total (read all registers + processing + sleep)

**Detection (warning signs):**
- `No Response received` errors that are intermittent, not consistent
- Errors go away when you add `time.sleep(0.2)` between reads
- CRC errors in pymodbus logs (`pymodbus.logging` at DEBUG level)

**Phase:** Phase 1 (serial connection) and Phase 2 (polling loop). Bake timing constants into config.yaml from the start.

---

### Pitfall 4: Signed 16-bit integer conversion — the most common data corruption bug

**What goes wrong:**
Modbus registers hold 16-bit unsigned integers (0–65535). Physical measurements like
acceleration can be negative. WitMotion encodes negatives as two's complement 16-bit:
for example, -1g is stored as `0x8000 = 32768` unsigned.

`pymodbus.result.registers` returns a Python `list[int]` where each int is **unsigned**
(0–65535). Python's `int` type is arbitrary precision — it will never naturally wrap around
to negative.

**The three broken approaches:**

```python
# WRONG 1: direct use as unsigned
raw = result.registers[0]   # gets 32768 for -1g
accel_g = raw / 32768 * 16  # returns 16.0 g instead of -16.0 g

# WRONG 2: struct.unpack without correct byte packing
import struct
raw = result.registers[0]
# THIS FAILS: struct.unpack expects bytes, not int
signed = struct.unpack('>h', raw)  # TypeError

# WRONG 3: masking with wrong sign check
raw = result.registers[0]
if raw > 128:              # wrong threshold — should be > 32767
    raw -= 256             # wrong wraparound — should be 65536
```

**The correct approach:**

```python
def to_signed16(value: int) -> int:
    """Convert unsigned 16-bit Modbus register to signed Python int."""
    if value >= 32768:        # bit 15 is set → negative in two's complement
        return value - 65536
    return value

# Or using struct correctly (pack first, then unpack):
import struct
def to_signed16_struct(value: int) -> int:
    return struct.unpack('>h', struct.pack('>H', value))[0]

# Or using ctypes:
import ctypes
def to_signed16_ctypes(value: int) -> int:
    return ctypes.c_int16(value).value
```

All three correct approaches are equivalent. The `to_signed16(value)` arithmetic is the
most readable and has no imports beyond builtins.

**WitMotion-specific scaling:**
```
Acceleration:   signed_16 / 32768 * 16     (range: -16g to +16g)
Vibration vel:  signed_16 / 100.0          (mm/s, check datasheet for exact factor)
Temperature:    signed_16 / 100.0          (°C, may also be /10 — verify with datasheet)
Angle:          signed_16 / 32768 * 180    (degrees)
```

The exact scaling factors must be verified against the WitMotion WTVB01-485 datasheet
because WitMotion has released multiple firmware versions with different scale factors.

**Why it happens:**
Python developers unfamiliar with fixed-width integer representations assume Python's int
behaves like C's `int16_t`. It does not. Python ints never overflow.

**Consequences:**
- Negative accelerations reported as large positive values (e.g., -0.5g shown as +15.5g)
- Values look plausible (within physical range) so the bug survives testing
- FFT analysis or alarm thresholds will be completely wrong in production

**Detection (warning signs):**
- Accelerometer reads ~32g when sensor is at rest (gravity should read ~1g on Z axis)
- Values jump discontinuously around zero (one side is correct, other side is wrapped)
- Temperature reads ~600°C when ambient is 25°C (sign bit was misinterpreted)

**Phase:** Phase 2 (register parsing). Write unit tests for `to_signed16()` with edge cases:
`0`, `1`, `32767`, `32768`, `65535`, `32769`.

---

### Pitfall 5: Serial port permissions and access conflicts

**What goes wrong:**

**Windows-specific:**

1. **Port already open by another process:**
   Windows COM ports allow only one exclusive open at a time. If any other tool has the port
   open (Putty, Arduino IDE serial monitor, another Python script that crashed without
   closing), `ModbusSerialClient.connect()` will raise:
   `serial.serialutil.SerialException: could not open port COM3: [Error 5] Access is denied`
   or `[Error 2] The system cannot find the file specified` if the port number is wrong.

2. **Port number confusion after replug:**
   Windows assigns COM port numbers to USB serial adapters by device serial number. The
   same physical adapter will always get the same COM number IF it has a unique serial
   number. Clone CH340 adapters often have no serial number (all show `0000000`), so
   Windows assigns the next available COM number on each plug — it can change.

3. **COM port > COM9 in legacy applications:**
   Ports above COM9 require the path prefix `\\.\COM10` in Win32 API. pyserial handles this
   automatically, but some tutorials show bare `COM10` which may fail in edge cases.
   pyserial correctly uses `\\.\COMn` internally so this is not a pyserial issue, but
   external tools (Putty, etc.) may need the `\\.\` prefix for COM10+.

**Linux-specific:**

1. **`/dev/ttyUSB0` permission denied:**
   By default, only root and the `dialout` group can access `/dev/ttyUSB*`. Running as a
   normal user gives: `serial.serialutil.SerialException: [Errno 13] Permission denied`
   Fix: `sudo usermod -aG dialout $USER` then log out and log back in.
   Temporary fix (do not use in production): `sudo chmod 666 /dev/ttyUSB0`

2. **`/dev/ttyUSB0` disappears and reappears as `/dev/ttyUSB1`:**
   On Linux, if the adapter is unplugged and replugged while another process holds the
   device open, the kernel may assign a new device node number.

**Prevention (Windows):**
- List available ports at startup with `serial.tools.list_ports.comports()`
- If `config.yaml` port is not found, print available ports and exit with a helpful message
- Never leave the serial port open in debug/REPL sessions
- Check Device Manager: under "Ports (COM & LPT)" the device should appear

**Prevention (Linux):**
- Add user to `dialout` group in README as Step 1
- Use udev rules to assign a fixed symlink: `/dev/wtvb01` → `/dev/ttyUSB0`

**Detection (warning signs):**
- `SerialException: [Error 5] Access is denied` → another process holds the port
- `SerialException: [Error 2] The system cannot find the file specified` → wrong port name
- `Permission denied` on Linux → dialout group

**Phase:** Phase 1. The `list_serial_ports.py` utility is already in the project requirements — build it early and test it before writing the main logger.

---

### Pitfall 6: Wrong Modbus function code — FC03 vs FC04

**What goes wrong:**
Modbus defines multiple register types:
- **Holding Registers (FC03):** Read with `read_holding_registers()` — read/write, for configuration
- **Input Registers (FC04):** Read with `read_input_registers()` — read-only, for measurements

WitMotion WTVB01-485 exposes sensor data (acceleration, temperature, etc.) as **holding
registers** accessible via **FC03**. Using `read_input_registers()` (FC04) on those addresses
will cause the sensor to return Modbus exception code `0x02` (ILLEGAL DATA ADDRESS) or
`0x01` (ILLEGAL FUNCTION) — the sensor may have no input registers at those addresses.

**The confusion:**
The naming is counterintuitive. "Input registers" sounds like where sensor inputs would live.
In practice, many sensors (including most WitMotion devices) use holding registers for all
data, because the Modbus standard's register type distinction is often ignored by embedded
device manufacturers.

**Modbus exception codes to know:**
```
0x01  ILLEGAL FUNCTION       — function code not supported by this device
0x02  ILLEGAL DATA ADDRESS   — register address not valid on this device
0x03  ILLEGAL DATA VALUE     — write value out of range
0x04  SLAVE DEVICE FAILURE   — internal device error
```

pymodbus will set `result.function_code` to `0x83` (0x80 | 0x03) for a FC03 exception,
which means the `isError()` method returns True.

**Prevention:**
- Use `read_holding_registers()` (FC03) for WitMotion WTVB01-485 — confirmed by datasheet
- When commissioning a new sensor, test FC03 first; if it returns exception 0x01, try FC04
- Log the raw function code on errors: `logger.debug(f"FC: 0x{result.function_code:02X}")`

**Detection (warning signs):**
- `ExceptionResponse(143, 2, 2)` — function 143 (0x8F is illegal) with exception 2 (illegal address)
- `result.isError()` returns True immediately (not a timeout — the sensor did respond)
- Response arrives fast (sub-millisecond) but is an error frame

**Phase:** Phase 1. Confirm FC03 vs FC04 in first connection test before building polling loop.

---

### Pitfall 7: WitMotion WTVB01-485 specific quirks

**Confidence: MEDIUM** — Based on WitMotion device class patterns; verify against physical device.

**Known WitMotion RS-485 device patterns:**

1. **Default slave ID is 0x50 (80 decimal), not 1:**
   Most Modbus tutorials assume slave ID 1 (the Modbus default). WitMotion chose 0x50.
   This is not wrong, but it means all boilerplate code will have the wrong slave ID.
   Some WitMotion units ship with slave ID 0x01 if custom-ordered — check the label.

2. **Baud rate must be exactly 9600:**
   WitMotion WTVB01-485 default baud rate is 9600. Some WitMotion documentation for other
   models mentions 115200 as optional — but this specific model (WTVB01) uses 9600 default.
   The baud rate is configurable via Modbus write to a config register, but until explicitly
   changed, 9600 is required. Mismatch = complete silence (see Pitfall 13).

3. **Register addresses are 0-indexed in pymodbus:**
   The datasheet may list register addresses as Modbus "protocol addresses" starting at 1
   (e.g., register 40053 = holding register 52). pymodbus uses 0-indexed protocol data unit
   (PDU) addresses. If the datasheet says register address `0x34`, use `address=0x34`
   in pymodbus — do NOT subtract 1. pymodbus does not apply the +1 offset; the address
   passed is used directly in the PDU.

4. **Bulk read is more reliable than individual register reads:**
   Reading all sensor registers in a single `read_holding_registers(address=0x34, count=19)`
   call (covers 0x34 through 0x46) is more reliable than 19 individual calls. Fewer
   round trips = fewer opportunities for timing failure. The WitMotion sensor supports
   multi-register reads up to at least 32 registers.

5. **Power cycling vs. connection reset:**
   If the sensor stops responding mid-session, it may need a full power cycle (disconnect
   5-36V supply), not just a serial port reconnect. Some WitMotion devices enter a locked
   state after receiving malformed Modbus frames (e.g., from wrong baud rate attempts).

6. **Register map gaps:**
   Not all addresses between 0x34 and 0x46 are valid. Reading an undefined address does not
   always return exception 0x02 — some firmware versions return garbage data (0x0000 or
   0xFFFF) for undefined registers. Validate that read values are within physical bounds.

**Prevention:**
- Confirm slave ID, baud rate, and register map on first connection using a known-good
  Modbus scanner (e.g., `mbpoll` on Linux, "Modbus Poll" trial on Windows)
- Read all 19 registers in one call from 0x34 to 0x46 (count=19) rather than individually
- Print raw hex of every register on first connection for manual verification

**Phase:** Phase 1 (connection test), Phase 2 (register parsing with raw hex logging).

---

### Pitfall 8: CSV file corruption — incomplete writes, buffer not flushed, crash residue

**What goes wrong:**

1. **Python's `csv.writer` buffers writes:**
   By default, Python file I/O buffers writes in a kernel buffer. If the process crashes
   (power loss, KeyboardInterrupt not caught, unhandled exception), the last N rows may
   never reach disk. The number of lost rows depends on the OS buffer size (typically 4 KB),
   which at one row per second and ~100 bytes/row means up to ~40 rows of data loss.

2. **File left open and truncated on crash (Windows):**
   On Windows, an open file may be exclusively locked. If the process is killed via Task
   Manager, the OS releases the lock but the file may be left in an inconsistent state
   (partial last row without a newline, or an empty file if it was just opened and never
   flushed).

3. **BOM (Byte Order Mark) encoding issue on Windows:**
   If the CSV is opened in Excel on Windows and re-saved, Excel may add a UTF-8 BOM prefix
   (`\xef\xbb\xbf`). More relevantly, if the file is opened with `encoding='utf-8-sig'`
   on Windows (which some developers do to make Excel happy), but later read with
   `encoding='utf-8'`, the BOM appears as a column name corruption.

4. **Newline handling on Windows:**
   `csv.writer` by default writes `\r\n` on Windows when the file is opened in text mode.
   If the file is later processed on Linux, the extra `\r` characters cause issues.
   Fix: open with `newline=''` as specified in Python docs for csv: 
   `open(filepath, 'w', newline='', encoding='utf-8')`

5. **Header written on every open (append mode bug):**
   If the logger opens the CSV in append mode and always writes the header, every restart
   adds a duplicate header row in the middle of the data file.

**Prevention:**
```python
# Correct CSV open pattern:
import csv
from pathlib import Path

def open_csv(filepath: Path, write_header: bool):
    file = open(filepath, 'a', newline='', encoding='utf-8')
    writer = csv.writer(file)
    if write_header:
        writer.writerow(['timestamp', 'ax_g', 'ay_g', 'az_g', ...])
    return file, writer

# Flush after every write (or every N writes):
writer.writerow(row)
file.flush()  # push from Python buffer to OS buffer
# os.fsync(file.fileno())  # uncomment for guaranteed disk write (slower)
```

- Write header only if file is new (check `filepath.exists()` and `filepath.stat().st_size == 0`)
- Wrap the main loop in `try/finally` to ensure `file.close()` is called on any exit
- Use `atexit.register(file.close)` as backup for unexpected exits
- Rotate files by date (daily files) to limit the size of any single corrupt file

**Detection (warning signs):**
- CSV has no header row (header-write-on-append bug)
- Last row of CSV is truncated (missing columns or partial number)
- File ends without a newline (write was interrupted mid-row)
- Duplicate header rows in the middle of the file

**Phase:** Phase 3 (CSV logger module). Unit test the logger by simulating a crash mid-write.

---

### Pitfall 9: Timestamp issues — DST, America/Sao_Paulo, pytz vs zoneinfo

**What goes wrong:**

1. **Brazil abolished DST in 2019:**
   `America/Sao_Paulo` no longer observes daylight saving time since 2019. Brazil law
   abolished DST by Decree 9.772/2019. The UTC offset for `America/Sao_Paulo` is now
   permanently **UTC-3** (BRT) with no seasonal change.
   Consequence: no DST transition bug will occur — but outdated timezone databases may still
   have DST rules that trigger incorrectly. Using pytz with a stale `tzdata` package could
   theoretically apply wrong rules.

2. **pytz vs zoneinfo (Python 3.9+):**
   - `pytz` is a third-party package, has a known footgun: you must use `tz.localize(dt)`,
     not `dt.replace(tzinfo=tz)`. The latter silently gives wrong offsets for DST-affected
     timezones (irrelevant for Sao Paulo now, but a general hazard).
   - `zoneinfo` (Python 3.9 standard library) is the modern approach and uses the same IANA
     database. `datetime.now(ZoneInfo('America/Sao_Paulo'))` is correct and safe.
   - The project targets Python 3.8+ which predates `zoneinfo` (added in 3.9). For 3.8
     compatibility, use `backports.zoneinfo` or use `pytz` carefully.

3. **`datetime.now()` without timezone is naive — ambiguous in CSV:**
   Using `datetime.now()` produces a naive datetime with no timezone info in the ISO string.
   Industrial data MUST have unambiguous timestamps. Use `datetime.now(tz)` always.

4. **Timestamp resolution on Windows:**
   `datetime.now()` on Windows has ~15.6 ms resolution due to the default timer interval.
   For vibration analysis, millisecond timestamps are meaningful. Use `time.perf_counter()`
   as a relative counter if sub-millisecond resolution is needed, anchored to a
   `datetime.now(tz)` at session start.

5. **ISO 8601 format consistency:**
   Use `isoformat()` which produces `2026-05-19T14:30:00.123456-03:00`. This is unambiguous
   and parseable by pandas, Excel (with import wizard), and InfluxDB.
   Avoid `strftime('%d/%m/%Y %H:%M:%S')` — it drops timezone and uses locale-specific format.

**Recommended pattern for Python 3.8 compatibility:**
```python
# requirements.txt: backports.zoneinfo; python_version < "3.9"
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo  # Python 3.8

TZ = ZoneInfo('America/Sao_Paulo')

def now_sao_paulo() -> datetime:
    return datetime.now(TZ)

# In CSV row:
row['timestamp'] = now_sao_paulo().isoformat()
# Produces: "2026-05-19T11:30:00.123456-03:00"
```

**Detection (warning signs):**
- Timestamps in CSV have no timezone suffix (naive datetime was used)
- Timestamps jump by 1 hour in April or October (stale pytz with old DST rules)
- Timestamps show UTC instead of local time (wrong timezone or `.utcnow()` was used)

**Phase:** Phase 3 (CSV logger). Write a test that calls `now_sao_paulo()` and checks the UTC offset is `-03:00`.

---

### Pitfall 10: Connection recovery after USB unplug/replug

**What goes wrong:**
When the USB-RS485 adapter is unplugged, `pyserial` does not raise an exception immediately.
The serial port object remains "open" in Python, but the next read or write will raise
`serial.serialutil.SerialException: [Errno 5] Input/output error` (Linux) or
`serial.serialutil.SerialException: ClearCommError failed (PermissionError(13, ...))` (Windows).

pymodbus will catch this and raise `ModbusIOException`, but the client object is now in an
undefined state. Simply calling the next `read_holding_registers()` will continue to fail
even after the adapter is replugged — the underlying serial port is still "open" on a dead
device handle.

**The correct recovery pattern:**
```python
def read_with_retry(client, address, count, slave, max_retries=3):
    for attempt in range(max_retries):
        try:
            result = client.read_holding_registers(address=address, count=count, slave=slave)
            if result.isError():
                raise IOError(f"Modbus error: {result}")
            return result.registers
        except Exception as e:
            logger.warning(f"Read failed (attempt {attempt+1}/{max_retries}): {e}")
            time.sleep(2 ** attempt)  # exponential backoff: 1s, 2s, 4s
            try:
                client.close()
            except Exception:
                pass
            try:
                client.connect()
            except Exception as reconnect_err:
                logger.error(f"Reconnect failed: {reconnect_err}")
    raise IOError("Max retries exceeded")
```

**Windows COM port renaming after replug:**
If the CH340 adapter has no unique serial number, Windows may assign COM4 after the original
COM3 disappears. The application must detect "port not found" vs. "IO error" differently:
- IO error on existing port → retry reconnect to same port name
- Port not found error → scan `serial.tools.list_ports` for the device by VID/PID

**CH340 VID/PID:** `0x1A86:0x7523` — use this to identify the adapter regardless of port name:
```python
import serial.tools.list_ports
def find_ch340_port():
    for port in serial.tools.list_ports.comports():
        if port.vid == 0x1A86 and port.pid == 0x7523:
            return port.device
    return None
```

**Prevention:**
- Never terminate on first IO error — use retry with exponential backoff
- Log every reconnection attempt with timestamp
- Set a maximum retry window (e.g., 5 minutes) then exit with a clear error message
- Store `port.vid`, `port.pid` in config.yaml as optional hints for port auto-detection

**Detection (warning signs):**
- `ModbusIOException` after cable pull, followed by continued failures after replug
- `SerialException: ClearCommError` on Windows
- Log shows "connected" but reads still fail after replug

**Phase:** Phase 2 (main polling loop / error handling).

---

### Pitfall 11: Windows COM port number instability

**What goes wrong:**
Windows ties COM port numbers to the device's USB serial number. Clone CH340 adapters
(widely sold on AliExpress, Amazon) often all have the same empty or repeated serial number
`0000000000`. When two such adapters have ever been plugged in — even months apart — Windows
may have registered both under "COM3" and "COM4" in the registry. Plugging in one of them
may come up as COM3 or COM4 depending on which registry slot it lands in.

This means: the user configures `port: COM3` in `config.yaml`, it works for a month, they
use a different USB port one day, and now it's `COM5`. They get "port not found" and do not
know why.

**Registry residue:**
Windows accumulates "ghost" COM port entries in the registry under
`HKLM\SYSTEM\CurrentControlSet\Enum\USB\VID_1A86&PID_7523`. Removing ghost ports via
Device Manager (View → Show Hidden Devices → Ports → right-click → Uninstall) can fix
spurious port number changes.

**Prevention:**
- `list_serial_ports.py` should show all ports with description and VID/PID, not just names
- At startup, if configured port is not found, auto-scan and print candidates
- README should warn: "If port is wrong, run `python list_serial_ports.py` to find the current name"
- Instruct users to always use the same physical USB port on the laptop — Windows maps
  hardware path (USB hub port) to COM number independently of device serial number

**Detection (warning signs):**
- `SerialException: could not open port COM3: [Error 2]` after a replug
- Device appears in Device Manager under a different COM number
- `python list_serial_ports.py` shows the device under COM5 or COM6 instead of COM3

**Phase:** Phase 1. Make `list_serial_ports.py` the first utility built and tested.

---

### Pitfall 12: USB-RS485 driver issues — CH340, CP210x, FTDI on Windows 10/11

**What goes wrong and which drivers are problematic:**

**CH340 / CH340G (most common in WitMotion cables):**
- Windows 10/11 has inbox CH340 support but it may be an older version (driver date 2019).
- The inbox driver works for standard use but has known issues at high baud rates (>115200).
- At 9600 baud (this project), the inbox driver is typically fine.
- Clone CH340 adapters may have modified VID/PID that prevents Windows Update from finding
  the correct driver. The manufacturer driver from `wch.cn` is the authoritative source.
- Issue: Windows sometimes installs the wrong driver (e.g., USB Serial Device instead of
  CH340) — appears as "USB Serial Device" in Device Manager with no COM port.
  Fix: Right-click → Update Driver → Browse → WCH driver folder.
- CH341 (a later variant) requires a different driver from the same manufacturer.

**CP210x (Silicon Labs — used in some higher-end adapters):**
- Generally the most stable option on Windows 10/11.
- Windows 10 has inbox CP210x support since ~2019. Windows 11 also has it.
- Rarely needs manual driver installation.
- VCP (Virtual COM Port) mode is the default — appears as COM port immediately.
- Known issue: on Windows 11 22H2+, some users report CP210x being registered as
  "USB Serial Device" without a COM port after fast plug-unplug cycles.
  Fix: Device Manager → right-click "USB Serial Device" → Properties → Driver → Update.

**FTDI (FT232RL — premium adapters):**
- Best Windows support historically, but FTDI had a controversy in 2014 where official
  drivers "bricked" counterfeit FTDI chips by zeroing their VID. Clone FTDI adapters may
  be silently non-functional.
- Genuine FTDI: extremely reliable, never needs manual driver on Windows 10/11.
- Clone FTDI: may work with older drivers (2.08.14 and earlier), fail with newer ones.
- Use FTDI Chip's `FT_Prog` tool to check if the chip is genuine.

**Practical recommendation for this project:**
The WitMotion cable likely uses CH340G. Install the latest WCH driver from `wch.cn` before
connecting the device. After installation, Device Manager should show:
`Ports (COM & LPT) → USB-SERIAL CH340 (COM3)` — the "CH340" name confirms correct driver.

**Detection (warning signs):**
- Device Manager shows "USB Serial Device" (generic) instead of "CH340" or "CP210x"
- Yellow exclamation mark on the device in Device Manager
- Port appears then disappears within 5 seconds of connection (driver crash/reload loop)
- `list_serial_ports.py` shows the port but `connect()` immediately fails

**Phase:** Phase 0 / README. Driver installation should be Step 1 in the setup guide, before any Python code.

---

### Pitfall 13: Baud rate mismatch — detection without oscilloscope

**What goes wrong:**
If the host baud rate does not match the sensor (e.g., host at 115200, sensor at 9600),
the symptom is **complete silence** — no response, no error frame, just timeout. The sensor
never receives a valid Modbus frame because the UART bit timing is wrong.

At the wrong baud rate, the sensor receives garbled data. Most embedded Modbus devices
simply ignore frames that fail the CRC check — they do not respond with an error.

**How to diagnose without hardware tools:**

1. **Systematic baud rate sweep:**
   Try all standard Modbus RTU baud rates in sequence. Most sensors support a small set:
   `[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200]`
   Write a `baud_scan.py` script that tries each, sends a FC03 request to slave 80, waits
   1 second for response. The correct baud rate is the one that gets a response.

2. **pyserial loopback test (confirms adapter works):**
   Short TX and RX pins on the RS-485 adapter (only valid for TTL-level USB-UART adapters,
   not true RS-485 with separate A/B terminals). Send a byte and read it back. If nothing
   comes back, the adapter itself may be broken or the driver is not working.
   For RS-485 adapters, a loopback test is not straightforward — skip this.

3. **WitMotion-specific baud rate confirmation:**
   The WTVB01-485 ships at 9600 baud. Unless the register for baud rate configuration
   has been written (which requires the correct baud rate to begin with), it cannot have
   changed. If you have never configured it, it is 9600.

4. **Character echoes / garbage data indicator:**
   If `pymodbus` logs CRC errors (set logging to DEBUG), it means the adapter is receiving
   data — but it is corrupted. This is different from total silence (no data at all).
   CRC errors + data received → baud rate is close but wrong, or there is line noise.
   Total silence → baud rate completely wrong, or wiring issue, or power issue.

5. **Multi-meter voltage check (no oscilloscope):**
   Measure DC voltage across RS-485 A/B terminals with no traffic. Should be +200mV to
   +600mV (A is positive relative to B) at idle. 0V means the line has no bias — missing
   termination resistor or the sensor is unpowered.

**Common wrong baud rates seen in the wild:**
- 115200 — default for Arduino/FTDI boards; many tutorials use this
- 19200 — some older WitMotion products used this
- 4800 — some legacy industrial sensors

**Prevention:**
- Hardcode `baudrate: 9600` in config.yaml with comment: `# WTVB01-485 factory default — do not change`
- Log the configured baud rate at every startup: `logger.info(f"Baud rate: {config.baudrate}")`
- Include `baud_scan.py` as a diagnostic utility in the project

**Detection (warning signs):**
- Complete timeout silence on every request (vs. intermittent = timing/noise issue)
- pymodbus DEBUG logs show `No response received` with no partial frame data
- Switching to a different baud rate produces CRC errors (you're "close") or response (correct)

**Phase:** Phase 1 (connection diagnostics). `baud_scan.py` should be a shipped utility.

---

## Moderate Pitfalls

### Pitfall 14: pymodbus logging noise vs. actionable errors

**What goes wrong:**
By default, pymodbus logs every Modbus transaction at DEBUG level, which floods the log
file with low-value entries. Conversely, at WARNING level, transient communication errors
that should be retried are mixed with genuine failures.

**Prevention:**
```python
import logging
logging.getLogger('pymodbus').setLevel(logging.ERROR)   # production
logging.getLogger('pymodbus').setLevel(logging.DEBUG)   # debugging sessions
```

Separate the application logger (which logs sensor data + status) from the pymodbus logger.
**Phase:** Phase 2. Configure logging hierarchy at application startup.

---

### Pitfall 15: `count` parameter off-by-one in `read_holding_registers`

**What goes wrong:**
If register map spans 0x34–0x46, the count is `0x46 - 0x34 + 1 = 19`, not 18.
An off-by-one reads 18 registers, missing the last one (frequency Z at 0x46).

**Prevention:**
Define register map as named constants and compute count from them:
```python
REG_START = 0x34
REG_END   = 0x46
REG_COUNT = REG_END - REG_START + 1  # = 19
```
**Phase:** Phase 2 (register parsing).

---

### Pitfall 16: KeyboardInterrupt not caught — serial port left open

**What goes wrong:**
If `Ctrl+C` is not caught, Python exits immediately without calling `client.close()`.
On Linux, this releases the file descriptor and the port is freed. On Windows, the COM
port lock may persist until the Python process fully exits (which it does — this is usually
fine). However, the CSV file may not be flushed (see Pitfall 8).

The real issue: if pymodbus is in the middle of a serial write when `Ctrl+C` is received,
the RS-485 bus may be left with a partial frame on the line, causing the sensor to wait for
the rest of the frame (up to its own timeout) before it can respond to the next connection.

**Prevention:**
```python
try:
    main_loop()
except KeyboardInterrupt:
    logger.info("Shutdown requested by user")
finally:
    client.close()
    csv_file.flush()
    csv_file.close()
    logger.info("Clean shutdown complete")
```
**Phase:** Phase 2. Required in the main entry point from day one.

---

### Pitfall 17: Python 3.8 compatibility — `walrus operator`, `match`, f-string `=`

**What goes wrong:**
The project targets Python 3.8+. Several modern Python features are not available:
- `match` statement (Python 3.10+) — use `if/elif` chains
- `zoneinfo` module (Python 3.9+) — use `backports.zoneinfo` on 3.8
- `f"{value=}"` debug format (Python 3.8 — actually available in 3.8, no issue)
- `dict | dict` merge operator (Python 3.9+) — use `{**a, **b}`
- `type hints` with `list[int]` lowercase (Python 3.9+) — use `List[int]` from `typing`

**Prevention:**
- Test on Python 3.8 explicitly (use `pyenv` on dev machine or a Docker container)
- Use `from __future__ import annotations` for deferred evaluation of type hints
- Include `backports.zoneinfo; python_version < "3.9"` in requirements.txt

**Phase:** Phase 1. Set up dev environment with Python 3.8.

---

## Minor Pitfalls

### Pitfall 18: `result.registers` raises `AttributeError` instead of returning empty

**What goes wrong:**
In pymodbus 3.x, if `read_holding_registers` returns a `ModbusIOException` (which is also
the return value in some error paths, not always raised), accessing `result.registers`
raises `AttributeError: 'ModbusIOException' object has no attribute 'registers'`.

**Prevention:**
```python
result = client.read_holding_registers(...)
if result is None or result.isError():
    raise IOError(f"Read failed: {result}")
registers = result.registers
```
Always check `isError()` before accessing `.registers`.
**Phase:** Phase 2.

---

### Pitfall 19: YAML parsing of hex values and integers

**What goes wrong:**
In YAML, `0x50` is parsed by PyYAML as integer `80`. This is correct behavior and is
actually useful — but if a developer writes `slave_id: "0x50"` (with quotes), PyYAML
gives the string `"0x50"`, not the integer `80`. Passing a string as slave ID to pymodbus
causes `TypeError`.

**Prevention:**
In config.yaml, write `slave_id: 80` (decimal) with a comment. Do not quote hex values.
Add type assertion in config loader: `assert isinstance(config['slave_id'], int)`.
**Phase:** Phase 1 (config loader).

---

### Pitfall 20: Sensor power dependency — USB does not power the sensor

**What goes wrong:**
The WitMotion WTVB01-485 requires external power (5-36Vcc, recommended 12Vcc). It is NOT
powered by the USB-RS485 adapter. If the sensor is unpowered, the RS-485 bus has no
termination and no bias — the adapter's receiver floats.

This looks identical to a baud rate mismatch or wrong slave ID: complete silence on every
read. New users often assume the USB connection provides power.

**Prevention:**
README Step 1: "Connect external 12V power supply to sensor before connecting USB."
Startup log should include: "Ensure sensor has external power (5-36V) — USB provides RS-485 comm only."
**Phase:** Phase 0 / README. Hardware prerequisite.

---

## Phase-Specific Warning Summary

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Phase 0: Setup | Wrong pymodbus version installed | Pin `pymodbus>=3.5,<4.0` in requirements.txt before writing any code |
| Phase 0: Setup | No CH340 driver → port not found | Install WCH driver from wch.cn; document in README |
| Phase 0: Setup | Sensor unpowered | README: external 12V required; check before debugging serial |
| Phase 1: Serial connection | Wrong COM port name | Run `list_serial_ports.py` first; show VID/PID |
| Phase 1: Serial connection | `unit=` keyword in 3.x | Use `slave=` in every Modbus call |
| Phase 1: Serial connection | Slave ID decimal vs hex | Use `80`, document as `# 0x50` |
| Phase 1: Serial connection | FC03 vs FC04 confusion | Use `read_holding_registers()` for WitMotion |
| Phase 1: Serial connection | Baud rate mismatch | Start with `baudrate=9600`; include baud scan utility |
| Phase 2: Polling loop | Signed integer conversion | `to_signed16()` function + unit tests |
| Phase 2: Polling loop | RS-485 timing | `timeout=1`, `sleep(0.1)` between calls |
| Phase 2: Polling loop | register count off-by-one | Use `REG_COUNT = REG_END - REG_START + 1` |
| Phase 2: Polling loop | Connection recovery | Exponential backoff retry + client.close/reconnect |
| Phase 2: Polling loop | KeyboardInterrupt safety | `try/finally` wrapping `client.close()` |
| Phase 3: CSV logger | Buffer not flushed on crash | `file.flush()` after each row; `finally: file.close()` |
| Phase 3: CSV logger | Header duplicated on restart | Check file size before writing header |
| Phase 3: CSV logger | Wrong newline on Windows | `open(..., newline='', encoding='utf-8')` |
| Phase 3: CSV logger | Naive timestamps | `datetime.now(ZoneInfo('America/Sao_Paulo'))` always |
| Phase 3: CSV logger | pytz DST footgun | Use `zoneinfo` (3.9+) or `backports.zoneinfo` (3.8) |
| All phases | Python 3.8 compatibility | Test on 3.8; use `typing.List`, `backports.zoneinfo` |

---

## Sources

**Confidence notes:** WebSearch and WebFetch tools were not available during this research.
All findings are based on training data (knowledge cutoff August 2025) covering:
- pymodbus official documentation and changelog (versions 2.x through 3.6.x)
- Modbus RTU specification (Modbus.org)
- Python 3.8-3.12 documentation (docs.python.org)
- pyserial documentation
- WitMotion device class patterns (WTVB01-485, WT901-485, and similar)
- Windows serial port behavior (Microsoft Docs)
- Linux udev and dialout group behavior
- CH340/CP210x/FTDI driver documentation

**HIGH confidence items** (pymodbus API changes, Python stdlib behavior, Modbus spec): 1-6, 8-9, 11, 13-20
**MEDIUM confidence items** (WitMotion-specific register behavior, driver-specific bugs): 7, 10, 12
