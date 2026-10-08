---
phase: 10-analysis-engine
plan: 02
subsystem: dashboard-converter
tags: [site-json, schema, golden, workbook-reference]
requires: []
provides:
  - "source_runs top-level key (RLE of source file index per row, time order)"
  - "meta.workbook_reference (only with --golden)"
affects: [10-04 conforme.js]
tech-stack:
  added: []
  patterns: [additive optional schema keys, schema stays 1]
key-files:
  created: []
  modified:
    - tools/dashboard_converter/writer.py
    - tools/dashboard_converter/cli.py
    - tools/dashboard_converter/README.md
    - tests/test_dashboard_converter_writer.py
    - tests/test_dashboard_converter_cli.py
    - tests/test_dashboard_site_json.py
    - site/data/run-2026-10-02-l4-t102.json
key-decisions:
  - "source_runs is top-level, peer of sentido_runs; indexes meta.source.files; run 1 = [[0,1],[10839,0]]"
  - "meta.workbook_reference omitted when golden has no KPI keys; schema remains 1"
duration: ~15min
completed: 2026-10-08
---

# Phase 10 Plan 02: source_runs and workbook_reference Summary

Site JSON now carries per-row source-file runs (time order) and, with `--golden`, embedded workbook reference values; run-1 JSON regenerated.

## Tasks
1. Writer/CLI emit `source_runs` and `meta.workbook_reference` (`workbook_reference_from_golden`, `WORKBOOK_THRESHOLDS_G`, `decode_samples()["source"]`), tests, README - commit 4226063
2. Regenerated run-1 JSON (exit 0, all [OK]); before/after diff identical except generated_at, source_runs, workbook_reference; CI golden tests for file-boundary split (10839/12544 records, 1262/1090 eventos) - commit 1d6e618

## Deviations from Plan
None - plan executed exactly as written. JSON size 1101.7 KB (< 2.5 MB). Full suite green.

## Self-Check: PASSED
