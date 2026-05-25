# Milestones

## v1.2 GPS Data Integration (Shipped: 2026-05-25)

**Phases completed:** 2 phases, 4 plans | **Python LOC added:** ~1,661 net (+1,728 / −67)
**Timeline:** 2026-05-24 → 2026-05-25 (1 day) | **Tests:** 79 → 95 (+16 new tests GREEN)

**Delivered:** Every CSV row now includes live GPS position (`gps_lat`, `gps_lon`, `gps_speed_mps`) from the Windows Location API — empty fields when no fix. GPS runs as a 1 Hz background thread, never blocking the 10 Hz sensor acquisition loop. App starts normally with no GPS hardware or denied permission.

**Key accomplishments:**
- `src/gps_reader.py` — GPSReader class: Windows Location API via `winsdk`, async `_fetch()`, module-level import guard for resilience, 4-state `status` property (`ok / no_fix / denied / unavailable`), poll/cache split for non-blocking 10 Hz compatibility; 8 unit tests GREEN
- `src/utils.py` — `SensorReading` extended with `gps_lat`, `gps_lon`, `gps_speed_mps` (`Optional[float]`, `field(default=None)`) — backward-compatible with all 79 existing tests
- `src/main.py` — GPSReader wired as daemon background thread at 1 Hz; startup status line ("GPS: fix acquired" / "GPS: no fix — CSV columns will be empty" / "location access denied") printed before acquisition loop
- `src/csv_logger.py` — CSV extended from 18 to 21 columns; `_cell()` helper reused for GPS `None → ""` serialization; all 95 tests GREEN with no regressions

**Archive:**
- Roadmap: `.planning/milestones/v1.2-ROADMAP.md`
- Requirements: `.planning/milestones/v1.2-REQUIREMENTS.md`

---

## v1.1 Real-Time Visualization (Shipped: 2026-05-24)

**Phases completed:** 2 phases, 4 plans | **Python LOC added:** ~707 insertions / 25 deletions
**Timeline:** 2026-05-23 → 2026-05-24 (1 day) | **Tests:** 64 → 79 (+15 new tests GREEN)

**Delivered:** Live matplotlib visualization window (`python main.py --gui`) — 5 labeled subplots animating all 13 sensor channels at 1 Hz with 30-second rolling buffer, running alongside continuous CSV logging via background acquisition thread.

**Key accomplishments:**
- `tests/test_visualizer.py` Wave 0 scaffold: 10 RED tests for VIZ-02 through VIZ-06 using Agg backend (CI-safe headless pattern); `matplotlib>=3.10` added to requirements.txt
- `src/visualizer.py`: PlotManager class (139 lines) with 5-subplot FuncAnimation, 13 per-channel `deque(maxlen=300)` rolling buffers, `update_data()` for thread-safe data push, `_animate()` callback, and standalone mock mode — all 10 TDD tests GREEN
- `tests/test_main_gui.py` Wave 0 scaffold: 5 RED stub tests covering INTG-01 through INTG-04; `tests/test_main.py` patched with `sys.argv` guard in all 5 tests to prevent argparse breakage
- `main.py` refactored with argparse `--gui` flag: `_run_headless_mode` (exact v1.0 loop), `_run_gui_mode` (deferred PlotManager import, daemon acquisition thread, `stop_event.wait()`, close-event shutdown), `_print_summary` — 79/79 tests GREEN, zero regressions

**Known gaps accepted at ship:**
- `05-VALIDATION.md` and `06-VALIDATION.md` frontmatter not updated to `nyquist_compliant: true` (planning artifacts)
- VIZ-01 live Tk window rendering needs human confirmation (structural verification complete; animation requires live display)
- `mock_csv.file_path` vs `.path` mismatch in `tests/test_main.py` (4 locations) — tests pass via MagicMock; runtime unaffected

**Archive:**
- Roadmap: `.planning/milestones/v1.1-ROADMAP.md`
- Requirements: `.planning/milestones/v1.1-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.1-MILESTONE-AUDIT.md`

---

## v1.0 MVP (Shipped: 2026-05-21)

**Phases completed:** 4 phases | **Plans executed:** 8 of 9 | **Python LOC:** 2,064
**Timeline:** 2026-05-19 → 2026-05-21 (3 days) | **Git commits:** 46
**Git range:** `feat(01-01): implement src/utils.py` → `feat(04-02): write README.md`

**Delivered:** Python acquisition logger for WitMotion WTVB01-485 via Modbus RTU/RS-485 — connects, reads 19 registers in a single burst, converts to physical units, saves to timestamped CSV at 10 Hz, and exits cleanly on Ctrl+C.

**Key accomplishments:**
- Project scaffold with `SensorReading` dataclass (17 channels), `to_signed16()`, timezone-aware `get_timestamp_br()` (tzdata/Windows), rotating log handler — 31 tests GREEN
- Config loader with full YAML validation (collect-all-errors), `AppConfig` dataclass, `list_serial_ports.py` standalone script — 8 tests GREEN
- `WitMotionSensor` class: pymodbus 3.13.0 RTU burst read (0x34, count=19, device_id=80), confirmed scale factors from official manual, transient error handling with consecutive-error threshold — 11 mock tests GREEN; hardware-verified on COM10
- `CSVLogger`: 18-column format, Windows-safe CSV (`newline=''`), flush-on-write, `None→""` for RESERVED angle registers — 8 tests GREEN
- `main.py` acquisition loop: Ctrl+C session summary, `KeyboardInterrupt`+`finally` cleanup, hardware-verified end-to-end at 10 Hz
- `README.md` (281 lines): CH340 driver step, all 3 OS serial port paths, 12 troubleshooting scenarios; `_REG_COUNT = 0x46 - 0x34 + 1` arithmetic hardening — 64/64 tests GREEN

**Known gaps accepted at ship:**
- `02-02-PLAN.md` (hardware checkpoint) — deferred; az_g ≈ 1.0 g at rest verified indirectly during Phase 3 live run on COM10
- `angle_x/y/z` channels always `None` — RESERVED registers 0x3D-0x3F per official WTVB01-485 manual
- DISP-03 CSV-path component not asserted by automated test (`mock_csv.file_path` vs `.path` mismatch in test_main.py)

**Archive:**
- Roadmap: `.planning/milestones/v1.0-ROADMAP.md`
- Requirements: `.planning/milestones/v1.0-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.0-MILESTONE-AUDIT.md`

---
