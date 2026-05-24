# Roadmap: WTVB01 Notebook Logger

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-05-21)
- ✅ **v1.1 Real-Time Visualization** — Phases 5-6 (shipped 2026-05-24)
- 🚧 **v1.2 GPS Data Integration** — Phases 7-8 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-05-21</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-05-20
- [x] Phase 2: Sensor Layer (1/2 plans; HW checkpoint deferred) — completed 2026-05-21
- [x] Phase 3: Acquisition Loop (3/3 plans) — completed 2026-05-21
- [x] Phase 4: Documentation & Hardening (2/2 plans) — completed 2026-05-21

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Real-Time Visualization (Phases 5-6) — SHIPPED 2026-05-24</summary>

- [x] Phase 5: Visualizer Module (2/2 plans) — completed 2026-05-23
- [x] Phase 6: main.py Integration (2/2 plans) — completed 2026-05-24

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

### 🚧 v1.2 GPS Data Integration (In Progress)

**Milestone Goal:** Enrich every CSV row with live GPS position (lat, lon, speed) from the Windows Location API, with graceful degradation when no fix or no hardware is present.

- [x] **Phase 7: GPS Reader & Data Model** — `src/gps_reader.py` with Windows Location API, non-blocking background polling, resilience to missing hardware/denied permission, terminal status, and `SensorReading` dataclass extension (completed 2026-05-24)
- [ ] **Phase 8: CSV Integration** — GPS columns in CSV header and every data row, end-to-end integration with acquisition loop, full test coverage

## Phase Details

### Phase 7: GPS Reader & Data Model
**Goal**: The app can acquire GPS position from the Windows Location API without blocking sensor acquisition, degrades gracefully when unavailable, and communicates status to the user at startup
**Depends on**: Phase 6
**Requirements**: GPS-01, GPS-02, GPS-03, GPS-04, GPS-05, GPS-08, GPS-09
**Success Criteria** (what must be TRUE):
  1. Running `python main.py` prints a GPS status line at startup — either "GPS: fix acquired" or "GPS: no fix — CSV columns will be empty" — before the acquisition loop begins
  2. `GPSReader.get_location()` returns a `(float, float, float)` tuple when a fix is available and `(None, None, None)` when not, with no exception raised to the caller
  3. On a machine with no GPS hardware or with the Windows Location API import failing, the app starts and logs normally — no crash, no traceback visible to the user
  4. When Windows location permission is denied, the terminal shows the exact actionable message: "GPS: location access denied — enable in Windows Settings › Privacy › Location"
  5. `SensorReading` in `utils.py` carries `gps_lat`, `gps_lon`, `gps_speed_mps` fields typed `float | None`, and GPS polling does not measurably delay the 10 Hz sensor read cycle
**Plans**: 3 plans
Plans:
- [x] 07-01-PLAN.md — GPSReader class: Windows Location API, resilience, TDD (GPS-01, GPS-02, GPS-08, GPS-09)
- [ ] 07-02-PLAN.md — SensorReading dataclass: add gps_lat, gps_lon, gps_speed_mps fields (GPS-05)
- [ ] 07-03-PLAN.md — main.py wiring: background GPS thread, startup status messages, GPS field population (GPS-03, GPS-04)

### Phase 8: CSV Integration
**Goal**: Every CSV file produced by the logger contains three GPS columns in its header and populates them each row with the current fix values or empty strings when no fix
**Depends on**: Phase 7
**Requirements**: GPS-06, GPS-07
**Success Criteria** (what must be TRUE):
  1. A CSV file opened after a session always contains `gps_lat`, `gps_lon`, `gps_speed_mps` as its last three column headers, regardless of whether a GPS fix was ever obtained
  2. Each data row in the CSV contains a numeric value for each GPS column when a fix was available at that acquisition cycle, and an empty string when no fix — matching the existing `None → ""` pattern used for angle RESERVED registers
  3. The full test suite (existing 79 + new GPS tests) passes with no regressions
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-05-20 |
| 2. Sensor Layer | v1.0 | 1/2 | Complete (HW checkpoint deferred) | 2026-05-21 |
| 3. Acquisition Loop | v1.0 | 3/3 | Complete | 2026-05-21 |
| 4. Documentation & Hardening | v1.0 | 2/2 | Complete | 2026-05-21 |
| 5. Visualizer Module | v1.1 | 2/2 | Complete | 2026-05-23 |
| 6. main.py Integration | v1.1 | 2/2 | Complete | 2026-05-24 |
| 7. GPS Reader & Data Model | 3/3 | Complete   | 2026-05-24 | - |
| 8. CSV Integration | v1.2 | 0/TBD | Not started | - |
