# Phase 13: Matrix, Ranking & Shareable State - Context

**Gathered:** 2026-10-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Add to the existing dashboard (Phases 11–12):
- a trecho × severidade matrix (per sentido, route order) whose cells filter every view
- a trecho table (priority, counts, per-trecho quality index, "sem Crítico" badge) and a sortable top-50 pontos de impacto table, both exportable as CSV
- the analysis-parameter controls (rest-level offset, grouping gap, time-jump split, GPS max speed, GPS max fix interval)
- a live, shareable URL that restores the view
- **a track quality index (IQ) card** at the top of the page. This was added by the user during discussion as new requirement **KPI-06**, in scope for this phase.

Covers MTX-01, MTX-02, RANK-01, RANK-02, RANK-03, PARAM-04, SHARE-01 and KPI-06. CSV upload is Phase 14. Mobile layout, multi-run, chart range brushing and PNG export stay deferred.

</domain>

<decisions>
## Implementation Decisions

### Carried forward (already locked)
- Trecho priority is impact-based (1 Alta → 4 Monitorar by class index) and always computed on the **full run**. Filters never change it (Phase 10).
- The offset mode is `median` (whole run, all valid samples per axis, never affected by filters) or `manual` in g per axis, quantized to the LSB grid in the engine. The gap is counted in **samples**, default 0. `maxJumpMs` defaults to 2000 (Phase 10).
- "Conforme planilha" returns `{ ok, reasons[] }` and depends on the params only, not on filters (Phase 10).
- Portuguese UI. Every new card/control gets an (i) info button with text in `INFO` (`i18n.js`). Panels and controls mount once and then update. Desktop only. Class colour tokens `--normal`…`--critico` (Phases 11–12).
- The map shows only the filtered pontos. Clicking a map point moves the chart cursor and zooms the charts to ±30 s (Phase 12).

### Page layout
- Order: header → KPI row (**IQ card first**, left of registros) → map → charts → **matrix** → **ranking tables (trecho table and pontos top-50 side by side)** → classes / stats / quality panels.

### Quality index (new KPI-06)
- Formula (linear penalty), with N = **classified medições in the current filter** (the same denominator as `classPct`; não classificadas excluded):
  `IQ = 100 % × (1 − (0,25·Leve + 0,5·Moderado + 0,75·Severo + 1·Crítico) / N)`
  Weights follow the class index (`w = cls / (ncls − 1)`), so edited thresholds carry through. Run 1 at defaults = **96,4 %** (test anchor: 1 − 844,5 / 23.383).
- Follows every filter and every parameter change.
- The card shows the value plus a coloured band: **≥ 95 % Bom** (green), **85–95 % Regular** (amber), **< 85 % Ruim** (red). 95 % itself counts as Bom. An (i) button explains the formula.
- Per-trecho IQ is a column in the trecho table, using the same formula on that trecho's filtered classified medições.
- N = 0 (everything filtered out) shows "—", not 0 % or NaN.
- KPI-06 must be added to REQUIREMENTS.md and to the Phase 13 success criteria in ROADMAP.md (done along with this context).

### Matrix (MTX-01/02)
- **Two matrices side by side**, one per sentido, rows = trechos in route order (`run.trechos[].order`), columns = classes, plus a **Total** column at the right.
- A **basis selector** above the matrices switches between impactos / medições / pontos. **Default: impactos.**
- The **Normal column is shown only in medições mode**. Impactos and pontos never have class Normal.
- Colour: each class column is shaded in **its own class colour**, with opacity proportional to count / that column's max. The count is printed in the cell.
- Filters: counts follow the **sentido, eixo and time** filters but **ignore the trecho and classe filters**, so every row and column stays visible and clickable. Cells inside the current trecho+classe selection are outlined.
- Click: a plain click **replaces** the trecho and classe filters with that cell's trecho + class. Clicking the same (sole selected) cell again clears both. **Ctrl/Shift-click adds** the cell to the selection (adds its trecho and class to the filter lists). All views update through the store.
- The matrix sits after the charts.

### Ranking tables (RANK-01/02/03)
- **Pontos top-50** (from the filtered pontos, `view.pointRows`, the same set as the map markers). The header shows "Top 50 de N pontos".
  - Columns: #, hora, trecho, sentido, eixo dominante, |dom| (g), AX/AY/AZ din. (g), classe, N impactos no ponto, Google Maps link.
  - Default sort: |dom| desc. Clicking any header re-sorts the **same 50 rows** (the top 50 is always the worst 50 by |dom|).
  - **Row click = map + chart jump**: the map centres on the ponto and the chart cursor moves there with the ±30 s zoom, the same behaviour as a map click (reuse the link bus).
- **Trecho table**: columns prioridade, sentido, trecho, IQ, registros, eventos, impactos, pontos, maior classe, pico |dom|. Default order = priority order (as `trechoPriority` sorts).
  - Priority is **full run**. Registros/eventos/impactos/pontos/IQ **follow the filters**. The trecho filter **highlights** the selected rows and never hides any.
  - **"sem Crítico" badge** on every trecho with **zero Crítico (top-class) medições**. This can only happen at priority 2–4, because an Alta trecho always contains a Crítico measurement. The check is full-run, consistent with priority. With edited thresholds, "Crítico" means the top class.
- **CSV export**: one button per table. pt-BR Excel format: `;` separator, `,` decimal, **UTF-8 BOM**, Portuguese headers. Exports the **filtered rows in the current sort**. The pontos export contains **all filtered pontos**, not only the top 50. Times in America/Sao_Paulo. Google Maps URL as a plain column.

### Analysis parameters (PARAM-04)
- One collapsible **"Parâmetros de análise"** group in the control column, **closed by default**, below the thresholds. Each control has an (i) button.
  - **Offset**: radio Mediana / Manual. In Manual, three g inputs (AX/AY/AZ) **prefilled with the current median values**, `,` or `.` accepted.
  - **Agrupamento (gap)**: integer number of samples, ≥ 0.
  - **Separar impactos após intervalo de X s** (time-jump split): seconds, default 2 (maps to `maxJumpMs`). It also drives the chart gap rows (existing behaviour).
  - **GPS velocidade máxima** (km/h, default 50) and **GPS intervalo máximo entre fixes** (s, default 120).
- **Live on valid input** (the Phase 11 threshold pattern). An invalid value shows a Portuguese error and keeps the last valid value.
- **GPS params = GPS jump filter**: a fix that implies a speed above the max from the previous valid fix (when the interval between them is ≤ max interval) is **rejected**. Its samples become sem GPS (location key `"SEM GPS | " + trecho`). This changes pontos, map markers, the ranking and the sem-GPS note. The researcher must verify and report whether run 1 changes at the defaults 50 km/h / 120 s. If it does, flag it rather than tune it. Also define what happens to fixes separated by more than the max interval (suggested: no speed check, accepted).
- **Conforme badge**: a non-default offset, gap or time-jump turns it off with reasons (e.g. "offset manual", "agrupamento alterado"). **GPS params are excluded** from the conforme check because they don't affect the trecho-independent KPIs.
- The analysis params go into `state.params` / `paramsKey` (memoized `analyze`). Reset restores all of them.

### Share link (SHARE-01)
- **The live URL** is kept in sync via `history.replaceState` (debounced, no history spam), plus a **"Copiar link"** button with "Link copiado" feedback.
- **Captured**: params (thresholds, offset mode + manual values, gap, time-jump, GPS speed and interval), filters, display, **plus the heat-map toggle, the matrix basis and the ranking sort**. **Not captured**: chart zoom and map pan/zoom.
- **Format**: readable **hash** params with **defaults omitted** (e.g. `#lim=0,5;1;2;4&sent=0&cls=3,4&modo=med`). The default view has an empty hash.
- **Bad input**: unknown, invalid or out-of-range keys are ignored, the rest is applied, and a short notice is shown ("Alguns parâmetros do link foram ignorados"). It never crashes and never shows a blank page. Threshold order and the other validations reuse the same validators as the controls.
- Opening a link with filters restores those filters exactly. Reset clears the hash.

### Claude's Discretion
- Hash key names and encoding details (keep them short and readable). Debounce interval.
- Exact matrix and table styling, header layout of the basis selector, the way the cell selection outline is drawn.
- Whether heat toggle, matrix basis and ranking sort move into the store or stay panel-local with their own URL hooks.
- Module split (e.g. `core/matrix.js`, `core/ranking.js`, `core/quality_index.js`, `core/gpsfilter.js`, `app/urlstate.js`, `panels/matrix.js`, `panels/ranking.js`), as pure, `node --test`-covered core functions.
- CSV filename pattern (e.g. `pontos-2026-10-02-l4-t102.csv`).
- Where the GPS jump filter runs (decode-time vs. analyze stage) and how it is memoized.

</decisions>

<specifics>
## Specific Ideas

- The IQ card is the headline number for management: first card in the row, value + Bom/Regular/Ruim colour.
- Clicking a row in the pontos ranking should behave exactly like clicking that ponto on the map: land on the moment in the charts.
- The matrix must stay fully clickable while it is filtering everything else. That is why it ignores its own trecho/classe filters and shows the selection as an outline.
- CSVs must open cleanly by double-click in Excel pt-BR. The raw TIG-PXV CSV was mangled by exactly this, so don't repeat it.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `site/js/app/state.js`: `defaultState`, `setFilter`, `setDisplay`, `setThresholdText` (the validate-and-keep-last-valid pattern), `paramsKey`, `createStore`. Add the analysis-param setters and extend `paramsKey` here.
- `site/js/core/view.js`: `rowMask` and `buildView`, which provide `mask`, `pointRows`, `impacts`, `eventosByTrecho` and `classCounts`. The matrix needs a variant mask that skips the trecho/classe filters.
- `site/js/core/aggregate.js`: `perTrecho` and `trechoPriority` (full-run priority, sorted).
- `site/js/core/events.js`: `pointsByLocation`. `site/js/core/data.js`: `decodeRun` (`locId`, `fixRow`, `fixLat/fixLon`, `run.trechos` with `sentido`/`order`, `run.sentidos`). The GPS jump filter has to rebuild the locId/location keys.
- `site/js/core/conforme.js`: add reasons for offset/gap/time-jump. GPS params are excluded.
- `site/js/app/link.js` (link bus): reuse for the ranking row click → map + chart jump.
- `site/js/app/format.js`: `parseDecimal`, pt-BR number/date formatters, needed for the manual offset inputs and the CSV.
- `site/js/app/panels/controls.js`: the mount-once/render pattern, `group()`, `line()`, `infoBtn`. The analysis group goes here as a `<details>`.
- `site/js/app/panels/overview.js`: the KPI cards. The IQ card is inserted first.
- `tools/dashboard_converter/gps.py` `build_fixes`: the reference for the speed rule (haversine / dt × 3,6, dt ≤ 120 s, v ≤ 50 km/h). Mirror it in JS.

### Established Patterns
- Pure core functions in `site/js/core/` (no DOM), tested with `node --test` in `tests/js/`. Panels render from `ctx` in `main.js` `update()`.
- `analyze` is memoized on `paramsKey`. New params must enter the key or views go stale.
- Python↔JS parity fixtures (`gen_parity.py`) cover thresholds/offset/gap/maxJumpMs. The GPS jump filter is not in the Python oracle, so decide whether parity is needed or JS unit tests are enough.

### Integration Points
- `site/index.html`: add `#matrix` and `#ranking` sections after `#charts`. Add the IQ card to `#overview`.
- `site/js/app/main.js`: read the hash → initial state before the first `update()`. Write the hash on store change. Render the matrix and ranking.
- `.planning/REQUIREMENTS.md` + `ROADMAP.md`: KPI-06 added for this phase.

</code_context>

<deferred>
## Deferred Ideas

- Encoding chart zoom and map pan/zoom in the share link: not selected; it could be a later enhancement.
- Speed estimate display (velocidade estimada in the popup/ranking): not selected. The GPS params drive the jump filter only.

</deferred>

---

*Phase: 13-matrix-ranking-shareable-state*
*Context gathered: 2026-10-14*
