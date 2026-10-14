# Milestones

## v1.3 Field Run Dashboard (Shipped: 2026-10-14)

**Phases completed:** 8 phases (9-16), 47 plans, ~100 tasks | **Commits:** 210 (`v1.2..v1.3`)
**Code added:** ~6,600 LOC JS (`site/js`, excluding vendored libs and the generated image module) + ~3,550 LOC Python (`tools/`) + tests; 329 files changed (+39.572 / −3.024)
**Timeline:** 2026-10-08 → 2026-10-14 (7 days) | **Tests:** pytest 95 → 289, `node --test` 0 → 296 (all GREEN)
**Public site:** https://github.com/M-rfl/painel-sapata (GitHub Pages, deployed by Actions only after pytest + node tests pass)

**Delivered:** A public Portuguese GitHub Pages dashboard for the first field run (VLT Carioca · Linha 4 · Trem 102 · 02/10/2026). It is built from the raw logger CSVs. Thresholds, filters, display and analysis parameters are all recomputed live in the browser. It reproduces the treated workbook's class counts, eventos and impactos exactly, accepts any raw logger CSV upload, and exports a PDF report.

**Key accomplishments:**
- **Converter (Phase 9):** `python -m tools.dashboard_converter` turns the raw logger CSVs into schema-versioned compact JSON. It recovers the pt-BR Excel-mangled values (or reports them), assigns trecho by station geofence, detects sentido from the station sequence and flags "sem GPS" tunnel samples. The output matches the workbook exactly: classes 21.031/1.611/512/173/56, 2.352 eventos, 1.749 impactos.
- **Analysis engine (Phase 10):** a pure JS engine (`site/js/core/`) computes dynamics, classes, eventos, impactos, pontos and trecho priority, and drives the "conforme planilha" badge. Golden tests and seeded Python↔JS parity tests protect it.
- **Public site (Phases 11-12):** published to GitHub Pages with a test-gated Actions deploy. It has KPIs, the class/axis breakdown, stats and a data-quality card, plus pt-BR controls with one-click reset. The synchronized uPlot time series (medido/dinâmico, threshold lines, gaps, secondary channels) link to a Leaflet map with OSM routes, severity markers and a fixed-scale heat map. Hover and click link the charts and the map.
- **Matrix, ranking and sharing (Phase 13):** a trecho × severidade matrix whose cell clicks filter every view; top-50 pontos and trecho priority tables with CSV export; a track quality index (96,4 % on run 1); analysis parameters including a GPS jump filter; and a URL hash that restores the full view.
- **Browser upload (Phase 14):** any raw CSV (comma or pt-BR `;`) can be uploaded. A JS port of the converter, bit-for-bit parity-tested against Python on run 1, re-renders the whole dashboard with no backend. Errors are shown in Portuguese and the previous view is kept.
- **PDF report and axis help (Phases 15-16):** "Gerar PDF" builds an A4 landscape report in the browser (jsPDF) with the KPIs, map heat raster, matrices and ranking tables. An "Orientação dos eixos" header popup shows a base64-embedded WebP.

**Known gaps accepted at ship** (from `v1.3-MILESTONE-AUDIT.md`, status `tech_debt`, 50/50 requirements):
- Per-trecho deviation at inferred stations (CTR/EQD/SCT) is still unfixed. Trechos 1 and 4 show 0 impactos, and the top trecho differs from the workbook (427 'Pereira Reis – Vila Olímpica' vs 304 'Vila Olímpica – Central'). This affects the matrix, ranking, priority, per-trecho IQ and the PDF.
- Accepted deviations: the sentido split is at row 11.835 vs about 10.839; pontos are 99 vs 101 (98 with the default GPS filter).
- MAP-01 and MAP-02 were implemented as OSM route outlines and station markers instead of the GPS-fix track and trecho segments (engineer-approved).
- Minor: a PDF made before the route GeoJSON loads has no route lines; the quality card ignores the GPS filter; an upload-failure rollback drops the example URL state; no automated test covers `main.js` mount wiring.
- `09-VALIDATION.md` is not Nyquist compliant.

**Archive:**
- Roadmap: `.planning/milestones/v1.3-ROADMAP.md`
- Requirements: `.planning/milestones/v1.3-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.3-MILESTONE-AUDIT.md`

---

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
