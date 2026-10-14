# Phase 12: Time Series & Map - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Add two linked views to the existing Phase 11 dashboard: AX/AY/AZ time series (plus expandable velocidade, deslocamento, frequência, temperatura) and an OSM route map (track, stations, impact markers, heat map). Both read from the same state store as the KPI panels and react to every filter/threshold/display change. Hovering and clicking link the two views.

Covers CHART-01..05, MAP-01..06 and SYNC-01. Matrix/ranking, analysis parameters and URL sharing (Phase 13) and CSV upload (Phase 14) are separate phases. Range-brushing that filters the map (CHART-06), PNG export, mobile layout and GPS interpolation remain deferred.

</domain>

<decisions>
## Implementation Decisions

### Carried forward (already locked)
- uPlot 1.6.32, Leaflet 1.9.4, leaflet.heat 0.2.0, vendored in `site/vendor/` with versions in `site/vendor/README.md`. No CDN, no build step, vanilla ES modules (`.planning/research/STACK.md`)
- Medido/dinâmico toggle, heat-map metric (dom/ax/ay/az/resDin), radius and intensity already exist in `state.display` and the controls panel. Phase 12 consumes them and adds no new controls for these
- Portuguese UI text in `i18n.js`. Every new card/control gets an info (i) button with text in `INFO` (Phase 11 pattern)
- Desktop layout only (MOB-01 deferred)
- The heat map is severity-weighted on a fixed scale, one point per GPS fix. Density weighting is out of scope

### Page layout
- Order: header, then the KPI cards row (`#overview`), then **map**, then **charts**, then the class/stats/quality panels
- Map and charts are stacked and full width (not side by side)
- Map height is about 450 px
- Secondary channels (velocidade, deslocamento, frequência, temperatura) are one collapsible group ("Mais canais"), closed by default. Opening it shows all 4 charts, synced with the axis charts

### Chart presentation
- 3 stacked charts (AX, AY, AZ) on a shared time axis, not one combined chart
- Filters: non-matching samples stay drawn but **dimmed** (grey). Matching samples are drawn in colour, so the full run stays visible for context
- Thresholds are drawn as **± lines** (+t and −t) in each class colour
- In medido mode, threshold lines are offset by the rest level (rest ± t), so they mark the same classification boundaries as in dinâmico
- Every peak stays visible at any zoom (min/max decimation if any decimation is used). Gaps (turnaround, missing samples) are drawn as gaps, never bridged
- A reset-zoom control returns to the full run

### Map markers & track
- Impact markers: **one per ponto de impacto** (one per GPS location, about 99 on run 1), coloured by the worst class at that point
- Popup shows the **worst impact** at that point: hora, trecho, sentido, AX/AY/AZ dinâmicos, classe, plus "N impactos neste ponto" and a Google Maps link
- Track coloured by sentido and broken at gaps. With filters active, matching segments are drawn in full sentido colour and the rest is **faded** (thin, pale), not hidden
- Stations are small dots with the name in a hover tooltip. Trecho is shown in tooltips/popups. The track is not re-coloured by trecho
- Basemap: standard OSM tiles (tile.openstreetmap.org) with attribution, no API key
- Heat map is **off by default**, toggled on the map
- "N eventos sem GPS" appears as a small note line under the map and updates with filters
- Marker and threshold colours reuse the Phase 11 class colour tokens (`--normal`, `--leve`, `--moderado`, `--severo`, `--critico` in `app.css`)

### Chart↔map linking
- Chart hover moves a position marker on the map. At times without a GPS fix (tunnel), the marker sits at the nearest prior fix, drawn hollow/grey to signal "sem GPS"
- Clicking a map point (marker or track) moves the chart cursor to that time **and zooms all charts to ±30 s** around it
- Chart zoom does not move or filter the map (range brushing is deferred as CHART-06)
- The time-window filter and chart zoom are independent. The filter dims/filters data, zoom is only the view. Changing the filter does not zoom the charts

### Claude's Discretion
- Sentido colours for the track (two distinct colours, not class colours)
- Chart heights, axis label formatting (pt-BR, America/Sao_Paulo), legend style
- How the dimmed/coloured split is drawn in uPlot (e.g. two series per axis)
- Position-marker style, track-hover tolerance, heat-map toggle control placement on the map
- Fixed heat-map scale value (`max`) and how the radius/intensity controls map onto leaflet.heat options
- Module split (e.g. `panels/charts.js`, `panels/map.js`) and how per-view data is derived from `analyze`/`buildView`

</decisions>

<specifics>
## Specific Ideas

- Clicking a ponto on the map should land you on that moment in the charts (cursor + ±30 s zoom), ready to inspect the peak
- Keep the rest of the run visible as context (dimmed chart samples, faded track) instead of removing it when filtering

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `site/js/app/state.js`: `createStore`, `display` (`valueMode`, `heatMetric`, `radius`, `intensity`), `HEAT_METRICS`, `paramsKey`. Charts and map subscribe here
- `site/js/core/view.js`: `rowMask(run, analysis, filters)` and `buildView`. `rowMask` gives the matching/dimmed split for charts, track highlight and markers
- `site/js/core/engine.js` `analyze` (memoized on `paramsKey`): dynamics, classes, events, impacts, pontos
- `site/js/core/data.js` `decodeRun`: columnar run (tMs, ax/ay/az counts, locKey, trecho, sentido, GPS fixes)
- `site/js/app/format.js`: pt-BR date/number formatters (America/Sao_Paulo)
- `site/js/app/dom.js` `h()`: element helper used by all panels
- `site/js/app/info.js` + `INFO` in `i18n.js`: info buttons
- `app.css` class colour tokens `--normal`…`--critico`
- `Stations_GEO/*.txt` are already parsed by the converter. Check whether station coordinates are in the site JSON, and add them through the converter if not

### Established Patterns
- Panels expose `render(...)` and are called from `update()` in `main.js` on every store change. Controls use mount-once plus update (no rebuild). Charts and map should follow mount-once plus update so zoom and map view survive state changes
- `node --test` covers core logic, pytest covers the converter. Both gate deploy (PUB-02). Pure data derivation for charts and map (series, segments, pontos, heat points) should live in testable core functions
- Local preview: `python -m tools.serve_site` (no-cache)

### Integration Points
- `site/index.html`: new `#map` and `#charts` sections between `#overview` and `#classes`, plus vendor `<script>`/`<link>` tags
- `site/js/app/main.js` `update()`: add chart and map renders
- `.github/workflows/pages.yml`: deploys `site/` as-is, so the vendored files must be committed

</code_context>

<deferred>
## Deferred Ideas

None. The discussion stayed within phase scope. Range brushing (CHART-06), PNG export (EXP-01) and mobile (MOB-01) were already deferred in REQUIREMENTS.md.

</deferred>

---

*Phase: 12-time-series-map*
*Context gathered: 2026-10-13*
