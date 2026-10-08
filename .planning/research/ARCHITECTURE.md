# Architecture Patterns

**Domain:** Static field-run dashboard (accelerometer + GPS) added to an existing Python logger repo
**Milestone:** v1.3 Field Run Dashboard
**Researched:** 2026-10-08
**Overall confidence:** HIGH for the analysis pipeline and data schema (verified by re-implementing the workbook logic and reproducing the golden numbers from the actual file); MEDIUM for deploy/CI details (standard GitHub Pages Actions flow, not run here); LOW for the raw-logger-CSV adapter (trecho assignment is an unsolved design question, see Gaps).

## Verified Facts That Drive the Design

I loaded `Results_1st.Run/Final - Monitoramento de Sapata coletora - Linha 04.xlsx` (cached values, sheet `02 — DADOS TRATADOS`) and re-implemented the workbook formulas in plain Python. Result at default parameters, **exact match** with the workbook: Normal 21,031 / Leve 1,611 / Moderado 512 / Severo 173 / Crítico 56; 2,352 eventos; 1,749 impactos; 101 pontos. This proves the rules below are complete and sufficient (HIGH confidence).

| Fact | Evidence (formulas in sheet 02 / 11) | Design consequence |
|------|--------------------------------------|--------------------|
| Dynamic = measured − **median of whole run per axis** (`MED_AX/AY/AZ` = 0.0458984375 / −0.0185546875 / −0.9853515625) | col N,O,P `=I2-MED_AX` | "Rest-level offset" is a real parameter; JS must compute the median itself (exact with integer LSB, see below) |
| Dominant axis = max `abs(dynamic)`; ties resolved X, then Y, then Z | col R `IF(AND(ABS(N)>=ABS(O),ABS(N)>=ABS(P)),"Longitudinal",IF(ABS(O)>=ABS(P),"Lateral","Vertical"))` | Port the tie-break verbatim |
| Class on `abs(dominant dynamic)` with **lower bound inclusive** (`>=`) | col T nested `IF(AO>=THR_C ...)` | Thresholds are 4 numbers; `Normal` is "below Leve" |
| Evento = class != Normal (i.e. `>= Leve`) | col U | Event threshold is tied to the Leve limit |
| Impacto = run of **consecutive rows** with Evento=1; class = class of the run's peak; peak = first strict maximum in the run | cols W (start), AX/AY/AZ (peak, `N(AX4)<AO5` strict) | Grouping param = tolerated gap (default 0 = workbook) |
| Ponto de impacto = per **location key**, the Evento row with max `abs(dominant)`; ties go to the earliest row (`key = AO - ROW()*1e-10`) | cols AP, Z, AT | Location key is the 6-decimal coordinate string, or `"SEM GPS \| <trecho>"` when no fix |
| Location keys **recur at different times**: 115 distinct keys vs 142 contiguous coordinate runs (train revisits/stands at same fix) | measured | Key points by coordinate (loc id), NOT by fix index or time segment |
| 15 of the 101 pontos are "SEM GPS \| trecho" groups (2,020 rows without coordinates) | measured | No-GPS points exist in KPIs/matrix but cannot be drawn on the map; show a footnote |
| Filters in the Painel are `COUNTIFS` over **globally precomputed flags** (Ev, ImpPk, Ponto): flags first, filters second | `00 — PAINEL` formulas | **Derive on the full series, then filter by the attributes of the flagged row.** A time window does not re-split an impact; it counts by the peak row. This makes filtered numbers match the workbook and keeps validation trivial |
| All 70,149 accel values are exact multiples of 1/2048 g (max deviation 0.0) | measured; also true for raw logger CSV (e.g. 0.03515625 = 72/2048) | Store accel as **integer LSB counts** (`per_g: 2048`). Exact medians, exact threshold comparisons, ~4x smaller than floats, zero rounding drift vs workbook |
| Treated sheet time has **1 s resolution** (3–6 rows share a second; 4,669 distinct seconds), monotonic, one gap of 567 s (the sentido 1→2 turnaround at row 10,839) | measured | Converter reconstructs sub-second offsets evenly within each second and flags `t_quality`; JS never assumes uniform 5 Hz |
| Sentido flips once (row 10,839); 22 contiguous trecho runs for 21 trechos | measured | RLE for trecho/sentido (2 + 22 entries) instead of per-row columns |

**Source-of-truth decision:** converter reads **only** sheet `02 — DADOS TRATADOS` (cached values via `data_only=True`). It must never read sheet `01` (lost decimal separators). A mandatory sanity gate: every accel value must satisfy `abs(v*2048 - round(v*2048)) < 1e-6`, and every GPS point must fall inside the configured envelope (lat −22.92…−22.88, lon −43.22…−43.16); violations abort the conversion (`--strict`, default) or are reported. If cached values are empty (file saved by a tool that does not recalc), fail with a clear message to open/save in Excel.

## Recommended Architecture

```
                 BUILD TIME (developer machine, Python, dev-only deps)
 +---------------------------+     +-----------------------------------------+
 | Results_1st.Run/*.xlsx    |     | tools/dashboard_converter/              |
 | (sheet 02 cached values)  +---->|  sources/xlsx_treated.py  (adapter 1)   |
 | later: data/wtvb01_*.csv  +---->|  sources/logger_csv.py    (adapter 2)   |
 +---------------------------+     |  model.py  RunData (neutral, validated) |
                                    |  gps.py    fixes, loc ids, speed        |
                                    |  analysis_ref.py  Python reference impl |
                                    |  crosscheck.py    vs workbook flags     |
                                    |  writer.py  -> run JSON + golden JSON   |
                                    +--------------------+--------------------+
                                                         |
                          site/data/run-<id>.json        |   tests/js/golden/run-<id>.golden.json
                          (deployed, committed)          v   (NOT deployed, committed)
 ------------------------------------------------------------------------------------------
                 RUN TIME (browser, static files, no backend)
 +---------+   +-----------+   +--------------------------------------------------------+
 | fetch   |-->| core/data |-->| core/pipeline (pure functions over typed arrays)       |
 | JSON    |   | decode    |   |  S1 dynamics -> S2 classify -> S3 events/impacts       |
 +---------+   +-----------+   |  -> S4 points -> S5 filter mask -> S6 aggregates       |
                                +----------------------+---------------------------------+
                                                       | products (immutable per recompute)
   +-----------+  patch   +----------+  subscribe      v
   | ui/controls|-------->| state.js |-------> views: kpis, charts(uPlot), map(Leaflet),
   | (inputs)   |<--------| store    |         matrix, ranking table
   +-----------+  render  +----------+
                  hash-sync (URL #fragment) for shareable parameter sets
```

### Directory Layout (NEW unless marked)

```
Accel_mro/
├── main.py, src/, tests/, config.yaml, requirements.txt     (EXISTING, untouched)
├── requirements-dashboard.txt        NEW  openpyxl==3.1.5 (dev-only; keeps logger requirements.txt clean)
├── .gitignore                        NEW  repo currently has none: ignore __pycache__/, logs/, data/*.csv,
│                                          Results_1st.Run/*.xlsx (22 MB), WTVB01 documents/, *.docx
├── tools/
│   └── dashboard_converter/          NEW  python package, run: python -m tools.dashboard_converter ...
│       ├── __init__.py
│       ├── __main__.py / cli.py      argparse: --input --output --run-id --title --strict --emit-golden
│       ├── model.py                  RunData dataclass: arrays + meta (adapter-neutral contract)
│       ├── sources/
│       │   ├── xlsx_treated.py       reads sheet 02 by HEADER TEXT (not column index)
│       │   └── logger_csv.py         (phase 9) uses SensorReading CSV columns; needs run descriptor
│       ├── gps.py                    envelope check, coordinate->loc id (6 dp), fix runs, speed km/h
│       ├── quantize.py               g -> LSB ints, sanity gate, sub-second time reconstruction
│       ├── analysis_ref.py           Python reference of workbook rules (same API shape as JS pipeline)
│       ├── crosscheck.py             row-level compare vs workbook cached flags (xlsx source only)
│       └── writer.py                 schema v1 JSON + golden JSON
├── site/                             NEW  the published directory (Pages artifact root)
│   ├── index.html                    pt-BR, relative URLs only
│   ├── .nojekyll
│   ├── css/app.css
│   ├── js/
│   │   ├── main.js                   bootstrap: load, init store, mount views
│   │   ├── state.js                  store, defaults, URL-hash sync, stage scheduler
│   │   ├── core/                     PURE (no DOM, no Leaflet/uPlot): importable from Node tests
│   │   │   ├── data.js               decode JSON -> typed arrays
│   │   │   ├── dynamics.js           S1
│   │   │   ├── classify.js           S2
│   │   │   ├── events.js             S3 + S4
│   │   │   ├── filter.js             S5
│   │   │   ├── aggregate.js          S6 (KPIs, class counts, matrix, ranking, heat weights, trecho priority)
│   │   │   └── defaults.js           thresholds, class names/colours (single source), param schema
│   │   ├── ui/                       controls.js, kpis.js, charts.js, map.js, matrix.js, table.js
│   │   └── i18n-pt.js                all user-visible strings and number/date formatting (pt-BR)
│   ├── vendor/                       uPlot, Leaflet, leaflet.heat (pinned, vendored; see STACK.md)
│   └── data/run-2026-10-02-l4-t102.json
├── tests/                            EXISTING dir, pytest (testpaths = tests)
│   ├── test_dashboard_converter_*.py NEW  flat naming like existing tests; fixtures built in tmp_path
│   ├── fixtures/parity_cases.json    NEW  Python-generated random cases + expected outputs (JS parity)
│   └── js/                           NEW  node:test files (pytest ignores non-test_*.py)
│       ├── core.golden.test.mjs
│       ├── core.params.test.mjs
│       ├── core.parity.test.mjs
│       └── golden/run-2026-10-02-l4-t102.golden.json
└── .github/workflows/pages.yml       NEW  test + deploy
```

Why `site/` and not `docs/`: `docs/` invites confusion with `.planning/` and the many `.docx/WTVB01 documents`; a Pages **Actions** deploy can publish any folder, and the same workflow can gate deploy on tests. If the user prefers zero-CI, `site/` can be renamed `docs/` and Pages set to "Deploy from branch /docs" (loses the test gate).

Why keep tests outside `site/`: everything under `site/` is published. Node's built-in `node --test` (Node 24 is installed locally) means **no `package.json`, no node_modules, no npm** is needed. If a bundler or Vitest is ever adopted, that is a deliberate later decision.

### Component Boundaries

| Component | Responsibility | Communicates With | New/Modified |
|-----------|---------------|-------------------|--------------|
| `tools/dashboard_converter` | Source adapters -> neutral `RunData` -> schema v1 JSON + golden; validation gates | Reads xlsx/CSV; writes `site/data`, `tests/js/golden` | NEW |
| `analysis_ref.py` | Python reference of the severity/event/impact/point rules | converter crosscheck, pytest, parity-fixture generator | NEW |
| `site/js/core/*` | Pure pipeline S1-S6 over typed arrays | `state.js` only | NEW |
| `site/js/state.js` | Holds params/filters/display, schedules stages, notifies views, syncs URL hash | `core/*`, `ui/*` | NEW |
| `site/js/ui/*` | Rendering + input widgets; no business logic | `state.js` | NEW |
| `src/`, `main.py`, logger tests | Unchanged. Logger CSV is only an *input* to adapter 2 | n/a | EXISTING, untouched |
| `SensorReading` / CSV columns | Read-only contract for adapter 2 (21 columns, GPS last 3) | `sources/logger_csv.py` | EXISTING, read-only |
| `requirements.txt` | Must NOT gain openpyxl (test_structure.py asserts its content; logger stays lean) | n/a | EXISTING, untouched |
| `.github/workflows/pages.yml` | pytest + `node --test` + deploy `site/` | GitHub | NEW |

No existing file needs modification for v1.3 (only `.gitignore`, README pointer and `.planning/*` docs are added/edited). The existing 95 tests are unaffected as long as `tools/` is not under `src/` (test_docs.py globs `src/**/*.py` for naive `datetime.now()`).

## JSON Data Schema (v1): raw samples, not pre-aggregated

**Decision:** ship the *measured samples* (quantized, columnar) plus param-independent structure (GPS fixes, trecho/sentido runs). Ship **no** class, dynamic value, event, impact or point arrays: all of those change when a threshold, offset or grouping parameter changes, so they are computed in JS (S1-S6). Python computes only things that do **not** depend on user-adjustable parameters.

| Computed in Python (converter) | Computed in JS (live) |
|--------------------------------|-----------------------|
| Decimal-separator-safe values (use treated sheet), LSB quantization | Rest-level offset (median/mean/manual) |
| GPS envelope validation; coordinate->loc id (6 dp); fix speed km/h (haversine, dt<=120 s, <=50 km/h) | Dynamic axes, dominant axis, severity value |
| Trecho/sentido normalization (sheet's standardized names, order) | Class per sample (thresholds) |
| Sub-second time reconstruction | Events, impact grouping, impact peaks, pontos de impacto |
| Golden/reference numbers (separate file, tests only) | Filters, KPIs, matrix, ranking, heat weights, trecho priority |

Rationale for "raw samples": 23,383 rows x (3 ints + dt + 2 RLE columns) is about 350-450 KB raw, roughly 100 KB gzipped (Pages gzips text). Pre-aggregating would make every slider an impossible request. Even at 10 Hz for 8 h (288k rows) typed-array recompute stays well under 100 ms; only payload size would need chunking then (not now).

```jsonc
{
  "schema": 1,
  "meta": {
    "run_id": "2026-10-02-l4-t102",
    "title": "VLT Carioca · Linha 4 · Trem 102 (MRO 102) · Sapata coletora",
    "sensor_id": "wtvb01",
    "source": { "kind": "xlsx_treated", "file": "Final - Monitoramento ... Linha 04.xlsx",
                "sheet": "02 — DADOS TRATADOS", "sha256": "…" },
    "t0": "2026-10-02T00:30:56-03:00", "tz": "America/Sao_Paulo",
    "n": 23383, "t_quality": "second-resolution; sub-second reconstructed",
    "axes": { "ax": "Longitudinal", "ay": "Lateral", "az": "Vertical" },
    "workbook_defaults": { "thresholds_g": [0.5, 1, 2, 4], "rest": "median",
                           "max_speed_kmh": 50, "max_fix_gap_s": 120 },
    "converter_version": "1.0.0", "generated_at": "2026-10-08T…"
  },
  "t": { "dt_ms": [0, 200, 200, 190, …] },           // delta-encoded, first = 0 -> cumulative sum in JS
  "accel": { "unit": "lsb", "per_g": 2048,           // fallback {"unit":"g"} + float arrays if a source is not on the 1/2048 grid
             "ax": [94, 98, …], "ay": [-38, …], "az": [-2015, …] },
  "sentidos": [ { "code": "TIG-PXV", "name": "Sentido 1 — Terminal Gentileza → Praça XV" },
                { "code": "PXV-TIG", "name": "Sentido 2 — Praça XV → Terminal Gentileza" } ],
  "trechos":  [ { "name": "Terminal Gentileza – Rodoviária", "sentido": 0, "order": 1 }, … ],   // 21
  "sentido_runs": [[0, 0], [10839, 1]],              // [start_index, sentido_idx]
  "trecho_runs":  [[0, 0], [412, 1], …],             // [start_index, trecho_idx]; 22 runs
  "gps": {
    "lat": [-22.898793, …], "lon": [-43.211217, …],  // one entry per contiguous coordinate run (142), 6 dp
    "loc": [0, 1, 2, 1, …],                          // loc id per fix: equal coordinates -> equal id (113 ids)
    "speed_kmh": [0.96, null, …],                    // precomputed from fixes; null = invalid/unavailable
    "status": [0, 0, 1, …]                           // 0 original, 1 corrigido (separador decimal), 2 fora da região (excluded)
  },
  "fix_runs": [[0, 0], [186, 1], …, [9120, -1]]      // [start_index, fix_idx or -1 = sem GPS]
}
```

Rules:
- RLE (`*_runs`) for piecewise-constant columns; JS expands once into `Int16Array` per sample. This avoids repeating 21,363 identical-lat/lon rows and keeps location identity explicit.
- Accel as integer LSB: JS keeps `Int16Array`, converts with `/ 2048` at S1. The 4-decimal rounding suggested in STACK.md is **not** recommended: it perturbs the median offset (e.g. −0.0185546875 -> −0.0186) and can flip samples sitting exactly on a threshold, breaking parity with the workbook.
- `schema` integer; JS refuses unknown majors with a pt-BR error banner.
- File name carries `run_id` (`run-<id>.json`); `main.js` reads the id from one constant/`?run=` param. Multi-run selector remains out of scope, but nothing in the schema blocks it.
- Golden file (tests only) is a separate object, **not** shipped to the browser:

```jsonc
{ "run_id": "...", "oracle": "workbook-cached-values",
  "class_counts": [21031, 1611, 512, 173, 56],
  "class_hash_fnv1a": "…",                 // hash of the per-row class byte array (row-level check without 23k values)
  "eventos": 2352,
  "impact_starts": [ … 1749 sample indices … ],
  "impacts_by_class": [0, 1112, 423, 159, 55],
  "point_rows": [ … 101 sample indices … ],
  "points_by_class": [0, 8, 16, 36, 41],
  "trecho_matrix_points": [[…5 ints…] x 21], "trecho_matrix_impacts": [[…] x 21],
  "top_points": [ { "row": 18631, "value_g": 11.66, "axis": "az", "trecho": "Santo Cristo – Cordeiro da Graça" } ],
  "medians_lsb": [94, -38, -2018],
  "sentido_counts": { "records": [10839, 12544], "eventos": [1262, 1090] } }
```

(Numbers in `class_counts`..`points_by_class`, `sentido_counts` come from `WORKBOOK-CRITERIA.md`/my reproduction; `point_rows`, `impact_starts`, `top_points.row` are filled by the converter from the workbook's own cached flag columns `AT`, `W`, `U`.)

## Client-Side State / Recompute Pipeline

### State shape (one object, three slices)

```js
state = {
  params: {                                   // ANALYSIS: change S1..S4  (+ everything downstream)
    thresholds: [0.5, 1, 2, 4],               // Leve, Moderado, Severo, Crítico lower bounds (g), validated ascending
    rest: { mode: 'median' | 'mean' | 'manual', manual: [0, 0, 0] },   // g per axis
    grouping: { maxGapSamples: 0 },           // 0 == workbook (strictly consecutive)
    pointKey: 'coordenada'                    // reserved: future radius-based clustering
  },
  filters: {                                  // S5 only
    sentidos: Set, trechos: Set, eixos: Set<'ax'|'ay'|'az'>, classes: Set,
    window: [tStartMs, tEndMs] | null
  },
  display: {                                  // views only, never trigger S1-S5
    heatMetric: 'severidade' | 'contagem' | 'ax' | 'ay' | 'az',
    heatBasis: 'pontos' | 'impactos' | 'medicoes',
    heatRadius: 25, heatBlur: 15, heatIntensity: 1,
    matrixBasis: 'pontos' | 'impactos' | 'medicoes',
    seriesMode: 'medido' | 'dinamico', showEventMarkers: true, rankingTopN: 20
  }
}
```

### Stages and dependency keys

| Stage | Output (typed arrays unless noted) | Depends on | Cost |
|-------|------------------------------------|------------|------|
| S1 dynamics | `dx,dy,dz` (Float64), `domAxis` (Uint8 0/1/2), `domAbs` (Float64), `medians` | `params.rest` | O(n) + O(n log n) median, only when rest changes |
| S2 classify | `cls` (Uint8 0..4) | S1, `params.thresholds` | O(n) |
| S3 events + impacts | `ev` (Uint8), `impacts[]` {start,end,peak,cls,nEv} + `impactOfSample` | S2, `params.grouping` | O(n) |
| S4 points | `points[]` {row, locKey, cls, nEvAtLoc} | S2, S3 flags, loc ids, trecho runs | O(n) with a `Map` |
| S5 filter | `mask` (Uint8) over samples; `impactKeep`, `pointKeep` derived from the flagged row's attributes | S1-S4, `filters` | O(n) |
| S6 aggregate | KPIs, class x axis counts, trecho x class matrix, ranking, heat weights, per-trecho priority, series slices | S5, `display` | O(n) |

`state.js` keeps `{key -> product}` per stage where key = `JSON.stringify` of that stage's inputs; `set(patch)` marks the lowest changed slice, runs stages from there, and notifies subscribers once per animation frame (inputs of type range are debounced about 80 ms). Views subscribe to a product name and re-render only if the reference changed. With 23k samples a full recompute is a few ms, so caching is an optimization, not a requirement; do **not** add a framework, reactive library or web worker for this size. (Worker only if a run exceeds roughly 500k samples.)

### Core algorithm (port of workbook rules)

```js
// S3: event + impact grouping. gap = params.grouping.maxGapSamples (0 == workbook)
export function groupImpacts(domAbs, cls, thrLeve, gap) {
  const n = cls.length, impacts = [];
  let cur = null, lastEv = -1e9;
  for (let i = 0; i < n; i++) {
    if (domAbs[i] < thrLeve) continue;               // not an event (cls > 0 <=> domAbs >= thrLeve)
    if (cur === null || i - lastEv - 1 > gap) {      // gap=0: any normal sample between events splits
      cur = { start: i, end: i, peak: i, nEv: 0 };
      impacts.push(cur);
    }
    if (domAbs[i] > domAbs[cur.peak]) cur.peak = i;  // strict ">" -> first maximum wins (workbook tie rule)
    cur.end = i; cur.nEv++; lastEv = i;
  }
  for (const m of impacts) m.cls = cls[m.peak];
  return impacts;
}

// S4: one point per location key (first strict max wins)
export function pointsByLocation(domAbs, cls, locOfSample, trechoOfSample) {
  const best = new Map();
  for (let i = 0; i < cls.length; i++) {
    if (cls[i] === 0) continue;
    const k = locOfSample[i] >= 0 ? locOfSample[i] : -1 - trechoOfSample[i];   // "SEM GPS | trecho"
    const b = best.get(k);
    if (b === undefined || domAbs[i] > domAbs[b]) best.set(k, i);
  }
  return [...best.values()].sort((a, b) => a - b);
}
```

Median for S1 must replicate Excel `MEDIAN` (average of the two middle values for even n); working on LSB integers makes it exact.

Filter semantics (documented in the UI as a tooltip "Contagem pelo registro de maior valor"): measurements are filtered by their own attributes; impacts by their peak sample's sentido/trecho/eixo/class and by the peak's time against the window; points by the point row. A class filter on impacts/points uses the class of the peak/point row. These are exactly the workbook's `COUNTIFS(... T_ImpPk,1 ...)` / `T_Ponto,1` semantics.

## Replicating and Validating Against the Workbook

Three independent safety nets, in order of strength:

1. **Convert-time cross-check (Python, xlsx source only)** - `crosscheck.py` runs `analysis_ref.py` on the quantized arrays and compares **row by row** with the workbook's own cached columns: `CLASSIFICAÇÃO` (T), `Evento` (U), `Início Impacto` (W), `PICO DO IMPACTO` (AZ), `PONTO DE IMPACTO` (AT), `Eixo Dominante` (R). Any mismatch fails conversion (`--strict`). It also asserts the headline numbers 21,031 / 2,352 / 1,749 / 101 when the source is this run. This validates the *reference*, and the converter is also the only place that sees the workbook.
2. **JS golden test (`node --test`)** - loads `site/data/run-*.json`, runs S1-S6 with `defaults.js` thresholds, and asserts equality with the golden file: class counts, `class_hash_fnv1a`, `impact_starts` (all 1,749 indices), `point_rows` (all 101), class splits (impactos 1,112/423/159/55; pontos 8/16/36/41), trechos sem Crítico = 6, trecho com mais eventos = Vila Olímpica – Central (304), #1 ponto (01:53:16, Santo Cristo – Cordeiro da Graça, AZ −11.66 g), medians. Also asserts the JS default thresholds equal `meta.workbook_defaults` so the UI "Restaurar padrão" can never drift from the workbook.
3. **Python<->JS parity on random data** - `tests/fixtures/parity_cases.json` is generated by a small script from `analysis_ref.py` (seeded random series with injected edge cases: values exactly on a threshold, ties for dominant axis, ties for peak, events at array start/end, runs separated by gap 1/2, no-GPS stretches, repeated coordinates). `core.parity.test.mjs` replays the same cases through the JS pipeline for several parameter sets (non-default thresholds, rest offset manual, grouping gap 0/1/3). This is what protects the **non-default** parameters, which no workbook number covers.

Additional property tests (JS and/or Python): raising any threshold never increases eventos; `gap` is monotone non-increasing in impact count; sum of class counts == n; filters never change the pre-filter totals; impact count with no filters equals count of event runs; every point row is an event row.

Float note: all comparisons happen between values derived from exact binary fractions (`LSB/2048` minus a median that is itself `k/2048` or half of one), so JS and Python IEEE doubles agree bit for bit; no epsilon is needed. User-typed thresholds like `0.3` are compared as doubles, which is the same as Excel for realistic inputs. The one place to be careful is `manual` offsets typed in decimal; round them to the LSB grid only if parity with a decimal workbook edit is wanted (not required).

## Testing Approach

| Layer | Tool | What |
|-------|------|------|
| Converter unit | pytest in `tests/`, synthetic tiny xlsx built with openpyxl in `tmp_path` | header-based column lookup; decimal/LSB gate; GPS envelope; loc ids; RLE round-trip; sub-second reconstruction; schema shape; clear errors (missing sheet, empty cached values) |
| Converter vs reality | pytest marked `skipif(not Path("Results_1st.Run/....xlsx").exists())` | full cross-check against the real workbook; runs locally, skipped in CI where the 22 MB xlsx is not committed |
| Reference analysis | pytest | hand-computed mini cases (boundary, ties, gap) |
| JS core | `node --test tests/js` | golden + parity + properties (above); import `site/js/core/*.js` as ES modules (name them `.js` and add `"type":"module"` via `site/js/package.json`, or use `.mjs`; pick `.mjs` for `core/` to avoid any package.json) |
| UI smoke | one manual checklist in the phase plan; optional Playwright later | Pure `core` carries the risk; UI is thin rendering. Do not add a browser test stack in v1.3 |
| Existing logger | pytest (95 tests) | Must stay green; run in the same CI job |

## Deploy Flow (GitHub Pages)

1. One-time: create the GitHub repo (none exists; local branch is `master`, PR-main is `main` - rename or trigger the workflow on both), push, set **Settings > Pages > Source: GitHub Actions**. Repo must be public on a free plan (user accepted public data).
2. `.github/workflows/pages.yml` on push to the default branch: job `test` (checkout, setup-python 3.12 + setup-node, `pip install -r requirements.txt -r requirements-dashboard.txt` - winrt lines are `sys_platform == "win32"`-guarded so Linux runners are fine - `pytest`, `node --test tests/js`), then job `deploy` (`needs: test`; `actions/configure-pages`, `actions/upload-pages-artifact` with `path: site`, `actions/deploy-pages`; `permissions: pages: write, id-token: write`).
3. The run JSON is a **committed build artifact** produced locally by the converter (the xlsx stays out of git or in Git LFS-free local storage). CI does not run the converter on the real workbook; it validates the committed JSON through the JS golden test, which is the integrity check that matters. `meta.source.sha256` gives provenance.
4. Pages is served from `https://<user>.github.io/<repo>/`: **every URL must be relative** (`./data/...`, `./vendor/...`). A leading `/` breaks the project site. ES modules and `fetch` do not work from `file://`; local preview is `python -m http.server -d site`.
5. Add `site/.nojekyll`. Tile layer is OSM with attribution; no API keys anywhere.

## Patterns to Follow

### Pattern 1: Pure core, thin views
**What:** All numbers shown to users come from `core/*` functions that take typed arrays + plain objects and return plain objects. Views never recompute classes or counts.
**When:** Always. It is what makes golden/parity tests meaningful.

### Pattern 2: Derive globally, then filter by flagged row
**What:** Compute events/impacts/points over the full series; filters select among flagged rows by their attributes.
**Why:** Matches workbook `COUNTIFS` semantics so filtered KPIs equal the workbook's; avoids ambiguous "impact cut in half by the time window".

### Pattern 3: Single source for classes/colours/labels
**What:** `defaults.js` holds class names, order, colours (Normal verde, Leve amarelo, Moderado laranja, Severo vermelho, Crítico roxo), default thresholds, axis names. Charts, map, matrix, legend all import it.

### Pattern 4: Adapter -> neutral RunData -> writer
**What:** Each source (treated xlsx, raw logger CSV) only produces `RunData`; validation, quantization, GPS processing and writing are shared. Adding the raw-CSV path later touches one file.

### Pattern 5: URL-hash state
**What:** `#t=0.5,1,2,4&rest=median&gap=0&s=1&...` serialized from `state`; lets managers share a configured view without any backend. Only non-default values are written.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shipping classified/aggregated data
**Why bad:** Sliders become impossible; Python and JS rules drift into two sources of truth.
**Instead:** Samples + structure only; rules live once in JS (with a Python reference used only to test).

### Anti-Pattern 2: Reading sheet `01 — DADOS ORIGINAIS`
**Why bad:** Decimal separators lost; the workbook itself repairs them with heuristics (power-of-ten + 1/2048 grid) that the converter would have to duplicate.
**Instead:** Sheet 02 cached values + the LSB/envelope sanity gates.

### Anti-Pattern 3: Per-sample lat/lon columns and fix-index points
**Why bad:** Bloats the file, and fix-index/segment keys split locations the workbook merges (115 keys vs 142 runs -> wrong 101).
**Instead:** `fix_runs` + `gps.loc` ids.

### Anti-Pattern 4: Rounding accel to 4 decimals "to save bytes"
**Why bad:** Breaks exact median/threshold parity (see above); integers are smaller anyway.

### Anti-Pattern 5: Putting converter or tests inside `src/` or `site/`
**Why bad:** `src/` is the logger runtime package (test_docs scans it); `site/` is published verbatim.

### Anti-Pattern 6: Assuming uniform 5 Hz
**Why bad:** Treated sheet timestamps are 1 s; rows per second vary 3-6; one 567 s gap exists. Use `t.dt_ms` cumulative values; grouping is by sample order (as the workbook), optionally by time gap later.

## Scalability Considerations

| Concern | This run (23k) | 10 Hz, 8 h (288k) | Multi-run (future) |
|---------|----------------|-------------------|--------------------|
| Payload | ~100 KB gz | ~1.5 MB gz; consider chunked `dt_ms`/accel or binary | one JSON per run + `runs.json` manifest |
| Recompute | few ms | ~50-100 ms on main thread; debounce | per selected run only |
| Chart | uPlot handles 23k x 3 directly | min/max decimation per pixel column | same |
| Heat/markers | 101 points, ~115 locations | cluster markers | same |

## Suggested Build Order (dependencies drive it)

0. **Repo hygiene (parallel, small):** `.gitignore`, create GitHub remote, `requirements-dashboard.txt`, empty `tools/` and `site/` skeletons.
1. **Converter + schema + reference + cross-check** (`tools/dashboard_converter`, pytest). Output: committed `site/data/run-*.json` and golden. Gate: row-level equality with the workbook and 21,031/2,352/1,749/101. Everything downstream depends on the schema, so freeze schema v1 here (a tiny hand-made JSON lets phase 2 start in parallel if needed).
2. **JS core pipeline + node tests** (`site/js/core`, `tests/js`). No UI. Gate: golden + parity + property tests green. This is the highest-risk, highest-value step, and the cheapest to test in isolation.
3. **Site shell + state store + KPIs + threshold/filter controls + Pages deploy skeleton.** Deploy early (even with only KPIs) to catch the relative-path/`.nojekyll`/Actions-setup issues before features pile up. Gate: live KPI recompute equals golden at defaults; public URL reachable.
4. **Time-series charts** (uPlot, 3 axes, medido/dinâmico, event markers coloured by class, brush -> `filters.window`). Depends on S1-S3.
5. **Map** (Leaflet track from `fix_runs`, impact/point markers by class, leaflet.heat driven by `display.heat*`). Depends on S4/S6 and GPS arrays; shares filters with charts.
6. **Trecho x severidade matrix** (+ click-to-filter, trecho priority badge). Depends on S6 aggregates.
7. **Analysis-parameter UI** (rest offset modes, grouping gap) + URL-hash sharing + "Restaurar padrão/valores do relatório". Logic already exists and is tested from step 2, so this is mostly inputs.
8. **Polish and release:** pt-BR copy pass, responsive layout for management on tablets/phones, accessibility (matrix as real `<table>`), attribution, README section on regenerating data, final Pages verification.
9. **(Deferred, separate milestone-sized item) Raw logger CSV adapter** once the trecho-assignment question is decided.

Phases 4, 5, 6 are independent of each other after phase 3 and can be reordered; 5 (map) is the riskiest of them (tiles, heat plugin tuning).

## Research Flags for Phases

| Phase | Flag |
|-------|------|
| 1 Converter | Standard, but verify cached-value availability and `read_only` speed (non-read-only load of the 22 MB file took >100 s here; use `read_only=True, data_only=True`) |
| 2 JS core | Standard; the rules are now fully specified and reproduced |
| 5 Map | Needs a short spike: leaflet.heat weighting for "metric" options, basemap choice/contrast, behaviour of 15 no-GPS points (list/footnote, not map) |
| 9 Raw CSV adapter | Needs real design research (below) |

## Gaps to Address

- **Raw logger CSV has no trecho/sentido.** The logger writes `timestamp, ax..., gps_lat, gps_lon, gps_speed_mps` only. A later adapter needs a run descriptor (time windows per trecho, or a station polyline for nearest-segment matching). Not needed for v1.3; do not bake trecho assumptions into `RunData` beyond "trecho runs may be absent" (UI must degrade: hide matrix/trecho filter when `trechos` is empty).
- **Raw CSV GPS is a 1 Hz cached value** (repeated coordinates, `gps_speed_mps` may be empty because Wi-Fi location has no speed), so speed must be derived from fixes as in the workbook, and the 6-dp coordinate-key logic must be re-checked on those files.
- **Raw CSV sample rate is ~10 Hz** (the logger target) vs ~5 Hz in the treated run; "grouping gap in samples" semantics differ in time; consider exposing the gap in milliseconds in a later iteration.
- **Sub-second reconstruction** only affects chart x-position, not any KPI; but state this in the UI footnote ("resolução de 1 s na fonte").
- **Trecho priority rule** (1 Alta / 2 Média / 3 Baixa / 4 Monitorar) is in WORKBOOK-CRITERIA.md; its bases (pontos vs impactos) should be confirmed against sheet `05 — ANÁLISE POR TRECHO` when building phase 6.
- Branch naming (`master` locally vs `main`) and repo/user name for the Pages URL are open.

## Sources

- Direct inspection of `Results_1st.Run/Final - Monitoramento de Sapata coletora - Linha 04.xlsx` (formulas of sheets 00, 02, 03, 04, 11; defined names; cached values of sheet 02), 2026-10-08 - HIGH
- Python re-implementation reproducing 21,031 / 1,611 / 512 / 173 / 56, 2,352, 1,749, 101 exactly; measurements of key/run counts, time resolution, LSB grid - HIGH
- `.planning/research/WORKBOOK-CRITERIA.md` and `.planning/research/STACK.md` (sibling research for this milestone) - consistent with the above except the accel rounding recommendation (superseded here by LSB integers)
- `.planning/PROJECT.md`, `requirements.txt`, `tests/test_structure.py`, `tests/test_docs.py`, `pytest.ini`, sample `data/wtvb01_20260525_092005.csv` - HIGH
- GitHub Pages custom Actions workflow pattern (`configure-pages` / `upload-pages-artifact` / `deploy-pages`) - MEDIUM (standard, from training knowledge; not re-verified against current docs in this session)
- Node built-in test runner (`node --test`), Node v24.14.0 present locally - HIGH for availability, MEDIUM for API details
