---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Field Run Dashboard
current_plan: 6
status: verifying
stopped_at: Completed 09-06-PLAN.md
last_updated: "2026-10-08T21:02:56.151Z"
last_activity: 2026-10-08
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 6
  completed_plans: 6
  percent: 17
---



# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-08 after v1.3 start)

**Core value:** O sensor deve conectar, ler e salvar dados confiáveis em CSV — se isso não funcionar, nada mais importa.
**Current focus:** Phase 9 — Repo Hygiene & Raw CSV Converter

## Current Position

Phase: 9 of 13 (Repo Hygiene & Raw CSV Converter)
**Current Plan:** 6
**Total Plans in Phase:** 6
**Status:** Phase complete — ready for verification
**Last Activity:** 2026-10-08

Progress: [██░░░░░░░░] 17%

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
| Phase 09 P01 | 5min | 2 tasks | 9 files |
| Phase 09 P02 | 25min | 3 tasks | 14 files |
| Phase 09 P04 | 20min | 3 tasks | 6 files |
| Phase 09 P03 | 40min | 3 tasks | 4 files |
| Phase 09 P05 | 30min | 2 tasks | 6 files |
| Phase 09 P06 | ~1h | 3 tasks | 5 files |

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

### v1.3 Decisions

- Primary data source is raw logger CSVs in Results_1st.Run/raw/; workbook only for validation (CONV-07, CORE-05)
- Trecho by station geofence (Stations_GEO/*.txt); sentido auto-detected; tunnel samples inferred from neighbours
- Accel stored as integer 1/2048 g counts; JS core owns rules, Python converter owns quantization/GPS validation
- Parity: trecho-free KPIs must match workbook exactly; pontos/per-trecho side by side
- Repo has no GitHub remote; REPO-02 needs user action

### Decisions

- [09-01] `.gitignore` is the first v1.3 code commit; run data, workbook, logs, generated docs and caches are excluded, `logs/.gitkeep` kept via negation rule
- [Phase 09]: [09-02] Ambiguous accel readings reported as ValueIssue but never changed (workbook rule parity); slow pytest marker deselected by default
- [Phase 09]: [09-04] Public JSON GPS precision 6 dp (half-up keys); re-confirm at Phase 11 push checkpoint
- [Phase 09]: [09-03] Forward-only station progress state machine; dwell stays in arriving trecho; terminal radius 200 m
- [Phase 09]: [09-05] Workbook row-level mismatches are exact checks (exit 2); pontos/per-trecho side by side only
- [Phase 09]: [09-06] Engineer approved report; known per-trecho deviations at inferred stations (CTR 210 m, EQD 159 m, SCT collapse following trecho: Vila Olimpica-Central 1 vs 2.940, Rodoviaria-Equador 1 vs 295, Gamboa-Santo Cristo 326 vs 1.468); fix via larger radius or closest-GPS-approach boundary before per-trecho views
- [Phase 09]: [09-06] Sentido split at 11.835 vs ~10.839 in workbook (PXV 200 m terminal dwell) accepted; pontos 99 vs 101 side by side only

### Key Constraints for v1.2

- `winsdk` is the new library required for Windows Location API access
- All existing 79 tests must remain GREEN after integration — currently 95 GREEN
- GPS columns appear as the last 3 columns in the CSV (after the existing 18)
- None → "" serialization already established in CSVLogger — reused the same pattern

## Session Continuity

Stopped at: Completed 09-06-PLAN.md

Next action: `/gsd:plan-phase 9` (first commit must be .gitignore; REPO-02 remote creation needs a user checkpoint in Phase 11)
