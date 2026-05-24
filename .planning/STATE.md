---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: GPS Data Integration
status: Roadmap ready — awaiting phase planning
stopped_at: Roadmap created — Phase 7 not yet planned
last_updated: "2026-05-24T00:00:00.000Z"
last_activity: 2026-05-24 — v1.2 roadmap created (Phases 7-8)
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-24 after v1.2 start)

**Core value:** O sensor deve conectar, ler e salvar dados confiáveis em CSV — se isso não funcionar, nada mais importa.
**Current focus:** v1.2 GPS Data Integration — Phase 7: GPS Reader & Data Model

## Current Position

Phase: 7 — GPS Reader & Data Model (not yet planned)
Plan: —
Status: Roadmap ready — awaiting `/gsd:plan-phase 7`

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

| Metric | v1.0 | v1.1 | v1.2 |
|--------|------|------|------|
| Timeline | 3 days | 1 day | — |
| Tests GREEN | 64 | 79 | — |
| Python LOC added | 2,064 | +707 | — |
| Phases | 4 | 2 | 2 planned |
| Plans | 8/9 | 4/4 | 0/TBD |

## Accumulated Context

### Carried forward from v1.1

- `test_main.py` uses `mock_csv.file_path` but `main.py` reads `csv_logger.path` (4 locations) — test correctness fix deferred to v1.3
- Validate SCALE_VEL = 1/100 (mm/s) in field with reference instrument — deferred to v1.3
- `05-VALIDATION.md` and `06-VALIDATION.md` show `nyquist_compliant: false` — planning artifacts only, not a runtime issue

### v1.2 GPS Decisions Made

- GPS source: Windows Location API (WinRT / winsdk) — no extra serial port needed
- New fields on SensorReading: `gps_lat`, `gps_lon`, `gps_speed_mps` (all `float | None`)
- No-fix behavior: empty fields in CSV (same pattern as angle RESERVED registers)
- Activation: always-on — GPS columns always present in CSV header regardless of fix status
- Non-blocking: GPSReader runs in a background thread; must not delay 10 Hz sensor acquisition
- Resilience: app starts normally if GPS hardware absent, API import fails, or permission denied

### Key Constraints for v1.2

- `winsdk` is the new library required for Windows Location API access
- All existing 79 tests must remain GREEN after integration
- GPS columns appear as the last 3 columns in the CSV (after the existing 18)
- None → "" serialization already established in CSVLogger — reuse the same pattern

## Session Continuity

Next action: `/gsd:plan-phase 7`

Phase 7 scope: `src/gps_reader.py` (GPSReader class), `SensorReading` dataclass update in `utils.py`, background thread wiring in `main.py`, terminal status messages, full resilience (no-hardware, permission-denied).

Phase 8 scope: `src/csv_logger.py` header extension, row serialization for GPS fields, end-to-end integration tests.
