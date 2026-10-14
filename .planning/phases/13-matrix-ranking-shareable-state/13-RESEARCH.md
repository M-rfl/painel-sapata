# Phase 13: Matrix, Ranking & Shareable State - Research

**Researched:** 2026-10-14
**Domain:** Vanilla-JS (ES modules, no bundler) dashboard extension: pure-core aggregations, DOM panels, URL-hash state, CSV export, GPS jump filter
**Confidence:** HIGH (everything is grounded in the existing code and measured on run 1; browser-API notes are MEDIUM, from training knowledge)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Carried forward (already locked)
- Trecho priority is impact-based (1 Alta → 4 Monitorar by class index) and always computed on the **full run**. Filters never change it (Phase 10).
- The offset mode is `median` (whole run, all valid samples per axis, never affected by filters) or `manual` in g per axis, quantized to the LSB grid in the engine. The gap is counted in **samples**, default 0. `maxJumpMs` defaults to 2000 (Phase 10).
- "Conforme planilha" returns `{ ok, reasons[] }` and depends on the params only, not on filters (Phase 10).
- Portuguese UI. Every new card/control gets an (i) info button with text in `INFO` (`i18n.js`). Panels and controls mount once and then update. Desktop only. Class colour tokens `--normal`…`--critico` (Phases 11–12).
- The map shows only the filtered pontos. Clicking a map point moves the chart cursor and zooms the charts to ±30 s (Phase 12).

#### Page layout
- Order: header → KPI row (**IQ card first**, left of registros) → map → charts → **matrix** → **ranking tables (trecho table and pontos top-50 side by side)** → classes / stats / quality panels.

#### Quality index (new KPI-06)
- Formula (linear penalty), with N = **classified medições in the current filter** (the same denominator as `classPct`; não classificadas excluded):
  `IQ = 100 % × (1 − (0,25·Leve + 0,5·Moderado + 0,75·Severo + 1·Crítico) / N)`
  Weights follow the class index (`w = cls / (ncls − 1)`), so edited thresholds carry through. Run 1 at defaults = **96,4 %** (test anchor: 1 − 844,5 / 23.383).
- Follows every filter and every parameter change.
- The card shows the value plus a coloured band: **≥ 95 % Bom** (green), **85–95 % Regular** (amber), **< 85 % Ruim** (red). 95 % itself counts as Bom. An (i) button explains the formula.
- Per-trecho IQ is a column in the trecho table, using the same formula on that trecho's filtered classified medições.
- N = 0 (everything filtered out) shows "—", not 0 % or NaN.
- KPI-06 must be added to REQUIREMENTS.md and to the Phase 13 success criteria in ROADMAP.md (done along with this context).

#### Matrix (MTX-01/02)
- **Two matrices side by side**, one per sentido, rows = trechos in route order (`run.trechos[].order`), columns = classes, plus a **Total** column at the right.
- A **basis selector** above the matrices switches between impactos / medições / pontos. **Default: impactos.**
- The **Normal column is shown only in medições mode**. Impactos and pontos never have class Normal.
- Colour: each class column is shaded in **its own class colour**, with opacity proportional to count / that column's max. The count is printed in the cell.
- Filters: counts follow the **sentido, eixo and time** filters but **ignore the trecho and classe filters**, so every row and column stays visible and clickable. Cells inside the current trecho+classe selection are outlined.
- Click: a plain click **replaces** the trecho and classe filters with that cell's trecho + class. Clicking the same (sole selected) cell again clears both. **Ctrl/Shift-click adds** the cell to the selection (adds its trecho and class to the filter lists). All views update through the store.
- The matrix sits after the charts.

#### Ranking tables (RANK-01/02/03)
- **Pontos top-50** (from the filtered pontos, `view.pointRows`, the same set as the map markers). The header shows "Top 50 de N pontos".
  - Columns: #, hora, trecho, sentido, eixo dominante, |dom| (g), AX/AY/AZ din. (g), classe, N impactos no ponto, Google Maps link.
  - Default sort: |dom| desc. Clicking any header re-sorts the **same 50 rows** (the top 50 is always the worst 50 by |dom|).
  - **Row click = map + chart jump**: the map centres on the ponto and the chart cursor moves there with the ±30 s zoom, the same behaviour as a map click (reuse the link bus).
- **Trecho table**: columns prioridade, sentido, trecho, IQ, registros, eventos, impactos, pontos, maior classe, pico |dom|. Default order = priority order (as `trechoPriority` sorts).
  - Priority is **full run**. Registros/eventos/impactos/pontos/IQ **follow the filters**. The trecho filter **highlights** the selected rows and never hides any.
  - **"sem Crítico" badge** on every trecho with **zero Crítico (top-class) medições**. This can only happen at priority 2–4, because an Alta trecho always contains a Crítico measurement. The check is full-run, consistent with priority. With edited thresholds, "Crítico" means the top class.
- **CSV export**: one button per table. pt-BR Excel format: `;` separator, `,` decimal, **UTF-8 BOM**, Portuguese headers. Exports the **filtered rows in the current sort**. The pontos export contains **all filtered pontos**, not only the top 50. Times in America/Sao_Paulo. Google Maps URL as a plain column.

#### Analysis parameters (PARAM-04)
- One collapsible **"Parâmetros de análise"** group in the control column, **closed by default**, below the thresholds. Each control has an (i) button.
  - **Offset**: radio Mediana / Manual. In Manual, three g inputs (AX/AY/AZ) **prefilled with the current median values**, `,` or `.` accepted.
  - **Agrupamento (gap)**: integer number of samples, ≥ 0.
  - **Separar impactos após intervalo de X s** (time-jump split): seconds, default 2 (maps to `maxJumpMs`). It also drives the chart gap rows (existing behaviour).
  - **GPS velocidade máxima** (km/h, default 50) and **GPS intervalo máximo entre fixes** (s, default 120).
- **Live on valid input** (the Phase 11 threshold pattern). An invalid value shows a Portuguese error and keeps the last valid value.
- **GPS params = GPS jump filter**: a fix that implies a speed above the max from the previous valid fix (when the interval between them is ≤ max interval) is **rejected**. Its samples become sem GPS (location key `"SEM GPS | " + trecho`). This changes pontos, map markers, the ranking and the sem-GPS note. The researcher must verify and report whether run 1 changes at the defaults 50 km/h / 120 s. If it does, flag it rather than tune it. Also define what happens to fixes separated by more than the max interval (suggested: no speed check, accepted).
- **Conforme badge**: a non-default offset, gap or time-jump turns it off with reasons (e.g. "offset manual", "agrupamento alterado"). **GPS params are excluded** from the conforme check because they don't affect the trecho-independent KPIs.
- The analysis params go into `state.params` / `paramsKey` (memoized `analyze`). Reset restores all of them.

#### Share link (SHARE-01)
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

### Deferred Ideas (OUT OF SCOPE)
- Encoding chart zoom and map pan/zoom in the share link: not selected; it could be a later enhancement.
- Speed estimate display (velocidade estimada in the popup/ranking): not selected. The GPS params drive the jump filter only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MTX-01 | trecho × severidade heat-map matrix in route order per sentido | `core/matrix.js` with a matrix mask (`rowMask` with `trechos: [], classes: []`), 3 bases (impactos/medições/pontos); rows from `run.trechos[].sentido/order` (same grouping as `controls.js`) |
| MTX-02 | Clicking a matrix cell filters all other views | Click handler calls `store.set(setFilter ...)` for `trechos` + `classes`; pure `cellClick(filters, t, c, additive)` reducer; selection outline derived from filters |
| RANK-01 | Sortable top-50 pontos table with Google Maps links | `core/ranking.js` `pontoRanking(run, analysis, view)`, built from `view.pointRows`, includes sem-GPS pontos (no link); `googleMapsUrl` already exists in `core/geo.js` |
| RANK-02 | Trecho table with priority and "sem Crítico" highlight | `trechoRows()` joins full-run `analysis.priority` with per-trecho tallies from a trecho-filter-free mask; "sem Crítico" from full-run top-class **medição** count (not `perTrecho.topCount`, see Pitfall 5) |
| RANK-03 | Export filtered ranking as CSV | pure `app/csv.js` (`;`, `,` decimal, BOM, CRLF, quoting) + Blob download; pontos CSV = all filtered rows |
| PARAM-04 | Analysis parameters: offset per axis, gap, GPS max speed, max fix interval (+ time-jump) | New setters/validators in `state.js`; `core/gpsfilter.js` derived-run filter; `paramsKey` extended; `conformeCheck` already emits offset/gap/jump reasons |
| SHARE-01 | URL encodes all parameters and filters; link restores view | Pure `app/urlstate.js` `serialize(state)` / `parse(hash, ctx)`; `replaceState` debounced; `hashchange` listener; Copiar link |
| KPI-06 | Track quality index card + per-trecho IQ | Pure `core/quality_index.js` (integer-exact band test); IQ card first in `overview.js`; golden anchor 96,4 % |
</phase_requirements>

## Summary

Phase 13 is an additive extension of an already clean architecture: a single immutable-style store (`state.js`) feeds a memoized `analyze(run, params)` (keyed by `paramsKey`), then `buildView(run, analysis, filters)` produces filtered aggregates, then `main.js update()` calls render functions per panel. All new logic can be written as **pure functions in `site/js/core` and `site/js/app` (no DOM)** and tested with `node --test` (113 tests currently green, no package.json, no npm dependencies). **No new libraries are needed**: matrix and tables are plain DOM via the existing `h()` helper, CSV is a ~30-line pure function, URL state is a hand-written serializer (do not use `URLSearchParams`: it treats `+` as space and would encode the commas/semicolons the context wants readable).

Two findings need the planner's attention. (1) **The GPS jump filter changes run 1 at the defaults**: exactly one fix (fix index 31 of 105, trecho index 7, 185 sample rows, 6 events: 4 Leve + 2 Moderado) implies 54,6 km/h from the previous fix over 31,7 s and is rejected. Class counts, eventos and impactos are unchanged (21031/1611/512/173/56, 2352, 1749, so IQ stays 96,4 %), but **pontos goes 99 → 98** in the app view because those rows join the trecho's "sem GPS" ponto. The existing golden test `r.pontos === 99` stays valid only if the filter lives outside `analyze()` (recommended, see Architecture). (2) The Python converter's `build_fixes` does **not** reject fast fixes; it only nulls the `speed_kmh` estimate. The jump filter is therefore new behaviour with no Python oracle, and JS has no `haversine` yet (must be added to `core/geo.js` or the new module, mirroring `geo.py` with R = 6371000 m).

State for the new UI controls (heat toggle, matrix basis, ranking sort) should move into the store as a `ui` slice so that a single serializer/parser handles everything and Reset clears them. The heat toggle is currently panel-local in `map.js`; it needs a small refactor (checkbox driven by state, `heatKey` must include the toggle).

**Primary recommendation:** Build in this order: (a) pure cores (`quality_index`, `gpsfilter`, `matrix`, `ranking`, `csv`, `urlstate`) with unit tests against run 1; (b) extend `state.js` (analysis params + `ui` slice + validators) and `paramsKey`; (c) panels (IQ card, controls group, matrix, ranking) mount-once; (d) `main.js` wiring (hash → initial state, debounced write, derived GPS run, ranking→map focus); (e) one manual browser checkpoint like Phases 11/12.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla ES modules (browser) | n/a | All new panels/cores | Project constraint: no bundler, static GitHub Pages, tests via plain Node |
| `node:test` | Node 24 (CI `setup-node` `node-version: '24'`) | Unit tests for every new pure module | Existing 113-test suite, command `node --test "tests/js/*.test.js"` |
| pytest | 8 (existing) | Static site checks (`tests/test_site_static.py`: module graph resolves, relative URLs) | New modules are auto-covered by the import-graph walk from `main.js` |

### Supporting (already vendored, reuse only)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Leaflet | 1.9.4 | Map; add `focus(row)` for ranking row click | `panTo` / `setView` on the ponto, optional `openPopup` |
| leaflet.heat | 0.2.0 | Heat layer; toggle now state-driven | include toggle in `heatKey` |
| uPlot | 1.6.32 | Charts; `link.select(row)` already zooms ±30 s | reuse via link bus |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written hash serializer | `URLSearchParams` | Decodes `+` as space, percent-encodes `;` and `,` in some paths, defeats the readable `#lim=0,5;1;2;4` format |
| Hand-written CSV writer | a CSV library | Not worth a vendored dependency; the format is fixed and small (see Don't Hand-Roll note) |
| GPS filter inside `analyze()` | Derived run outside `analyze()` | Inside would silently change the 99-pontos golden/parity tests; outside keeps oracle parity intact |

**Installation:** none. No new vendor files, no `package.json`.

## Architecture Patterns

### Recommended Project Structure
```
site/js/core/
├── quality_index.js   # qualityIndex(classCounts) -> {value|null, band}; pure
├── gpsfilter.js       # DEFAULT_GPS, haversineM, rejectedFixes(), applyGpsFilter(run, gps) -> derived run (memo by caller)
├── matrix.js          # matrixMask(), buildMatrix(run, analysis, filters, basis), cellClick()
└── ranking.js         # pontoRanking(), trechoRows(), sortRows(), column defs (shared by panel + CSV)
site/js/app/
├── csv.js             # toCsv(headers, rows) pure; downloadCsv() (DOM, tiny)
├── urlstate.js        # serialize(state) / parse(hash, ctx) -> {state, ignored[]} ; pure
├── state.js           # + analysis-param setters, ui slice, validators; paramsKey extended
└── panels/
    ├── matrix.js      # mount-once table, update cells
    ├── ranking.js     # mount-once: trecho table + pontos top-50, CSV buttons
    ├── overview.js    # + IQ card first
    ├── controls.js    # + <details> "Parâmetros de análise"
    └── map.js         # + focus(row), heat toggle state-driven, use ctx.run
tests/js/  quality_index.test.js, gpsfilter.test.js, matrix.test.js, ranking.test.js, csv.test.js, urlstate.test.js (+ extend state.test.js, info.test.js)
```

### Pattern 1: Derived run for the GPS jump filter (recommended placement)
**What:** `applyGpsFilter(run, {maxSpeedKmh, maxFixGapS})` returns a shallow copy `{...run, locId, fix, priorFix, gpsRejected}`; the original arrays are never mutated. `main.js` memoizes it on the gps key, then calls `analyze(derivedRun, params)` and `buildView(derivedRun, ...)`, and puts `derivedRun` in `ctx.run`.
**Why:** `analyze`, `pointsByLocation`, `pontoMarkers`, `unplacedCounts`, `heatPoints`, `hoverPosition` all read `run.locId`/`run.fix`/`run.priorFix`; one swapped run object fixes all of them. Golden/parity tests call `analyze(rawRun)` and keep their 99 pontos.
**Algorithm (mirrors `gps.py` speed rule, extended to rejection):**
```js
// Source: derived from tools/dashboard_converter/gps.py build_fixes + geo.py haversine_m (R = 6371000)
// fix start time = run.tMs[run.fixRow[f]]; walk fixes in order, compare to the LAST ACCEPTED fix.
let prev = -1; const rejected = new Set();
for (let f = 0; f < nF; f++) {
  if (Number.isNaN(run.fixLat[f])) continue;
  if (prev >= 0) {
    const dt = (run.tMs[run.fixRow[f]] - run.tMs[run.fixRow[prev]]) / 1000;
    if (dt > 0 && dt <= maxFixGapS) {
      const v = haversineM(run.fixLat[prev], run.fixLon[prev], run.fixLat[f], run.fixLon[f]) / dt * 3.6;
      if (v > maxSpeedKmh) { rejected.add(f); continue; }   // strict >, as in Python
    }
    // dt <= 0 or dt > maxFixGapS: no speed check, accept (gap >120 s is a turnaround/tunnel, not a jump)
  }
  prev = f;
}
// rows of rejected fixes: fix[i] = -1, locId[i] = -1 (=> pointsByLocation key -1 - trecho, i.e. "SEM GPS | trecho")
// recompute priorFix[i] = last ACCEPTED fix index (hover on those rows shows the dashed "sem GPS" marker)
```
Rebuild `locId` by copying `run.locId` and setting rejected rows to -1 (no need to re-key strings: `locId` is already an int id; the "SEM GPS | trecho" key of the context is exactly the `-1 - trecho` branch of `pointsByLocation`).

### Pattern 2: Matrix mask = `rowMask` with trecho/classe filters cleared
```js
// core/matrix.js
const m = rowMask(run, analysis, { ...filters, trechos: [], classes: [] });
// basis 'medicoes': for i in mask, cls[i] >= 0           -> cell[trecho[i]][cls[i]]++
// basis 'impactos': for im of analysis.impacts, mask[im.peak] -> cell[trecho[im.peak]][im.cls]++
// basis 'pontos'  : maskedCls (cls where mask else -1) -> pointsByLocation(dom2, maskedCls, locId, trecho)
//                   -> cell[trecho[r]][cls[r]]++     (same recipe as buildView)
```
Impact attribution uses the trecho of the peak row (same rule as `perTrecho` and `buildView`). Columns: classes 1..ncls-1, plus 0 only for `medicoes`. Total column = sum of displayed columns (so in medições mode Total includes Normal). Per-column max for shading: compute across **both** sentido matrices per class (recommendation; makes the two matrices comparable). Row grouping: reuse the `controls.js` pattern `run.trechos.map((t, idx) => ...).filter(t => t.sentido === si).sort((a,b) => a.order - b.order)`.

### Pattern 3: One-pass per-trecho tallies for the trecho table
Compute with `rowMask(run, analysis, {...filters, trechos: []})` (trecho filter ignored, since it only highlights; the other filters, including classe, are applied). Per trecho: `classCounts[ncls]` (for IQ, maior classe), `registros`, `eventos` (cls ≥ 1), `impactos` (peak in mask, by peak trecho), `pontos` (from `pointsByLocation` on the masked classes, attributed by `trecho[r]`), `pico|dom|` (max `dom2` over masked event rows, /4096). Full-run side (no filter): `analysis.priority` (already sorted level asc, topCount desc, peakDom2 desc, idx asc; has `label`) plus `topClassMedicoes[t]` from a plain loop over `analysis.cls` for "sem Crítico".

### Pattern 4: Store `ui` slice and URL round trip
```js
state = { params:{..., gps:{maxSpeedKmh:50, maxFixGapS:120}}, inputs:{..., offsetText:[3], gapText, jumpText, speedText, fixGapText, analysisErrors:{}},
          filters, display, ui:{ heat:false, matrixBasis:'impactos', rank:{col:'dom', dir:'desc'} } }
```
`urlstate.serialize(state)` emits only non-default keys; `parse(hash, {nT, nSent, tMin, tMax})` starts from `defaultState()`, applies each key through the same validators/setters as the controls, collects `ignored` keys, and returns the state (never throws). Suggested keys (discretion): `lim=0,5;1;2;4`, `of=-0,0186;…` (manual offset g, exact JS number text with `,`), `gap`, `salto` (seconds), `vmax`, `fixmax`, `sent`, `trc`, `eixo`, `cls` (index lists, comma separated), `de`/`ate` (elapsed ms, integer), `modo=med` (valueMode medido; `dinamico` is default), `met`, `raio`, `int`, `calor=1`, `mtx=med|pto` (default impactos), `ord=col:asc` (default `dom:desc` omitted).

### Pattern 5: Hash sync in `main.js`
```js
// read before first update()
const init = parse(location.hash, ctx);            // store = createStore(init.state); show notice if init.ignored.length
let timer; let lastWritten = location.hash.slice(1);
store.subscribe((s) => { clearTimeout(timer); timer = setTimeout(() => {
  const h = serialize(s); if (h === lastWritten) return; lastWritten = h;
  try { history.replaceState(null, '', h ? '#' + h : location.pathname + location.search); } catch (_) {}
}, 250); });
addEventListener('hashchange', () => { /* user pasted/edited hash: re-parse unless equal to lastWritten */ });
// "Copiar link": build URL from serialize(store.get()) NOW (do not rely on the debounced location), navigator.clipboard.writeText, fallback to a temporary textarea + execCommand('copy')
```

### Pattern 6: Ranking row click → map + chart jump
`link.select(row)` already drives the charts (`charts.js focusRow`). Map click currently only calls `link.select`, and the map panel does not subscribe to `onSelect`. Do **not** subscribe the map to `onSelect` (that would pan the map on every marker click, a behaviour change). Instead `mountMap` returns `{ render, focus(row) }`; the ranking panel callback in `main.js` does `link.select(row); map.focus(row);` where `focus` uses `hoverPosition(cur, row)` and `map.panTo`/`setView(…, max(zoom, 16))` (sem-GPS ponto: `hoverPosition` returns the prior fix with `noGps: true`; centre there and show the dashed marker).

### Anti-Patterns to Avoid
- **Re-creating panel DOM on every update for tables with sortable headers/buttons:** the sort button loses keyboard focus after each click. Mount the table skeleton once, update `tbody` (and header `aria-sort`). Existing `PANELS` pattern (`clear(el)` + rebuild) is acceptable only for static panels.
- **Putting the GPS filter or `gps` params into `analyze()`:** breaks the 99-pontos golden test and the Python parity contract.
- **Using `fmtInt`/`fmtDec` for CSV cells:** `Intl` pt-BR groups thousands (`23.383`). Use `String(n)` for integers and `n.toFixed(d).replace('.', ',')` for decimals in CSV.
- **Using `fmtThreshold`/`fmtDec(…, 4)` to serialize URL values:** `fmtThreshold` caps at 4 decimals and would lose a threshold such as 0,12345. Serialize with `String(x).replace('.', ',')` (exact round trip).
- **Writing `#` + empty string:** leaves a trailing `#`. Use `location.pathname + location.search` when the hash is empty.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-ponto Google Maps link | New URL builder | `googleMapsUrl(lat, lon)` in `core/geo.js` | already exists, 6 dp |
| Trecho grouping/order per sentido | New sort | Pattern in `controls.js` (`run.trechos[].sentido/order`) | single source of route order |
| Ponto selection per location | New dedupe | `pointsByLocation(dom2, maskedCls, locId, trecho)` from `core/events.js` | exact tie rules (first max wins); `buildView` uses it |
| Row mask / filters | New filter code | `rowMask`/`normalizeFilters` in `core/view.js` (call with cleared keys) | AND semantics, unclassified-row rule |
| Priority | Recompute | `analysis.priority` (+ `PRIORITY_NAMES`) | full-run, already sorted |
| Dynamic axis values for the ranking | New conversion | `axisConverters(analysis, 'dinamico')` from `core/stats.js` (as `pontoMarkers` does) | same numbers as the map popup |
| Number/date text | Custom formatting | `fmtInt/fmtDec/fmtPct/fmtDateTime` in `app/format.js` (UI only; CSV uses plain conversion) | pt-BR, America/Sao_Paulo |
| Threshold validation | New rules | `validateThresholds` / `setThresholdText` pattern | CONTEXT requires the same validators for URL and controls |
| (i) buttons | New popover | `infoBtn(key, name)` + `INFO[key]` | `info.test.js` enforces key existence/Portuguese text |

**Key insight:** every aggregate this phase needs (class counts per trecho/sentido, impacts by peak, pontos by location) is a re-slicing of data `analyze`/`buildView` already compute. The risk is in **filter semantics and state plumbing**, not in algorithms.

## Common Pitfalls

### Pitfall 1: The GPS jump filter changes run 1 (pontos 99 → 98)
**What goes wrong:** At 50 km/h / 120 s one fix (index 31, trecho 7) is rejected; its 185 rows (6 events) fold into the trecho's sem-GPS ponto, so pontos drops by 1; the sem-GPS note changes; `pontosNote` ("99 vs 101") would read 98. Verified by running the algorithm over the decoded run (scratch script, 105 fixes: 1 rejected, 2 pairs with dt > 120 s accepted unchecked, 101 pass). Class counts, eventos, impactos, impactsByClass, mediansLsb are unchanged, so **IQ 96,4 % and the conforme badge are unaffected**.
**How to avoid:** Implement exactly as specified and **flag, don't tune** (CONTEXT). Keep `analyze(rawRun)` = 99 for golden/parity. Add an app-level test asserting `analyze(applyGpsFilter(run, defaults))` gives 98 pontos and the same class counts, so the change is intentional and visible. Show the rejected-fix count to the user (e.g. in the map sem-GPS note or quality panel: "N fixes de GPS descartados por salto de velocidade") so the 99 → 98 is explainable. Raise it to the user as Open Question 1.
**Warning signs:** golden test failing on 99; `pontosNote` text mismatch; map marker for a ponto disappearing at defaults.

### Pitfall 2: `parseDecimal` rejects negatives
`parseDecimal` accepts only `^\d+([.,]\d+)?$`; run-1 medians are AX +0,0459, AY −0,0186, AZ −0,9854 g. The manual-offset inputs need a **signed** parser (add `parseSignedDecimal`; keep `parseDecimal` unchanged for thresholds). Range: |g| ≤ 16 (sensor range, same as `MAX_THRESHOLD_G`).

### Pitfall 3: Prefilling manual offset loses precision if rounded too coarsely
Median LSB × 1/2048 → display with **≥ 4 decimals** (error ≤ 0,00005 g = 0,2 units of 1/4096 g, so `halfUp(g*4096)` recovers the exact integer; 3 decimals would not). Verified reasoning against `restOffset2` (`off2 = halfUp(g*4096)`). Prefill must come from `analysis.mediansLsb` (full-run medians, never filtered). Switching Mediana → Manual should prefill; switching back keeps typed text but uses `{mode:'median'}`.

### Pitfall 4: Matrix must ignore trecho **and** classe filters, trecho table only the trecho filter
If the matrix used `view.mask`, clicking a cell would hide every other cell. Use the cleared mask. For the trecho table, CONTEXT says registros/eventos/…/IQ "follow the filters" and the trecho filter only highlights: use a mask with `trechos: []` only. Consequence worth knowing: with a classe filter active (e.g. only Crítico) the global IQ and per-trecho IQ become 0 % by the formula (all remaining classified rows are class 4). That is the literal consequence of "follows every filter"; mention it in the IQ (i) text rather than special-casing it.

### Pitfall 5: "sem Crítico" must use medições, not `perTrecho.topCount`
`topCount` counts **impacts** attributed to the trecho of their peak row. An impact straddling a boundary can contain top-class rows in the neighbouring trecho while its peak is in the other. CONTEXT defines the badge by "zero Crítico (top-class) medições", so count `analysis.cls[i] === ncls - 1` per `run.trecho[i]` over the full run. Priority 1 (Alta) trechos are guaranteed to have ≥ 1 (the peak row of a top-class impact is top class); assert this in a test.

### Pitfall 6: IQ band thresholds with floating point
`0.95` boundary: compute the band with integers. With `S = Σ cls·count` over classified rows and `D = ncls − 1`: IQ ≥ 95 % ⇔ `20·S ≤ D·N`; IQ ≥ 85 % ⇔ `100·S ≤ 15·D·N`. Value = `1 − S/(D·N)` (run 1: S = 1611 + 1024 + 519 + 224 = 3378; D·N = 93.532; 1 − 0,03612 = 96,388 %). Display with `fmtPct(v, 1)` (Intl pt-BR prints `96,4%` without the space the CONTEXT shows; either is acceptable, keep one format everywhere). A value like 94,96 % displays as `95,0%` but is Regular: acceptable, note it in the (i) text or display 2 decimals near the boundary. N = 0 → `null` → render "—" and no band.

### Pitfall 7: Hash sync pitfalls
- `history.replaceState` can throw `SecurityError` in Safari when called more than ~100 times in 30 s (MEDIUM confidence, training knowledge): debounce (250 ms) and wrap in try/catch. Sliders (time window, radius) fire `input` continuously.
- `replaceState` does not fire `hashchange`; a user editing the hash manually does. Handle `hashchange` (compare with `lastWritten` to avoid feedback loops) and apply with a full `store.set(() => parsed.state)`.
- "Copiar link" must build the URL from the **current** state, not `location.href` (debounce may be pending). `navigator.clipboard` needs a secure context (https Pages / localhost: fine); keep a textarea fallback.
- Threshold text fields: after loading from URL, set `inputs.thresholdText` from the exact strings, not from `fmtThreshold` (4 dp cap).
- Time window `de/ate` are elapsed ms on the `run.tMs` basis; a link applied to a different dataset (Phase 14 upload) is out of range, so `parse` must clamp/ignore against `[tMin, tMax]` and flag it as ignored.
- Out-of-range indices (`trc=99`, `sent=5`, `cls=7`) must be ignored individually, not crash `rowMask` or controls (`r.trecho.get` etc.).

### Pitfall 8: State-shape changes break existing tests
`tests/js/state.test.js` deep-equals `defaultState()`; adding `params.gps`, `inputs.*Text`, `ui` requires updating it. `paramsKey` must include `gps` (and `offset.g`), else analyze memo goes stale. The `INFO` test (`info.test.js`) has a REQUIRED key list and checks keys used in panels exist: add the new keys (`kpiIQ`, `matrix`, `matrixBase`, `ranking`, `rankTrecho`, `rankPontos`, `csv`, `analise`, `pOffset`, `pGap`, `pSalto`, `pGpsVel`, `pGpsFix`, `share`) in `i18n.js` and the REQUIRED list. Existing `INFO.kpiImpactos` hard-codes "maior que 2 s": reword to "o intervalo de separação configurado (padrão 2 s)".

### Pitfall 9: Map heat toggle becomes state-driven
`map.js` caches `heatKey`/`viewKey`; `heatOn` is a closure variable set by the checkbox. When moving it to `state.ui.heat`, include it in `hk`, and set the checkbox from state in `render()`; the URL parse can set `heat:true` before the map has a size (`updateHeat` already returns false when `!map.getSize().x` and retries via key).

### Pitfall 10: Cascading rejections
The filter compares with the last **accepted** fix. If the very first fix were an outlier, later good fixes within 120 s would be rejected in a chain; with very low user-set max speed most of the track disappears. Validate UI ranges (suggested: speed 1–300 km/h, fix interval 1–3600 s) and report `gpsRejected.length` so the effect is visible. For run 1 the first fix is fine.

### Pitfall 11: CSV for Excel pt-BR
UTF-8 BOM (`﻿`) + `;` + CRLF; quote any field containing `;`, `"`, CR or LF (double the quotes); decimals with `,`; no thousands grouping; date `dd/mm/aaaa hh:mm:ss` (Excel parses it in pt-BR). Prefix a `'`/space for cells starting with `=`, `+`, `-`, `@` only for text columns (trecho names do not, but cheap to guard). Negative numbers (dynamic accel) start with `-` and are numeric: do not guard numeric columns. Revoke the object URL after the click.

### Pitfall 12: Matrix click semantics edge cases
Additive (Ctrl/Shift) selection produces a cross product (trechos × classes), not the union of cells; the outline rule in CONTEXT ("cells inside the current trecho+classe selection") matches that, so be consistent and say so in the (i) text. "Clicking the same sole cell clears both" means `trechos` equals `[t]` and `classes` equals `[c]` exactly. Also decide: Total-column / row-label click (not specified): recommend row label click = select that trecho only (classes cleared), Total column not clickable. Zero-count cells stay clickable (CONTEXT: matrix must stay fully clickable).

## Code Examples

### IQ (pure, integer-exact band)
```js
// core/quality_index.js  (no DOM)
export function qualityIndex(classCounts) {
  const D = classCounts.length - 1;
  let N = 0, S = 0;
  classCounts.forEach((c, k) => { N += c; S += k * c; });
  if (N === 0) return { value: null, band: null, n: 0 };
  const value = 1 - S / (D * N);
  const band = 20 * S <= D * N ? 'bom' : 100 * S <= 15 * D * N ? 'regular' : 'ruim';
  return { value, band, n: N };
}
// test anchor: qualityIndex([21031,1611,512,173,56]).value ≈ 0.96388 (1 - 844.5/23383), band 'bom'
```

### Hash parse skeleton (never throws)
```js
export function parseHash(hash, ctx) {
  const ignored = [];
  let s = defaultState();
  for (const part of hash.replace(/^#/, '').split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const key = i < 0 ? part : part.slice(0, i);
    const val = i < 0 ? '' : part.slice(i + 1);
    try { s = APPLY[key] ? APPLY[key](s, val, ctx) ?? (ignored.push(key), s) : (ignored.push(key), s); }
    catch { ignored.push(key); }
  }
  return { state: s, ignored };
}
```

### CSV core
```js
const SEP = ';', EOL = '\r\n', BOM = '﻿';
const q = (v) => { const t = v == null ? '' : String(v); return /[;"\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
export const toCsv = (headers, rows) => BOM + [headers, ...rows].map((r) => r.map(q).join(SEP)).join(EOL) + EOL;
export const csvNum = (x, d) => (x == null || Number.isNaN(x) ? '' : x.toFixed(d).replace('.', ','));
```

### Ponto ranking row (reuses map logic, adds sem-GPS pontos)
```js
// core/ranking.js - for r of view.pointRows:
// key = run.locId[r] >= 0 ? run.locId[r] : -1 - run.trecho[r]    // nImpactos: count view.impacts whose peak maps to same key
// dom = analysis.dom2[r] / 4096 ; ax/ay/az = axisConverters(analysis,'dinamico') ; url only if run.fix[r] >= 0 (derived run)
// top50 = rows sorted by dom desc, ties -> lower row (earlier time), then .slice(0, 50); user sort re-sorts these 50 only
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 11 local panel state | Single store with `ui` slice | this phase | one serializer covers everything; Reset clears hash |
| Python `speed_kmh` estimate only (nulls >50) | JS jump **rejection** with same rule | this phase | new behaviour, no Python oracle; run 1 pontos 99 → 98 |
| `conformeCheck` TODO in CONTEXT | Already emits `offset manual`, `agrupamento alterado`, `salto de tempo alterado`; GPS not compared | Phase 10 | CONTEXT's "add reasons" is already done; only add tests/UI wiring (keep `params.gps` out of `conformeCheck`) |

**Deprecated/outdated:** none relevant (no external libs added).

## Open Questions

1. **GPS jump filter changes run 1 at defaults (pontos 99 → 98).**
   - What we know: measured; only fix 31 (54,6 km/h, dt 31,7 s, trecho 7, 185 rows, 4 Leve + 2 Moderado events) is rejected; classes/eventos/impactos/IQ unchanged. Python `build_fixes` never rejects, so workbook comparison ("99 vs 101") only gets a different engine number.
   - What's unclear: whether the user wants 98 as the new baseline.
   - Recommendation: implement per spec and flag in the plan/summary; keep `golden` at 99 on the raw run, add an app-level assertion of 98; surface the rejected count in the UI. Do not tune.
2. **Does the classe filter apply to the trecho-table counts/IQ?**
   - CONTEXT says "follow the filters" (trecho only highlights). Literal reading: yes, classe applies, so with a single-class filter IQ is degenerate. Recommendation: apply sentido/eixo/classe/time, ignore trecho (as researched); document in the (i) text.
3. **Matrix column shading max: per sentido matrix or shared?** Recommendation: shared across both matrices per class column (discretion).
4. **Total column / row-label clicks, zero-count cells.** Recommendation in Pitfall 12; confirm during the UI checkpoint.
5. **Python parity for the GPS filter?** Not needed; JS unit tests with a synthetic run + the run-1 expectation suffice. Optional cheap cross-check: JS-rejected fix `f` should coincide with `build_fixes` giving `speed_kmh[f-1] is None` with dt ≤ 120 (the only such case in run 1).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 24) for JS core/app-pure modules; pytest 8 for static site checks |
| Config file | none for Node (no package.json); `pytest.ini` for pytest (`-m "not slow"`) |
| Quick run command | `node --test "tests/js/*.test.js"` (113 tests, ~2.3 s) |
| Full suite command | `python -m pytest && node --test "tests/js/*.test.js"` |

DOM panels cannot be unit-tested (no jsdom, no browser runner in repo). Keep every behaviour that matters in pure modules; panels get static checks plus the manual checkpoint (the Phase 11/12 pattern).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KPI-06 | IQ = 96,4 % on run 1 (classCounts [21031,1611,512,173,56]); band edges 95 % exact = Bom, 85 % exact = Regular, N=0 → null; follows filters (sentido filter changes value); per-trecho sums consistent | unit | `node --test tests/js/quality_index.test.js` | ❌ Wave 0 |
| MTX-01 | Matrix cells per basis: sum of impactos cells == `view` impactos without trecho/classe filters; medições Normal column only in that basis; rows in `order` per sentido; trecho/classe filters ignored, sentido/eixo/time honoured | unit | `node --test tests/js/matrix.test.js` | ❌ Wave 0 |
| MTX-02 | `cellClick` reducer: plain replaces, same sole cell clears, ctrl/shift adds; resulting filters make `buildView` equal the matrix cell count (impactos basis) | unit | `node --test tests/js/matrix.test.js` | ❌ Wave 0 |
| RANK-01 | Top 50 = worst 50 by `dom2` of `view.pointRows`, ≤ 50 rows, header N = `view.pontos`, re-sort keeps same 50, Maps URL equals `googleMapsUrl`, sem-GPS ponto has no URL | unit | `node --test tests/js/ranking.test.js` | ❌ Wave 0 |
| RANK-02 | Trecho rows: order == `analysis.priority`, priority independent of filters, counts follow filters but trecho filter never removes rows, "sem Crítico" == zero top-class medições full run, every level-1 trecho has Crítico | unit | `node --test tests/js/ranking.test.js` | ❌ Wave 0 |
| RANK-03 | CSV: BOM, `;`, CRLF, `,` decimal, quoting/escaping, pontos export has all filtered pontos in current sort, headers Portuguese | unit | `node --test tests/js/csv.test.js` | ❌ Wave 0 |
| PARAM-04 | Setters/validators (signed decimals, gap int ≥ 0, jump s → ms, speed/interval ranges, invalid keeps last valid + PT error); `paramsKey` changes with each param; manual offset equal to medians reproduces defaults (existing golden case); GPS filter: run 1 rejects exactly fix 31, class counts unchanged, pontos 98; synthetic: dt > maxFixGapS not checked, cascade vs last accepted, rows of rejected fix → sem GPS; reset restores all; `conformeCheck` reasons for offset/gap/jump, none for GPS | unit | `node --test tests/js/state.test.js tests/js/gpsfilter.test.js tests/js/golden.test.js` | state.test ✅ (extend), gpsfilter ❌ Wave 0 |
| SHARE-01 | `serialize(defaultState()) === ''`; round trip `parse(serialize(s)) == s` over param/filter/display/ui combos (incl. negative manual offsets, 5-decimal thresholds); unknown key / bad value / out-of-range index / reversed thresholds ignored with `ignored[]`, rest applied; never throws on garbage (fuzz strings); time window outside run ignored | unit | `node --test tests/js/urlstate.test.js` | ❌ Wave 0 |
| (all UI) | INFO keys exist and are Portuguese; module graph resolves; relative URLs; `#matrix`/`#ranking` sections exist in `index.html` | static | `node --test tests/js/info.test.js` and `python -m pytest tests/test_site_static.py -q` | ✅ (extend REQUIRED list / section order) |
| (visual) | IQ card first, colours/bands, matrix shading + outline, click filters map/charts/KPIs, ranking row click pans map and zooms charts, CSV opens in Excel pt-BR by double-click, Copiar link opens identical view in a fresh tab, bad hash shows notice, Reset clears hash | manual checkpoint | checklist in final plan | manual-only (DOM/Leaflet/uPlot/Excel; no browser runner in repo) |

### Sampling Rate
- **Per task commit:** `node --test "tests/js/*.test.js"`
- **Per wave merge:** `python -m pytest && node --test "tests/js/*.test.js"`
- **Phase gate:** full suite green before `/gsd:verify-work`, plus the manual browser checklist (use `python -m tools.serve_site`, no-cache server, per Phase 11-06 decision)

### Wave 0 Gaps
- [ ] `tests/js/quality_index.test.js` — KPI-06
- [ ] `tests/js/gpsfilter.test.js` — PARAM-04 (GPS filter; includes run-1 expectation and synthetic cases)
- [ ] `tests/js/matrix.test.js` — MTX-01, MTX-02
- [ ] `tests/js/ranking.test.js` — RANK-01, RANK-02
- [ ] `tests/js/csv.test.js` — RANK-03
- [ ] `tests/js/urlstate.test.js` — SHARE-01
- [ ] Update `tests/js/state.test.js` (`defaultState` shape, new setters), `tests/js/info.test.js` (REQUIRED keys), `tests/test_site_static.py` if it asserts section order
- [ ] Framework install: none (Node and pytest already present)

## Sources

### Primary (HIGH confidence) - this repository, read and executed
- `site/js/app/state.js`, `main.js`, `panels/controls.js`, `overview.js`, `map.js`, `charts.js`, `link.js`, `format.js`, `i18n.js`, `info.js` — architecture, patterns, test-coupled contracts
- `site/js/core/view.js`, `engine.js`, `events.js`, `aggregate.js`, `data.js`, `conforme.js`, `dynamics.js`, `classify.js`, `geo.js`, `quality.js`, `series.js` — aggregation recipes and filter semantics
- `tools/dashboard_converter/gps.py` / `geo.py` — speed rule and haversine (R = 6371000 m); confirmed it does not reject fixes
- `tests/js/*.test.js`, `tests/test_site_static.py`, `.github/workflows/pages.yml` — test conventions (113 tests green, Node 24)
- Scratch measurements on `site/data/run-2026-10-02-l4-t102.json` (105 fixes, trechos 20, pontos 99): jump filter at 50 km/h / 120 s rejects fix 31 only; pontos 98 after; class counts identical; IQ arithmetic 1 − 844,5/23.383 = 96,39 %
- `.planning/phases/13-.../13-CONTEXT.md`, `REQUIREMENTS.md`, `STATE.md`, `ROADMAP.md`

### Secondary (MEDIUM confidence)
- Browser API behaviour (History `replaceState` rate limiting in Safari, Clipboard API secure-context requirement, Excel pt-BR handling of BOM + `;` CSV): training knowledge, not re-verified against current docs in this session

### Tertiary (LOW confidence)
- None load-bearing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies; everything verified in the repo
- Architecture: HIGH - derived from the actual store/analyze/view/panel code; GPS filter effect measured
- Pitfalls: HIGH for code-coupled items (1-6, 8-10, 12); MEDIUM for browser/Excel behaviours (7, 11)

**Research date:** 2026-10-14
**Valid until:** 2026-11-13 (stable; invalidated only by changes to `state.js`/`view.js`/`map.js` or the run-1 JSON)
