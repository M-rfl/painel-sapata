---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Real-Time Visualization
status: Roadmap ready — awaiting plan-phase
stopped_at: Phase 06 Plan 02 complete — main.py --gui integration, 79 tests GREEN
last_updated: "2026-05-24T00:20:34.254Z"
last_activity: 2026-05-21 — v1.1 roadmap created
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21 — v1.1 started)

**Core value:** O sensor deve conectar, ler e salvar dados confiáveis em CSV — se isso não funcionar, nada mais importa.
**Current focus:** Phase 5 — Visualizer Module (ready to plan)

## Current Position

Phase: 5 — Visualizer Module
Plan: Not started
Status: Roadmap ready — awaiting plan-phase
Last activity: 2026-05-21 — v1.1 roadmap created

Progress: [░░░░░░░░░░] 0%

```
Phase 5: Visualizer Module    [░░░░░░░░░░] Not started
Phase 6: main.py Integration  [░░░░░░░░░░] Not started
```

## Accumulated Context

### Decisions

Decisions from v1.0 are logged in PROJECT.md Key Decisions table.

v1.1 architectural decisions:
- Matplotlib main thread / acquisition background thread (Windows Tk backend constraint)
- deque maxlen=300 per channel (30s × 10 Hz) for rolling buffer — thread-safe in CPython
- `--gui` flag via argparse — default (no flag) stays exactly as v1.0
- 13 live channels: ax_g, ay_g, az_g, vib_x/y/z_mm_s, disp_x/y/z_um, freq_x/y/z_hz, temp_c
- angle_x/y/z always None (RESERVED registers 0x3D-0x3F) — NOT included in visualization
- 5 subplots: Acceleration (g), Velocity (mm/s), Displacement (µm), Frequency (Hz), Temperature (°C)
- Phase 5 designed to be testable standalone with mock data before touching main.py
- [Phase 05-visualizer-module]: TDD Wave 0: 10-test scaffold written before implementation — all fail with ImportError until Plan 02 ships PlotManager
- [Phase 05-visualizer-module]: Agg backend set as first statement in test_visualizer.py — prevents Tk window in headless CI
- [Phase 05-visualizer-module]: _SUBPLOT_DEFS data-driven pattern drives both subplot setup and update_data attribute lookup without duplication
- [Phase 05-visualizer-module]: FuncAnimation stored as self._ani (not local) to prevent GC during animation; blit=False + cache_frame_data=False for correct axis behavior
- [Phase 06-main-py-integration]: mock_csv.path used in test_main_gui.py (correct attribute) vs mock_csv.file_path kept in test_main.py (pre-existing, not changed)
- [Phase 06-main-py-integration]: sys.argv regression guard: patch sys.argv as first item in with-block to prevent argparse SystemExit(2) when Plan 02 adds --gui flag
- [Phase 06-main-py-integration]: Shutdown order in _run_gui_mode: stop_event.set then join then _print_summary then sensor.close then csv_logger.close
- [Phase 06-main-py-integration]: patch src.visualizer.PlotManager (not main.PlotManager) because PlotManager is never bound in main namespace due to deferred import

### Pending Todos

- Plan Phase 5: Visualizer Module
- Plan Phase 6: main.py Integration

### Blockers/Concerns (carried from v1.0)

- Validate SCALE_VEL = 1/100 (mm/s) in field with reference instrument — scale confirmed from SDK but not yet measured against known vibration
- test_main.py uses `mock_csv.file_path` but main.py reads `csv_logger.path` — DISP-03 CSV path not asserted by automated test

## Session Continuity

Last session: 2026-05-24T00:16:31.040Z
Stopped at: Phase 06 Plan 02 complete — main.py --gui integration, 79 tests GREEN
Resume file: None
Next action: `/gsd:plan-phase 5`
