---
phase: 10-analysis-engine
plan: 05
subsystem: testing
tags: [parity, fixture, node-test, pytest, oracle]
requires:
  - phase: 10-01
    provides: Python oracle analysis_ref
  - phase: 10-04
    provides: JS aggregates, priority, conforme
provides:
  - Seeded Python-to-JS parity fixture (18 cases) and generator
  - JS replay test and pytest freshness guard
affects: [11-dashboard-ui]
tech-stack:
  added: []
  patterns: [oracle-generated fixture with freshness guard]
key-files:
  created:
    - tools/dashboard_converter/gen_parity.py
    - tests/fixtures/parity_cases.json
    - tests/js/parity.test.js
    - tests/test_parity_fixture.py
  modified:
    - tools/dashboard_converter/README.md
key-decisions:
  - "Fixture holds 10 synthetic edge-case series and 8 run-1 cases (2 default-equivalent, 6 seeded random); 212 KB"
  - "inputs_sha256 covers analysis inputs only, so a new generated_at does not stale the fixture"
metrics:
  duration: 25min
  completed: 2026-10-08
---

# Phase 10 Plan 05: Parity Fixture and Drift Guards Summary

**Seeded oracle-generated parity fixture (18 cases, non-default thresholds/offsets/gap/maxJumpMs) replayed by `node --test`, with a pytest freshness guard.**

## Accomplishments
- `gen_parity.py` (`build_cases`, `dumps_fixture`, `main`) produces byte-identical output across runs.
- Synthetic cases inject threshold-exact values, axis ties, peak/location ties, events at rows 0 and n-1, gap and gap+1 separations, None in each axis, no-GPS stretches, time jumps of maxJumpMs, maxJumpMs+1 and 600 000 ms, and source regions where the second-appearing file index is lower.
- `parity.test.js` compares 17 fields per case; failures name the case and field.
- `test_parity_fixture.py` fails with "parity fixture stale: run python -m tools.dashboard_converter.gen_parity" when oracle or site JSON changes (about 1.2 s, no slow marker).
- README section "Motor JS e testes de paridade" added.

## Deviations from Plan
None. All JS parity cases passed on the first run. Axis tie construction is best-effort when the offset parities of the axes differ.

## Test results
- `node --test`: 50 tests, 50 pass, 0 fail (bare and quoted glob forms)
- `python -m pytest`: 250 passed, 1 deselected (slow marker), 0 failed

## Commits
- f0b18af: feat(10-05): seeded parity fixture generator and committed fixture
- 364d479: test(10-05): JS parity replay, pytest freshness guard, README note

## Self-Check: PASSED
