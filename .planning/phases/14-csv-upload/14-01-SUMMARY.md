---
phase: 14-csv-upload
plan: 01
subsystem: testing
tags: [parity, oracle, fixture, stations, csv-upload]
requires: []
provides:
  - "site/data/stations.json: deployed station definitions for the browser geofence"
  - "tests/fixtures/upload_parity.json: Python-oracle expectations for the JS converter"
affects: [14-03, 14-04, 14-05]
tech-stack:
  added: []
  patterns: ["generator + byte-for-byte freshness test (as gen_parity)"]
key-files:
  created:
    - tools/dashboard_converter/gen_upload_parity.py
    - site/data/stations.json
    - tests/fixtures/upload_parity.json
    - tests/test_upload_fixture.py
  modified: []
key-decisions:
  - "Fixture dates/dmy built from zero-padded fields (not strftime) so year 0099 is platform independent"
  - "Forced ambiguity uses 10.9375 g (109.375): both k and k-1 readings on grid; k-1 forced with lsb not divisible by 10"
  - "Synthetic run keeps tunnel to 8 fix points (32 rows) so the forward-only geofence (max 2 skipped stations) still reaches the terminal"
requirements-completed: [UPLOAD-01]
duration: 40min
completed: 2026-10-14
---

# Phase 14 Plan 01: Python oracle for the browser converter Summary

One command (`python -m tools.dashboard_converter.gen_upload_parity`) regenerates `site/data/stations.json` and a 254 KB `upload_parity.json` fixture, both produced only by calling the Python converter code and CPython builtins. Pytest fails when either is stale.

## Accomplishments
- stations.json for lines 1-4 (directions, display names, site_stations, overlap warnings, load warnings).
- Fixture sections: recover (accel 214 cases incl. log10 near-power-of-ten, upper-integer grid, k/k-1; gps; scaled; plain; key6 ties; log10k), 60 timestamp cases (accept/reject/naive), 70 Python `round` cases (half-even ties), 8 geofence routes (terminal turn, reversal, skip, dwell, tunnel, Line 1, noisy, no GPS), 3 whole-file conversions (run_mini, synthetic-l4 comma + pt-BR, single-ptbr).
- synthetic-l4 pins max_gap_s 2.2 (2.25 tie), turnaround gap_s 1.2 (1.25 tie), 2 ambiguous cells, 3 k-1 cells, 1 unrecoverable cell, tunnel without GPS.
- Generation takes under 1 s; regeneration is byte-identical.

## Task Commits
1. Task 1: generator, stations.json, recover/timestamps/pyround/geofence sections - 486e6ca
2. Task 2: whole-file cases and freshness/coverage tests - 349272c

## Deviations from Plan
None of substance. Plan note followed: main() wrote the fixture file already in Task 1 (files section empty until Task 2). Dead branch noted: `n <= 16` thousands-shaped cannot occur (the regex requires >= 4 digits), so it is not in the fixture.

## Issues Encountered
Generated file was initially CRLF from the writer tool, which broke string escapes; converted to LF and fixed. Git warns about LF->CRLF on commit (autocrlf); tests read CRLF-tolerantly.

## Self-Check: PASSED
