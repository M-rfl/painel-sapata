# Roadmap: WTVB01 Notebook Logger

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-05-21)
- **v1.1 Real-Time Visualization** — Phases 5-6 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-05-21</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-05-20
- [x] Phase 2: Sensor Layer (1/2 plans; HW checkpoint deferred) — completed 2026-05-21
- [x] Phase 3: Acquisition Loop (3/3 plans) — completed 2026-05-21
- [x] Phase 4: Documentation & Hardening (2/2 plans) — completed 2026-05-21

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### v1.1 Real-Time Visualization

- [ ] **Phase 5: Visualizer Module** — PlotManager class with 5 subplots, deque buffers, FuncAnimation; testable standalone with mock data
- [ ] **Phase 6: main.py Integration** — `--gui` argparse flag, background acquisition thread, graceful shutdown when GUI window closes

## Phase Details

### Phase 5: Visualizer Module
**Goal**: A self-contained PlotManager class exists that renders live sensor data in 5 labeled subplots, driveable by any data source
**Depends on**: Nothing (builds on existing SensorReading dataclass from utils.py)
**Requirements**: VIZ-01, VIZ-02, VIZ-03, VIZ-04, VIZ-05, VIZ-06
**Success Criteria** (what must be TRUE):
  1. Running `python src/visualizer.py` (or a test script) opens a matplotlib window with 5 subplots and animates with mock data — no sensor hardware required
  2. Each subplot shows the correct channels: Acceleration has 3 lines (ax/ay/az), Velocity has 3 (vib_x/y/z), Displacement has 3 (disp_x/y/z), Frequency has 3 (freq_x/y/z), Temperature has 1 (temp_c)
  3. Each subplot Y-axis label includes the measurement name and physical unit (e.g., "Acceleration (g)", "Temperature (°C)")
  4. After 30 seconds of mock data, the X-axis window scrolls — old points drop off as new ones arrive, never exceeding 300 points per channel
  5. The animation visibly updates at least once per second (FuncAnimation interval ≤ 1000 ms)
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — Wave 0 test scaffold: tests/test_visualizer.py (10 RED tests) + matplotlib in requirements.txt
- [ ] 05-02-PLAN.md — PlotManager implementation: src/visualizer.py makes all 10 tests GREEN + standalone mock mode

### Phase 6: main.py Integration
**Goal**: `python main.py --gui` runs the full acquisition loop with live visualization; the existing `python main.py` path is unchanged
**Depends on**: Phase 5
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04
**Success Criteria** (what must be TRUE):
  1. `python main.py` (no flag) behaves identically to v1.0: terminal output, CSV write, Ctrl+C summary — no new imports, no behavior change
  2. `python main.py --gui` opens the visualization window while simultaneously writing every reading to CSV at 10 Hz
  3. Closing the matplotlib window (clicking X) triggers a clean shutdown and prints the session summary to the terminal — equivalent to pressing Ctrl+C
  4. Sensor acquisition runs in a background thread and matplotlib animation runs on the main thread; no GUI freeze occurs during normal operation
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-05-20 |
| 2. Sensor Layer | v1.0 | 1/2 | Complete (HW checkpoint deferred) | 2026-05-21 |
| 3. Acquisition Loop | v1.0 | 3/3 | Complete | 2026-05-21 |
| 4. Documentation & Hardening | v1.0 | 2/2 | Complete | 2026-05-21 |
| 5. Visualizer Module | 1/2 | In Progress|  | - |
| 6. main.py Integration | v1.1 | 0/? | Not started | - |
