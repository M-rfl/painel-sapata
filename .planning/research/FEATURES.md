# Features Research: Industrial Sensor Data Logger

**Domain:** Python Modbus RTU data logger for vibration/CBM
**Sensor:** WitMotion WTVB01-485 (accelerometer, vibration, displacement, frequency, temperature)
**Use Case:** Windows notebook, bench validation -> railway CBM integration
**Researched:** 2026-05-19
**Confidence:** HIGH (core Modbus/CSV patterns) | MEDIUM (CBM conventions) | noted per section

---

## Table Stakes (must-have)

Features where absence causes the tool to fail its primary job. Users abandon or distrust
loggers that skip any of these.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Modbus RTU connection with configurable COM port, baud, slave ID | Without this, the tool cannot talk to the sensor at all | Low | Slave ID 0x50 (80), 9600 baud, 8N1 are fixed for WTVB01 but must be config-file driven so they can be changed without code edits |
| Read all sensor registers in one poll cycle | Partial reads leave columns empty and corrupt CBM baselines | Low-Med | Registers 0x34–0x46: accel X/Y/Z, vibration velocity X/Y/Z, angle X/Y/Z, temperature, displacement X/Y/Z, frequency X/Y/Z — all in one `read_holding_registers` call |
| Signed 16-bit raw-to-physical conversion | Raw Modbus values are meaningless without scaling; wrong conversion = bad CBM alarms | Low | Accel: `signed_16 / 32768 * 16` g. Each register group has its own formula — must be explicit and documented |
| Timestamped rows in CSV output | Without timestamps, vibration trends cannot be correlated to events or times | Low | ISO 8601 format `YYYY-MM-DDTHH:MM:SS.ffffff+HH:MM`. Explicit timezone (America/Sao_Paulo) is non-negotiable for CBM — ambiguous timestamps break maintenance records |
| Append-mode CSV with header on first write only | Data must survive restarts; re-opening the file must not overwrite prior sessions | Low | Check `file.exists()` before writing header. Open in `'a'` mode. Never truncate on start |
| Configurable sample interval | Polling every 100 ms vs every 1 s changes file size and Modbus bus load dramatically | Low | YAML key `sample_interval_s`. Reasonable range: 0.1–60 s for this sensor |
| config.yaml for all runtime parameters | Field operators and beginners cannot use CLI flags reliably; YAML is readable without Python knowledge | Low | Covers: `port`, `baud_rate`, `slave_id`, `sample_interval_s`, `output_dir`, `log_level` |
| Graceful Ctrl+C shutdown | Abrupt termination leaves Modbus connection in unknown state; can lock COM port until reboot on Windows | Low | `signal.signal(SIGINT, handler)` + `atexit.register()`. Close Modbus client and flush/close CSV file explicitly |
| Transient error retry without exit | RS-485 lines are noisy; a single CRC error or timeout must NOT kill the logger | Low-Med | See Error Resilience section |
| Error and status logging to file | Console output disappears; field troubleshooting requires persistent log | Low | Python `logging` module, rotating file handler, separate from CSV data |
| Human-readable terminal output during run | Operators need to confirm the sensor is live; silent loggers appear frozen | Low | One line per sample: timestamp, key values, error count. See Terminal Display section |
| list_serial_ports.py utility | COM port identification on Windows is non-obvious; without this, setup fails | Low | `serial.tools.list_ports.comports()` — name, description, hwid. Critical for USB-RS485 adapters (CH340/CP210x/FTDI) |

**Dependency chain for table stakes:**
```
config.yaml loader
    -> COM port + baud + slave_id
        -> Modbus RTU connection
            -> Register reads (all in one call)
                -> raw-to-physical conversion
                    -> timestamped row dict
                        -> CSV append
                        -> terminal display
    -> sample_interval_s -> poll timing loop
```

---

## Differentiators (competitive advantage)

Features that are not strictly required but significantly increase reliability, maintainability,
and downstream CBM usability. Worth building in Phase 1 or 2.

| Feature | Value Proposition | Complexity | Phase Fit |
|---------|-------------------|------------|-----------|
| Atomic CSV row writes (flush after each row) | Prevents partial/corrupt last row on power loss or OS crash | Low | Phase 1 — one line: `csvfile.flush()` after each `writerow()`. Very high value for no cost |
| Consecutive error counter with configurable max before pause | Distinguishes transient noise from hardware failure; prevents infinite tight retry loops that flood the log | Low | Phase 1 — counter resets on success, increments on any exception from pymodbus |
| Session summary on shutdown | Shows total samples, error rate, duration — confirms run quality without opening CSV | Low | Phase 1 — print on Ctrl+C handler |
| ISO 8601 timestamp with microseconds | CBM tools correlate events at sub-second precision; date-only or second-only is insufficient | Low | Phase 1 — `datetime.now(tz).isoformat()` already provides microseconds |
| Output directory auto-creation | If `output/` doesn't exist, logger crashes on first write — bad UX | Low | Phase 1 — `Path(output_dir).mkdir(parents=True, exist_ok=True)` |
| Date-stamped output filenames | `data_2026-05-19.csv` prevents accidental overwrite across sessions without relying on append mode alone | Low | Phase 1 — filename template in config: `{prefix}_{date}.csv` |
| Configurable log level in YAML | `DEBUG` for commissioning, `WARNING` for normal runs — without this, debug sessions produce unreadable output | Low | Phase 1 |
| Config validation on startup with clear error messages | Missing `port:` or invalid `baud_rate: abc` should print "config.yaml line 3: baud_rate must be integer" not a Python traceback | Low-Med | Phase 1 — validate with pydantic or manual checks before opening COM port |
| Reconnect loop on connection loss | USB cable wiggle or port enumeration change causes connection drop; auto-reconnect keeps 8-hour runs alive | Med | Phase 2 — separate from transient retry; involves closing and re-opening the Modbus client |
| Column naming aligned to CBM conventions | `accel_x_g`, `vib_vel_x_mm_s`, `disp_x_um`, `freq_x_hz`, `temp_c` — downstream pandas/InfluxDB imports work without renaming | Low | Phase 1 — baked into csv_logger.py fieldnames list |
| Optional output to multiple sinks (CSV + console + future DB) | Modular exporter architecture means adding InfluxDB later doesn't touch sensor.py | Med | Phase 2 — define a `Sink` protocol/ABC; CSV is the first implementation |

---

## Anti-Features (deliberately exclude)

Features that appear useful but add complexity, maintenance burden, or scope creep for this
specific use case. The PROJECT.md already identifies most of these; this section adds rationale.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time dashboard (terminal TUI / web) | Doubles scope; curses/rich TUI breaks on some Windows terminals; web server adds a process to manage | Plain print() for live status. Plan dashboard as a separate Phase 3+ tool that reads the CSV |
| Signal processing in logger (FFT, filters, RMS over window) | Logger's job is raw data capture; analysis changes over CBM project lifetime and should not be coupled to acquisition | Post-process with scipy/pandas on the CSV. Keep logger as dumb pipe |
| SQLite / InfluxDB writes in Phase 1 | Adds dependency, setup complexity, and failure modes before the basic loop is validated | CSV is sufficient for bench validation; design the exporter interface so DB can be plugged in later |
| Multi-sensor support in Phase 1 | One sensor. Multiple sensors require polling orchestration, collision avoidance on RS-485 bus, and per-sensor config — different problem | Single-sensor loop. `sensor_id` field in CSV row is enough to prepare for future multi-sensor |
| Auto-discovery of Modbus slaves | Scanning 1–247 slave IDs is slow, risky on production hardware, and unnecessary when slave ID is documented | Hard-code slave ID in config.yaml |
| GUI configuration wizard | Target user can edit a YAML file; GUI adds PyQt/tkinter dependency for zero functional gain | Document config.yaml keys clearly in README |
| Remote control / API | Adds network stack, auth, and port conflicts; notebook logger is operated locally | Out of scope for v1; would be Phase 4+ if needed for centralized fleet management |
| Compression / binary formats (HDF5, Parquet) | CSV is universally readable; compressed formats require tooling to inspect | CSV. If file size becomes a concern, gzip the daily file as a post-processing step |
| Watchdog / auto-restart daemon | Adds OS-level complexity (Windows Service, systemd); overkill for bench validation | Document manual restart in README; implement only if 24/7 unattended operation is required |
| Unit testing framework in Phase 1 | Useful but not blocking; introducing pytest before the core loop works adds overhead | Write tests in Phase 2 once the sensor protocol is confirmed correct against real hardware |

---

## CBM / Vibration Analysis Expectations

What downstream CBM tools (pandas analysis scripts, InfluxDB dashboards, ISO 10816/20816
alarm tools) expect from logger outputs. Failure to meet these conventions forces downstream
renaming and reformatting.

### Timestamp Requirements

- **Format:** ISO 8601 with timezone offset — `2026-05-19T14:32:01.123456-03:00`
- **Column name:** `timestamp` (universally recognized by pandas `pd.to_datetime()`)
- **Precision:** Microseconds are free in Python's `datetime`; include them — vibration events can need sub-second correlation
- **Timezone:** Explicit offset is mandatory. `2026-05-19 14:32:01` with no timezone is ambiguous across DST boundaries and breaks time-series databases that store in UTC
- **Monotonicity:** Timestamps must be strictly increasing within a session. If sample interval is 1 s and a Modbus retry adds 0.5 s, the next timestamp must still be after the previous one — log the actual wall-clock time, not a computed time

### CSV Structure Conventions

```
timestamp,accel_x_g,accel_y_g,accel_z_g,vib_vel_x_mm_s,vib_vel_y_mm_s,vib_vel_z_mm_s,angle_x_deg,angle_y_deg,angle_z_deg,temp_c,disp_x_um,disp_y_um,disp_z_um,freq_x_hz,freq_y_hz,freq_z_hz
2026-05-19T14:32:01.123456-03:00,0.012,-0.003,1.001,0.45,0.12,0.33,0.1,-0.2,89.9,25.3,12.0,4.0,8.0,49.8,50.1,50.0
```

- **No spaces after commas** — some industrial CSV parsers break on `col1, col2`
- **Units in column names** (suffix: `_g`, `_mm_s`, `_um`, `_hz`, `_deg`, `_c`) — self-documenting, survives header loss
- **No units row** — a second header row with units breaks `pd.read_csv()` default parsing
- **Empty cell for failed reads** — on Modbus timeout, write the row with empty string for failed channels, not "NaN" or "ERROR" (empty parses cleanly as `NaN` in pandas)
- **Consistent column count** — every row must have the same number of columns; partial reads must fill missing columns with empty strings

### ISO 10816 / 20816 Vibration Velocity Alarm Levels (MEDIUM confidence)

CBM alarm logic operating on this CSV will compare `vib_vel_*_mm_s` against:
- Zone A (new machines): < 0.71 mm/s RMS
- Zone B (acceptable): 0.71–1.8 mm/s RMS
- Zone C (alarm): 1.8–4.5 mm/s RMS
- Zone D (danger): > 4.5 mm/s RMS (exact thresholds vary by machine class)

The logger itself does not apply these thresholds, but column naming in `mm/s` (not cm/s or m/s)
is required for downstream alarm scripts to work without unit conversion.

### Sensor ID Field for Future Multi-Sensor

Even though Phase 1 is single-sensor, adding `sensor_id` as a column costs nothing and
prevents a schema migration when the second sensor is added:

```
timestamp,sensor_id,accel_x_g,...
2026-05-19T14:32:01.123456-03:00,WTVB01_01,0.012,...
```

`sensor_id` should be configurable in `config.yaml`.

### File Naming for CBM Archives

Daily rotation with date stamp is the industry norm:
```
wtvb01_2026-05-19.csv
wtvb01_2026-05-20.csv
```
This allows:
- Easy grep/selection by date range
- Predictable InfluxDB backfill (one file per day)
- Prevents unbounded single-file growth during multi-week monitoring campaigns

---

## Configuration Patterns

Analysis of config approaches for the field use case (Windows notebook, possibly beginner user).

### Verdict: YAML is the right choice for this project

The PROJECT.md already decided this. The research confirms why it beats alternatives:

| Approach | Readability | Beginner-friendly | Field-editable | Validation | Verdict |
|----------|-------------|-------------------|----------------|------------|---------|
| `config.yaml` | High — key: value is self-explanatory | High — no syntax to learn | High — any text editor | Requires manual or pydantic | **USE THIS** |
| `.env` file | Medium — `KEY=VALUE` is flat | Medium | High | Minimal | Use only if 12-factor deployment is needed (not here) |
| CLI args (`argparse`) | Low — must remember flag names | Low — not for beginners | Low — must retype every run | Built-in | Add as override layer only, never as primary |
| `config.ini` | Medium | Medium | High | ConfigParser built-in | Legacy pattern; YAML is strictly more readable |
| Hardcoded constants | Zero | Zero | None — requires code edit | None | Never acceptable for COM port / baud |

### Recommended config.yaml Structure

```yaml
# WTVB01 Logger Configuration
connection:
  port: COM3               # Windows: COM3, COM4, etc. Linux: /dev/ttyUSB0
  baud_rate: 9600
  slave_id: 80             # 0x50 decimal
  timeout_s: 1.0           # Modbus response timeout per request

sampling:
  interval_s: 1.0          # Seconds between polls (0.1 minimum recommended)

output:
  directory: data          # Relative to working directory; created if missing
  filename_prefix: wtvb01  # Produces wtvb01_2026-05-19.csv
  sensor_id: WTVB01_01     # Written to sensor_id column

logging:
  level: INFO              # DEBUG | INFO | WARNING | ERROR
  log_file: logs/logger.log
```

### Config Loading Rules

1. Load `config.yaml` from the working directory by default
2. Accept `--config path/to/other.yaml` as an optional CLI override (for running multiple instances)
3. Validate all required keys on startup; print human-readable error and exit with code 1 if missing
4. Do not silently apply defaults for `port` — missing port must be an error, not a guess

---

## Error Resilience Patterns

Industrial environments generate transient RS-485 errors. The logger must distinguish:
- **Transient noise** — single bad frame, CRC error, bit flip: retry immediately, no alarm
- **Timeout** — sensor did not respond within timeout_s: retry with backoff, log WARNING
- **Device gone** — N consecutive timeouts: log ERROR, pause, attempt reconnect
- **Port lost** — USB adapter disconnected: log CRITICAL, attempt port reopen with delay

### Recommended Retry Strategy

```
Poll attempt:
  try:
    result = client.read_holding_registers(...)
    if result.isError():
      consecutive_errors += 1
      log.warning("Modbus error #%d", consecutive_errors)
      if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
        log.error("Sensor unresponsive — pausing %ds", PAUSE_SECONDS)
        sleep(PAUSE_SECONDS)
      continue  # skip this sample, write empty row or skip row
    else:
      consecutive_errors = 0  # reset on success
      process_and_write(result)
  except serial.SerialException:
    log.critical("Serial port lost — attempting reconnect")
    reconnect_with_backoff()
  except Exception as e:
    log.error("Unexpected error: %s", e)
    consecutive_errors += 1
```

### Specific pymodbus Exceptions to Catch (HIGH confidence, from library knowledge)

- `ModbusIOException` — I/O-level failure (serial timeout, framing error)
- `ConnectionException` — connection not established or dropped
- `ModbusException` — base class for protocol errors
- `serial.SerialException` — from pyserial, raised when USB adapter is removed

### Backoff Parameters (Recommended Defaults)

| Parameter | Default | config.yaml key |
|-----------|---------|-----------------|
| Single request timeout | 1.0 s | `connection.timeout_s` |
| Max consecutive errors before pause | 5 | `error_handling.max_consecutive_errors` |
| Pause duration after max errors | 10 s | `error_handling.pause_s` |
| Reconnect attempts before giving up | 3 | `error_handling.reconnect_attempts` |
| Reconnect delay | 5 s | `error_handling.reconnect_delay_s` |

### Data Integrity on Unexpected Shutdown

The primary risk is a corrupt/incomplete last CSV row. Mitigation layers:

1. **Flush after every row** — `csvfile.flush()` after `writer.writerow()`. Ensures OS buffer is written to disk even if Python crashes. Cost: ~0 ms at 1 Hz polling.
2. **Never buffer multiple rows** — no in-memory batch writes for a 1 Hz logger; batch writes save nothing here and risk losing the batch on crash
3. **`newline=''` on file open** — prevents Windows `\r\r\n` double-carriage-return corruption (confirmed in Python csv docs)
4. **Append mode always** — `open(path, 'a', newline='')` — restart never truncates
5. **No atomic rename needed** for append-mode logging — the partially-written last row is the only risk, and `flush()` eliminates it

Note: True atomic writes (write-to-temp + rename) are used for configuration files and databases,
not for append-mode sensor logs. Do not over-engineer this.

---

## Terminal Display Patterns

### What to Show (one line per sample is the right answer)

```
[14:32:01.123] AX:+0.012g AY:-0.003g AZ:+1.001g | Vx:0.45 Vy:0.12 Vz:0.33 mm/s | T:25.3°C | Err:0
```

**Rationale for each element:**
- Timestamp (time only, not date — date is already in filename): operator confirms freshness
- Acceleration X/Y/Z: primary diagnostic for vibration direction
- Vibration velocity X/Y/Z: the CBM alarm channel (ISO 10816)
- Temperature: secondary condition indicator
- Consecutive error count: confirms communication health without scrolling log

**Omit from terminal (show in log file only):**
- Raw register hex values
- Displacement and frequency (secondary channels, clutter the line)
- File path on every row (show once at startup)
- Sample counter (use timestamps to infer sample rate)

### What to Show at Startup (before first sample)

```
WTVB01 Logger v0.1.0
Port: COM3 | Baud: 9600 | Slave: 80 | Interval: 1.0s
Output: data/wtvb01_2026-05-19.csv
Press Ctrl+C to stop.
```

### What to Show at Shutdown

```
--- Session Summary ---
Duration:  00:45:23
Samples:   2723
Errors:    4 (0.15%)
Output:    data/wtvb01_2026-05-19.csv (2723 rows)
```

### How Much is Too Much

- **Too much:** Scrolling debug output during normal operation. One line per sample is the maximum.
- **Too little:** Silent logger with no output. Operators assume it froze.
- **Never use `\r` line overwrite** for Windows PowerShell/CMD — carriage return tricks work in Linux terminals but produce garbage in Windows CMD. Print a new line every sample.

---

## Feature Dependencies

```
config.yaml valid
    -> COM port open (list_serial_ports.py helps find it)
        -> Modbus RTU client connected
            -> register poll success
                -> raw-to-physical conversion
                    -> row dict with all columns
                        -> CSV row append + flush
                        -> terminal print (one line)
            -> poll failure
                -> consecutive_error++ 
                -> write empty-column row OR skip (configurable)
                -> if >= max_errors: pause + reconnect

output directory exists (auto-create)
    -> date-stamped CSV file (append mode)
        -> header written once if file is new

logging module configured
    -> errors, warnings -> log file (rotating)
    -> startup/shutdown summary -> terminal + log
```

---

## MVP Prioritization

### Phase 1 — Must Ship (all table stakes + selected differentiators)

1. config.yaml loader with validation
2. list_serial_ports.py utility
3. Modbus RTU connection (pymodbus)
4. Full register read with raw-to-physical conversion
5. Timestamped CSV append with flush-per-row
6. Terminal output (one line per sample)
7. Graceful Ctrl+C shutdown with session summary
8. Transient error retry + consecutive error counter
9. Error/status log to file
10. Column names aligned to CBM conventions (units in name, `sensor_id` column)
11. Date-stamped output filenames + auto-create output directory
12. Config validation with human-readable errors on startup

### Phase 2 — High Value, Low Risk (add after bench validation)

- Reconnect-on-port-loss (close + reopen Modbus client)
- Modular exporter interface (Sink protocol/ABC) for future DB/MQTT
- Unit tests for conversion formulas and CSV schema
- Optional CLI `--config` override

### Defer (Phase 3+)

- Dashboard / TUI
- InfluxDB / SQLite exporter
- Multi-sensor support
- Signal analysis (FFT, RMS window)

---

## Sources

- Project context: `C:/Users/Cliente/Documents/Accel_mro/.planning/PROJECT.md`
- Python csv module official docs (fetched 2026-05-19): https://docs.python.org/3/library/csv.html
- pymodbus library knowledge: exception types, RTU client patterns (HIGH confidence — well-established library, stable API)
- ISO 10816 / ISO 20816 vibration alarm zone thresholds (MEDIUM confidence — standard is paywalled; thresholds from widely-cited secondary sources in CBM literature)
- CBM CSV conventions: pandas `pd.read_csv()` and InfluxDB line protocol expectations (HIGH confidence — direct library knowledge)
- Windows COM port / CH340/CP210x/FTDI USB-RS485 patterns (HIGH confidence — well-documented driver landscape)
