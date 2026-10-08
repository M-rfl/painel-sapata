---
phase: 10-analysis-engine
verified: 2026-10-08T00:00:00Z
status: passed
score: 4/4 success criteria verified
---

# Phase 10: Analysis Engine Verification Report

**Phase Goal:** Browser-side rules reproduce the workbook numbers at defaults and recompute correctly for any parameter change, with no UI.
**Status:** passed. Initial verification.

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `node --test` golden tests pass: workbook class counts, eventos, impactos exact at defaults | VERIFIED | `node --test "tests/js/*.test.js"`: 50 pass, 0 fail. golden.test.js asserts the 21031/1611/512/173/56 classes, 2352 eventos and 1749 impactos. |
| 2 | Changing thresholds, offset or gap recomputes classes, eventos, impactos, pontos and priority; lower bounds inclusive | VERIFIED | unit.test.js covers these (inclusive bounds, custom class count, priority ordering, perTrecho). Engine modules are in `site/js/core/`: classify, dynamics, events, aggregate, engine. |
| 3 | Python↔JS parity with seeded random non-default params | VERIFIED | parity.test.js replays the committed fixture. A pytest freshness guard is in place. The full pytest run ends 100% with no failures. |
| 4 | "Conforme planilha" is true only at default settings with trecho-independent KPIs equal to the workbook | VERIFIED | `site/js/core/conforme.js` flags changed thresholds, offset, gap or time-jump, then compares classes, eventos, impactos, impacts_by_class and the sentido split with `meta.workbook_reference`. Returns `available:false` when there is no reference. Covered by the "conformeCheck" unit test. |

**Score:** 4/4

## Requirements Coverage

| Req | Status | Evidence |
|-----|--------|----------|
| CORE-01 | SATISFIED | dynamics.js, offset and dominant-axis tests |
| CORE-02 | SATISFIED | classify.js, inclusive-bound tests |
| CORE-03 | SATISFIED | events.js, golden eventos/impactos, pointsByLocation |
| CORE-04 | SATISFIED | aggregate.js priority, "priority ordering" test |
| CORE-05 | SATISFIED | conforme.js |
| CORE-06 | SATISFIED | golden.test.js, parity.test.js, pytest guard |

All six IDs appear in the ROADMAP phase requirements and are marked Complete in REQUIREMENTS.md. No orphaned IDs.

## pontos 99 vs workbook 101

This does not conflict with any success criterion or with CORE-05.
- SC1 lists only class counts, eventos and impactos as exact. Pontos is not in it.
- CORE-05 and SC4 compare only trecho-independent KPIs, and `conformeCheck` does not compare pontos. The workbook value is kept as a diagnostic only.
- 10-CONTEXT.md records the 99 vs 101 difference as a known consequence of noisy GPS location keys. It also records the decision to base priority on impactos rather than pontos.
- The gap is already reported side by side in the Phase 9 validation report.

Minor note: the "conforme planilha" badge is silent on the pontos divergence. Phase 11 should not label pontos as "equal to the workbook".

## Anti-Patterns

No blockers were found. The engine modules are pure, with no DOM/window use (conforme.js states this explicitly).

## Test Runs

- Node: 50/50 pass.
- Pytest: the first full run had one failure, `tests/test_visualizer.py::test_update_data_appends`, with a Tk/Tcl environment error (`tcl_findLibrary`). A re-run passed fully with 0 failures. That test is unrelated to Phase 10 and looks flaky on Tk initialisation.

## Human Verification

None required. The phase has no UI.

_Verifier: Claude (gsd-verifier)_
