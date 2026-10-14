# Phase 15: PDF Report Generation - Research

**Researched:** 2026-10-14
**Domain:** Client-side PDF generation (vanilla ES modules, no build step) plus canvas rasterisation of a Leaflet/OSM map
**Confidence:** HIGH on library choice, glyph limits, OSM CORS and project wiring (all verified by running code or headers). MEDIUM on the exact heat visual parity and on the tile-volume policy question.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Carried forward (already locked)
- Portuguese UI. Every new control gets an (i) info button with text in `INFO` (`i18n.js`). Desktop only. No backend and no CDN: any new library is vendored in `site/vendor/` with its version in `site/vendor/README.md` (Phases 11–12).
- Class colour tokens `--normal`…`--critico`. IQ bands: ≥ 98 % Bom, 90–98 % Regular, < 90 % Ruim (Phase 13).
- Uploaded data can't be shared by link (Phase 14). The PDF is how an uploaded run gets shared.

#### Report contents
- **Included, in page order:** report header → KPI summary (IQ card with its band, registros, eventos, impactos, pontos) → **map with the heat layer** → **both matrices** (one per sentido) → **trecho table** → **pontos top-50 table**.
- "Heatmap" means **both** the map heat layer and the colour-shaded matrices.
- **Not included:** the time-series charts (AX/AY/AZ and Mais canais), the classes/stats/quality panels and the "conforme planilha" badge (omitted even for the bundled run).

#### Capture fidelity
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

#### Data state
- **Full run, no filters.** Every filter (sentido, trecho, classe, eixo, time window) is ignored, so the report always covers the whole loaded run.
- **The parameters currently set are used:** thresholds, offset mode and values, gap, time-jump split, GPS max speed and interval. Edited parameters carry into the report.
- **The matrix basis** (impactos / medições / pontos) and **the pontos table sort** follow what is currently selected on screen.
- The top 50 is still the worst 50 by |dom| over the full run, displayed in the current sort (same rule as the page).
- The report includes a **short method note** listing the parameters used, e.g. "Limites 0,5 / 1 / 2 / 4 g; offset mediana; agrupamento 0; corrida completa, sem filtros". There is no separate filter disclosure, because the report never has filters.
- **Uploaded data:** the report covers the uploaded run, marked **"Dados enviados"** with the uploaded file names and row count.

#### Layout and delivery
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

### Deferred Ideas (OUT OF SCOPE)
None. The discussion stayed within the phase scope. (New dashboard views, scheduled reports and emailing are out of scope per the phase boundary.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REPORT-01 | "Gerar PDF" downloads a PDF report of the run currently on screen (bundled run 1 or uploaded CSV): KPIs, map with heat, both matrices, trecho table, top-50 pontos table; browser-only, pt-BR | jsPDF 4.2.1 + jspdf-autotable 5.0.8 (vendored UMD, verified in node), manual canvas map compositor (OSM tiles send `access-control-allow-origin: *`), pure report model reusing `trechoRows`/`pontoRows`/`buildMatrix`/`qualityIndex`, glyph sanitiser (→ − ≥ ≤ break in standard fonts) |
</phase_requirements>

## Summary

Use **jsPDF 4.2.1 + jspdf-autotable 5.0.8**, vendored as the two prebuilt UMD minified files (`jspdf.umd.min.js` 420 KB, `jspdf.plugin.autotable.min.js` 32 KB), both MIT, both older than two weeks (jsPDF published 2026-03-17, autotable 2026-05-17). I ran both under Node 24 (`require` of the exact UMD files) and confirmed: A4 landscape, per-cell `fillColor`/`textColor`, header repeated on every page, 80-row table breaking across 3 pages in 39 ms, `doc.link()` annotations from a `didDrawCell` hook, "Página i de N" via a second pass with `setPage`, and `doc.output('blob')`. So a real PDF smoke test can run in `node --test` without a browser. pdf-lib (last release 2022) has no table layout; pdfmake 0.3.11 needs a VFS font bundle and is much larger. Reject both.

The **only real PDF-text hazard** is glyph coverage. jsPDF's standard Helvetica maps through WinAnsi. Verified by rendering each character: `á ç × – — … · µ ± ° |` are fine; **`→` (U+2192), `−` (U+2212), `≥`, `≤`, U+2011 are corrupted** (emitted as UTF-16 garbage). The bundled run's sentido names are `Sentido 1 — Terminal Gentileza → Praça XV` and every OSM route name contains `→`, so a `pdfText()` sanitiser is mandatory (`→` becomes `>`, U+2212 becomes `-`, `≥` becomes `>=`, `≤` becomes `<=`, U+2011 becomes `-`). Do not embed a TTF (adds hundreds of KB for four characters).

For the **map**, do not use leaflet-image / html2canvas / html-to-image, and do not reuse the live map. Build a small **manual canvas compositor**: pure Web-Mercator maths (node-testable), tiles fetched as `Image` with `crossOrigin='anonymous'` (verified with curl: `tile.openstreetmap.org` returns `access-control-allow-origin: *`, so the canvas is not tainted), routes/stations/ponto markers drawn with canvas 2D, and heat drawn with `window.simpleheat`, which leaflet-heat.js already exposes as a global. That gives deterministic 2× output, never touches the live map, and degrades cleanly (no tiles: white background + route + heat + note).

**Primary recommendation:** `site/vendor/jspdf/` + `site/vendor/jspdf-autotable/` (lazy-loaded by script injection on first click) → pure `site/js/app/report.js` (model, colours, strings, filename, `pdfText`) → `site/js/app/mapshot.js` (canvas compositor with pure helpers) → `site/js/app/pdf.js` (jsPDF renderer taking injected `{jsPDF, autoTable}`) → `site/js/app/panels/report.js` (button + (i) + busy/warning UI) wired from `main.js`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jsPDF | 4.2.1 (2026-03-17, MIT) | PDF document, text, shapes, JPEG embed, link annotations | Dominant browser PDF lib, single UMD file, runs in node for tests. Verified `dist/jspdf.umd.min.js` sha256 `e6551fcdc32f09d6853b2c5126d18d01d9447e0da618a41a11ebeee0f6c20d54` |
| jspdf-autotable | 5.0.8 (2026-05-17, MIT) | Table layout: per-cell fills, repeated headers, page breaks, column widths, hooks | De facto jsPDF table plugin; peer `jspdf ^2 \|\| ^3 \|\| ^4`. `dist/jspdf.plugin.autotable.min.js` sha256 `a65dff2c6a8296b16aff24e69f7683cd7dbaed4a4ec26b507d6840ee27d54649` |
| simpleheat | bundled in leaflet-heat 0.2.0 (already vendored, exposes `window.simpleheat`) | Heat rendering on the capture canvas | Same renderer as the on-screen heat layer, so visual parity |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Leaflet 1.9.4 | already vendored | Only for the live map; the capture does NOT use it | n/a (capture uses own Mercator maths) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsPDF + autotable | pdfmake 0.3.11 | Declarative tables but needs a font VFS file (~MBs), larger; link/cell hooks less direct. Rejected |
| jsPDF + autotable | pdf-lib 1.17.1 | No table engine, last release 2022. Rejected |
| Manual compositor | leaflet-image 0.4.0 (2022) | Reads Leaflet private internals, no heat/scale support. Rejected |
| Manual compositor | html2canvas 1.4.1 / html-to-image 1.11.13 | Rasterises the DOM incl. controls and tiles; fights CSS transforms, would capture the user's view; cannot force refit/2×. Rejected |
| Manual compositor | Hidden second `L.map` + composite | Needs `layer._tiles` private API, waits for tile events, leaflet.heat canvas is 1× (no retina scaling, radius in CSS px), would need refactoring the monolithic `mountMap`. More moving parts than ~150 lines of canvas code |
| Standard font + sanitiser | Embedded TTF (e.g. DejaVu) | Covers → ≥ −, but +0.5–0.7 MB vendored and base64 in VFS. Not worth it |

**Installation (vendoring, same procedure as `site/vendor/README.md`):**
```bash
# in an empty temp dir
npm pack jspdf@4.2.1 jspdf-autotable@5.0.8
# extract; copy WITHOUT .map files:
#   package/dist/jspdf.umd.min.js        -> site/vendor/jspdf/jspdf.umd.min.js
#   package/LICENSE                      -> site/vendor/jspdf/LICENSE
#   package/dist/jspdf.plugin.autotable.min.js -> site/vendor/jspdf-autotable/jspdf.plugin.autotable.min.js
#   package/LICENSE.txt                  -> site/vendor/jspdf-autotable/LICENSE   (autotable names it LICENSE.txt)
# then add rows + sha256 lines to site/vendor/README.md
```

## Architecture Patterns

### Recommended Project Structure
```
site/vendor/jspdf/                 # jspdf.umd.min.js + LICENSE
site/vendor/jspdf-autotable/       # jspdf.plugin.autotable.min.js + LICENSE
site/js/app/report.js              # PURE (no DOM/window): model, colours, strings, filename, pdfText
site/js/app/mapshot.js             # browser: canvas compositor; pure helpers exported for tests
site/js/app/pdf.js                 # renderer; takes { jsPDF, autoTable } injected; returns Blob
site/js/app/panels/report.js       # "Gerar PDF" button + infoBtn + busy/warning/error feedback
tests/js/report.test.js            # model, formatting, filename, method note, pdfText, colours
tests/js/mapshot.test.js           # Mercator/fit/tile-plan/heat-grid pure maths
tests/js/pdf_smoke.test.js         # require vendored UMD in node, render model, assert pages/links/bytes
tests/test_site_static.py          # + report wiring/vendor/no-network checks
```
Note: CONTEXT suggested `core/report.js`, but the model needs `app/format.js`, `app/i18n.js` (`T`) and colour constants, and `core/` is statically guarded to be independent of app/DOM. Put the pure model in `app/report.js` (same status as `app/csv.js`, `app/format.js`: pure, node-tested, no `document`/`window`). Add a static check that `report.js` and `pdf.js` contain no `document`/`window`/`fetch(`.

### Pattern 1: Getting the "full run, current params" model
**What:** The report must not read the on-screen `ctx.view` (it carries filters). Take only the latest `ctx.run`, `ctx.analysis`, `ctx.state` (params, ui.matrixBasis, ui.rankSort, display heat settings) and recompute with empty filters.
**Key facts verified in code:**
- `ctx.run` in `main.js update()` is the **GPS-filtered** run (`applyGpsFilter(run, params.gps)`), and `ctx.analysis` is memoised by `paramsKey`. Both already reflect the current params. Add a module-level `let currentCtx` in `main.js` set at the end of `update()` (or have the report button's getter call the same memo path). The report then does no analysis of its own; it is cheap.
- Filters are plain `{}`: `normalizeFilters` fills defaults, so `buildView(run, analysis, {})`, `trechoRows(run, analysis, {})`, `buildMatrix(run, analysis, {}, basis)` all give full-run results. `trechoRows` `selected` is false for all rows (good, no highlight).
- Matrix basis = `state.ui.matrixBasis`; pontos sort = `state.ui.rankSort` (both live in the store `ui`, not panel-local). Pontos: `sortPontos(topPontos(pontoRows(run, analysis, fullView), 50), state.ui.rankSort)`; title via `topPontosTitle(top.length, all.length)`.
- IQ: `qualityIndex(fullView.classCounts)` returns `{value, band, n}`; band strings `bom|regular|ruim`; labels `T.iqBom|iqRegular|iqRuim`. KPI numbers from `fullView.registros/eventos/impactos/pontos` (same as `overview.js`).
- Map points: `pontoMarkers(run, analysis, fullView)` and `heatPoints(run, analysis, fullView.mask, display.heatMetric, display.intensity)` (the mask must be the full-run mask from `fullView`).
- Run metadata: title `run.meta.title`; period `epochMs(run, 0)` .. `epochMs(run, run.n-1)` (`core/series.js`), formatted with `fmtDateTime`; uploaded flag `run.meta.uploaded === true` (also `isShareable(run)` is its negation); file names and per-file rows are in `run.meta.source.files[] = {name, sha256, rows, ...}` for both bundled and uploaded runs; total rows `run.meta.n`. No need to touch the `uploadInfo` WeakMap in `main.js`. File name: `relatorio-${run.meta.run_id}.pdf` (same fallback `'corrida'` as `csvFilename`; add `reportFilename(run)` to `report.js`).
- Method note: from `state.params`: `thresholds_g` (join with " / " using `fmtThreshold`), `offset.mode` (`median` -> "mediana"; `manual` -> values `offset.g` formatted), `gap`, `maxJumpMs/1000`, `gps.maxSpeedKmh`, `gps.maxFixGapS`; always end with "corrida completa, sem filtros".

### Pattern 2: Report model is plain data, renderer is dumb
`buildReport(ctxLike, { now })` returns `{ filename, header:{title, subtitle, period, generatedAt, uploaded:{files,rows}|null}, kpis:[{label,value,note,band}], methodNote, matrices:[{name, head:[...], rows:[[{text, fill:[r,g,b], color:[r,g,b]}...]]}], trechos:{head, rows}, pontos:{title, head, rows(with url)} , map:{...inputs} }`. All colours are RGB arrays decided in `report.js` (testable); `pdf.js` only maps them to jsPDF calls. Inject `now` so "Gerado em" is deterministic in tests.

### Pattern 3: Page colours as constants with a drift test
Class colours `['#2e7d32','#f9a825','#ef6c00','#c62828','#6a1b9a']`, IQ band colours (bom `--normal`, regular `#b26a00`, ruim `--severo`), priority pills (`.lvl-1` critico, `.lvl-2` severo, `.lvl-3` moderado, `.lvl-4` leve with dark text `#1f2933`, others muted `#6b7280` on white text), "sem Crítico" badge (`#e5e7eb` bg, `#374151` text), muted `#6b7280`. Define as constants in `report.js` and add a **static test** (Python) that parses `app.css` and asserts the same hex values, so the PDF cannot drift from the page. (Do not read computed CSS at runtime; keeps the model pure and node-testable.)

### Pattern 4: Matrix cell shading identical to the page
Page rule (`panels/matrix.js`): `share = round(100 * n / colMax[c])`; background `color-mix(in srgb, classColor share%, white)`; text white if `share > 55`. In PDF: `rgb = round(c*share/100 + 255*(1-share/100))` per channel (`mixWhite(rgb, share)` in `report.js`), `textColor` white if `share > 55`, else the text colour. Right-align numbers, total column plain. Show the `caption` (sentido name, sanitised) as a bold line above each table. `buildMatrix` columns: for `medicoes` includes Normal (class 0); for the others classes 1..4.

### Pattern 5: Tables via autotable (function form)
```js
// Source: verified in node against jspdf 4.2.1 / jspdf-autotable 5.0.8 (UMD min files)
const { jsPDF } = window.jspdf;            // browser global set by jspdf.umd.min.js
const autoTable = window.autoTable;        // set by the plugin UMD when loaded as a classic script (verify at implementation; in node: require(...).autoTable)
const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }); // 841.89 x 595.28 pt
autoTable(doc, {
  head: [headCells], body: rows, startY,
  margin: { left: 28, right: 28, top: 52, bottom: 36 },  // leave room for header/footer band on every page
  showHead: 'everyPage',                                   // header repeats on continuation pages
  styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
  headStyles: { fillColor: [244, 245, 247], textColor: [31, 41, 51], fontStyle: 'bold' },
  columnStyles: { 0: { halign: 'right', cellWidth: 28 } },
  // per-cell colours: body cell as { content, styles:{ fillColor:[r,g,b], textColor:[r,g,b] } }
  didDrawCell(d) {
    if (d.section === 'body' && d.cell.raw && d.cell.raw.url) {
      doc.link(d.cell.x, d.cell.y, d.cell.width, d.cell.height, { url: d.cell.raw.url });
    }
  },
});
const y = doc.lastAutoTable.finalY;        // autoTable() itself returns undefined; use doc.lastAutoTable
```
Verified: an 80-row table produced 3 pages in 39 ms and 160 `/URI` entries (80 links). A custom `url` property on the cell object survives into `d.cell.raw`.

### Pattern 6: Page chrome in a second pass
After all content: `const n = doc.getNumberOfPages(); for (i=1..n) { doc.setPage(i); draw "Relatório de impactos · <title>" (left), "Gerado em dd/mm/aaaa hh:mm" and "Página i de N" (right, `align:'right'`) }`. Reserve top/bottom margins in every autotable call so tables never overlap the chrome. Page 1 has the bigger header block (title, period, Dados enviados line, method note) drawn in the first pass.

### Pattern 7: Matrices side by side with a fit check
Two sentido tables as on the page: same `startY`, `margin:{left:28,right:420}` and `margin:{left:420,right:28}` (or `tableWidth`). Because a table splitting across pages while its sibling doesn't would misalign, precompute `needed = (maxRows + 2) * rowHeight + captionHeight`; if `startY + needed > pageHeight - bottomMargin` call `doc.addPage()` first. If a run has a single sentido block, draw one table at full width.

### Pattern 8: Map capture (manual compositor, no live-map contact)
Module `mapshot.js`:
1. **Inputs (no DOM reads):** `{ points (fix lat/lon + stations, same set mountMap uses for fitBounds), routes (GeoJSON features), stations, markers (pontoMarkers output), heat ([lat,lon,w] from heatPoints), heatOpts {radius, blur, minOpacity:0.3, max:1}, classColors, sentidoColors, size {w,h}, pixelRatio:2 }`.
2. **Pure helpers (node-tested):** `project(lat, lon, zoom)` (Web Mercator, 256-px tiles; clamp lat ±85.0511), `fitZoom(bounds, w, h, padding)` (fractional), `tilePlan(centerPx, w, h, zoom, ratio)` (tile x/y list, wrap x mod 2^z, clamp y, cap count), `mixWhite`, and the **heat grid merge** (below).
3. **Zoom/tiles:** logical fit zoom `zf` for a CSS-size box (e.g. 1000x420 css px, matches the PDF box aspect), canvas = 2x that. Draw tiles at integer `zt = clamp(round(zf) + 1, 0, 19)` scaled by `2^(zf + 1 - zt)` (+1 because the canvas is 2x: this gives retina-like sharpness). Cap total tiles (about 80); if the plan exceeds it use `zt = round(zf)` (tiles scaled up 2x, blurrier but few requests).
4. **Fetch tiles:** `new Image(); img.crossOrigin = 'anonymous'; img.src = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'` (same URL template as `map.js`; HTTPS only). Per-tile timeout ~8 s, `Promise.allSettled`, concurrency not above ~6 (OSM allows modest parallelism; browsers cap at 6 per host on HTTP/1.1 anyway). A failed tile is left as a light-grey square. If more than half fail (or all), flag `basemapFailed` and fill white instead.
5. **Draw order (matches live map z-order):** background/tiles → routes (alpha/dash/colour as `map.js`: `SENTIDO_COLORS ['#1565c0','#5d4037']`, weight 5/opacity 0.55 for a single line, 3/0.3 for four, second sentido dashed `10 6`; scale widths by pixelRatio) → heat (own offscreen canvas via `new window.simpleheat(canvas)`, `radius(r*2, blur*2)`, `max(1)`, `data(pts).draw(0.3)`, composite with `drawImage`) → station circles (r4, `#37474f` stroke 1.5, white fill) → ponto markers (radius `5 + 1.5*cls`, white 1-px stroke, class fill, 0.95 alpha, ordered by class ascending as `pontoMarkers` already sorts) → attribution text bottom-right on the raster ("© OpenStreetMap contributors", OSM policy requires visible attribution).
6. **Heat parity detail:** leaflet.heat (maxZoom 0, max 1) merges points that fall in the same grid cell of size `r/2` (`r = radius + blur`) by summing weights (capped at `max`) and averaging positions, then simpleheat draws each with `globalAlpha = max(w/max, minOpacity)`. Reproduce that merge (about 12 lines, pure, testable) before calling `simpleheat.data(...)`, using 2x radius and blur. Radius/blur follow the page: `radius = state.display.radius`, `blur = Math.round(radius*0.6)` (as `heatOptions` in `map.js`), scaled by `pixelRatio`.
7. **Output:** `canvas.toDataURL('image/jpeg', 0.9)` (opaque basemap; a few hundred KB vs several MB for PNG, and jsPDF's JPEG path is a straight embed with no re-encode). Fill white first so failed-basemap output is opaque. `doc.addImage(dataUrl, 'JPEG', x, y, w, h)`.
8. **Legend and notes drawn as PDF vector/text**, not in the raster: sentido swatches (text sanitised, `→` becomes `>`), class dots, "sem GPS" note (`semGpsNote(...)` from `unplacedCounts(run, analysis, fullView)`), GPS-rejected note (`gpsRejectedNote`), and on failure "Mapa base indisponível; rota e calor sem fundo".
9. **Routes data:** `mountMap` fetches `data/routes/linha-N-sentido-S.geojson` into Leaflet layers and does not keep the features. Expose them from the map handle (for example `getRouteFeatures()` returning the loaded GeoJSON array, `[]` until loaded) instead of re-fetching, and also expose nothing else from the live map. Do not call anything that moves the live view; `mapshot` never receives the Leaflet map object, so "on-screen map unchanged, heat toggle unchanged" holds by construction (nothing to restore).
10. **Pixel budget:** 2000x840 canvas is about 6.7 MB of RGBA; fine. Revoke nothing (data URL). Browsers limit canvas to well above this.

### Pattern 9: Lazy library load + injected dependencies
`panels/report.js` on first click (not at page load) injects `<script src="vendor/jspdf/jspdf.umd.min.js">` then the autotable script, awaiting `onload` (classic scripts work from `file://`). On `onerror` show the Portuguese error and leave the page untouched. Avoid `import()` (static guard forbids it in strict files and the vendored files are UMD anyway). This keeps first paint unchanged (about 450 KB not downloaded for visitors who never click). `pdf.js` itself takes `{ jsPDF, autoTable }` as arguments, which is what makes the node smoke test possible.

### Pattern 10: Button behaviour
Mount once in `<span id="report">` in `<header class="top">` (after `#upload`), like `mountShare`: button `.share-btn`-styled (or a new `.report-btn` rule with the same look) + `infoBtn('report', T.report)` + an `aria-live` feedback span. Click: disable, text `T.reportBusy` ("Gerando PDF…"), `await new Promise(r => setTimeout(r, 0))` so the label paints, generate, download (`downloadBlob(blob, filename)` in the style of `downloadCsv`: object URL + `<a download>` + deferred revoke), re-enable in `finally`. Partial failure: `result.warnings` non-empty shows `T.reportMapWarning` in the feedback/notice area; throw means `T.reportError` and nothing else changes. Guard against double clicks. Enabled for example and uploaded runs (no `isShareable` coupling). The getter returns the latest `currentCtx`; if null (no run mounted) leave the button disabled.

### Anti-Patterns to Avoid
- **Reading `ctx.view` or `state.filters` in the report:** would leak filters. Always rebuild with `{}`.
- **Using `base run` instead of `ctx.run`:** ignores the GPS speed/fix-gap params (`applyGpsFilter`). Use the `ctx.run` that already went through it.
- **Capturing the live map / toggling its heat checkbox:** violates "left exactly as it was" and races tile loading and animation. Capture from data only.
- **Embedding the raster at CSS resolution:** the 2x requirement is canvas pixels, not `devicePixelRatio`; set the canvas to `2*w x 2*h` explicitly so it is deterministic across displays.
- **Passing unsanitised strings to jsPDF:** always `pdfText()`; sentido/route/trecho names contain `→` and `—`.
- **Calling `doc.html()`, `doc.addImage(url)` or `addFont(url)`:** those use XMLHttpRequest/html2canvas paths inside jsPDF. We only pass data URLs and text, so no network use arises from the library.
- **`doc.save()`:** works, but use `doc.output('blob')` + own download so the Blob path is testable and consistent with the CSV pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table layout, wrapping, page breaks, header repeat | Manual row/y bookkeeping | jspdf-autotable `showHead:'everyPage'`, `pageBreak:'auto'` | Wrapping and splitting rows across pages is the bulk of the complexity |
| PDF byte generation, link annotations, page numbers | Raw PDF writer | jsPDF `link()`, `setPage()`, `getNumberOfPages()` | Verified working |
| Heat blob rendering | Own gaussian/gradient code | `window.simpleheat` (already vendored) | Identical look to on-screen heat |
| pt-BR number/date formatting | New Intl wrappers | `fmtInt/fmtG/fmtPct/fmtDateTime/fmtThreshold` from `app/format.js` | Already covered by tests; includes America/Sao_Paulo |
| Top-50, sorting, matrix, IQ | Re-deriving | `topPontos`, `sortPontos`, `pontoRows`, `trechoRows`, `buildMatrix`, `qualityIndex` | Page parity; same numbers as the screen and CSV |
| Download trigger | New mechanism | Copy `downloadCsv` pattern with a Blob of `application/pdf` | Proven in phase 13 |

**Key insight:** the new code is glue (model, colours, canvas compositing). The two risky areas that look easy but are not are (1) glyph coverage of the standard fonts and (2) heat/tile parity, so both get pure, tested helpers.

## Common Pitfalls

### Pitfall 1: Glyphs outside WinAnsi are silently corrupted
**What goes wrong:** `→`, `−`, `≥`, `≤`, U+2011 render as garbage (jsPDF falls back to UTF-16 bytes in a standard font); no error is raised.
**Why:** Helvetica standard font = WinAnsi only. Verified by rendering each char: fine = `á ç × – — … · µ ± ° |`; broken = `→ − ≥ ≤ ‑`.
**How to avoid:** `pdfText(s)` replaces `→` with `>` (or " > "), U+2212 with `-`, `≥` with `>=`, `≤` with `<=`, U+2011 with `-`, then drops any remaining char above U+00FF that is not one of `– — … ‘ ’ “ ” • €`. Apply to every string handed to jsPDF/autotable. Unit test with the bundled run's sentido names and all route names.
**Warning signs:** weird glyphs after "Terminal Gentileza" in the matrix captions or map legend.

### Pitfall 2: Using filtered view or non-GPS-filtered run
**What goes wrong:** report shows filtered counts or ignores the GPS speed param.
**How to avoid:** see Pattern 1; add a node test asserting that `buildReport` over a ctx whose `state.filters` are non-empty gives the same tables as with empty filters, and that changing `params.thresholds_g` changes the output.

### Pitfall 3: Tainted canvas from tiles
**What goes wrong:** `toDataURL` throws `SecurityError`.
**Facts:** `curl -I` on `https://tile.openstreetmap.org/10/383/578.png` with an Origin header returned `access-control-allow-origin: *` and `access-control-allow-methods: GET, HEAD, OPTIONS`. So `img.crossOrigin='anonymous'` yields an untainted canvas (also from `file://`, origin `null`, because `*` allows it). The live `L.tileLayer` has no `crossOrigin`; the capture creates its own Image elements, so no change to `map.js` is needed. If the request still fails (offline, blocked), catch per tile.
**How to avoid:** wrap `toDataURL` in try/catch; on SecurityError rebuild the canvas without tiles and mark `basemapFailed`.

### Pitfall 4: OSM tile policy
**What goes wrong:** Many requests could trip blocking.
**Facts (policy page fetched 2026-10-14):** valid Referer must be sent, attribution must be visible, honour cache headers, no pre-fetching/bulk or headless bots. A single user-initiated capture of roughly 40–80 tiles is comparable to viewing a full-screen map but is a judgement call (the policy says nothing about export/canvas).
**How to avoid:** cap tile count, only on explicit click, no retries storms (one retry at most), attribution on the raster, `strict-origin-when-cross-origin` default Referrer-Policy left untouched. Flag in the manual checkpoint to confirm tile count in DevTools. (MEDIUM confidence on policy interpretation.)

### Pitfall 5: Heat looks different from the screen
**What goes wrong:** saturated or washed out compared with the page.
**Why:** leaflet.heat merges weights per grid cell and uses `minOpacity 0.3`; radius is in screen px.
**How to avoid:** replicate the merge, scale radius/blur by the pixel ratio, same `max:1`, same gradient (default). Manual checkpoint compares side by side with the live map at a similar zoom.

### Pitfall 6: Table breaking over page chrome / orphan titles
**How to avoid:** set `margin.top/bottom` on every autotable call; before drawing a section title + table check remaining height and `addPage()` if less than title + header + ~3 rows; use `didDrawPage` or the second pass for chrome so continuation pages also get it.

### Pitfall 7: Busy state never paints
**How to avoid:** `await` a macrotask (`setTimeout 0`) after setting the label; generation of tables is about 50 ms, the map step is the slow one (tile network).

### Pitfall 8: Generating during an upload swap
**What goes wrong:** user clicks Gerar PDF while a new upload is being mounted (`session.busy()`), and the ctx belongs to the old run.
**How to avoid:** snapshot `currentCtx` once at click time and use only that snapshot (immutable objects); disable the button while `session.busy()` is true or accept the snapshot semantics. Reset `currentCtx = null` in the `mountDashboard` catch path.

### Pitfall 9: Header persistence across remounts
`mountDashboard` replaces section nodes, but `#share`, `#upload` live in the header and persist. Mount the report button once (like `share`), and keep its getter reading the module-level `currentCtx`.

### Pitfall 10: Static test churn
`test_vendor_files_present_and_pinned` currently enumerates vendor files and versions; extend it (and README table/sha256 block) for the two new libs. `test_section_order` only checks `<section>` ids so adding `<span id="report">` in the header is safe.

## Code Examples

### Glyph sanitiser (pure, in report.js)
```js
const MAP = { '→': '>', '←': '<', '−': '-', '‑': '-', '≥': '>=', '≤': '<=' };
export function pdfText(s) {
  return String(s ?? '')
    .replace(/[→←−‑≥≤]/g, (c) => MAP[c])
    .replace(/[^\x00-\xFF–—…‘’“”•€]/g, '?');   // anything else outside WinAnsi
}
```

### Web-Mercator helpers (pure, in mapshot.js)
```js
// Standard slippy-map maths (tile size 256). Verified against Leaflet's EPSG:3857 conventions.
export function project(lat, lon, z) {
  const s = 256 * 2 ** z;
  const la = Math.max(-85.0511287798, Math.min(85.0511287798, lat)) * Math.PI / 180;
  return { x: (lon + 180) / 360 * s, y: (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * s };
}
export function fitZoom(pts, w, h, pad = 20, maxZ = 18) {
  // fractional zoom: largest z where the projected bbox + padding fits (w, h) in css px
  const at = (z) => { const p = pts.map(([la, lo]) => project(la, lo, z)); /* bbox */ };
  /* closed form: z = log2(min((w-2pad)/bboxW0, (h-2pad)/bboxH0)) with bbox measured at z=0 */
}
```
(The closed form is exact because Mercator scales by `2^z`: measure the bbox at z=0 using the 256-px world, then `zf = log2(min((w-2*pad)/bw0, (h-2*pad)/bh0))`, clamped to `[0, maxZ]`. Degenerate bbox, one point or no GPS: use zoom 15 around the point or `fitWorld` equivalent zoom 1.)

### Tile image loader with timeout (browser)
```js
function loadTile(url, ms = 8000) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const t = setTimeout(() => { img.src = ''; resolve(null); }, ms);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = url;
  });
}
```

### Heat on the capture canvas
```js
// window.simpleheat is defined by the already-vendored leaflet-heat.js
const hc = document.createElement('canvas'); hc.width = W; hc.height = H;
const sh = window.simpleheat(hc).radius(radius * ratio, blur * ratio).max(1);
sh.data(mergedPts).draw(0.3);          // minOpacity 0.3, same as heatOptions in map.js
ctx.drawImage(hc, 0, 0);
```

### Download (mirrors `downloadCsv`)
```js
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
```

### Node smoke test shape (tests/js/pdf_smoke.test.js)
```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { jsPDF } = require('../../site/vendor/jspdf/jspdf.umd.min.js');
const { autoTable } = require('../../site/vendor/jspdf-autotable/jspdf.plugin.autotable.min.js');
// build report from loadRun1()+analyze, renderReportPdf(model, { jsPDF, autoTable, mapImage: null }) -> Uint8Array/Blob
// assert: starts with %PDF-, page count >= 2, /URI count === number of pontos with url, size under a few MB,
// first page text contains 'Relatório de impactos' (uncompressed streams: default jsPDF output is not compressed unless compress:true)
```
Verified: `require` of both UMD files works under Node 24.14 and `autoTable(doc, opts)` is exported; `doc.autoTable` is NOT auto-attached in node (no global), so always use the function form.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `doc.autoTable(...)` method form | `autoTable(doc, ...)` function form | autotable 3.x/5.x | Works without global plugin registration, required in node and with injected deps |
| html2canvas / `doc.html()` for tables | Real text tables via autotable | n/a | Selectable, sharp, small |
| jsPDF 2.x/3.x | 4.2.1 (4.0.0 Jan 2026) | 2026 | autotable 5.0.8 peer range includes 4; security fixes landed in 3.x/4.x, so pin 4.2.1 not an older release |

**Deprecated/outdated:** leaflet-image 0.4.0 (2022), pdf-lib 1.17.1 (2022, unmaintained).

## Open Questions

1. **Does the autotable UMD attach `window.autoTable` when loaded as a classic script after jsPDF?**
   - Known: the UMD factory assigns exports to the root object when no CJS/AMD is present, and it also tries to patch `window.jsPDF`/`window.jspdf.jsPDF` (source lines ~2204). Node `require` exports `autoTable`.
   - Unclear: exact global name in the browser (`window.autoTable` expected).
   - Recommendation: first implementation task should log `Object.keys` of the globals in a browser check; fall back to `window.jspdf.jsPDF.API.autoTable` via `applyPlugin`. The panel should read both defensively; the manual checkpoint covers it.
2. **Route features availability:** if the user clicks before the route GeoJSONs finish loading, the map has no route lines. Recommendation: `getRouteFeatures()` returns whatever is loaded; if empty, the map still renders heat and markers and no warning is needed (routes are decoration).
3. **Tile zoom boost (+1) vs OSM etiquette:** the +1 doubles-to-quadruples tile count. Recommendation: ship with +1 and the 80-tile cap; reduce if the checkpoint shows more than about 60 requests for the bundled route.
4. **Regional glyph fallback `>` for `→`:** purely cosmetic; user may prefer "para" or " - ". Planner may keep `>`.
5. **Compression:** `new jsPDF({compress:true})` shrinks output but makes content streams non-greppable in the smoke test. Recommendation: construct with compression on in production and use `compress:false` via an option in tests (or decode streams).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node --test` (Node 24 in CI, 24.14 locally) for `tests/js/*.test.js`; `pytest` for static checks |
| Config file | none (CI runs `node --test "tests/js/*.test.js"` and `python -m pytest`) |
| Quick run command | `node --test tests/js/report.test.js tests/js/mapshot.test.js tests/js/pdf_smoke.test.js` |
| Full suite command | `node --test "tests/js/*.test.js"` and `python -m pytest tests/test_site_static.py` (full: `python -m pytest`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REPORT-01 | Model uses full run, ignores filters, honours params, basis and sort | unit | `node --test tests/js/report.test.js` | ❌ Wave 0 |
| REPORT-01 | Matrix shading maths, class/IQ/priority colours, sem Crítico badge, top-50 rule, pontos link cell | unit | `node --test tests/js/report.test.js` | ❌ Wave 0 |
| REPORT-01 | Filename `relatorio-<run_id>.pdf`, "Gerado em" in America/Sao_Paulo, method note text, "Dados enviados" block with file names and rows | unit | `node --test tests/js/report.test.js` | ❌ Wave 0 |
| REPORT-01 | `pdfText` sanitiser covers → − ≥ ≤ and all bundled/route names | unit | `node --test tests/js/report.test.js` | ❌ Wave 0 |
| REPORT-01 | Mercator project/fitZoom/tilePlan/heat-grid merge | unit | `node --test tests/js/mapshot.test.js` | ❌ Wave 0 |
| REPORT-01 | PDF renders in node: `%PDF-` header, A4 landscape, multi-page, header repeated, link annotations equal pontos with URL, page-number text, no mapImage path works | integration (vendored UMD) | `node --test tests/js/pdf_smoke.test.js` | ❌ Wave 0 |
| REPORT-01 | Vendor files + README versions/sha256 + LICENSE present; scripts not in `index.html` (lazy) or ordered; `#report` span in header; main.js wires report; no `fetch(`/XHR/`import(` in report/pdf/mapshot beyond the tile URL; no `innerHTML`; no `document` in `report.js`/`pdf.js`; CSS colour constants equal `app.css` tokens | static | `python -m pytest tests/test_site_static.py -q` | ❌ Wave 0 (extend file) |
| REPORT-01 | Real browser: button busy state, download name, map raster with tiles and with network blocked (placeholder + warning), live map view and heat toggle unchanged, uploaded run report, text selectable, links open, pt-BR | manual checkpoint | n/a (browser) | manual-only: needs canvas, DOM, OSM network, visual comparison |

### Sampling Rate
- **Per task commit:** the quick run command above (under 30 s)
- **Per wave merge:** `node --test "tests/js/*.test.js"` plus `python -m pytest tests/test_site_static.py`
- **Phase gate:** full `node --test` + `pytest` green, then the manual browser checkpoint plan, before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/js/report.test.js` — covers model/formatting/colours/filename/method note/pdfText (REPORT-01)
- [ ] `tests/js/mapshot.test.js` — covers pure map maths and heat grid merge
- [ ] `tests/js/pdf_smoke.test.js` — covers PDF rendering under node using the vendored UMD via `createRequire`
- [ ] `tests/test_site_static.py` — add report wiring, vendor pinning (jspdf 4.2.1, jspdf-autotable 5.0.8), no-network and purity assertions (existing `test_upload_no_network` already forbids XHR/WebSocket/sendBeacon/POST in all of `site/js`; the new modules must not add `fetch(` for anything except the relative route data, and the only absolute URL is the OSM tile template, mirror `map.js`). Note: vendored jsPDF itself contains the string `XMLHttpRequest` but `site/vendor` is not scanned by that guard and the code path (URL-based image/font loading) is never used.
- [ ] Framework install: none (node built-ins; vendored UMD files are the only new inputs)

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`/`npm pack`, 2026-10-14): jspdf 4.2.1 (modified 2026-03-17, MIT, deps fflate/fast-png/@babel/runtime, optional canvg/core-js/dompurify/html2canvas), jspdf-autotable 5.0.8 (2026-05-17, MIT, peer jspdf ^2||^3||^4), pdf-lib 1.17.1 (2022-05-12), pdfmake 0.3.11, leaflet-image 0.4.0 (2022), html2canvas 1.4.1, html-to-image 1.11.13
- Executed in this session (Node 24.14): `require` of the real UMD min files; A4 landscape; per-char WinAnsi render test; 80-row autotable with fills, 3 pages, header repeat, 80 link annotations, `setPage` page numbers, `output('blob')`
- `curl -I https://tile.openstreetmap.org/10/383/578.png` with Origin header: `access-control-allow-origin: *`
- OSM Tile Usage Policy https://operations.osmfoundation.org/policies/tiles/ (fetched 2026-10-14): Referer required, attribution visible, caching rules, no bulk/prefetch; silent on CORS/canvas/export
- Project source read: `site/js/app/{main,csv,format,i18n,state,session,uploadio,panels/map,panels/matrix,panels/ranking,panels/overview,panels/share}.js`, `core/{ranking,matrix,quality_index,view,geo,defaults}.js`, `site/vendor/{README.md, leaflet-heat/leaflet-heat.js}`, `site/css/app.css`, `tests/test_site_static.py`, `tests/js/{csv.test.js,helpers.js}`, `.github/workflows` (CI runs `node --test` on Node 24)

### Secondary (MEDIUM confidence)
- Web search for OSM policy returned no canvas/CORS statements; policy interpretation for one-off user-initiated capture is a judgement call

### Tertiary (LOW confidence)
- Exact browser global name for the autotable UMD (`window.autoTable`) is inferred from the UMD wrapper source, not run in a browser

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions and dates from the registry, behaviours executed under Node
- Architecture: HIGH for model/wiring (read from source), MEDIUM for heat parity and tile-count tuning (needs the browser checkpoint)
- Pitfalls: HIGH for glyphs, CORS, filters/GPS-filtered run; MEDIUM for OSM policy interpretation

**Research date:** 2026-10-14
**Valid until:** 2026-11-13 (stable libs; re-check jsPDF release notes if a newer 4.x/5.x appears, and re-check OSM CORS header if tiles start failing)
