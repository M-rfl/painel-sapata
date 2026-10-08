# Feature Landscape

**Domain:** Static, Portuguese-language condition-monitoring dashboard (rail vibration plus GPS track) for a single field run
**Milestone:** v1.3 Field Run Dashboard
**Researched:** 2026-10-08
**Confidence:** MEDIUM overall. This is synthesized from domain knowledge of railway and vibration CBM dashboards and geo-sensor explorers (Grafana/Kibana-style panels, Leaflet/Mapbox heat maps, track-geometry and inspection viewers). I did not verify it with Context7 or web sources in this pass. Library-specific claims belong in STACK.md.

## How this domain typically works (short orientation)

- Condition-monitoring views follow "overview first, zoom and filter, details on demand". The top shows KPI cards and a severity distribution. The middle shows time series and a map. The bottom shows a ranked table of worst events.
- Severity is always a banded classification on a magnitude, with a fixed colour ramp (green, yellow, orange, red, dark red). The same colours must be used on every view (KPI, chart, map, matrix, table). This is the single strongest consistency convention.
- Maintenance users want "where do I go inspect": a ranked list, a map pin and a coordinate or Google Maps link. Management users want "how bad is it": counts per class, the worst trecho and a trend or comparison.
- Geo-sensor explorers link every view to a shared selection and filter state. Brushing a time range highlights the map, and clicking a map point highlights the time series.

## Table Stakes

Missing any of these makes the dashboard feel incomplete to either audience.

| Feature | Why Expected | Complexity | Notes / Dependencies |
|---------|--------------|------------|----------------------|
| KPI cards row: registros, eventos, impactos, pontos de impacto, plus per-class counts (Normal/Leve/Moderado/Severo/Crítico) | Every CBM overview opens with headline numbers. Management reads only this. | Low | Cards must be derived from current client-side state, so they change when thresholds or filters change. Show the run context (date, trem 102, linha 4, duration, 23.383 samples) in a header strip. |
| Severity colour legend, applied consistently | Without it the colours are unreadable. | Low | Single shared palette constant. Make it colour-blind-safe and give each class a text label, not colour alone. |
| Per-axis acceleration time series (AX/AY/AZ), medido vs dinâmico toggle | The core user request. Engineers expect the raw and the baseline-removed signal. | Med | 23k points × 3 axes. Needs downsampling or a WebGL/canvas renderer (see PITFALLS). Draw threshold lines at the current Leve/Moderado/Severo/Crítico values on the chart. AZ measured includes −1 g, so label it clearly. |
| Threshold bands/lines drawn on the time series | Lets the user see why a point is classed Severo. | Low | Re-render when sliders move. |
| Route map: GPS track polyline plus impact points coloured by severity | Locating spots is the maintenance use case. | Med | Basemap tiles are an external dependency (OSM/CARTO). Offline fallback is not needed. The track is only about 190 fixes at 30 s, so it is sparse (see GPS gap handling). |
| Point popup/tooltip: severity, value in g, dominant axis, trecho, sentido, time, coordinates, Google Maps link | Engineers act on it in the field. | Low | The Google Maps link `https://www.google.com/maps?q=lat,lon` is already in the workbook's top-50. Generate it client-side so it stays valid when parameters change. |
| Geographic heat map (intensity layer) | Explicitly requested. | Med | Weight by the selected metric (see Heat map weighting). Rendered from impact points or from interpolated samples, not from the 190 raw fixes alone. |
| Trecho × severidade matrix heat map | Explicitly requested. It is the management view of "which segment is worst". | Med | 21 rows × 5 classes. Cell = count (toggle to % of the trecho's samples). Row and column totals. Clicking a cell applies a filter. Sort rows by priority or by Crítico+Severo count. |
| Top-N peaks table (default 50) with rank, value, class, axis, trecho, sentido, time, map link | The maintenance worklist. It already exists in Excel, so users will expect it. | Med | Sortable. N is adjustable. Recomputed when thresholds, filters or rest-offset change. Row click flies the map to the point and highlights it on the chart. CSV download of the table. |
| Filters: sentido, trecho, eixo dominante, classe de severidade, janela de tempo | Requested. A standard faceted-filter set. | Med | One shared filter store drives every view. Show the active filters as removable chips and a visible "limpar filtros" button. Show "N de M registros" so the user knows what is filtered. |
| Adjustable severity thresholds (4 cut-points) | Requested headline feature. | Med | Enforce monotonic ordering (Leve < Moderado < Severo < Crítico). Show defaults (0,5/1/2/4 g) and a "restaurar padrão" button. Numeric input plus slider. The slider range is roughly 0.1–8 g. Use debounced recompute (~100 ms) or `input` events with cheap recalculation. |
| Analysis parameters: rest-level offset (baseline) and event grouping rule | Requested. The Excel pipeline defined these, and they change results. | High | Baseline: mediana (default) / média / manual per axis. Recomputing dynamic axes, severity, eventos, impactos and pontos de impacto in JS must reproduce the Excel numbers at defaults. This is the highest-risk logic. A golden-file test against the workbook is required. Event grouping: "consecutive events" gap tolerance in samples or seconds. |
| Defaults reproduce the workbook exactly | Trust. Engineers will cross-check against the Excel file. | Med | Needs a verification step. Display "valores padrão = planilha" when the parameters are untouched. |
| Display options: which metric/axis drives the heat map and the map colouring, heat radius and intensity | Requested. | Low–Med | Metric choices: |dominante|, AX, AY, AZ, count of events. |
| Responsive layout, readable on a phone | Field engineers open it on a phone, and managers on a tablet or laptop. | Med | See Mobile. |
| Portuguese UI strings and pt-BR number formatting (decimal comma, dd/mm/aaaa, 24 h) | Stated constraint. | Low | Use `Intl` with `pt-BR`. Don't hardcode strings in scattered places. Centralize them in one dictionary. |
| Loading/empty/error states | A static site with a ~MB JSON file needs them. | Low | An empty filter result must say "nenhum registro" rather than render a blank chart. |
| Methodology/legend panel ("Como ler") | Management needs to know what Leve/Moderado mean and which g-values apply. | Low | Short text, with the thresholds interpolated from the current state. |

## Differentiators

These are not required, but they separate a useful dashboard from a chart dump. Each is valued by the audiences in the brief.

| Feature | Value Proposition | Complexity | Notes / Dependencies |
|---------|-------------------|------------|----------------------|
| Linked brushing: time-series range select filters the map, matrix and table, and vice versa (click a map point, chart cursor jumps) | The single most useful geo-sensor explorer behaviour. It answers "where was I when this spike happened?" | High | Needs a central store with one `selection` (time range and/or sample id) and one `filters` object. All views subscribe. Use selection as a highlight, not a filter, by default, with an "aplicar como filtro" action. Map to chart uses the timestamp as the join key. |
| Hover sync: chart crosshair moves a marker along the track (and the reverse) | Cheap linked brushing. It gives most of the value for less complexity than range brushing. | Med | Recommended first step before full range brushing. Needs the interpolated position per sample. |
| URL-encoded state (thresholds, filters, parameters, selected tab) | A shareable link such as "this view with Severo=1,5 g, trecho 7". It is the main export/share route on a static site. | Med | Serialize only non-default values to keep URLs short. Use the hash (`#`) so GitHub Pages needs no routing. Version the schema (`v=1`). Validate and clamp on load. |
| Per-trecho priority ranking with the rule shown | Management gets "where to spend maintenance budget". It extends the existing Excel per-trecho priority. | Med | Recompute when thresholds change. Show the formula. |
| Interpolated position for samples between GPS fixes (about 150 samples fall between consecutive 30 s fixes at 5 Hz) | Without it 99% of samples have no coordinates and cannot be mapped. Impact points then sit only on fix locations. | Med | Linear interpolation of lat/lon by timestamp between consecutive fixes, but only when the fix gap is below a limit (see GPS gaps). Mark the interpolated points as estimated. Precomputed in the converter, which keeps the browser simple. |
| Sentido comparison (TIG-PXV vs PXV-TIG) side by side in the KPI cards or matrix | The two directions show asymmetry in track wear. | Low–Med | A facet toggle on the matrix and the cards. |
| Heat map toggle between "intensidade (g)" and "densidade de eventos" | Different questions: where is it worst vs where does it occur most. | Low | Lives under display options. |
| Map layer control: track, impact points, heat map, trecho labels, with a basemap switch (rua/satélite) | Standard for geo explorers. | Low | Leaflet-style layer control. |
| Trecho boundaries/labels on the map and on the time axis (shaded bands) | Connects the table of trechos to the route and the signal. | Med | Needs trecho start/end time or polygon from the workbook. Check that the converter can extract it. |
| Export: PNG of charts, CSV of the filtered table / filtered events, "copiar link" button | Engineers paste into reports. Management pastes into slides. | Low–Med | CSV is trivial. PNG is built into most chart libraries. Do not build PDF. |
| Print/PDF-friendly stylesheet | A manager may print the overview. | Low | CSS `@media print`, instead of generating PDFs. |
| Gap/quality indicator: "2.020 registros sem coordenadas (túnel Central → Saara)" shown as a data-quality card | Honesty about data. It prevents misreading the empty map stretch as "no impacts". | Low | Computed from the data. Also list the events that cannot be mapped. |
| Statistics panel per axis (min/max/RMS/p95/mean of the dynamic signal) | The workbook has an Estatísticas sheet. RMS is the standard vibration summary. | Low–Med | Compute from the filtered samples. |
| Keyboard accessibility and ARIA labels on the controls | Public site. Low cost if done early. | Low | Matters especially for slider and chip components. |
| Dark mode | Night-time operations staff, and it was already deferred for the logger as VIZ-10. | Low–Med | Optional. Only if the palette is tokenised from the start. |

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Live/real-time streaming, WebSocket, polling | Out of scope (static site, no backend). | Static JSON only. Show the run date prominently. |
| Multi-run selector or run comparison | Explicitly out of scope. | Keep the JSON run-scoped (`run.json` with a run id) so it can be added later without a rewrite. |
| User accounts, login, private views | Public by decision. | None. Do not put any personal data in the JSON. |
| Time × trecho heat map | Explicitly not selected. | Only the geographic heat map and the trecho×severidade matrix. |
| FFT/spectrum analysis, filters, frequency charts | Out of scope for the project. The vibration, displacement and frequency channels were all 0 in this run. | Do not show empty channels. Hide the channels that are all zero rather than plotting flat lines. |
| Server-side recompute, database, API | Static GitHub Pages only. | All recompute runs in the browser in JS. |
| Dynamic-axis recomputation from the raw, decimal-damaged sheet | The original data lost its decimal separators. | The converter reads the treated sheet `02 — DADOS TRATADOS` only. |
| Rendering all 23k points as DOM/SVG elements per axis | The browser slows to a crawl, especially on a phone. | Canvas/WebGL charts plus min/max decimation per pixel bucket. |
| One heat-map point per raw GPS fix, weighted by nothing | With ~190 fixes at 30 s spacing, this shows where the GPS happened to sample, not where the impacts are. | Weight by the impact metric and place impacts via the interpolated position (see Heat map weighting). |
| Drawing straight lines across tunnel gaps as if they were measured track | Misleading. It invents a path through Central → Saara. | Break the polyline at large gaps, or draw it dashed and labelled "estimado". |
| Free-text editing or annotation of events, saving comments | Needs a backend. | Use the exported CSV and the link. |
| Automatic "AI" diagnosis or maintenance recommendations | The thresholds come from engineering criteria. An invented recommendation is a liability on a public site. | Show the class and the priority rule only. |
| Many chart types for variety (pie, radar, gauges) | Clutter and worse readability. | Stacked/grouped bar for classes, one matrix, line charts, one map. |
| Language switcher | Single audience. | Portuguese only, with strings centralised. |
| Pixel-perfect PDF report generation in the browser | High complexity and fragile. | Print stylesheet. |
| Auto-refreshing basemap tile key requiring a secret | A public static site cannot hide keys. | Use keyless tiles (OSM/CARTO) with attribution, and respect their usage policy. |

## Expected Behaviours (detail for the roadmap)

### KPI cards
- Show the current value, the label and a one-line explanation (hover or tooltip). Per-class cards use the class colour.
- They respond to filters and thresholds, and display "(filtrado)" when any filter is active. Without that tag, users read a filtered count as the whole run.
- Distinguish **registros**, **eventos** (samples ≥ Leve), **impactos** (grouped) and **pontos de impacto** (one per location). Give a tooltip definition for each, because these terms are confusable and management will ask.
- Clicking a class card toggles the class filter.

### Linked brushing (time series ↔ map)
- Key phase ordering: (1) shared store plus click-to-select, (2) hover sync, (3) range brush. Stop at (2) if time is short.
- Brushing highlights, and it dims the unselected items rather than hiding them. A clearly visible "limpar seleção" is mandatory.
- The selection must survive a threshold change (selection is by sample id or time range, not by class).
- Samples without coordinates (tunnel) can be selected in the chart but have no map marker. Say so in the UI ("N pontos sem coordenada").

### Threshold sliders
- Four thresholds on one multi-handle control, or four inputs, enforcing order. Show the class names between the handles, and the g-value on each handle.
- Live recompute while dragging for the cheap parts (colour and counts). Use a throttled update for the expensive parts (grouping into impacts, top-N). 23k samples is small enough for full recompute on `input` in under ~50 ms if it is written with typed arrays. Verify this with a benchmark.
- "Restaurar padrão" and an indicator showing when the values differ from the workbook's.

### Filter UX
- Persistent filter bar (a sticky bar on desktop, a collapsible drawer on mobile). Multi-select chips for sentido, trecho, eixo and classe. A time window comes from the chart brush or from two time inputs.
- Always show the match count, active-filter chips, and a clear-all button.
- Filters AND across dimensions and OR within a dimension. Say so in a tooltip if it is not obvious.

### Heat map weighting
- Weight by the severity metric (|dominante| in g, or its square for energy emphasis, with the choice under display options). Never weight by plain sample density, otherwise the slow-speed stretch (more samples per metre) dominates the map. This is the standard pitfall for time-sampled data: samples per metre varies with train speed.
- Cap or normalise the weight, so one Crítico outlier does not wash out the rest. Offer an intensity slider and a radius slider (the requested display options).
- Only samples at or above a user-chosen minimum class contribute (default: Leve).
- Heat layers should be built from the interpolated positions, not from the raw fixes.

### Top-N peaks table
- Default 50. Sort by value desc. Ties are stable. Show the rank, g-value, class chip, dominant axis, trecho, sentido, local time and a map link.
- Dedupe by location: show one row per ponto de impacto when the "um por local" option is on (the workbook default), otherwise one row per impacto.
- Row hover highlights the point on the map, and a click centres the map.
- Rows without coordinates show "sem GPS" with the map link disabled, not a broken link.

### Export / share (URL state)
- Hash-encoded state is the whole sharing story on a static site. Add a "Copiar link" button. Do not use localStorage as the only persistence, because it cannot be shared.
- CSV download for the filtered table. PNG export for the chart and the map is optional.

### GPS gaps (tunnels) and sparse fixes
- Fixes are about every 30 s, and 2.020 samples have no coordinate. Treat "no fix" as normal data, not an error.
- Interpolate only across gaps under a threshold (for example <= 60 s, adjustable), flag the result as estimated, and never extrapolate beyond the first and last fix.
- Break the polyline across long gaps. In the tunnel stretch show a labelled dashed connector or nothing.
- Show the gap as a shaded band on the time axis and report the count as a data-quality KPI.
- Impacts without coordinates remain in all counts and in the chart and the matrix, but are absent from the map and heat map. Always state this next to the map ("N eventos sem coordenada não aparecem no mapa").
- Speed must not be derived from the fixes for the Wi-Fi/none cases (see the project memory: speed None is correct).

### Mobile use
- Single-column layout under ~768 px with the order KPIs, then map, then top-N, then charts, then matrix. Maintenance engineers on a phone want the map and the list first.
- Controls in a bottom-sheet or collapsible drawer. Touch targets >= 44 px. A slider needs a numeric input fallback.
- The map is full width, with `touch-action` handled so the page can still scroll. Provide a "ver em tela cheia" option.
- The matrix scrolls horizontally with a sticky first column, or switches to a list on narrow screens.
- Payload budget: keep the data JSON compact (columnar arrays, rounded floats, gzip by Pages). Target < 1 MB transferred. Test on a throttled mobile profile.
- Chart interactions: tap rather than hover. Hover sync becomes tap-to-select.

## Feature Dependencies

```
Converter (xlsx -> JSON, treated sheet 02) -> everything below
  Interpolated lat/lon per sample (converter) -> impact points on map -> geographic heat map
  Trecho start/end + sentido per sample (converter) -> trecho x severidade matrix
                                                     -> trecho filter -> per-trecho priority

Shared state store (thresholds, params, filters, selection)
  -> client-side classification engine (baseline, dynamic axes, severity, eventos, impactos, pontos)
       -> KPI cards, time series threshold lines, matrix, top-N, map colours, heat map
  -> URL hash state (needs a stable store schema first)
  -> linked brushing (needs the store plus a timestamp join key)

Golden-file test (JS engine at defaults == workbook) -> trust in all recomputed outputs
Severity palette/tokens -> every view (build first)
Heat-map weighting + min-class -> geographic heat map
Top-N table -> map link generation (client-side) and the CSV export
Fix-gap rule (max gap for interpolation) -> map polyline -> heat map -> data-quality card
```

Dependency on existing project: none on the logger runtime. The only existing assets are the workbook (`Results_1st.Run/Final - Monitoramento de Sapata coletora - Linha 04.xlsx`) and the CSV column contract (21 columns, GPS as the last 3) for the later raw-CSV path. The converter's JSON schema should be shaped so that a raw logger CSV can produce the same structure. This is why the baseline, severity and grouping logic should live in the browser and be applied to samples, not be baked into the JSON.

## MVP Recommendation

Prioritize, in this order:
1. Converter plus JSON schema (samples as columnar arrays, with an interpolated position flag, trecho, sentido and the fixes list), plus shared palette and state store.
2. JS classification engine at the default parameters, verified against the workbook (golden test), then KPI cards and thresholds.
3. Per-axis time series with threshold lines (decimated), then the map with track, impact points and popups.
4. Filters and the trecho × severidade matrix with click-to-filter.
5. Top-N table with map links and CSV export.
6. Geographic heat map with weighting, radius and intensity controls.
7. Analysis parameters (baseline offset, grouping rule).
8. Differentiators in this order: URL hash state, hover sync, data-quality card, mobile polish, then range brushing.

Defer:
- Range brushing (full) and sentido side-by-side comparison: valuable, but hover sync and click-to-filter cover most of the need.
- Dark mode, PNG export and print stylesheet: nice to have, and the palette tokens make them cheap to add later.
- Multi-run support: out of scope, keep the schema run-scoped.

## Open Questions / Flags for Later Research

- Can the converter get the trecho boundaries (start and end timestamps or coordinates) from the workbook? This is needed for the matrix, the shaded bands and the trecho labels on the map. LOW confidence until the sheets are inspected.
- The exact "impacto" grouping rule in the Excel (gap tolerance, same axis or not) must be reverse-engineered before the JS engine can match it. Treat this as a research flag for the engine phase.
- The per-trecho "prioridade" formula in the workbook must be read from the sheet and reproduced.
- The renderer choice for 23k × 3 points and for the heat map, plus the basemap tile policy, goes to STACK.md.

## Sources

- Domain knowledge of rail and vibration CBM dashboards, geo-sensor explorers and Leaflet/Mapbox heat-map conventions. This is training-derived, so MEDIUM to LOW confidence, and was not verified against current docs in this pass.
- `.planning/PROJECT.md` (milestone scope, data facts, out-of-scope list). HIGH confidence for project-specific facts.
