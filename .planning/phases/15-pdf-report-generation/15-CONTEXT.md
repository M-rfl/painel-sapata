# Phase 15: PDF Report Generation - Context

**Gathered:** 2026-10-14
**Status:** Ready for planning

<domain>
## Phase Boundary

A "Gerar PDF" button that downloads a PDF report of the run currently loaded on the page: the bundled run 1 or an uploaded CSV. The report contains the KPI summary, the map with the heat layer, the two trecho × classe matrices, the trecho table and the pontos top-50 table. It is generated entirely in the browser with no backend, and its text is in Portuguese. New dashboard views, scheduled reports and emailing are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Carried forward (already locked)
- Portuguese UI. Every new control gets an (i) info button with text in `INFO` (`i18n.js`). Desktop only. No backend and no CDN: any new library is vendored in `site/vendor/` with its version in `site/vendor/README.md` (Phases 11–12).
- Class colour tokens `--normal`…`--critico`. IQ bands: ≥ 98 % Bom, 90–98 % Regular, < 90 % Ruim (Phase 13).
- Uploaded data can't be shared by link (Phase 14). The PDF is how an uploaded run gets shared.

### Report contents
- **Included, in page order:** report header → KPI summary (IQ card with its band, registros, eventos, impactos, pontos) → **map with the heat layer** → **both matrices** (one per sentido) → **trecho table** → **pontos top-50 table**.
- "Heatmap" means **both** the map heat layer and the colour-shaded matrices.
- **Not included:** the time-series charts (AX/AY/AZ and Mais canais), the classes/stats/quality panels and the "conforme planilha" badge (omitted even for the bundled run).

### Capture fidelity
- **Tables and matrices are rebuilt as real PDF text**, not screenshots. They are selectable and sharp, and the long table can break across pages. They have the same columns as the page and keep its visual cues:
  - class-coloured cells
  - matrix shading in each class colour, with opacity proportional to count / column max and the count printed in the cell
  - priority styling
  - the "sem Crítico" badge
  - the IQ band colour
- **No UI-selection highlight.** Neither the trecho-filter row highlight nor the matrix cell outline appears in the PDF.
- **Pontos table:** the Google Maps column becomes a **clickable link** (short text such as "abrir").
- **Map: a raster image**, **refitted to the whole route** (ignoring the user's current pan and zoom), with the **heat layer forced on** for the capture, at **2× resolution**. The on-screen map must be left exactly as it was afterwards: same view, and heat toggle back to the user's setting.
- **No controls** in any captured image: no buttons, (i) icons, selectors or CSV buttons.

### Data state
- **Full run, no filters.** Every filter (sentido, trecho, classe, eixo, time window) is ignored, so the report always covers the whole loaded run.
- **The parameters currently set are used:** thresholds, offset mode and values, gap, time-jump split, GPS max speed and interval. Edited parameters carry into the report.
- **The matrix basis** (impactos / medições / pontos) and **the pontos table sort** follow what is currently selected on screen.
- The top 50 is still the worst 50 by |dom| over the full run, displayed in the current sort (same rule as the page).
- The report includes a **short method note** listing the parameters used, e.g. "Limites 0,5 / 1 / 2 / 4 g; offset mediana; agrupamento 0; corrida completa, sem filtros". There is no separate filter disclosure, because the report never has filters.
- **Uploaded data:** the report covers the uploaded run, marked **"Dados enviados"** with the uploaded file names and row count.

### Layout and delivery
- **A4 landscape.**
- **Direct download:** click "Gerar PDF", the button shows a busy state ("Gerando PDF…"), and the file downloads. No print dialog.
- **Header:** "Relatório de impactos", the run title (linha, data, trem, or "arquivo enviado"), the run's time period, "Gerado em dd/mm/aaaa hh:mm" (America/Sao_Paulo) and page numbers on every page.
- **Button:** in the page header next to "Copiar link" and "Carregar CSV", with an (i) info button. Enabled for both the bundled and uploaded runs.
- **File name:** `relatorio-<run_id>.pdf`, e.g. `relatorio-2026-10-02-l4-t102.pdf`.
- **Partial failure:** if the map tiles or the capture fail, **still produce the PDF**. Draw the map section with the route and heat but no basemap (or a placeholder) and a note, and show a Portuguese warning on the page. A total failure shows a Portuguese error and leaves the page untouched.

### Claude's Discretion
- PDF library choice and whether to use a DOM-to-image helper for the map. Must be vendored, with no CDN, and must work offline from `file://`/static hosting as far as possible. The researcher must check OSM tile CORS for canvas capture.
- Whether to render the map capture off-screen (a hidden second Leaflet map) or temporarily reuse the live map.
- Exact typography, column widths, page breaks (repeat table headers on continuation pages), margins and the KPI block design (drawn as text/shapes rather than an image is fine).
- Module split, e.g. a pure `core/report.js` that builds the report model (rows, cells, colours, header strings), unit-tested under `node --test`, plus an `app/pdf.js` renderer.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `core/ranking.js`: `trechoRows(run, analysis, filters)`, `pontoRows(run, analysis, view)`, `topPontos(rows, 50)`, `sortPontos(rows, {col, dir})`. Call them with empty/default filters to get the full-run rows.
- `core/matrix.js`: `buildMatrix(run, analysis, filters, basis)` gives the matrix cells for the chosen basis.
- `core/quality_index.js`: `qualityIndex(classCounts)` gives the IQ and its band.
- `app/csv.js`: `pontosCsv`, `trechosCsv` and `csvFilename(run, kind)` hold the column definitions, pt-BR formatting and the filename pattern to mirror (`relatorio-<run_id>.pdf`). `downloadCsv` shows the download pattern.
- `app/format.js` and `i18n.js` (`T`, `INFO`) provide pt-BR number and date formatting and UI strings.
- `panels/map.js` uses Leaflet 1.9.4 and leaflet.heat 0.2.0 from `site/vendor/`. The heat state lives in the display state.
- `app/session.js` and `mountDashboard`: the current run, its `uploaded` flag and its source file names are available after Phase 14.

### Established Patterns
- Pure core modules are tested with `node --test` (`tests/js/*.test.js`). App and panel code gets static checks in `tests/test_site_static.py` and a manual browser checkpoint plan at the end of the phase.
- `analyze` is memoized by `paramsKey`, so the full-run analysis with the current params is cheap. The report takes the current `state.params` together with default filters.
- Header actions live in `<header class="top">`: `#share` and `#upload`. A new `#report` span goes next to them.
- A static guard ensures nothing is sent to any server. The PDF must be generated client-side, and the only network use is the existing OSM tile fetches.

### Integration Points
- `site/index.html` header: add a `#report` container.
- `main.js`: mount the report button once (the header persists across remounts) and give it access to the current session run, state and analysis.
- `site/vendor/` + `README.md`: the new vendored PDF library (and capture helper if used).

</code_context>

<specifics>
## Specific Ideas

- "Use the tables and heatmap just as displayed on the page." The report should feel like a printout of the dashboard: same columns, colours and badges, but cleaner, with no buttons or selection outlines.
- The PDF is the way to share an uploaded run, since uploads can't be shared by link.

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within the phase scope.

</deferred>

---

*Phase: 15-pdf-report-generation*
*Context gathered: 2026-10-14*
