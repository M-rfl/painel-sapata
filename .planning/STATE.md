---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: GPS Data Integration
status: Defining requirements
stopped_at: Milestone v1.2 started — defining requirements
last_updated: "2026-05-24T00:00:00.000Z"
last_activity: 2026-05-24 — Milestone v1.2 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-24 after v1.2 start)

**Core value:** O sensor deve conectar, ler e salvar dados confiáveis em CSV — se isso não funcionar, nada mais importa.
**Current focus:** Defining requirements for GPS Data Integration

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements

Progress: [░░░░░░░░░░] 0%

## Accumulated Context

### Carried forward from v1.1

- `test_main.py` uses `mock_csv.file_path` but `main.py` reads `csv_logger.path` (4 locations) — test correctness fix deferred to v1.3
- Validate SCALE_VEL = 1/100 (mm/s) in field with reference instrument — deferred to v1.3
- `05-VALIDATION.md` and `06-VALIDATION.md` show `nyquist_compliant: false` — planning artifacts only

### v1.2 GPS Decisions Made

- GPS source: Windows Location API (WinRT) — no extra serial port needed
- Fields: gps_lat, gps_lon, gps_speed_mps
- No-fix behavior: empty fields (same pattern as angle RESERVED registers)
- Activation: always-on (GPS columns always in CSV header)
