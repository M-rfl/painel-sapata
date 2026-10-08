# Technology Stack (v1.3 Field Run Dashboard additions)

**Project:** WTVB01 Notebook Logger - Field Run Dashboard
**Researched:** 2026-10-08
**Scope:** Only NEW capabilities (converter, static site, Pages deploy). Logger stack unchanged.

## Verdict (opinionated)

No build tool, no framework. Plain HTML + vanilla ES modules, with 3 small libraries **vendored** (copied into the repo at pinned versions, not loaded from a CDN): uPlot, Leaflet, leaflet.heat. Data is one columnar JSON file. Converter uses openpyxl (read_only) and the stdlib only. Deploy with a GitHub Actions workflow that publishes the `site/` folder.

Reasoning: one page, one dataset (23k rows), one developer, Python-first repo. Vite + a framework adds node_modules, a lockfile, a CI build step and a second ecosystem for no gain. The "live recompute" logic is a pure function over typed arrays, which does not need a reactive framework. A few `input` event listeners and a debounced `render()` are enough.

## Recommended Stack

### Site core
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| HTML + CSS + vanilla JS (ES modules, `<script type="module">`) | n/a | UI, state, recompute | Zero build; `site/` is deployed as-is; modules split into `state.js`, `analysis.js`, `charts.js`, `map.js`, `matrix.js`, `i18n-pt.js` |
| uPlot | 1.6.32 (npm, verified 2026-10) | Per-axis time series (3 stacked charts, medido/dinamico) | ~50 KB, canvas, designed for 100k+ points; 23k x 3 renders in a few ms, drag-zoom built in, `uPlot.sync()` links cursor/zoom across the 3 axis charts; accepts `Float32Array` columns directly |
| Leaflet | 1.9.4 (latest stable on npm) | Route map, OSM tiles, GPS polyline, impact markers | Standard, tiny, no WebGL/API key. Do NOT jump to the 2.x alpha line |
| leaflet.heat | 0.2.0 | Geographic heat map | Only ~2 KB canvas plugin; supports per-point weight, `radius`, `blur`, `max`, `gradient`, which map directly to the "metric / radius / intensity" controls. Unmaintained since 2019, but API is stable and works with Leaflet 1.9.4 |
| OpenStreetMap raster tiles | n/a | Base map | Fine for low-traffic public dashboard; keep the attribution. Optionally CARTO light basemap as alternative for better heat contrast (verify its terms before using) |

### Trecho x severidade matrix
No library. Render a CSS-grid or `<table>` with cell background from a color scale function (21 trechos x 4-5 classes = about 100 cells). Click on a cell sets a filter. Accessible, printable, trivial to localize.

### Data format
| Choice | Detail | Why |
|--------|--------|-----|
| Single `site/data/run-<id>.json`, **columnar** (`{"meta":{...}, "cols":{"t":[...],"ax":[...],...}, "trechos":[...], "sentidos":[...]}`) | Numbers rounded in the converter (accel to 4 decimals, lat/lon to 6), categorical columns stored as small int codes plus a lookup list, missing GPS as `null` | Columnar is about 3-4x smaller than array-of-objects and loads directly into `Float32Array` / `Int8Array`. Estimated 1-2 MB raw |
| No manual gzip / no binary | GitHub Pages serves text assets with gzip on the fly (about 70-80% smaller, so about 300-500 KB over the wire) | Avoids `pako`/`fflate` + decode code. Typed-array binary only worth it above about 500k rows. MEDIUM confidence on Pages compression behavior (widely observed, not formally documented); not critical either way |
| Time as epoch seconds (float, 0.2 s steps) plus `t0` ISO string with `-03:00` offset in meta | Compact, uPlot's x axis wants seconds | Format dates in pt-BR with `Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo'})`, no date lib |
| Keep raw per-sample dominant-axis value and per-axis medido columns in the JSON, **not** precomputed severity | Thresholds, rest-level offset, and event grouping are client-side parameters; severity/events/impacts/pontos de impacto are recomputed in JS. Converter may additionally embed the workbook's own results in `meta.reference` so the JS implementation can be unit-checked against them at default params | Required by the "live recompute" spec |

### Converter (Python, dev-only)
| Library | Version | Purpose | When |
|---------|---------|---------|------|
| openpyxl | 3.1.5 (latest on PyPI) | Read workbook | `load_workbook(path, read_only=True, data_only=True)`; iterate `ws.iter_rows(values_only=True)` on `02 — DADOS TRATADOS`. read_only streams rows so the 22 MB file does not blow memory. `data_only=True` gives cached formula values (verify no formula cell is uncached/None; Excel must have saved it) |
| Python stdlib (`json`, `csv`, `argparse`, `pathlib`, `statistics`, `zoneinfo`) | 3.13 | CSV input path, JSON write, CLI | The raw-logger-CSV path needs no extra deps. Look up columns by header text, not index |
| pytest | already in repo | Converter tests | Fixture = tiny synthetic xlsx built with openpyxl in `tmp_path` |

Put in a separate `requirements-dashboard.txt` (`openpyxl==3.1.5`), NOT in the logger's `requirements.txt`. Layout: `tools/build_dashboard_data.py` (or `src/dashboard/`), with `--input`, `--output`, `--sheet`. Auto-detect `.xlsx` vs `.csv`.

**Do not use pandas** (3.0.6 current): a 40-column x 23k-row sheet needs no dataframe; pandas drags in numpy and a heavy install on a "corporate Windows" machine, and its `read_excel` loads the full sheet via openpyxl anyway. If someone later wants it, it is a drop-in at the reading step only.

### Deploy
| Choice | Detail | Why |
|--------|--------|-----|
| GitHub Actions workflow publishing `site/` | `.github/workflows/pages.yml` on push to `main`: `actions/checkout`, `actions/configure-pages`, `actions/upload-pages-artifact` (path: `site`), `actions/deploy-pages`; permissions `pages: write`, `id-token: write`; repo Settings > Pages > Source = "GitHub Actions" | No built-output committed to a branch, `site/` can be any name (not forced to `/docs`), a future build step can be added without migration. Pin to current major tags at implementation time (configure-pages v5, upload-pages-artifact v3/v4, deploy-pages v4 as of my knowledge; MEDIUM confidence, check the Marketplace pages when writing the file) |
| Alternative (acceptable, simplest): `/docs` folder on `main` | Settings > Pages > Deploy from branch > `main` `/docs` | Zero workflow. Fine if the user prefers; rename `site/` to `docs/` |
| Not `gh-pages` branch | Needs a push-to-branch step or action and creates a second history | No benefit here |

Repo needs a GitHub remote (none yet) and must be **public** for Pages on a free plan (user already accepted public data). Add `.gitignore` entries or keep `Results_1st.Run/` (22 MB xlsx) and `WTVB01 documents/` out of the first push unless intended to be public; the site only needs `site/`.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Build | None (vanilla ES modules) | Vite + React/Svelte/Vue | Node toolchain + CI build for a single page; recompute logic is pure functions, no component tree needed |
| Chart | uPlot 1.6.32 | ECharts 6.1.0 | Excellent (dataZoom, large mode, heatmap series could replace the matrix) but about 1 MB min (tree-shaken needs a build) and heavier rendering; would otherwise be my choice if Vite were accepted |
| Chart | uPlot | Plotly (`plotly.js-dist-min` 4.1.2) | About 4+ MB bundle, slow on 70k points in SVG/WebGL modes, overkill |
| Chart | uPlot | Chart.js 4.5.1 + decimation plugin | Needs `chartjs-plugin-zoom` + a date adapter, decimation requires parsing off and sorted data, visibly slower on 23k x 3 live-updating series, and decimation hides single-sample impact spikes (the thing being measured) |
| Map | Leaflet 1.9.4 + leaflet.heat | MapLibre GL 6.13.0 / deck.gl | Vector/WebGL stack needs tile style/key hosting, bigger, heavier; MapLibre has a native heatmap layer, but with 23k points and a raster OSM base Leaflet is sufficient and simpler. Revisit only if tilted/3D or >500k points |
| Data | Columnar JSON | Float32 binary / Parquet / Arrow | Extra decode code and an unreadable artifact for 23k rows; JSON is diffable and debuggable |
| Data | Plain JSON (Pages gzips) | Pre-gzipped `.json.gz` + pako/fflate (fflate 0.8.3) | Not needed; `DecompressionStream('gzip')` exists natively if ever required |
| Converter | openpyxl read_only | pandas / calamine | See above; `python-calamine` is faster but another binary dependency |
| Deploy | Actions workflow | gh-pages branch | See above |

## Integration Points

- Converter output schema is the contract between Python and JS: version it (`meta.schema: 1`) and include `meta.run` (id, date, train, unit/line) so the multi-run selector (deferred) can be added later without redesign.
- Converter must keep AZ's -1 g convention and "dinamico = medido - mediana do eixo" consistent with the workbook; the JS "rest-level offset" parameter replaces the median at runtime, so ship the **medido** columns and let JS derive dinamico.
- Downsample for display only: uPlot handles 23k points natively, so no downsampling is needed. Keep full data for analysis.
- Heat map weights come from JS-computed metric (e.g. |dominant dynamic| or impact count) on points with non-null GPS; 2,020 rows have no coordinates, so the track must break (not interpolate) across gaps or clearly mark interpolated segments (GPS fix only about every 30 s; consider forward-filling lat/lon per fix window in the converter, flagged in meta).
- Vendor files into `site/vendor/` (`uPlot.iife.min.js` + `uPlot.min.css`, `leaflet.js/css` + marker images, `leaflet-heat.js`) at the pinned versions; record the versions in `site/vendor/README.md`. Reason: no CDN outage or version drift, works offline, and no SRI bookkeeping.
- Tests: JS analysis module in plain ESM can be tested with `node --test` (Node built in, no npm install), checking results against `meta.reference` from the workbook. Optional.

## Installation

```bash
# Converter (dev-only, separate from logger requirements.txt)
pip install openpyxl==3.1.5

# Vendor the front-end libs once (no package.json required)
# uPlot 1.6.32: dist/uPlot.iife.min.js, dist/uPlot.min.css
# Leaflet 1.9.4: dist/leaflet.js, leaflet.css, images/*
# leaflet.heat 0.2.0: dist/leaflet-heat.js
# e.g. via: npm pack uplot@1.6.32 leaflet@1.9.4 leaflet.heat@0.2.0  (extract into a scratch dir, copy the files)
```

## What NOT to add

- Node/Vite/webpack, React/Vue/Svelte, TypeScript compile step, Tailwind build.
- pandas/numpy, Jupyter, a database, any backend or serverless function.
- Plotly, ECharts, Chart.js, MapLibre, deck.gl (see table).
- A date library (moment/dayjs): native `Intl` is enough.
- Analytics/trackers, API-key map providers.

## Confidence

| Item | Confidence | Basis |
|------|------------|-------|
| Package versions (uPlot, Leaflet, leaflet.heat, openpyxl, alternatives) | HIGH | Queried npm registry / PyPI on 2026-10-08 |
| uPlot suitability/performance for 23k x 3, sync, zoom | MEDIUM | Training knowledge of uPlot design and benchmarks; not re-verified against its docs this session |
| leaflet.heat compatibility with Leaflet 1.9.4 | MEDIUM | Long-standing common pairing; plugin has not changed since 2019 |
| Pages gzip on the fly, Actions versions | MEDIUM | Not verified against current GitHub docs; check when writing the workflow |
| openpyxl `data_only` returning cached values for treated sheet | MEDIUM | Must be confirmed on the actual workbook in the converter phase (cells could be formulas without cached values) |

## Sources

- npm registry (uplot, leaflet, leaflet.heat, echarts, plotly.js-dist-min, chart.js, maplibre-gl, fflate) and PyPI (openpyxl, pandas): version queries, 2026-10-08
- Project context: `.planning/PROJECT.md`
