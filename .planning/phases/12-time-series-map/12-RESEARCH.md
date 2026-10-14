# Phase 12: Time Series & Map - Research

**Researched:** 2026-10-13
**Domain:** Vanilla-JS dashboard: uPlot time series + Leaflet/leaflet.heat map, linked via a shared store
**Confidence:** MEDIUM-HIGH (codebase facts verified by reading code/data; library API from training knowledge of uPlot 1.6.x / Leaflet 1.9, versions verified on npm; not re-verified in Context7 this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Carried forward (already locked)**
- uPlot 1.6.32, Leaflet 1.9.4, leaflet.heat 0.2.0, vendored in `site/vendor/` with versions in `site/vendor/README.md`. No CDN, no build step, vanilla ES modules (`.planning/research/STACK.md`)
- Medido/dinâmico toggle, heat-map metric (dom/ax/ay/az/resDin), radius and intensity already exist in `state.display` and the controls panel. Phase 12 consumes them and adds no new controls for these
- Portuguese UI text in `i18n.js`. Every new card/control gets an info (i) button with text in `INFO` (Phase 11 pattern)
- Desktop layout only (MOB-01 deferred)
- The heat map is severity-weighted on a fixed scale, one point per GPS fix. Density weighting is out of scope

**Page layout**
- Order: header, then the KPI cards row (`#overview`), then **map**, then **charts**, then the class/stats/quality panels
- Map and charts are stacked and full width (not side by side)
- Map height is about 450 px
- Secondary channels (velocidade, deslocamento, frequência, temperatura) are one collapsible group ("Mais canais"), closed by default. Opening it shows all 4 charts, synced with the axis charts

**Chart presentation**
- 3 stacked charts (AX, AY, AZ) on a shared time axis, not one combined chart
- Filters: non-matching samples stay drawn but **dimmed** (grey). Matching samples are drawn in colour, so the full run stays visible for context
- Thresholds are drawn as **± lines** (+t and −t) in each class colour
- In medido mode, threshold lines are offset by the rest level (rest ± t), so they mark the same classification boundaries as in dinâmico
- Every peak stays visible at any zoom (min/max decimation if any decimation is used). Gaps (turnaround, missing samples) are drawn as gaps, never bridged
- A reset-zoom control returns to the full run

**Map markers & track**
- Impact markers: **one per ponto de impacto** (one per GPS location, about 99 on run 1), coloured by the worst class at that point
- Popup shows the **worst impact** at that point: hora, trecho, sentido, AX/AY/AZ dinâmicos, classe, plus "N impactos neste ponto" and a Google Maps link
- Track coloured by sentido and broken at gaps. With filters active, matching segments are drawn in full sentido colour and the rest is **faded** (thin, pale), not hidden
- Stations are small dots with the name in a hover tooltip. Trecho is shown in tooltips/popups. The track is not re-coloured by trecho
- Basemap: standard OSM tiles (tile.openstreetmap.org) with attribution, no API key
- Heat map is **off by default**, toggled on the map
- "N eventos sem GPS" appears as a small note line under the map and updates with filters
- Marker and threshold colours reuse the Phase 11 class colour tokens (`--normal`, `--leve`, `--moderado`, `--severo`, `--critico` in `app.css`)

**Chart↔map linking**
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

### Deferred Ideas (OUT OF SCOPE)
None. Range brushing (CHART-06), PNG export (EXP-01) and mobile (MOB-01) were already deferred in REQUIREMENTS.md. Also out: Phase 13 matrix/ranking/URL sharing, Phase 14 CSV upload, GPS interpolation.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHART-01 | AX/AY/AZ time series, zoom, medido/dinâmico toggle | 3 uPlot instances, series from `chartData()` core fn, `state.display.valueMode`, drag-zoom built in |
| CHART-02 | Threshold lines, every peak visible at any zoom | `hooks.draw` (or constant series) for ± lines from `analysis.th2`; uPlot's per-pixel-column min/max path builder keeps extremes; never downsample ourselves |
| CHART-03 | Gaps drawn as gaps | Insert synthetic null rows where `dt > maxJumpMs` and for invalid rows; `spanGaps:false` |
| CHART-04 | Expandable secondary charts vel/disp/freq/temp | `<details>` group, lazy-create charts on first open, `channels.*` in JSON (NOT decoded yet) |
| CHART-05 | Zoom + cursor sync across all charts | `cursor.sync.key` shared across all 7 uPlots (default scale sync on x) |
| MAP-01 | GPS track on OSM, coloured by sentido, broken at gaps | `trackSegments()` core fn -> `L.polyline` per segment; break on sentido change or fix gap > 120 s |
| MAP-02 | Station markers and trecho segments | `run.stations` already in JSON (14 with lat/lon); `circleMarker` + tooltip; trecho in tooltips |
| MAP-03 | Severity markers + popup | `view.pointRows` -> `pontoMarkers()` core fn; `circleMarker`, popup via DOM nodes |
| MAP-04 | Severity-weighted heat map, fixed scale, one point per fix | `heatPoints()` core fn (105 fixes); `L.heatLayer` with fixed `max` |
| MAP-05 | Count of events not placeable | count of `pointRows` with `locId < 0` (see Open Question 1) |
| MAP-06 | Filter/threshold changes update map | map `update(ctx)` called from `main.js update()` on every store change |
| SYNC-01 | Chart hover -> map position; map click -> chart cursor | `setCursor` hook -> row -> fix; map click -> t -> `setScale` ±30 s + `setCursor` on all charts |
</phase_requirements>

## Summary

The Phase 11 foundation is solid: one store, `update()` in `main.js` recomputes `analysis` (memoized by `paramsKey`) and `view` (`buildView` with `mask`, `pointRows`, `impacts`) and calls panel `render(el, ctx)`. Phase 12 adds two panels (`map`, `charts`) that must be **mount-once + update** (so zoom/map view survive), plus pure derivation functions in `site/js/core/` (testable with `node --test`).

**Three blocking facts found in the repo that the planner must handle:**
1. `site/vendor/` does **not exist yet** (no uPlot, Leaflet or leaflet.heat committed). A vendoring task is the first task of the phase (from npm tarballs, versions pinned, `README.md` with versions, license files).
2. `decodeRun` (core/data.js) does **not** retain GPS coordinates (`json.gps.lat/lon` are only turned into `locKey` strings -> `locId`) nor `json.channels` beyond `run.channels = json.channels` (raw, scaled integers) nor `accel.per_g`. It must be extended to expose `run.fixLat`, `run.fixLon` (per fix), fix start rows, and a `priorFix` per-row table. `run.fix` (per-row fix index, -1 = none) and `run.stations` (with lat/lon) already exist. Stations coordinates are already in the JSON: **no converter change needed** (14 stations).
3. The JSON has only **105 GPS fixes** (99 unique coordinates; a fix about every 30 s, ~175 ms per row, 23,383 rows). So track/heat/markers are tiny datasets; the heavy data is the charts (23k x 3 + 4 secondary, 7 canvases). Everything can be rebuilt on each store change without perf concerns, except chart data arrays which should be rebuilt only when their inputs change.

**Primary recommendation:** Pure core functions (`chartData`, `thresholdLines`, `trackSegments`, `pontoMarkers`, `heatPoints`, `rowToFix`, `fixToRow`) + two mount-once panels (`panels/charts.js`, `panels/map.js`) wired through a small `link` object (cursor row <-> fix) created in `main.js`. Load libs as classic `<script>` globals (`uPlot`, `L`) before the module entry. Use `L.circleMarker` (no marker image assets) and `uPlot`'s native min/max-per-pixel rendering (no custom decimation).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| uPlot | 1.6.32 (npm verified 2026-10-13) | 7 time-series charts, drag zoom, cursor sync | Locked. Canvas; native cursor sync; null = gap |
| Leaflet | 1.9.4 (npm `leaflet@1` latest = 1.9.4) | Map, polylines, circleMarkers, popups, tooltips | Locked. Do not use 2.x alpha |
| leaflet.heat | 0.2.0 (npm latest = 0.2.0) | Heat layer | Locked. Classic-script plugin, attaches `L.heatLayer` |

### Supporting
| Item | Purpose | When |
|------|---------|------|
| OSM raster tiles `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | Basemap | `maxZoom: 19`, attribution `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors` (required by OSM tile policy; set via Leaflet `attribution` option) |
| `<details>`/`<summary>` | "Mais canais" collapsible group | Native, accessible, closed by default; no JS lib |
| `Intl.DateTimeFormat` via existing `format.js` | pt-BR / America/Sao_Paulo labels | All time labels (reuse `fmtTime`, `fmtDate`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `circleMarker` | default `L.marker` icons | Default icons need vendored `images/*.png` and `L.Icon.Default.imagePath` fix; circleMarkers coloured by class need no assets |
| Dimmed+colour as 2 series | per-point colour via custom paths | 2 series (grey full-run underneath, coloured masked overlay) is simplest and cheap |

**Installation (vendoring, one-time; run in a scratch dir, copy files into repo):**
```bash
# in an empty temp dir, not in the repo
npm pack uplot@1.6.32 leaflet@1.9.4 leaflet.heat@0.2.0
# extract each tarball into its own empty directory, then copy to site/vendor/:
#   uplot:        dist/uPlot.iife.min.js, dist/uPlot.min.css, LICENSE
#   leaflet:      dist/leaflet.js, dist/leaflet.css, LICENSE   (images/ not needed with circleMarker; but leaflet.css references images/layers.png and marker-icon only for layers control / default markers: unused -> 404 never requested)
#   leaflet.heat: dist/leaflet-heat.js, LICENSE
```
Then `site/vendor/README.md` lists the three versions + source URLs. `<link>`/`<script>` tags in `index.html` with relative paths (test_site_static requires every `src`/`href` to be relative and to exist). Script order: `leaflet.js`, `leaflet-heat.js`, `uPlot.iife.min.js`, then `<script type="module" src="js/app/main.js">`. (Module scripts are deferred, so classic scripts run first.) Verify exact dist file names after extracting (names above are from training; LOW-MEDIUM until checked).

## Architecture Patterns

### Recommended Project Structure
```
site/
├── vendor/                       # NEW: uplot, leaflet, leaflet-heat + README.md (versions)
├── js/core/
│   ├── data.js                   # EXTEND decodeRun: fixLat/fixLon/fixRow/priorFix/perG
│   ├── series.js                 # NEW pure: chartData, thresholdLines, secondary channels
│   └── geo.js                    # NEW pure: trackSegments, pontoMarkers, heatPoints, noGps count, rowToFix/fixToRow
├── js/app/panels/
│   ├── charts.js                 # NEW mount-once: mountCharts(el, link, run) / renderCharts(ctx)
│   └── map.js                    # NEW mount-once: mountMap(el, link, run) / renderMap(ctx)
├── js/app/link.js                # NEW tiny pub/sub: {hoverRow, selectRow} chart<->map
└── tests/js/series.test.js, geo.test.js, (decode extension in existing data tests)
```
`core/` must stay free of `document`/`window` (test_core_is_pure). Libraries `L`/`uPlot` are referenced only from `app/panels/*`.

### Pattern 1: Mount once + update (existing Phase 11 convention)
`mountMap`/`mountCharts` called once in `start()` after decode; `renderMap(ctx)`/`renderCharts(ctx)` appended to the update path (not into the `PANELS` array, which calls `render(el, ctx)` and `clear`s... Phase 11 panels rebuild DOM; map/charts must not). Update only the parts whose inputs changed (cache keys): chart data depends on `valueMode`, `analysis` (offset, thresholds) and `view.mask`; map layers depend on `view` and `display`.

### Pattern 2: Chart data (core, pure)
Per axis k, x = epoch seconds (`Date.parse(meta.t0)/1000 + (tMs[i]-tMs[0])/1000`) so uPlot's native time axis and `tzDate` can be used. Filters/time-window use elapsed ms (`run.tMs`), so convert once (`xOfRow`, `rowOfX` via binary search on `tMs`).
- Value (g): medido = `axis[i]/2048` (per_g = 2048; `th2` is in doubled LSB = g*4096, so `2*axis - off2` over 4096 is the dinâmico g); dinâmico = `(2*axis[i] - off2[k]) / 4096`. Medido threshold line: `off2[k]/4096 ± th2[j]/4096`; dinâmico: `± th2[j]/4096`. Use `th2` (already ceil'd) not `thresholds_g`, so lines sit exactly on classification boundaries.
- Gap handling: build arrays with a synthetic row (x = midpoint, y = null) inserted wherever `tMs[i]-tMs[i-1] > params.maxJumpMs` (run 1 has exactly one such gap, 566 s, the turnaround) and y = null where `!valid[i]`. x must stay strictly increasing and non-null. uPlot series default `spanGaps:false`, so null breaks the line.
- Dimmed/coloured: series A "contexto" (grey, all valid rows, thin), series B "filtro" (axis colour, y = value where `mask[i]` else null). When no filter is active (`!view.isFiltered`) hide A or leave identical (draw only B) to halve paint cost. Points: set `points.show` for B so isolated matching samples (single non-null between nulls) are visible (uPlot hides points by default when dense; use `points:{show:(u,si,i0,i1)=>...}` or `points:{size:3}` only if sparse).
- Because buffers are shared, rebuild typed arrays (`Float64Array` x, `Float32Array` y, uPlot accepts typed arrays but null needs plain arrays or NaN: **use plain `Array` with `null`** for series with gaps, or `Float32Array` with `NaN`? uPlot treats `null` and `undefined` as gaps; NaN handling is not guaranteed in 1.6.x. Use plain arrays with null).
- Peaks at any zoom: uPlot's linear path builder draws per-pixel-column min/max (when more points than pixels), so extremes are preserved. Do NOT pre-decimate (e.g. LTTB) and do NOT set `paths: stepped/spline`. Test by asserting our data arrays contain the global max/min (unit) and verify visually once (manual).

### Pattern 3: Threshold lines
Draw in a `hooks.draw` callback using `u.valToPos(value,'y',true)` and `ctx` (setLineDash, class colours from CSS tokens read once via `getComputedStyle(document.documentElement).getPropertyValue('--leve')`; canvas cannot resolve `var(...)`). Alternative: constant extra series; rejected because they appear in legend/cursor and break the y auto-range. Include the threshold values in the y-range so lines are visible: set `scales.y.range` to `[min(data, -tMax*1.1), max(data, tMax*1.1)]` or keep auto-range but pad; decision: y range = data min/max padded, lines outside range are clipped (acceptable, they are just off-screen) -- but prefer to include the Leve threshold at least.

### Pattern 4: Sync across 3 + 4 charts (CHART-05)
All 7 uPlots get `cursor: { sync: { key: 'run', scales: ['x', null] } }` (default syncs x scale and cursor; y not shared). Include `uPlot.sync('run')` implicit via key. All charts must use the same x scale key (`'x'`) and the same x data length/ordering is NOT required, but identical x arrays across the 3 axes are used anyway. Secondary channels have different series (vel x/y/z, disp x/y/z, freq x/y/z, temp v) but same rows -> reuse the same x array (with the same synthetic gap rows, so lengths match and cursor idx matches between charts; critical for idx-based cursor sync when `sync.match`/data alignment differs: uPlot syncs by x value, so fine either way).
- Secondary charts must be created lazily when the `<details>` first opens (uPlot cannot size a canvas inside a closed `<details>`: width 0). On open, create (or `setSize`) using the container width; also on `window` resize use a `ResizeObserver` on the chart column and call `u.setSize`.
- Axes label alignment: give all stacked charts a fixed `axes[1].size` (e.g. 60 px) so plotting areas align horizontally and the cursor lines up visually.
- Reset zoom: button calls `setScale('x', {min: xFirst, max: xLast})` on one chart (sync propagates; to be safe call it on all).
- Zoom persistence across updates: when data change use `u.setData(data, false)` (resetScales false) so the user's zoom survives filter/threshold changes. (CONTEXT: filter changes must not zoom charts.) Y scale: autorange still follows visible window.

### Pattern 5: Chart <-> map link (SYNC-01)
`link.js`: `{ onHover(fn), onSelect(fn), emitHover(row|null), emitSelect(row) }`.
- Chart -> map: uPlot `hooks.setCursor: [u => { const idx = u.cursor.idx; ... }]` (guard `idx == null` -> emit `null`, hide marker). Map `idx` -> real row: because synthetic gap rows were inserted, keep `rowOfIdx` Int32Array (idx -> original row, -1 for synthetic) built with the data. Row -> `run.fix[row]`; if -1 use precomputed `priorFix[row]` (last fix start row index <= row, -1 if none before first fix) and mark `noGps`. Position marker: single `L.circleMarker` updated with `setLatLng`/`setStyle` (filled when GPS, hollow grey when "sem GPS"). Throttle with `requestAnimationFrame` (setCursor fires on every mousemove x 7 charts since sync triggers each chart's hook; only listen on **one** chart or dedupe by row).
  - Pitfall: with `cursor.sync`, each chart fires `setCursor` for synced cursor moves. Use a guard (`if (u.cursor.event == null)`? not reliable) or simply subscribe in all charts but dedupe by last emitted row.
- Map -> chart: click on a ponto marker -> row = `pointRows[...]` (the strongest row); click on track polyline -> nearest vertex (fix) via Leaflet click `latlng` -> nearest fix -> `fixRow[fix]` (first row of that fix). Then for each chart: `u.setScale('x', {min: x-30, max: x+30})` (sync propagates, calling on first is enough but call on all to be safe) and `u.setCursor({left: Math.round(u.valToPos(x,'x')), top: -10 /*or u.cursor.top*/})`. `setCursor` with `left` in CSS px relative to the plot; after `setScale` run the cursor set in `requestAnimationFrame`/after the scale redraw (uPlot batches via microtask `queueMicrotask`; setScale commits asynchronously by default) to avoid stale `valToPos`. Verify manually.
  - Both emit directions must avoid feedback loops: map click -> setCursor on charts -> setCursor hook -> emitHover -> moves position marker (that's fine/desired), but never triggers selection.
- Zoom independent from map (no `setScale` hook -> map). The time-window filter (`filters.tFrom/tTo`) in `rowMask` only dims.

### Pattern 6: Map layers (mount-once, update on view change)
Layer groups: `track` (polylines), `stations`, `markers`, `heat`, `pos` (hover marker). `fitBounds` only once at mount (from all fixes + stations), never on update. Track (core `trackSegments(run, mask)`): iterate fixes in order; segment boundary when `sentido` of fix's first row changes or `tFirstRow[f]-tFirstRow[f-1] > meta.workbook_defaults.max_fix_gap_s*1000` (120 s; run 1 gives 2 breaks: 319 s and 593 s, plus sentido change at row 11835). Each segment has `{sentido, matched, latlngs, fixFrom, fixTo}`. A fix is "matched" if any row belonging to that fix has `mask=1` (compute once per view: loop rows, `fixMatched[fix[i]] |= mask[i]`). Split segments additionally on matched changes. Draw faded (weight 2, opacity .35, pale) for unmatched, full (weight 4) for matched. `interactive: true` and `bubblingMouseEvents:false`; generous click tolerance by adding an invisible wide polyline (weight 14, opacity 0) with the click handler (cheap, ~105 vertices), or use canvas renderer `L.canvas({tolerance: 6})`.
- Sentido colours (discretion): two distinct non-class hues, e.g. blue `#1565c0` for sentido 0 and teal/magenta `#00838f`/`#ad1457`... must not collide with class tokens (green/amber/orange/red/purple). Recommend blue `#1565c0` (sentido 1) and cyan-teal `#00897b`? Teal is close to class green; choose **blue `#1565c0` and dark grey-brown `#5d4037`** to avoid class colours. Add a small legend control on the map.
- Markers (`pontoMarkers(run, analysis, view)`): from `view.pointRows` (rows). Per row r: `locId[r] >= 0` -> placeable; position = `fixLat/fixLon[run.fix[r]]`; class = `analysis.cls[r]`; popup fields: hora (wall clock via t0 + elapsed), trecho name `run.trechoNames[run.trecho[r]]`, sentido name `run.sentidos[run.sentido[r]].name`, AX/AY/AZ dinâmicos signed g `(2*axis[r]-off2[k])/4096`, classe `CLASS_NAMES[cls]`, "N impactos neste ponto" = count of `view.impacts` whose `peak` row has the same `locId`, link `https://www.google.com/maps?q=${lat},${lon}` with `target=_blank rel="noopener noreferrer"`. Build popup content as DOM nodes with `h()` (project rule: never innerHTML with data); `marker.bindPopup(node)`.
  - Radius by class (e.g. 5 + 1.5*cls), draw higher classes on top (sort by cls ascending before adding). Markers recreated on each view change (about 99, trivial) via `layerGroup.clearLayers()`.
- Heat (`heatPoints(run, analysis, view, metric)`): one point per fix: weight = max over rows of that fix with `mask=1` and classified (`cls>=0`) of metric value in g, divided by a fixed scale; fixes with no matching rows weight 0 (omit). Metric: `dom` = dom2/4096; `ax/ay/az` = |dynamic of that axis|; `resDin` = resultant of 3 dynamic axes (sqrt(sum sq)). Check what the existing stats module calls `resDin`/`T.dResDin` and reuse that formula (not read in this research). Fixed scale: normalise by the **top threshold** `th2[last]/4096` (Crítico boundary, 4 g default) and use `max: 1` so colours are comparable regardless of filters; weight clamped to [0,1]. Controls mapping: `radius` -> heatLayer `radius`, `blur: Math.round(radius*0.6)`; `intensity` -> multiply weights (clamped to 1) -- leaflet.heat has no intensity option; its `max` divides weights. Update with `heat.setOptions({radius, blur, max})` + `heat.setLatLngs(points)` (setLatLngs triggers redraw). Off by default: custom Leaflet control (checkbox "Mapa de calor") added with `L.control` `onAdd` using `h()`; call `L.DomEvent.disableClickPropagation(container)`.
- Stations: `L.circleMarker(radius 4, white fill, dark stroke).bindTooltip(name)`; trecho segments are conveyed in tooltips/popups only (CONTEXT: track not re-coloured by trecho). For MAP-02 "trecho segments": show trecho name in the track-segment tooltip (hover on invisible wide polyline: nearest fix's trecho) and in marker popups.
- No-GPS note: `<p class="muted" id="map-note">` under the map, text `${n} pontos de impacto sem GPS` / zero -> hide or "Todos os pontos têm GPS". Recompute from `view.pointRows.filter(r => run.locId[r] < 0).length` (core fn `unplacedCount`).

### Anti-Patterns to Avoid
- **Rebuilding charts/map in `render()` like the Phase 11 panels** (clear + rebuild): loses zoom and map view. Mount once.
- **Calling `fitBounds`/`setView` in update**: map would jump on every filter tweak.
- **Pre-decimating** chart data: hides single-sample spikes, the thing being measured.
- **Interpolating GPS or bridging gaps** (explicitly out of scope).
- **`innerHTML` for popups/tooltips with data**: use DOM nodes (project convention; Leaflet `bindPopup` accepts an `HTMLElement`; `bindTooltip` too).
- **Using CSS `var()` in canvas colours**: resolve tokens once with `getComputedStyle`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cursor/zoom sync across charts | Custom event bus on mousemove | uPlot `cursor.sync.key` | Built in, handles scale sync + cursor |
| Peak-preserving rendering | LTTB / own min-max decimation | uPlot's native per-pixel min/max path builder | Already preserves extremes, tested at 100k+ pts |
| Heat rendering | Own canvas gradient code | leaflet.heat | Locked, 2 KB |
| Time axis formatting/timezone | Own tick generator | uPlot `time:true` + `tzDate` + `axes[0].values` override with `format.js` | Ticks at nice time boundaries |
| Map popups/tooltips/click hit-testing | Custom overlays | Leaflet `bindPopup`/`bindTooltip`/polyline events | Edge cases (pan, close, z-order) |
| Collapsible group | JS accordion | `<details>` | Native, a11y |
| Gap detection data | Per-series path hacks | Null rows in data | uPlot `spanGaps:false` default |

**Key insight:** the data are small (105 fixes, ~100 markers, 23k rows); correctness of the derivations (masks, gap rows, fix lookups) matters more than rendering performance, so put every derivation in pure, node-tested functions.

## Common Pitfalls

### Pitfall 1: Vendor files missing / paths
**What goes wrong:** `site/vendor/` is absent today; pages deploy `site/` as-is, so uncommitted vendor files => blank map/charts in production. `leaflet.css` references `images/` (layers, markers) which would 404 if used.
**How to avoid:** Task 1 vendors and commits; add a pytest in `tests/test_site_static.py` style asserting each vendor file referenced by `index.html` exists and `vendor/README.md` lists the three pinned versions. Use only circleMarkers/custom control (no default icon, no layers control).
**Warning signs:** `L is not defined` / `uPlot is not defined` in console.

### Pitfall 2: Charts inside closed `<details>` have zero width
**What goes wrong:** uPlot created while hidden gets width 0/NaN. **How to avoid:** create secondary charts on first `toggle` (open) event; `setSize` on each open and on `ResizeObserver`.

### Pitfall 3: Cursor sync feedback / duplicate emits
**What goes wrong:** with `cursor.sync`, `setCursor` hook fires for each chart; map position marker updated 7 times per mousemove, and programmatic `setCursor` from a map click can re-trigger selection. **How to avoid:** single hover emitter (dedupe by last row) and separate hover vs select channels; rAF-throttle map updates.

### Pitfall 4: idx vs row mismatch after inserting gap rows
**What goes wrong:** `u.cursor.idx` indexes the augmented arrays; using it as a run row gives wrong GPS lookups. **How to avoid:** keep `rowOfIdx` map (Int32Array, -1 for synthetic) produced by `chartData()` and unit-test it.

### Pitfall 5: Zoom reset on `setData`
**What goes wrong:** `u.setData(d)` default `resetScales=true` re-fits x, losing user zoom (violates "filter does not zoom the charts"). **How to avoid:** `setData(d, false)`; only the explicit reset button / map click change x scale.

### Pitfall 6: Medido threshold lines wrong
**What goes wrong:** using `±t` in medido mode (AZ rest is about -1 g, i.e. median -2018 LSB: lines would not mark the boundaries). **How to avoid:** lines at `off2[k]/4096 ± th2/4096` for medido (per axis); unit test with run 1 medians [94, -38, -2018] LSB (off2 = 2x medians? `restOffset2` returns doubled medians `med2`; `mediansLsb = med2/2`; the offset in g = `off2/4096`).

### Pitfall 7: Unit confusion
`run.ax` is raw LSB at 2048 LSB/g; `dom2`, `off2`, `th2` are doubled-LSB (x2, i.e. 4096/g). Mixed use gives a 2x error. Encapsulate in one helper `toG(run, analysis, axis, i, mode)` and test.

### Pitfall 8: Canvas colours / `var()` and dark fades
Resolve class tokens via `getComputedStyle` once at mount; use pale equivalents (opacity) rather than new tokens for "faded".

### Pitfall 9: Leaflet map in a container sized after layout
Call `map.invalidateSize()` after mount and after the layout settles (the page is a grid with `aside#controls`; map container needs explicit `height:450px; width:100%` in CSS before `L.map()`), otherwise tiles render partially.

### Pitfall 10: leaflet.heat canvas warning / zero-size
`L.heatLayer` throws or renders blank if added while the map has zero size or with an empty latlng set at `max` = 0. Add the layer only when toggled on, and guard empty arrays (`setLatLngs([])` is fine). It also logs a `willReadFrequently` console hint on newer Chrome (harmless, LOW confidence).

### Pitfall 11: OSM tile policy
Tiles require attribution and a valid Referer (GitHub Pages sends one; `file://` preview shows blocked tiles: local preview must use `python -m tools.serve_site`). Do not add `referrerpolicy=no-referrer` to tags/meta.

## Code Examples

(From library knowledge; confirm against the vendored version when implementing.)

### uPlot sync + hooks
```javascript
// Source: uPlot docs (cursor.sync, hooks) — verify against 1.6.32 demos
const opts = {
  width, height: 160, tzDate: (ts) => uPlot.tzDate(new Date(ts * 1e3), 'America/Sao_Paulo'),
  cursor: { sync: { key: 'run' }, drag: { x: true, y: false, setScale: true } },
  scales: { x: { time: true } },
  series: [{}, { label: 'contexto', stroke: '#b0b6bf', width: 1 }, { label: 'AX', stroke: axisColor, width: 1.5 }],
  axes: [{ values: (u, ticks) => ticks.map(fmtTimeSeconds) }, { size: 60 }],
  hooks: { setCursor: [(u) => { const i = u.cursor.idx; link.emitHover(i == null ? null : rowOfIdx[i]); }],
           draw: [(u) => drawThresholds(u)] },
};
const u = new uPlot(opts, [xs, ctxY, maskedY], el);
u.setData([xs, ctxY, maskedY], false); // keep zoom
```

### Programmatic zoom + cursor (map click)
```javascript
for (const u of charts) u.setScale('x', { min: x - 30, max: x + 30 });
requestAnimationFrame(() => { for (const u of charts) u.setCursor({ left: u.valToPos(x, 'x'), top: 10 }); });
```

### Leaflet pieces
```javascript
const map = L.map(el, { preferCanvas: true });
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
const heat = L.heatLayer([], { radius: 15, blur: 9, max: 1 }); // add to map only when toggled on
heat.setOptions({ radius, blur: Math.round(radius * 0.6), max: 1 }); heat.setLatLngs(pts); // pts: [lat, lon, weight]
L.circleMarker([lat, lon], { radius: 6, color: '#fff', weight: 1, fillColor: css, fillOpacity: 0.9 }).bindPopup(domNode);
```

### Pure core derivation shape (testable)
```javascript
// core/geo.js
export function trackSegments(run, mask, maxFixGapMs) { /* -> [{sentido, matched, latlngs:[[lat,lon]], fixFrom, fixTo}] */ }
export function pontoMarkers(run, analysis, view) { /* -> [{row, fix, lat, lon, cls, nImpactos, ax,ay,az (g dinamico)}] ; unplaced separate */ }
export function heatPoints(run, analysis, view, metric, intensity) { /* -> [[lat, lon, w]] one per fix, w in [0,1] */ }
export function unplacedCount(run, view) {}
// core/series.js
export function chartData(run, analysis, view, valueMode, axis) { /* -> {x, all, masked, rowOfIdx} */ }
export function thresholdLines(analysis, valueMode, axis) { /* -> [{cls, value}] +/- */ }
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Leaflet 2.x alpha | Stay on 1.9.4 | Locked; 2.x is alpha/ESM-only |
| leaflet.heat unmaintained since 2019 | still works with 1.9.4 | Accept; API stable |
| uPlot tz via `tzDate` | same | Needed for America/Sao_Paulo ticks |

## Open Questions

1. **What does "N eventos sem GPS" count?** CONTEXT says "eventos", map shows pontos. Recommendation: count **pontos de impacto** in the current view with `locId < 0` (these are exactly the ones that cannot be markers), label "N pontos de impacto sem GPS"; planner to confirm wording with user in plan-check, low risk. (run 1: 2,020 rows without GPS; pontos without GPS keyed per trecho.)
2. **Track break rule.** Recommended: break at sentido change or fix-to-fix gap > `meta.workbook_defaults.max_fix_gap_s` (120 s). Run 1: breaks at 319 s, 593 s and the sentido boundary. Short tunnel stretches (< 120 s) stay connected by a straight line between fixes (not interpolated data, just the polyline). Confirm visually during verify.
3. **`resDin` formula** and `HEAT_METRICS` semantics live in `core/stats.js`/`T.dResDin` (not inspected); reuse, do not redefine.
4. **uPlot API details** (dist file names, `setCursor` after `setScale` timing, `points.show` signature) are from training knowledge; implementer must check against the vendored 1.6.32 source/demos (HIGH-impact only for the map-click zoom+cursor; verify manually).
5. **Performance of 7 canvases x 23k rows x 2 series on each threshold edit.** Data rebuild only on `valueMode`/params/mask change; mask changes on every filter toggle. Expected tens of ms; measure with `performance.now()` like Phase 11, coalesce with rAF if > 50 ms.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 24 local, 24 in CI) for JS core; pytest 8 for static site checks |
| Config file | none for Node (no package.json); `pytest.ini` for pytest |
| Quick run command | `node --test "tests/js/*.test.js"` |
| Full suite command | `python -m pytest` and `node --test "tests/js/*.test.js"` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHART-01 | `chartData` medido vs dinâmico values per axis (known rows of run 1; medido = lsb/2048; dinâmico = (2*lsb-off2)/4096) | unit | `node --test tests/js/series.test.js` | ❌ Wave 0 |
| CHART-02 | `thresholdLines`: dinâmico ±th2/4096, medido offset by off2/4096 per axis; data arrays contain global max/min (no decimation); static check that no decimation code exists | unit | `node --test tests/js/series.test.js` | ❌ Wave 0 |
| CHART-03 | gap row inserted where dt > maxJumpMs (run 1: exactly 1 at turnaround), invalid rows null, `x` strictly increasing, `rowOfIdx` -1 for synthetic | unit | `node --test tests/js/series.test.js` | ❌ Wave 0 |
| CHART-04 | `channels` decode (vel/disp/freq scaled by `scale`, temp single series); secondary chart data aligned with same x/gap rows; `<details>` exists closed by default in index.html | unit + pytest static | `node --test tests/js/series.test.js`; `pytest tests/test_site_static.py` | ❌ Wave 0 |
| CHART-05 | all chart option objects use the same `cursor.sync.key` (factory function `chartOptions()` is pure, export and assert) | unit | `node --test tests/js/series.test.js` | ❌ Wave 0 |
| MAP-01 | `trackSegments` run 1: breaks at the two >120 s gaps and sentido change; segment sentido labels; mask splits into matched/unmatched | unit | `node --test tests/js/geo.test.js` | ❌ Wave 0 |
| MAP-02 | stations present with lat/lon (14), `decodeRun` exposes `fixLat/fixLon` (105) | unit | `node --test tests/js/geo.test.js` | ❌ Wave 0 |
| MAP-03 | `pontoMarkers` count equals `view.pontos` minus unplaced (run 1 default: ~99 placed); class = worst; popup fields; nImpactos sums to placed impacts; Google Maps URL format | unit | `node --test tests/js/geo.test.js` | ❌ Wave 0 |
| MAP-04 | `heatPoints`: <= 105 points, weights in [0,1], fixed scale independent of filters (same fix, same weight under different unrelated filters), metric switch | unit | `node --test tests/js/geo.test.js` | ❌ Wave 0 |
| MAP-05 | `unplacedCount` equals pontos with locId<0; changes with filter | unit | `node --test tests/js/geo.test.js` | ❌ Wave 0 |
| MAP-06 | derivations are pure functions of `(run, analysis, view)`: changing filters/thresholds changes outputs (assert marker/segment/heat differences for a class filter and a threshold change) | unit | `node --test tests/js/geo.test.js` | ❌ Wave 0 |
| SYNC-01 | `rowToFix` / `priorFix` (hover: fix -1 returns prior fix + `noGps` flag; before first fix returns null); `fixToRow` / nearest-fix lookup (click); zoom window ±30 s helper `zoomWindow(x)` | unit | `node --test tests/js/geo.test.js` | ❌ Wave 0 |
| (infra) | vendor files exist, referenced relatively from index.html, README lists pinned versions; `#map` before `#charts` before `#classes`; `core/` still pure; no `innerHTML` in new panels | pytest static | `pytest tests/test_site_static.py -x` | ❌ Wave 0 (extend existing file) |
| (visual) | zoom/cursor feel, tiles load, popup look, hover marker, faded track, heat toggle, "Mais canais" open/close, drag-zoom keeps peaks | manual-only (browser; no headless browser infra in repo) | `python -m tools.serve_site` then manual checklist | n/a |

### Sampling Rate
- **Per task commit:** `node --test "tests/js/*.test.js"` (plus `pytest tests/test_site_static.py` when touching html/vendor)
- **Per wave merge:** `python -m pytest` and the full node suite
- **Phase gate:** both full suites green + manual browser checklist before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/js/series.test.js` — CHART-01..05 (needs the extended `decodeRun`)
- [ ] `tests/js/geo.test.js` — MAP-01..06, SYNC-01 lookups
- [ ] Extend `tests/test_site_static.py` — vendor files, section order, `<details>` closed, README versions
- [ ] Extend existing data/decode tests for the new `run.fixLat/fixLon/priorFix/channels` fields (ensure golden/parity tests unaffected: they use only cls/impacts)
- [ ] No new framework install needed

## Sources

### Primary (HIGH confidence, verified this session)
- Repo code: `site/js/core/{data,view,engine,events,dynamics,classify,defaults}.js`, `site/js/app/{state,main,dom,panels/classes,panels/controls}.js`, `site/index.html`, `site/css/app.css`, `tests/test_site_static.py`, `tests/js/*`, `.github/workflows/pages.yml`
- `site/data/run-2026-10-02-l4-t102.json` structure and statistics (23,383 rows; 105 fixes, 99 unique coordinates; 14 stations with lat/lon; one dt gap of 566 s; fix gaps 319 s / 593 s)
- npm registry: uplot 1.6.32, leaflet 1.9.4 (v1 line), leaflet.heat 0.2.0 current
- `.planning/research/STACK.md`, `12-CONTEXT.md`, `REQUIREMENTS.md`

### Secondary (MEDIUM/LOW, training knowledge, not re-verified in Context7)
- uPlot API (cursor.sync, hooks.setCursor, setScale, valToPos, tzDate, null gaps, setData resetScales, per-pixel min/max path builder)
- Leaflet 1.9 API (circleMarker, bindPopup with HTMLElement, preferCanvas), leaflet.heat options (`radius`, `blur`, `max`, `setLatLngs`, `setOptions`)
- OSM tile usage policy (attribution, referer)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (locked; versions confirmed on npm)
- Architecture: MEDIUM-HIGH (grounded in actual code and data; library calls from memory)
- Pitfalls: MEDIUM (repo-derived ones HIGH: vendor missing, decodeRun gaps, unit confusion; uPlot timing ones MEDIUM)

**Research date:** 2026-10-13
**Valid until:** 2026-11-12 (stable libraries)
