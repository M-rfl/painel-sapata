---
phase: 10-analysis-engine
plan: 01
subsystem: analysis-oracle
tags: [python, oracle, parity, analysis]
requires: []
provides:
  - "Extended oracle reference_analysis with offset, gap, t_ms/max_jump_ms, trecho_order, region"
  - "half_up, thresholds2, class_digest helpers"
affects: [10-05]
tech-stack:
  added: []
  patterns: ["doubled-LSB integer arithmetic", "single forward-scan impact grouping"]
key-files:
  created: []
  modified:
    - tools/dashboard_converter/analysis_ref.py
    - tests/test_dashboard_converter_analysis.py
key-decisions:
  - "Thresholds: th2 = ceil(t*4096); defaults give 2048/4096/8192/16384"
  - "Manual offset: off2 = floor(g*4096+0.5) (half_up), no round()"
  - "gap = max non-event rows (Normal or unclassified) between events of one impact"
  - "Time jump measured event-to-event, strict >, default 2000 ms; t_ms=None disables"
  - "Sentido and GPS do not affect grouping"
  - "Priority on impact basis (peak row trecho): levels by max class, then top_count, peak_dom2, order index"
duration: 20min
completed: 2026-10-08
---

# Phase 10 Plan 01: Analysis Oracle Extension Summary

Python oracle now supports manual offset, grouping gap, time-jump split, trecho priority, per-file region split and an FNV-1a class digest, with all prior callers unchanged.

## Decisions
1. Threshold rule `ceil(t*4096)`; 2. manual offset `floor(g*4096+0.5)`; 3. gap as pure index distance counting unclassified rows; 4. time-jump split event-to-event strict `>` 2000 ms; 5. sentido/GPS ignored in grouping; 6. impact-basis priority sorted by `(level, -top_count, -peak_dom2, order_index)`.

## Results
- Run 1 with t_ms and max_jump_ms=2000: impactos 1749, class counts and impacts_by_class equal golden.
- Run-1 priority sanity: 15 Alta, 3 Media, 2 Monitorar (impact basis, not workbook parity).
- Full suite green; no `round(` in rules.

## Deviations from Plan

None - plan executed exactly as written. (Two of my own new tests had wrong expected values and were corrected before commit; transient failures in test_dashboard_converter_cli.py came from parallel plans editing that file and cleared on rerun.)

## Commits
- c68e8e1: oracle manual offset, ceil thresholds, gap, time-jump split
- d5396a1: oracle priority, region split, class digest

## Self-Check: PASSED
