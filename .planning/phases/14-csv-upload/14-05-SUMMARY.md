---
phase: 14-csv-upload
plan: 05
subsystem: converter-js
tags: [convert, build, gps, parity, csv-upload]
requires: ["14-01", "14-03", "14-04"]
provides:
  - "site/js/core/convert/{gps,build,index}.js: convertFiles(files, stationsJson, opts) -> { json, summary }"
  - "tests/js/convert_meta.js: shared parity contract (UPLOAD_ONLY_META, RUN1_IGNORED_META, stripMeta, firstDiff)"
affects: [14-06, 14-07]
tech-stack:
  added: []
  patterns: ["every Python round() is pyRound", "one shared parity contract module"]
key-files:
  created:
    - site/js/core/convert/gps.js
    - site/js/core/convert/build.js
    - site/js/core/convert/index.js
    - tests/js/convert_meta.js
    - tests/js/convert_parity.test.js
    - tests/js/convert_errors.test.js
    - tests/js/convert_build.test.js
    - tests/js/convert_run1.test.js
  modified: []
key-decisions:
  - "unknown_line guard is the only JS-only rejection: every line_scores in_line === 0 (no station of any line hit, includes no-GPS and far-away files); one-station and ambiguous runs convert and are flagged via summary.lineHits / summary.ambiguous"
  - "run-1 parity test stays strictly equal (no epsilon added); the single 1-ulp difference is recorded for the 14-07 decision"
requirements-completed: []
duration: 35min
completed: 2026-10-14
---

# Phase 14 Plan 05: Browser converter (gps, writer, orchestrator) Summary

`convertFiles()` now turns raw logger CSV text into the schema-v1 site JSON; it deep-equals the Python converter on all three fixture files and on the real run 1 except for one last-digit float.

## Accomplishments
- gps.js (sample_key/build_fixes), build.js (rle, quantize with channel_off_grid, dt_ms, quality, build_site_json with identical keys), index.js (pipeline mirroring cli._run, upload meta, summary incl. lineHits).
- Fixture parity (run_mini, synthetic-l4, single-ptbr) passes on first run; max_gap_s 2.2 and gap_s 1.2 pinned (pyRound).
- Error catalogue tests: no_files, too_many_files, empty_file, missing_column, bad_timestamp (garbage and 2026-02-30), naive_timestamp, no_rows, channel_off_grid, unknown_line (50 km away, inside envelope but far from stations, no GPS); single-station and ambiguous runs convert.
- Converted JSON drives decodeRun, applyGpsFilter, analyze, buildView; reference null, conformeCheck unavailable.

## Run-1 parity result (local, executed not skipped)
Conversion of the 2 raw CSVs: 23,383 rows in about 1.75 s. Comparison against the committed `site/data/run-2026-10-02-l4-t102.json` ignoring only RUN1_IGNORED_META: FAIL with exactly ONE difference out of the whole object:

`$.quality.inferred_stations[0].min_dist_m`: JS `159.26061835491336` vs committed `159.26061835491333` (1 ulp; EQD inferred station, the known 159 m case).

Every other value (all samples, runs, line scores, geofence passages, boundaries, turnarounds, gap values, fixes, speeds, meta keys) is identical. No boundary flip. Cause: V8 vs CPython libm last-ulp difference in sin/cos/asin (research Open Question 1); haversine operation order is identical to geo.py. No epsilon added; the test remains strict and fails locally (it is skipped in CI since Results_1st.Run/raw is git-ignored). Decision needed at 14-07: allow a 1e-9 relative tolerance on `min_dist_m` only (as 14-04 does for geofence tests), or leave. Committed JSON was not regenerated (not suspected stale, only ulp noise).

## Task Commits
1. Task 1: gps/build/index + fixture parity - b1d5683
2. Task 2: errors, build integration, run-1 tests - bb1ce34

## Deviations from Plan
None in behavior. Note: the run-1 test fails locally by the single ulp above (reported, not loosened).

## Intentional JS-only addition
`unknown_line` (requireKnownLine, default true): rejects when no station of any line was hit. Python has no equivalent.

## Self-Check: PASSED
