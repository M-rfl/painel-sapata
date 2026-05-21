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

## Cross-Milestone Trends

| Metric | v1.0 MVP |
|--------|----------|
| Phases | 4 |
| Plans executed | 8/9 |
| Python LOC | 2,064 |
| Tests | 64 |
| Timeline (days) | 3 |
| Git commits | 46 |
| Hardware verified | Yes (COM10) |
