---
phase: 09-repo-hygiene-raw-csv-converter
verified: 2026-10-08T00:00:00Z
status: passed
score: 4/4 success criteria verified
re_verification: false
---

# Phase 9: Repo Hygiene & Raw CSV Converter Verification Report

**Phase Goal:** The run data is safely excluded from git and one command turns the raw logger CSVs into trustworthy site JSON that matches the treated workbook.
**Status:** passed

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Run data, workbook, logs, docs and caches ignored; .gitignore is the first code commit of v1.3 | VERIFIED | `git status` clean. .gitignore has anchored rules (/Results_1st.Run/, /data/, logs/*, *.docx, /WTVB01 documents/, __pycache__). Commit 8084cc5 is the first non-docs commit after the v1.3 milestone start. Stations_GEO/*.txt, gerar_*.py, logs/.gitkeep and site/data/*.json are tracked. test_repo_hygiene passes. |
| 2 | One command on raw/ gives schema-versioned compact JSON from comma and pt-BR `;` CSVs; unrecoverable values reported | VERIFIED | `python -m tools.dashboard_converter` (cli.py, __main__.py). Committed JSON starts `{"schema":1,"meta":...` and is compact. recover.py and reader tests pass. Row counts per file (12.544 and 10.839) match the workbook. |
| 3 | Every sample has a trecho from geofences; sentido from station sequence; tunnel samples inherit and are flagged sem GPS | VERIFIED | geofence.py, stations.py and their tests pass. Real run: 2.020 rows without GPS, matching expected. Real-data tests pass. |
| 4 | Validation shows class counts 21.031/1.611/512/173/56, eventos 2.352, impactos 1.749 equal to the workbook; pontos and per-trecho shown side by side with explanations | VERIFIED | Local report validation-2026-10-02-l4-t102.md has zero FALHA. Class counts, eventos, impactos, impacts_by_class, medians and GPS rows are OK against golden and workbook. Workbook AX/AY/AZ, GPS key and per-row class diffs are all 0. Pontos and per-trecho deviations are listed side by side, with explanations, which meets CONV-07's wording. |

**Score:** 4/4

## Tests

- `pytest -k "dashboard or hygiene"` passes (126 tests).
- `pytest -m slow` (workbook comparison) passes.
- The CI golden test (tests/test_dashboard_site_json.py) reproduces the exact totals from the committed JSON alone.

## Requirements Coverage

| Requirement | Plan | Status |
|-------------|------|--------|
| REPO-01 | 09-01 | SATISFIED |
| CONV-01 | 09-05, 09-06 | SATISFIED |
| CONV-02 | 09-02, 09-06 | SATISFIED |
| CONV-03 | 09-03, 09-06 | SATISFIED |
| CONV-04 | 09-03, 09-06 | SATISFIED |
| CONV-05 | 09-03, 09-06 | SATISFIED |
| CONV-06 | 09-04, 09-06 | SATISFIED |
| CONV-07 | 09-05, 09-06 | SATISFIED |

All 8 IDs are claimed by plans and mapped to Phase 9 in REQUIREMENTS.md. No orphans.

## Known Deviations (accepted by engineer, documented in 09-06-SUMMARY.md)

These are not gaps under CONV-07, which only requires side-by-side reporting with explanations.

- Inferred stations (CTR, EQD, SCT) collapse adjacent trechos. For example, Vila Olímpica – Central has 1 record against 2.940 in the workbook, and Rodoviária – Equador has 1 against 295. This should be fixed before the Phase 10/11 per-trecho dashboard views. The fix is a larger radius or putting the boundary at the closest GPS approach.
- The sentido split is at 11.835 against about 10.839. Plan 09-06 said "at or just after 10.839". The split sits later because of the locked dwell rule inside the 200 m terminal radius. The engineer accepted this.
- Pontos are 99 against 101.
- Open item: re-confirm 6-dp public GPS precision at the Phase 11 push checkpoint.

## Anti-Patterns

None blocking found. The tkinter TclError in test_visualizer is environmental and out of scope.

_Verifier: Claude (gsd-verifier)_
