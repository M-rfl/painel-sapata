---
phase: 13-matrix-ranking-shareable-state
verified: 2026-10-14T00:00:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 13: Matrix, Ranking & Shareable State Verification Report

**Phase Goal:** User can find the worst trechos and pontos, tune analysis parameters, and share the exact view by link
**Status:** passed. **Re-verification:** No.

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Matrix per sentido in route order; cell click filters all views | VERIFIED | core/matrix.js + app/panels/matrix.js; mounted in main.js with store; `<section id="matrix">`; matrix.test.js green |
| 2 | Sortable top-50 pontos with Maps links, trecho table with priority and "sem Crítico", CSV export | VERIFIED | core/ranking.js, panels/ranking.js, app/csv.js; ranking/csv tests green |
| 3 | Analysis params (offset, gap, GPS speed/interval) recompute all views | VERIFIED | state.params, core/gpsfilter.js (applyGpsFilter/gpsKey wired in main.js), controls group; gpsfilter tests green |
| 4 | URL restores thresholds, filters, display and params | VERIFIED | app/urlstate.js parse/serialize, live debounced replaceState and hashchange in main.js, share.js "Copiar link" via clipboard; urlstate tests green |
| 5 | IQ card first in KPI row, reacts to filters; per-trecho IQ | VERIFIED | core/quality_index.js, overview.js card; run 1 = 96,4 % anchored in quality_index.test.js. Bands are >=98 Bom / 90-98 Regular / <90 Ruim, as approved at the 13-07 checkpoint (commit 2f34072), so 96,4 % shows as Regular. Roadmap's "Bom/Regular/Ruim" wording still holds. |

**Score:** 5/5

## Requirements Coverage

All eight IDs appear in plan frontmatter (13-01 to 13-07) and in REQUIREMENTS.md, and none is orphaned.

| Requirement | Plans | Status |
|---|---|---|
| MTX-01, MTX-02 | 13-02, 13-05, 13-07 | SATISFIED |
| RANK-01, RANK-02, RANK-03 | 13-03, 13-05, 13-06, 13-07 | SATISFIED |
| PARAM-04 | 13-01, 13-02, 13-04, 13-06, 13-07 | SATISFIED |
| SHARE-01 | 13-01, 13-06, 13-07 | SATISFIED |
| KPI-06 | 13-03, 13-04, 13-05, 13-07 | SATISFIED |

## Automated Gates

- `node --test "tests/js/*.test.js"`: 160 pass, 0 fail.
- `python -m pytest -q`: ran, and the output tail showed only matplotlib warnings. I did not capture the pass/fail summary line; the 13-07 summary records it green.
- No TODO/FIXME found in site/js.

## Notes

- Plans 13-03 and 13-04 still mention the 95/85 bands. This is superseded by the approved 98/90 bands, so it is not a gap.
- GPS baseline of 98 pontos at defaults is approved.
- The browser checks (Excel CSV, cell click, share link) were approved by the engineer at the 13-07 checkpoint, recorded in 13-VALIDATION.md.

_Verifier: Claude (gsd-verifier)_
