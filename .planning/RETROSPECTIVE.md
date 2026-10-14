# Project Retrospective: WTVB01 Notebook Logger

---

## Milestone: v1.0 MVP

**Shipped:** 2026-05-21
**Phases:** 4 | **Plans:** 8 executed (1 deferred — hardware checkpoint)

### What Was Built

- `src/utils.py` — SensorReading dataclass, to_signed16(), get_timestamp_br() (tzdata/Windows), rotating log handler
- `src/config_loader.py` — AppConfig with full YAML validation, collect-all-errors pattern, list_serial_ports.py
- `src/sensor.py` — WitMotionSensor: pymodbus 3.13.0 RTU burst read, confirmed scale factors from manual, consecutive-error threshold
- `src/csv_logger.py` — CSVLogger: 18-column Windows-safe CSV, flush-on-write, None→"" for reserved channels
- `main.py` — Acquisition loop: Ctrl+C session summary, outermost KeyboardInterrupt + finally pattern
- `README.md` — 281 lines: CH340 driver step, 3 OS serial paths, 12 troubleshooting scenarios
- `tests/` — 64 tests GREEN across 6 test files

### What Worked

- **TDD discipline paid off**: Writing tests RED before implementation caught the `slave=` API removal (pymodbus 3.x) before any hardware attempt. The 11 mock tests in test_sensor.py defined exact API contracts.
- **Bottom-up dependency order**: Building Foundation → Sensor → Loop → Docs meant each phase had stable contracts from the one below it. Zero circular import issues.
- **SensorReading in utils.py (not sensor.py)**: The decision to put the shared dataclass in utils.py instead of sensor.py eliminated a circular import that would have been painful to debug later.
- **Hardware checkpoint in Phase 3 (not Phase 2)**: Because the full loop was running when hardware was available, the Phase 3 checkpoint validated sensor reading + CSV writing + display all at once. Much higher value than a bare sensor test would have been.
- **`_REG_COUNT = 0x46 - 0x34 + 1`**: The arithmetic hardening in Phase 4 is a good pattern — the register range is now self-documenting in the code.
- **Scale factors confirmed from official manual**: Having the exact protocol PDF eliminated guesswork (SCALE_VEL = 1/100, SCALE_TEMP = 1/100, SCALE_DISP = 1.0, SCALE_FREQ = 1/10).

### What Was Inefficient

- **Phase 2 SUMMARY.md has stale "scale factors = None"**: The SUMMARY was written before the datasheet was obtained. After confirming the scale factors (feat(sensor): apply confirmed scale factors), the SUMMARY was never updated. This caused confusion during the milestone audit — the audit thought Phase 2 requirements were unsatisfied until integration-checking the actual code.
- **REQUIREMENTS.md traceability table fell out of sync**: UTIL-01/02/03 and DOC-04 were marked "Pending" in the traceability table even though Phase 1 was complete. The checkbox update and the traceability table update were separate steps that weren't both done.
- **Phase 2 VALIDATION.md frontmatter stale**: `nyquist_compliant: false` and `wave_0_complete: false` were never updated after 11 tests passed, requiring `/gsd:validate-phase 2` before completing the milestone.
- **02-02-PLAN.md (hardware checkpoint) never got a SUMMARY**: When the hardware checkpoint was deferred, no placeholder SUMMARY was created to record the deferral decision. This caused the roadmap analyzer to show Phase 2 as "partial" and progress at 89%, even though the decision was intentional.

### Patterns Established

- **`getattr(config, field, default)` for optional config fields**: Avoids modifying AppConfig and its tests when sensor needs an optional field (sensor_id). If config gains the field later, the fallback auto-picks it up.
- **Collect-all-errors before exit**: `_validate()` accumulates all YAML errors and prints them all before `sys.exit(1)`. Users see all config problems in one run instead of fixing one at a time.
- **`open(newline='')` is mandatory on Windows CSV**: Without it, `csv.writer` produces CRCRLF (double line endings) that corrupt CSV in some parsers. This pattern must carry forward to any future CSV writers.
- **`except KeyboardInterrupt` at outermost level** (outside the polling while loop): Session summary always executes before `finally`. If it were inside the loop, a Ctrl+C during `read_all_data()` could skip the summary.
- **Mock patch target = import location**: `@patch("src.sensor.ModbusSerialClient")` works because that's where ModbusSerialClient lives in sensor.py's namespace. Patching `pymodbus.client.ModbusSerialClient` would have no effect.

### Key Lessons

1. **Write a SUMMARY for deferred plans**: When a plan is deferred (hardware checkpoint), write a minimal SUMMARY documenting the deferral rationale and where the verification happened instead. Prevents confusion in future audits.
2. **Update ALL traceability artifacts together**: When marking a requirement complete, update both the `[x]` checkbox AND the traceability table status in the same commit. The two-location pattern creates drift.
3. **Update VALIDATION.md frontmatter at phase completion, not plan-by-plan**: The `nyquist_compliant: true` flag should be set in the SAME commit that marks the phase complete in ROADMAP.md, before moving to the next phase.
4. **Hardware availability determines plan ordering**: Phase 2's hardware checkpoint was deferred because hardware wasn't available. If hardware is known to be available at project start, schedule the hardware checkpoint early (Phase 2) to validate the core sensor wiring before building on top of it.

### Cost Observations

- Model mix: sonnet (primary — all phases)
- Sessions: ~6 sessions across 3 days
- Notable: 46 commits for a 2,064 LOC project = healthy granularity (~45 LOC/commit). TDD RED→GREEN→SUMMARY pattern kept commits atomic and traceable.

---

## Milestone: v1.1 Real-Time Visualization

**Shipped:** 2026-05-24
**Phases:** 2 | **Plans:** 4 (all executed)

### What Was Built

- `tests/test_visualizer.py` — 10-test Wave 0 scaffold with Agg backend; matplotlib>=3.10 added to requirements.txt
- `src/visualizer.py` — PlotManager class (139 lines): 5-subplot FuncAnimation, 13 per-channel deque(maxlen=300), update_data(), _animate(), standalone mock mode
- `tests/test_main_gui.py` — 5 Wave 0 stub tests covering INTG-01 through INTG-04; sys.argv patch added to test_main.py
- `main.py` refactored — argparse `--gui`, `_run_headless_mode` (exact v1.0 loop), `_run_gui_mode` (deferred import, daemon thread, stop_event), `_print_summary`
- `tests/` — grew from 64 to 79 tests, all GREEN

### What Worked

- **TDD Wave 0 + deferred import pattern**: Writing test_visualizer.py with `matplotlib.use("Agg")` before any implementation meant the PlotManager could be designed with a clean headless test surface from the start. Phase 5 never had a flaky Tk window open during tests.
- **Phase 5 as standalone module**: Designing PlotManager to be fully testable with mock data (standalone `python src/visualizer.py`) before touching main.py meant Phase 6 had a proven interface to wire against. No integration surprises.
- **deque + CPython GIL thread safety**: Using `deque(maxlen=300)` with CPython's GIL was the correct call for this use case — no explicit locking needed, correct rolling buffer semantics, zero test instability.
- **stop_event instead of time.sleep()**: Using `threading.Event.wait(timeout=...)` in `_acquire()` meant shutdown latency is bounded at one sample interval (0.1s), not up to 100ms of a sleeping thread that doesn't notice the stop signal.
- **Shutdown order (join before close)**: Establishing the invariant "join the acquisition thread before closing CSV" eliminated the write-to-closed-file race at design time, not during debugging.
- **1-day milestone**: Phase 5 + Phase 6, 4 plans, 79 tests — completed in a single day. The Foundation work in v1.0 (SensorReading in utils.py, clean module boundaries) paid dividends here.

### What Was Inefficient

- **VALIDATION.md frontmatter not updated**: Same pattern as v1.0 — both `05-VALIDATION.md` and `06-VALIDATION.md` show `nyquist_compliant: false` after phase completion. The planning artifact was never updated to reflect the actual state.
- **`mock_csv.file_path` not fixed in test_main.py**: The attribute mismatch (`file_path` vs `.path`) was a known issue from v1.0 that was deferred again. It should have been fixed in Phase 6 Plan 01 when test_main.py was already being modified for the sys.argv patch.
- **VIZ-01 scope split between Phase 5 and Phase 6**: The requirement "launch a live graph window using `python main.py --gui`" was mapped to Phase 5 in REQUIREMENTS.md but the `--gui` flag itself was Phase 6. This created a PARTIAL status in Phase 5's VERIFICATION that needed explanation in the audit. Better requirement scoping would have split VIZ-01 into "PlotManager widget" (Phase 5) and "main.py --gui integration" (Phase 6).

### Patterns Established

- **Agg-first test pattern**: `import matplotlib; matplotlib.use("Agg")` as the very first statement in any test file that imports visualizer components — before any src.visualizer import. This prevents TkAgg activation in headless environments and CI.
- **Deferred import for GUI-only dependencies**: `from src.visualizer import PlotManager` inside the function body of `_run_gui_mode()`, not at module level. Prevents Tk backend activation when `main.py` is imported by tests.
- **samples_ref = [0] mutable list counter**: Cross-thread counter without `nonlocal` and without a Lock — thread-safe in CPython for simple int increment via GIL.
- **TDD across phases**: Phase N scaffold (RED) → Phase N+1 implementation (GREEN). Phase 5 Plan 01 wrote RED tests for the PlotManager that Phase 5 Plan 02 made GREEN. Phase 6 Plan 01 wrote RED stubs for GUI integration that Phase 6 Plan 02 made GREEN. Consistent and effective.

### Key Lessons

1. **Fix known test correctness issues before modifying those files**: When test_main.py was being modified in Phase 6 Plan 01 (sys.argv patch), the `file_path` → `.path` fix was already known. Co-locating the fix with the modification would have closed the tech debt at zero extra cost.
2. **Map requirements to the phase that delivers the observable behavior**: VIZ-01 ("launch via `python main.py --gui`") should have been mapped to Phase 6, with a new VIZ-01a for the PlotManager widget in Phase 5. Requirement-to-phase mapping should reflect the phase's observable output, not the component it builds.
3. **Update VALIDATION.md at phase completion, not later**: Same lesson as v1.0 — the VALIDATION.md frontmatter should be updated atomically with the phase-complete commit. Running `/gsd:validate-phase N` retroactively is extra work.

### Cost Observations

- Model mix: sonnet (primary — all phases)
- Sessions: ~3 sessions across 1 day
- Notable: v1.1 was 4 plans in 1 day vs v1.0's 8 plans in 3 days. The Foundation investment (SensorReading, clean module boundaries, established test patterns) compounded here — Phase 5 and 6 had zero architectural surprises.

---

## Milestone: v1.2 GPS Data Integration

**Shipped:** 2026-05-25
**Phases:** 2 | **Plans:** 4 (all executed)

### What Was Built

- `src/gps_reader.py` — GPSReader class (103 lines): Windows Location API via `winsdk`, `asyncio.run()` per poll, module-level import guard, poll/cache split, 4-state `status` property, 8 unit tests GREEN
- `src/utils.py` — SensorReading extended with `gps_lat`, `gps_lon`, `gps_speed_mps` (`Optional[float]`, `field(default=None)`) — zero changes to 79 existing tests
- `src/main.py` — GPSReader wired as 1 Hz daemon thread; startup GPS status line; GPS fields populated in both headless and GUI acquisition paths; 3 new unit tests
- `src/csv_logger.py` — CSV extended from 18 to 21 columns; `_cell()` helper reused for GPS None → "" serialization; 3 new TDD tests
- `tests/` — grew from 79 to 95 tests, all GREEN; 16 new GPS tests across 4 plans

### What Worked

- **poll/cache split design**: Separating `poll()` (does Windows API I/O) from `get_location()` (returns cached value instantly) was the right call upfront. The 10 Hz acquisition loop never waits on GPS — it reads the cache, which is always available. This was designed in Phase 7-01 and validated cleanly in Phase 7-03 wiring.
- **`field(default=None)` for backward compatibility**: Adding GPS fields to SensorReading with `field(default=None)` meant all 79 existing tests continued to construct SensorReading without GPS kwargs — zero test modifications needed in unrelated test files. Clean non-breaking extension.
- **Reusing `_cell()` helper**: CSVLogger already had `_cell(value)` returning `value if value is not None else ""` for angle RESERVED registers. Reusing it for GPS None → "" required zero new logic and zero new tests of the helper itself. The pattern was proven and consistent.
- **winsdk conditional import**: The module-level `_WINSDK_AVAILABLE = False` flag + try/import pattern means the app degrades gracefully on machines without `winsdk` installed — no crash, GPS columns remain empty. This was planned upfront as GPS-08 and worked exactly as intended.
- **1-day milestone again**: v1.2 followed v1.1's 1-day pattern despite being a non-trivial platform integration (Windows Location API). The clean module boundaries established in v1.0 made it straightforward to add GPSReader as a new module without touching existing ones.

### What Was Inefficient

- **07-03 checkpoint was a human-verify gate**: Phase 7 Plan 03 included a checkpoint requiring human approval after the GPS wiring was complete. In practice, the automated test coverage was sufficient — the checkpoint added a manual step without discovering anything new. For future platform integrations, consider whether the checkpoint adds verification value or is just a formality.
- **asyncio.run() per poll call**: Acceptable at 1 Hz, but if the GPS poll rate were ever increased, the per-call `asyncio.run()` overhead would become a bottleneck. A persistent event loop would be the correct refactor then. Noted as a known limitation but deferred.
- **No end-to-end integration test**: All tests are unit-level. There is no test that creates a GPSReader mock, runs the acquisition loop, writes a CSV, and verifies the GPS columns appear in the file. The verification was done at the unit level and confirmed by code inspection. A true E2E test would have been higher confidence but was deferred.

### Patterns Established

- **Module-level conditional import guard**: `try: import winsdk; _AVAILABLE = True except ImportError: _AVAILABLE = False` as the pattern for platform-specific optional dependencies. Fast hot path (import attempted once), zero runtime penalty when unavailable.
- **poll/cache split for blocking APIs**: When a blocking I/O operation must coexist with a tight timing loop, separate `poll()` (does the I/O, updates cache) from `get()` (returns cache instantly). The caller on the hot path always uses `get()`.
- **GPS columns at end of CSV schema**: New optional columns go at the end of the CSV schema (after existing ones) — backward-compatible for any consumers that read by index. Column indices 0–17 are unchanged from v1.0.

### Key Lessons

1. **Platform API + asyncio + threading requires a clear mental model upfront**: The `asyncio.run()` / background-thread / 10 Hz loop interaction needed to be designed explicitly before writing code. The plan's interface contracts section (what GPSReader provides, what each phase requires) made this tractable.
2. **Design resilience as a first-class requirement**: GPS-08 (no crash when GPS unavailable) and GPS-09 (permission-denied message) were explicit requirements, not afterthoughts. Both were covered by unit tests. Building the conditional import guard on Day 1 meant the resilience was structural, not a try/except patch added at the end.
3. **Checkpoint gates should require human action that tests can't automate**: Phase 7-03's human-verify checkpoint could have been skipped if the only verification was "does the test pass?" Future checkpoint gates should be reserved for things like "verify the GPS status line actually appears on the real terminal" — things that genuinely require a human.

### Cost Observations

- Model mix: sonnet (primary — all phases)
- Sessions: ~2 sessions across 1 day
- Notable: 14 commits for a +1,661 LOC milestone. The plan structure (4 plans, clear interfaces) kept the work focused — each plan modified 1–2 files and had a clear done condition.

---

## Milestone: v1.3 Field Run Dashboard

**Shipped:** 2026-10-14
**Phases:** 8 (9-16) | **Plans:** 47 (all executed) | **Commits:** 210

### What Was Built

- `tools/dashboard_converter/` — raw logger CSVs → schema-1 compact site JSON. It recovers the pt-BR Excel mangling, assigns trecho by station geofence, detects sentido from the station sequence and flags "sem GPS" tunnel samples. Validated against the workbook (classes, eventos, impactos exact).
- `site/js/core/` — pure JS analysis engine (dynamics, classes, eventos/impactos/pontos, priority, conforme), plus series, geo, matrix, ranking, quality index, GPS filter and the JS converter port (`core/convert/`)
- `site/js/app/` — the public pt-BR dashboard: state store with URL hash, overview/stats/quality panels, controls, uPlot charts, Leaflet map with heat layer, matrix, ranking with CSV export, upload session controller, PDF report (jsPDF), axis popup
- `.github/workflows/pages.yml` — Pages deploy gated on pytest + `node --test`, with Python pinned to 3.13.14
- Tests: pytest 95 → 289, plus 296 `node --test` (golden, Python↔JS parity, upload oracle parity, static/no-network guards, PDF smoke)

### What Worked

- **Golden values from the workbook as the contract.** Phase 9 locked exact class/eventos/impactos parity before any UI existed. That gave Phases 10-16 a fixed target, and the "conforme planilha" badge is the same contract shown to users.
- **Python↔JS parity via oracle fixtures.** Python generates the fixtures and JS replays them, with a pytest freshness guard. This caught real cross-runtime differences: V8 `Math.log10` vs CPython (fixed with a boundary table) and `fromisoformat` edge cases (ported from the C implementation and fuzz-verified). The JS upload converter reproduces run 1 almost exactly; the only difference is a recorded 1-ulp gap on one diagnostic field.
- **Pure core / thin app split.** `site/js/core/` has no DOM, so most behaviour is testable under `node --test`. The integration audit found no orphaned exports and no listener leaks across re-mounts.
- **Engineer browser checkpoints changed the product, for the better.** 12-06 replaced the GPS-fix track with OSM routes, 13-07 set the IQ bands to 98/90 and approved the 98-pontos GPS baseline, and 11-07 confirmed public 6-dp GPS. Unlike the v1.2 formality checkpoint, these were decisions only a human could make.
- **Test-gated deploy from day one.** Every push to `master` was guarded by both suites, so all 8 phases shipped live without a broken deploy.

### What Was Inefficient

- **A flagged data issue was never closed.** The Phase 9 verification said to fix the inferred-station trecho collapse (CTR/EQD/SCT) "before per-trecho views". Phases 11-15 then built the matrix, ranking, priority, per-trecho IQ and the PDF on top of it, and tests now assert the deviating values (for example the top trecho, 427). The fix is more expensive now: converter, JS port, data and fixtures.
- **Requirement text drifted after approved deviations.** MAP-01 and MAP-02 still describe a GPS track and trecho segments after the 12-06 change. The verifier suggested new wording, but nobody applied it.
- **Scope grew without bookkeeping.** The milestone went from Phases 9-13 to 9-16 (upload, PDF and axis popup were added), but the ROADMAP header ranges, the Phase 9 progress row (0/6) and the plan checkboxes were left stale until the audit.
- **SUMMARY frontmatter lacked `one_liner` and task counts**, so `milestone complete` recorded "1 task" and no accomplishments, and these had to be rebuilt by hand.
- **Local preview cached stale ES modules** under `http.server`, which cost a debugging round before `tools.serve_site` (no-cache) existed.

### Patterns Established

- **Oracle fixture + freshness guard** for every cross-language port: Python is the source of truth, JS replays committed fixtures, and pytest fails if the inputs change without regeneration. Pin the oracle's Python version in CI whenever the fixture depends on libm or float formatting.
- **Derived run outside the engine** (GPS jump filter): parameter-driven data cleaning wraps `analyze()` instead of changing it, so workbook parity is preserved.
- **Mount/destroy lifecycle with a generation token and disposer stack** for swapping the whole dashboard on upload, with rollback on failure.
- **Vendored, pinned, licence-checked third-party JS** (sha256 + LICENSE + `.gitattributes`), lazy-loaded when heavy (jsPDF).
- **Static guard tests** (`tests/test_site_static.py`) for no-network uploads, sections present and wiring, which cheaply complement code-level tests.

### Key Lessons

1. **A "fix before X" note in a verification needs a tracked task, not prose.** If it isn't a phase, a plan or a todo, it will be built on top of. Either insert a decimal phase immediately or downgrade it to accepted debt explicitly.
2. **When an approved deviation changes what a requirement means, update REQUIREMENTS.md in the same commit.** Otherwise the audit has to re-litigate it.
3. **Treat added phases as scope changes.** Update the milestone header range, progress table and traceability right away, in the same commit as `/gsd:add-phase`.
4. **Write machine-readable SUMMARY frontmatter** (`one_liner`, task count), so milestone tooling can produce accurate stats.
5. **Cross-runtime numerical parity is achievable but needs an oracle.** Don't trust "same algorithm" across Python and JS; generate fixtures from the reference implementation and replay them.

### Cost Observations

- Model profile: balanced (subagents per GSD defaults); the exact model mix was not tracked
- Timeline: 7 days, 47 plans (about 7 plans/day); most plans took 10-40 min, with checkpoint plans driven by engineer availability
- Notable: the largest milestone so far (8 phases vs 2-4 before), and it stayed coherent because the core engine contract (Phase 10) came before any UI

---

## Cross-Milestone Trends

| Metric | v1.0 MVP | v1.1 Real-Time Viz | v1.2 GPS Integration | v1.3 Field Run Dashboard |
|--------|----------|--------------------|----------------------|--------------------------|
| Phases | 4 | 2 | 2 | 8 |
| Plans executed | 8/9 | 4/4 | 4/4 | 47/47 |
| LOC (added net) | 2,064 Py | ~707 Py | ~1,661 Py | ~6,600 JS + ~3,550 Py (tools) |
| Tests (cumulative) | 64 | 79 (+15) | 95 (+16) | pytest 289 + node 296 |
| Timeline (days) | 3 | 1 | 1 | 7 |
| Hardware verified | Yes (COM10) | Pending (--gui) | Pending (real GPS fix) | n/a (post-run analysis; live site approved) |
| Known debt at ship | 3 items | 3 items | 2 items | ~16 items (1 significant) |
| Nyquist compliant phases | partial | 0/2 | — | 7/8 |
| New external deps | pymodbus, pyserial, PyYAML, tzdata, matplotlib | — | winsdk | uPlot, Leaflet, leaflet.heat, jsPDF, jspdf-autotable (vendored); Pillow (dev); winsdk → winrt-* |
