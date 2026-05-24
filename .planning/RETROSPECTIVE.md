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

## Cross-Milestone Trends

| Metric | v1.0 MVP | v1.1 Real-Time Visualization |
|--------|----------|------------------------------|
| Phases | 4 | 2 |
| Plans executed | 8/9 | 4/4 |
| Python LOC (added) | 2,064 | ~707 |
| Tests (cumulative) | 64 | 79 (+15) |
| Timeline (days) | 3 | 1 |
| Hardware verified | Yes (COM10) | Pending (--gui with real sensor) |
| Known debt at ship | 3 items | 3 items |
