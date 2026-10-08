# Phase 10: Analysis Engine - Context

**Gathered:** 2026-10-08
**Status:** Ready for planning

<domain>
## Phase Boundary

A pure JS core in `site/js/core/` (no DOM, no Leaflet/uPlot) that is importable from Node. It decodes the schema-v1 site JSON and recomputes the following for any parameter set:
- dinâmico values, the dominant axis and severity
- classes, eventos, impactos and pontos
- trecho priority
- a "conforme planilha" state

It is protected by `node --test` golden tests and by Python↔JS parity tests against `tools/dashboard_converter/analysis_ref.py`. Not in scope: UI, controls, filters UI, charts and map (Phases 11–13). The engine API for the analysis parameters (offset, grouping gap) is defined here. Their UI is PARAM-04 in Phase 13.

</domain>

<decisions>
## Implementation Decisions

### Carried forward (locked in Phase 9 / research)
- Workbook rules: lower bounds inclusive. Dominant-axis ties go X > Y > Z (strict `>`). The impact peak is the first maximum. Impact class = the max class in the run. Ponto = per location key, the event with max |dominante|. Rows without GPS use the key `"SEM GPS | " + trecho`.
- Accel is integer 1/2048 g (LSB). Do comparisons in exact integer or doubled-LSB arithmetic, as `analysis_ref.py` does, so a .5 median or a sample sitting on a threshold never flips between Python and JS.
- Row order = the merged, time-sorted order of the site JSON (the converter ignores filenames).
- Exact parity is required for class counts, eventos, impactos and impacts_by_class. Pontos (99 vs 101) and per-trecho values are compared side by side only.
- `node --test` only, with no package.json, npm or node_modules. Tests live outside `site/` (e.g. `tests/js/`).

### Impact grouping gap
- **Unit: samples.** `gap` = the number of Normal (non-event) samples allowed between events in the same impact. The default of **0** = the workbook (any non-event sample splits the impact).
- **Sentido change does NOT split** an impact. Grouping is pure row order, as in the workbook.
- **Large time jumps DO split** an impact. If consecutive rows are more than a threshold apart (suggested ~2 s; planner picks and documents the value), they never share an impact. The planner/researcher must verify that this leaves impactos = 1.749 at defaults on run 1. If it doesn't, flag it rather than silently tuning it.
- **GPS availability has no effect** on grouping (it only affects pontos via the location key).
- Unclassified samples (any axis missing) are non-events, so they break an impact run (same as `analysis_ref.py`).

### Rest-level offset
- **Modes: `median` (default) and `manual`.** Not mean.
- **The median is computed over the whole run, on all valid samples per axis, once.** Filters never move the offset, so a sample's class is independent of filters. It is not per sentido.
- **Manual offset is entered in g per axis** (e.g. AZ = −1,0). The engine quantizes it to the 1/2048 g grid (or the doubled-LSB grid) internally so the threshold comparisons stay exact and match Python.
- **Missing axis:** if any of AX/AY/AZ is null, the sample is unclassified. It has no class and is not an event. The engine exposes a `nao_classificadas` count for the data-quality card.

### Trecho priority
- **Basis: impactos, not pontos.** The trecho's priority comes from the highest class among the impacts whose peak row falls in that trecho:
  - 1 Alta = ≥ 1 impact in the top class
  - 2 Média = no top-class impact, ≥ 1 in the second-highest class
  - 3 Baixa = the highest is the middle class
  - 4 Monitorar = only the lowest event class, or no impacts
  - This deliberately diverges from the workbook text (pontos-based). Priority is NOT part of the workbook parity check. The per-trecho side-by-side report should note the different basis.
- **Priority ignores filters.** It is computed on the full run for the current analysis parameters (thresholds, offset, gap).
- **Mapping by class index:** priority levels follow the class indices, so edited thresholds carry through automatically. There are no fixed g levels.
- **Order within the same level:** first the count of top-class impactos in the trecho (desc), then the trecho's peak |dominante| g (desc), then workbook trecho order as a stable final tie-break.

### "Conforme planilha" state
- **KPIs checked:** class counts (5), eventos, impactos, impacts_by_class, **and sentido splits (registros + eventos per sentido)**.
- **The sentido split for the check uses the source-file row boundary**, not the geofence sentido. In time order, the first file (`3. TIG-PXV.csv`, 10.839 rows) is S1 and the rest is S2. That gives 10.839 / 12.544 registros and 1.262 / 1.090 eventos, as in the workbook. The geofence-detected sentido (11.835 split, accepted in Phase 9) stays the sentido used everywhere else (filters, views). The converter must expose the file boundary in the JSON (e.g. per-file row ranges in time order) if it isn't already derivable from `meta.source.files`.
- **Only the parameters matter, not filters.** The state is true when the analysis params are at their defaults (thresholds 0.5/1/2/4, median offset, gap 0, and the time-jump split at its default) AND the full-run KPIs equal the reference. Active filters don't turn it off.
- **Reference values are embedded in the site JSON** (e.g. `meta.workbook_reference`, written by the converter from the golden/workbook numbers). They are not hard-coded in the engine. If a run has no reference, the state is "not available" (no badge), not false.
- **Diagnostics:** return `{ ok, reasons[] }`, with reasons such as `"limiares alterados"`, `"offset manual"` or `"impactos 1.750 ≠ 1.749"`. The UI can show them as a tooltip.

### Claude's Discretion
- Module split inside `site/js/core/` (ARCHITECTURE.md suggests data/dynamics/classify/events/filter/aggregate/defaults). Phase 10 may stop at aggregate primitives needed for KPIs and priority. Filters can be included as a pure function if cheap.
- Typed-array choices, caching/stage keys, API naming.
- Parity fixture design: seeded random non-default params (thresholds, manual offsets, gap) on run 1 and the mini fixture, generated by Python into `tests/fixtures/parity_cases.json` (or similar), plus a pytest guard that the fixture is fresh.
- Exact default for the time-jump threshold (subject to the 1.749 check above).

</decisions>

<specifics>
## Specific Ideas

- The badge must show for run 1 at defaults. That is the reason for the file-boundary sentido check: Phase 11's success criterion depends on it.
- The trecho priority basis (impactos) is the user's choice, made because pontos depend on noisy GPS keys (99 vs 101 already differs).

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tools/dashboard_converter/analysis_ref.py`: the Python oracle (doubled-LSB arithmetic, tie rules, impact/point/per-trecho logic). The JS must mirror it. It needs extending for the gap, manual offset, time-jump split and priority so parity can cover non-default params.
- `site/data/run-2026-10-02-l4-t102.json`: real schema-v1 input (dt_ms, accel LSB, sentido/trecho/fix runs, gps loc ids, meta.source.files with per-file rows).
- `tests/fixtures/golden_run1.json`: golden values (`exact` block = parity-required; `reference` block = side by side).
- `tests/fixtures/run_mini/`: small two-file fixture, useful for fast JS tests.
- `.planning/research/ARCHITECTURE.md`: stage pipeline S1–S6, a `groupImpacts` sketch and the state shape.
- `.planning/research/WORKBOOK-CRITERIA.md`: rule definitions and golden totals.

### Established Patterns
- The converter owns quantization and GPS validation; JS owns the rules (Phase 9 decision).
- Golden exact vs reference split already exists in `golden_run1.json`. Mirror it in JS tests.
- The slow pytest marker is deselected by default; parity tests that touch the real run should stay fast or be marked.

### Integration Points
- The converter writer must add `meta.workbook_reference` (and the per-file row boundary if not already derivable) to the site JSON, then regenerate `site/data/*.json`.
- `analysis_ref.py` gains the new params so it can generate parity cases.
- Phase 11's `state.js`/UI consumes the engine API; Phase 11 adds the CI gate (`node --test` in the Pages workflow).

</code_context>

<deferred>
## Deferred Ideas

- Mean as a rest-offset mode: not needed (PARAM-04 only asks for median or manual).
- Gap in seconds / dual-unit gap: rejected for now, samples only.
- Per-sentido medians: rejected, because they break workbook parity.
- Fixing the geofence terminal rule so the geofence sentido matches the workbook split: not done. The badge uses the file boundary instead.

</deferred>

---

*Phase: 10-analysis-engine*
*Context gathered: 2026-10-08*
