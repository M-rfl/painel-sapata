---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Field Run Dashboard
status: defining_requirements
stopped_at: Milestone v1.3 started — defining requirements
last_updated: "2026-10-08T00:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-08 after v1.3 start)

**Core value:** O sensor deve conectar, ler e salvar dados confiáveis em CSV — se isso não funcionar, nada mais importa.
**Current focus:** v1.3 Field Run Dashboard — defining requirements

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-10-08 — Milestone v1.3 started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

| Metric | v1.0 | v1.1 | v1.2 |
|--------|------|------|------|
| Timeline | 3 days | 1 day | — |
| Tests GREEN | 64 | 79 | — |
| Python LOC added | 2,064 | +707 | — |
| Phases | 4 | 2 | 2 planned |
| Plans | 8/9 | 4/4 | 3/3 |
| Tests GREEN | 64 | 81 | 95 (08-01) |
| Phase 07 P03 | 25min | 3 tasks | 5 files |
| Phase 08 P01 | 4min | 2 tasks | 2 files |

## Accumulated Context

### Carried forward from v1.1

- `test_main.py` uses `mock_csv.file_path` but `main.py` reads `csv_logger.path` (4 locations) — test correctness fix deferred to v1.3
- Validate SCALE_VEL = 1/100 (mm/s) in field with reference instrument — deferred to v1.3
- `05-VALIDATION.md` and `06-VALIDATION.md` show `nyquist_compliant: false` — planning artifacts only, not a runtime issue

### v1.2 GPS Decisions Made

- GPS fields appended as last 3 in SensorReading using field(default=None) for backward compatibility and CSV column ordering (07-02)

- GPS source: Windows Location API (WinRT / winsdk) — no extra serial port needed
- New fields on SensorReading: `gps_lat`, `gps_lon`, `gps_speed_mps` (all `float | None`)
- No-fix behavior: empty fields in CSV (same pattern as angle RESERVED registers)
- Activation: always-on — GPS columns always present in CSV header regardless of fix status
- Non-blocking: GPSReader runs in a background thread; must not delay 10 Hz sensor acquisition
- Resilience: app starts normally if GPS hardware absent, API import fails, or permission denied

### 07-01 Decisions (GPSReader)

- asyncio.run() per get_location() call: acceptable at 1 Hz, no shared event loop state with sensor thread
- _WINSDK_AVAILABLE module-level flag: import attempted once at module load, fast hot path
- speed=None normalized to 0.0: Windows returns None for speed when fix exists but speed unknown

### 07-03 Decisions (main.py GPS wiring)

- poll/cache split in GPSReader: get_location() returns self._cache instantly; poll() does Windows Location API I/O — ensures 10 Hz acquisition loop is never blocked by GPS
- Synchronous startup poll before thread start: one poll() call establishes status before the "GPS: ..." message is printed
- gps_reader=None default params on _acquire/_run_headless_mode/_run_gui_mode for backward compatibility with tests

### 08-01 Decisions (CSVLogger GPS extension)

- GPS columns appended as columns 19-21 (after sensor_id at 18) — consistent with SensorReading field order and STORE-02 invariant (08-01)
- test_header_row_columns updated to assert against GPS_CSV_HEADER (21 cols) rather than keeping a stale 18-col local constant — keeps test file self-consistent (08-01)

### Key Constraints for v1.2

- `winsdk` is the new library required for Windows Location API access
- All existing 79 tests must remain GREEN after integration — currently 95 GREEN
- GPS columns appear as the last 3 columns in the CSV (after the existing 18)
- None → "" serialization already established in CSVLogger — reused the same pattern

## Session Continuity

Stopped at: Milestone v1.3 Field Run Dashboard started — PROJECT.md updated

Next action: Define REQUIREMENTS.md, then create ROADMAP.md (phases continue from 9)
