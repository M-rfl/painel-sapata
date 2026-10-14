# Phase 14: CSV Upload - Research

**Researched:** 2026-10-14
**Domain:** Browser-side port of the Python raw-CSV converter (Phase 9) feeding the existing Phase 10-13 dashboard; vanilla ES modules, no build step, no backend
**Confidence:** HIGH (everything below was read directly from this repo; browser APIs are standard and low-risk)

## Summary

The dashboard already consumes one thing: a schema-v1 site JSON turned into a `Run` by `decodeRun()` (`site/js/core/data.js`). The Python converter (`tools/dashboard_converter/`) produces exactly that JSON from raw CSVs. The cheapest, safest plan is therefore to port the converter to JS as a **pure core module that outputs the same schema-v1 object**, and feed it to the unchanged `decodeRun()`. Nothing downstream (analysis, view, stats, matrix, ranking, charts, map, URL state) needs a new data path. Parity then becomes a strong, simple test: JS-built JSON deep-equals Python-built JSON, ignoring only an explicit meta key list (see Validation Architecture: `UPLOAD_ONLY_META` for fixture cases, `RUN1_IGNORED_META` for the committed run-1 JSON).

Four things make this phase harder than "parse a CSV":
1. **Exactness.** The Python recovery code uses `Fraction`/`Decimal`, microsecond `datetime` arithmetic, ROUND_HALF_UP, `round()` (half-even on the exact binary value) and one deliberate float operation (`int(math.log10(n))`). JS doubles, `toFixed` and `Date.parse` (ms only) will silently differ. Port with string/integer arithmetic and reproduce the CPython float behaviour where Python itself uses floats (see Pitfalls).
2. **Station data is not in `site/`.** `Stations_GEO/*.txt` is tracked in git but is not deployed (Pages publishes only `site/`). Ship a generated `site/data/stations.json` (display names precomputed in Python) with a freshness guard test.
3. **Raw CSVs are git-ignored** (`/Results_1st.Run/`). CI cannot read them. Parity in CI must use committed fixtures (`tests/fixtures/run_mini/` plus new generated cell/geofence cases); the run-1 full parity test is local-only (`skip` when absent), exactly like `tests/test_dashboard_converter_real.py`.
4. **Panels are mount-once.** `charts`, `map`, `controls`, `matrix`, `ranking` are mounted in `main.js` `start()` against one `run`. A new dataset needs a teardown + remount (uPlot `destroy()`, Leaflet `map.remove()`, fresh section elements, fresh store, new `hashContext`). Atomic swap: only after the conversion fully succeeds.

**Primary recommendation:** Add `site/js/core/convert/` (pure, no DOM) that returns a schema-v1 object; add `site/js/app/upload.js` (button + drop zone + error notice); refactor `main.js` `start()` into `mountDashboard(run, {uploaded})` with a `destroy()`; prove parity with `node --test` against Python-generated fixtures.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UPLOAD-01 | Upload a raw logger CSV (comma or pt-BR `;`) in the browser; whole dashboard recomputes; no backend; JS port matches Python converter; Portuguese errors, view intact on failure | Port plan for recover/reader/geofence/gps/writer (Standard Stack, Patterns 1-3), remount architecture (Pattern 4), error UX (Pattern 5), parity strategy (Validation Architecture) |
</phase_requirements>

## User Constraints

No CONTEXT.md exists (user skipped discuss-phase). Constraints come from the ROADMAP and STATE decisions:

### Locked (from ROADMAP success criteria / STATE)
- User picks or drops a raw logger CSV (comma or pt-BR `;`); every view recomputes; the bundled run stays the default.
- Parsing, mangled-value recovery and station-geofence trecho/sentido assignment run in JS and match the Python converter on the run-1 CSVs (parity test).
- Invalid/unrecognised files show a Portuguese error and leave the current view intact; nothing is uploaded to any server.
- All UI text Portuguese, pt-BR numbers, America/Sao_Paulo dates (Phase 11).
- JS core stays pure (no `document`/`window` in `site/js/core/**`; enforced by `tests/test_site_static.py::test_core_is_pure`). All imports/fetches relative (enforced by the same test).
- Core rules: accel stored as integer 1/2048 g counts; "nothing is ever guessed: unrecoverable -> null + reported" (STATE v1.3 decisions, `recover.py` docstring).
- Dashboard GPS baseline is the derived GPS-filtered run (98 pontos); do not alter `analyze()`.

### Claude's Discretion
- UI placement of the upload control, error/notice UX, how uploaded state interacts with the share link, module layout, parity-fixture design.

### Deferred / Out of scope
- None recorded. Treat as out of scope: server-side anything, persistence of uploaded data (localStorage/IndexedDB), workbook (`.xlsx`) upload, editing station files in the browser, other-sensor CSV formats.

## Standard Stack

No new runtime dependencies. The project is vanilla ES modules + vendored uPlot/Leaflet; tests are `node --test` (Node 24 in CI; no `package.json`) and pytest.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Browser `File`/`Blob.arrayBuffer()`, `TextDecoder`, `<input type=file>`, DnD events | built in | Read the CSV locally | No upload; works on GitHub Pages (https) |
| `crypto.subtle.digest('SHA-256')` | built in (secure context; Node 24 global `crypto`) | `meta.source.files[].sha256` | Same field the Python writer fills; fall back to `""` if `crypto.subtle` is unavailable (file://) |
| Existing `decodeRun` / `analyze` / `buildView` | repo | Unchanged consumers of the schema-v1 object | Zero downstream change |
| `node:test` + `node:assert/strict` | Node 24 | Parity + unit tests | Already used by 20 test files |
| pytest | repo | Fixture generators + freshness guards | Matches `gen_parity.py`/`test_parity_fixture.py` pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `BigInt` | built in | Exact digit arithmetic for thousands-shaped accel cells | Accel recovery where `n` can exceed 2^53 (float-repr padded cells) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written minimal CSV reader | PapaParse | Adds a vendored dep for a 20-line need; logger CSVs have no quoting, and Python semantics (`csv.reader`, physical line numbers) must be matched. Write the small RFC4180-ish reader (handles `"` quoting defensively). |
| Main-thread conversion | Web Worker | 23k rows / 4 MB: expect well under ~1 s main-thread. Worker adds module-worker plumbing and test surface. Use main thread + `await` a macrotask before converting so the "Processando..." status paints. Revisit only if measured > ~2 s. |
| Fetch `Stations_GEO/*.txt` and parse in JS | Generated `stations.json` | Two parsers to keep in parity, DISPLAY_NAMES + `str.title()` fallback to port. Generated JSON from the Python parser is one source of truth. |

**Installation:** none.

## Architecture Patterns

### Recommended Project Structure
```
site/js/core/convert/            # PURE (no DOM): mirrors tools/dashboard_converter
├── recover.js                   # recoverAccel, recoverGps, resolveScaled, parsePlain, alternativeAccelReading
├── reader.js                    # parseCsv text -> records (delimiter detect, per-file ptbr, scaled resolve, ambiguity audit)
├── geofence.js                  # scoreLines + assign() forward-only station state machine (+ haversine)
├── gps.js                       # key6 (string half-up), buildFixes
├── build.js                     # buildSiteJson(): schema-v1 object (writer.build_site_json port)
└── index.js                     # convertFiles([{name,text,bytes?}], stations) -> {json, warnings}
site/data/stations.json          # GENERATED from Stations_GEO via Python parser (lines/directions/stations/display names/static warnings)
site/js/app/upload.js            # button, drop zone, busy status, error/notice rendering (DOM)
site/js/app/main.js              # refactor: mountDashboard(run, opts) with destroy(); upload wires swap/restore
tools/dashboard_converter/gen_upload_parity.py   # generates stations.json + tests/fixtures/upload_parity.json
tests/js/convert_*.test.js       # recover / reader / geofence / build / parity
tests/test_upload_fixture.py     # freshness guard (like test_parity_fixture.py)
```
Keep one file per Python module so reviewers can diff behaviour 1:1.

### Pattern 1: Output the schema-v1 JSON, reuse `decodeRun`
**What:** `convertFiles()` returns the same object `build_site_json` produces. `main.js` then calls `decodeRun(json)`.
**Why:** all derived fields (`sentido`, `flags`, `fix`, `priorFix`, `locKey`, `region` from `source_runs`) already come from `decodeRun`. Reimplementing them would duplicate logic and risk drift.
**Required meta for uploads:** `meta.run_id` (`${t0:YYYY-MM-DD}-l${line}` using the timestamp's own offset), `meta.title` (e.g. `Linha 4 · 02/10/2026 · enviado`), `meta.t0` (original ISO text normalised to Python `isoformat()` form), `meta.uploaded: true` (new additive key; schema stays 1), `meta.workbook_reference` ABSENT (so `run.reference = null` -> `conformeCheck` returns `available:false`; verify the "conforme planilha" badge and `overview.js:35` `run.reference && ...` render nothing for uploads).
**Source for fields:** `tools/dashboard_converter/writer.py` `build_site_json` (read it side by side; key names listed in `site/js/core/data.js` and `core/quality.js`).

### Pattern 2: Port rules exactly (recover.py -> recover.js)
Key rules to reproduce (all in `tools/dashboard_converter/recover.py`):
- `THOU = /^-?[1-9]\d{0,2}(\.\d{3})+$/`, `GPS_THOU = /^-?\d{1,3}(\.\d{3})+$/`, `DEC_COMMA = /^-?\d+,\d+$/`.
- `recoverAccel(text, ptbr)`: decimal comma -> point; thousands-shaped: `n` = digits, `k = int(math.log10(n))` **computed the way CPython does** — `math.log10` on the double nearest `n`, which rounds UP to the next integer for `n` just below a power of ten (`999999999999999` -> 15, while `digits.length-1` = 14), so `digits.length-1` is NOT equivalent. JS: `Math.trunc(Math.log10(Number(n)))` (`Number(BigInt)` rounds like `PyLong_AsDouble`, so libm sees the same double), verified against Python-generated near-power-of-ten fixture cases (`recover.log10k`, boundary values for every digit count 2..20); if V8 and CPython disagree on any boundary, use a CPython-generated boundary table instead (14-03). Try `n/10^k` if `|y|<=16` and on the 1/2048 grid, else `n/10^(k-1)`. Grid test (Python `_on_grid` and the final check): `x = v*2048`, `lsb = round(x)` (nearest integer, half-even on an exact .5), on grid iff `abs(float(x - lsb)) <= 1e-6` — the distance to the NEAREST integer (so `N + 0.9999999` is on grid with lsb `N+1`), not a remainder after flooring. `off_grid` is checked BEFORE `out_of_range` (`|v| <= 16`). Reasons `plain|k|k-1|empty|unrecoverable|off_grid|out_of_range`. Use exact rational arithmetic: `v = sign*n/10^k`, `x = sign*n*2048/10^k` with BigInt; compare the correctly rounded float of the exact difference with the double `1e-6` (`ratToFloat(|n*2048 - lsb*10^k|, 10^k) <= 1e-6`, bit-faithful to Python's `float(Fraction)`). For the plain (non-thousands) path parse the decimal text into (BigInt mantissa, scale) rather than `parseFloat`.
- `recoverGps(text, axis, ptbr)`: thousands-shaped -> `Decimal(digits).scaleb(-(len-2))` (i.e. insert decimal point after the 2nd digit; sign preserved). Envelopes: lat in [-22.92,-22.88], lon in [-43.22,-43.16] -> else `out_of_envelope` (null + reported). **Note:** this envelope is hard-coded to the Rio line area; it also acts as the "is this a Rio logger file" guard. For the upload, keep the same envelope for parity but report the *whole-file* case (all GPS rejected, or no GPS) as a Portuguese error/warning (see Pattern 5) instead of silently producing a no-GPS run.
- `resolveScaled`: candidates with 1..3 integer digits from `digits.rstrip('0')`, filter by `SCALED_RANGES`, choose nearest to median of up to 6 plain neighbours each side (window 6), else column median. Python `statistics.median` averages the two middle values for even counts. `min()` picks the **first** minimal candidate (ties -> earlier candidate); keep candidate order 1,2,3 integer digits.
- Ambiguity audit (`_ambiguity_audit`) only for ptbr files; reports `ambiguous_resolved_by_rule`, never changes values.

### Pattern 3: Port reader / geofence / gps / writer faithfully
- **Reader:** decode UTF-8 with BOM stripped and `fatal:true` (Python raises on bad bytes -> map to Portuguese error). Delimiter = `;` if first line has more `;` than `,`. Required columns `timestamp, ax_g, ay_g, az_g, gps_lat, gps_lon` (else error naming the missing column). Skip blank rows. Timestamp: Python uses `datetime.fromisoformat` (3.13) and then rejects naive results. The JS port must accept and reject exactly the same strings: port CPython's `_pydatetime.datetime.fromisoformat` (separator = any single character, basic `20261002T003000-0300` and extended formats, reduced time precision `HH`/`HH:MM`, fraction after `.` or `,` with more than 6 digits truncated, `Z`, `+HH`, `+HHMM`, `+HH:MM`, `+HH:MM:SS[.ffffff]`, ISO week dates) plus the constructor's calendar validation (2026-02-30 is rejected, never normalised; years 1..9999; offset strictly within ±24 h); naive -> rejected per the Python converter's rule. A single regex + `Date.UTC` is NOT enough (`Date.UTC` normalises invalid dates and maps years 0..99 to 1900s). Compute **integer epoch microseconds** with a days-from-civil formula + offset (incl. offset seconds/microseconds) and render `isoformat()` exactly (fraction only when non-zero; `+00:00` for zero offset; `:SS[.ffffff]` in the offset when present). Python-generated accept/reject fixture cases (`timestamps`) are the arbiter. `Date.parse` truncates to ms and would break `dt_ms`.
- **Merge:** files sorted by name (code-unit order), rows stable-sorted by timestamp (`Array.prototype.sort` is stable in modern engines); `origin` = (file index, 1-based physical line) -> `source_runs` RLE of file index. Multi-file selection (`multiple`) must be supported because run 1 is two files (one per sentido) and `region`/`regionSplit` depend on `source_runs`.
- **t.dt_ms:** `abs_ms = floor((ts_us - t0_us + 500)/1000)` (integer floor division; values are positive), `dt_ms[k] = abs_ms[k]-abs_ms[k-1]`. Epoch microseconds (~1.7e15) fit in a Number (< 9e15), but compute `ts - t0` first anyway.
- **GPS keys:** `key6` is ROUND_HALF_UP on the exact decimal text. Implement as decimal-string rounding (look at the 7th fractional digit; carry), never `toFixed(6)` (binary). Geofence input uses the **unrounded** `float(Decimal)` = `Number(decimalString)`. Fix lat/lon in JSON = `Number(key6)`. `decodeRun` later re-keys with `toFixed(6)` which round-trips 6-dp values correctly.
- **Fixes:** port `build_fixes` (`fix_runs`, `loc`, `status`, `speed_kmh` with `round(v,2)`). Python `round(x, n)` on a float is correctly rounded with **half-even on the exact binary value** (`round(1.25, 1)` = 1.2, `round(2.675, 2)` = 2.67); `toFixed` is not (`(1.25).toFixed(1)` = "1.3"). Every `round(x, n)` in writer.py/gps.py (`speed_kmh`, `quality.max_gap_s`, turnaround `gap_s`, channel quantisation) goes through one `pyRound(x, n)` helper (exact mantissa/exponent decomposition, half-even, correctly rounded back to a double), with Python-generated tie fixture cases (`pyround`, plus synthetic files whose max gap is exactly 2.25 s and whose turnaround gap is exactly 1.25 s).
- **Geofence:** port `score_lines`, `_initial_direction`, `_segment`, `_resolve_boundaries`, `assign` as-is (459 lines Python). It is index/array logic and portable line by line. Use `bisect_right` helper. Do NOT "improve" the algorithm; STATE records accepted known deviations (e.g. Rodoviaria-Equador 1 vs 295) that parity must preserve. `haversine_m` with the same operation order as CPython: `math.radians(x)` is `x * (pi/180)` with the constant precomputed (JS `x * (Math.PI / 180)`, NOT `(x * Math.PI) / 180`, which rounds differently), squares as `s * s`, `2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)))`. Trig results can still differ in the last ulp between CPython libm and V8 - tolerate with the thresholds, but verify that run-1 `trecho_runs` are identical; if any boundary flips, investigate before accepting.
- **Quality block:** `rows_with_gps`, `unrecovered_values` (issues with null value), `ambiguous_values`, `station_file_warnings` (take static ones from `stations.json` plus JS `geofence_overlap_warnings` for the chosen line), `inferred_stations`, `turnarounds`, `max_gap_s`, `max_gap_index`.
- **`stations.json`:** generated from `load_stations()` + `display_name()` (so the `str.title()` fallback is resolved in Python). Content: lines -> directions -> stations `{code, name, displayName, lat, lon}`, plus `warnings`. The `stations` array in the output JSON is built from the chosen line's directions (first occurrence of each code), as in `cli.py`.
- **Defaults:** `radius_m=100`, `terminal_radius_m=200`, no `line_override` (auto-detect). Optionally expose a line override only in the error path ("linha ambígua") - not required for v1.

### Pattern 4: Remount architecture (atomic swap)
Current `main.js` `start()` does fetch -> decode -> create store/hash handlers -> mount panels once. Refactor to:
```js
let dashboard = null;
function mountDashboard(run, { uploaded }) {
  dashboard?.destroy();                       // uPlot.destroy() each chart, ResizeObserver.disconnect, map.remove(), unsubscribe store, clear hashchange handler/timer
  replaceSections();                          // el.replaceWith(el.cloneNode(false)) for #controls,#map,#charts,#matrix,#ranking,#overview,... drops DOM listeners
  const store = createStore(uploaded ? defaultState() : parseHash(...).state);
  ... existing mount calls ...
  return { destroy };
}
```
Facts found in code that the plan must handle:
- `charts.js` creates uPlots lazily and a `new ResizeObserver` (never disconnected) -> add `destroy()` returning to `mountCharts`.
- `map.js` creates `L.map(canvas)`; fetches route GeoJSON by `run.meta.line.id` (uploaded line may be 1-4 -> files exist for all four lines in `site/data/routes/`; if `line.ambiguous` map already loads all four). Add `destroy()` calling `map.remove()`.
- `controls.js` `mountControls(el, store, run)` clears and rebuilds from `run.sentidos`/`run.trechos`/`run.tMs`/`restOffset2(run)` - safe to call again; `renderControls(state)` uses module state set by the last mount.
- `info.js` registers document-level listeners once (global, run-independent; fine).
- `window.addEventListener('hashchange', ...)` closes over `run`; must be removed/re-added (or read `currentRun` variable).
- State must be **reset** for uploads: filter indices (`trechos`, `sentidos`), `tFrom/tTo`, manual offsets and thresholds are run-specific; `parseHash` was validated against the bundled run's `hashContext`. Start the uploaded run from `defaultState()` and (decision below) do not carry over previous params.
- Keep the bundled `Run` object in memory so "Voltar a corrida de exemplo" re-mounts without refetching.
- Races: a slow conversion must not land after a newer upload or after "Voltar a corrida de exemplo". The session keeps a generation token (bumped by every load/restore); a result whose token is stale is discarded silently (no mount, no error).
- Partial mounts: `mountDashboard` registers a disposer as each resource is created (charts, map, subscriptions, hash timer/handler) and runs them in a `catch` before rethrowing, so a throw midway leaves nothing alive and the session can remount the previous run.
- `PANELS` sections `overview/classes/stats/quality` are plain render targets (no teardown needed, but `quality` is computed once from `qualitySummary(run, null)` - recompute per run).

### Pattern 5: Error and notice UX (consistent with Phases 11-13)
- Reuse the existing `#notice` (`role="status"`, dismissible `.notice-close`) pattern from `panels/share.js` `showIgnoredNotice`; add an error variant (`role="alert"`, `.notice--error`) in the same place above the overview. Errors never touch the current dashboard: conversion happens fully on the side; `mountDashboard` is only called on success.
- Portuguese error catalogue (one string per `StructuralError` kind; put them in `i18n.js` `T`, with the file name prefix):
  - not CSV / empty file: "O arquivo "X" está vazio."
  - undecodable: "O arquivo "X" não está em UTF-8 e não pôde ser lido."
  - missing column: "O arquivo "X" não parece ser um CSV do logger: falta a coluna "gps_lat"."
  - bad timestamp: "X, linha N: data/hora inválida "..."."; naive timestamp: "... sem fuso horário."
  - no data rows; too large (e.g. > 60 MB) ; > N files.
  - no usable GPS / not on a known line: "Não foi possível identificar a linha: nenhuma estação das linhas conhecidas foi encontrada no trajeto do GPS." Rule (same as Pitfall 9): error ONLY when no station of any line is within radius (every `line_scores[].in_line === 0`, which also covers no GPS / all GPS out of envelope). JS-only guard, Python has no equivalent - document it as an intentional addition and test it. Runs Python converts with few hits (`in_line` 1) or an ambiguous line are NOT rejected; they load with a warning notice.
- Non-fatal findings (unrecovered values, ambiguous values, ambiguous line, rows without GPS) go to the existing `quality` card (already driven by `run.quality`) and a one-line summary notice after load ("Arquivo carregado: 23.383 linhas, Linha 4; 0 valores não recuperados").
- Header affordance: in `<header class="top">` next to `#share`, add a `Carregar CSV` button (`<label>`/button + hidden `<input type="file" accept=".csv,text/csv" multiple>`). Only files whose name ends in `.csv` (case-insensitive, like Python's `glob("*.csv")` on the engineer's Windows machine) are converted, matching `read_run`; in a multi-file pick/drop, other files are ignored with a pt-BR notice ("Ignorados (não são .csv): …"), and if no `.csv` remains the upload is rejected with a pt-BR error and the view stays intact., plus whole-window drag&drop with a drop overlay ("Solte o CSV para carregar") built with `dragenter/dragover/dragleave/drop` (`preventDefault` on dragover or the drop is a navigation to the file). Add an `infoBtn('upload', ...)` entry in `info.js` text explaining that processing is local and nothing is sent. After an upload, show a persistent banner: "Exibindo seus dados: X (N linhas) - nada foi enviado a servidor algum. [Voltar a corrida de exemplo]". Reset the file input value after each pick so choosing the same file again works.

### Pattern 6: Shareable URL vs uploaded data (Phase 13 interaction)
The hash (`serialize`) encodes thresholds/filters/display/analysis params, with filter values as indices into the *bundled* run's sentidos/trechos and absolute `de/ate` ms. It is meaningless for someone who does not have the same upload.
Recommendation (prescriptive):
- While `uploaded`, **do not write the hash** (skip `writeHash`, call `history.replaceState` once to clear any hash) and do **not** read `hashchange` into the store.
- `Copiar link` is disabled with title/feedback "Link indisponível para dados enviados" (change `mountShare` to accept an `enabled()` or swap the button state).
- Returning to the example run restores the normal hash behaviour (parse a fresh `location.hash` at that time, or start default).
- A page load with a hash always loads the bundled run (uploaded data is never persisted).
- `tests/js/urlstate.test.js` stays untouched (urlstate.js is not changed); add a unit test for the small pure predicate if one is extracted (e.g. `shareable(meta)`).

### Anti-Patterns to Avoid
- **Re-deriving analysis inputs by a second path** (building a `Run` directly with `fromArrays`): bypasses `decodeRun` extras (`fix`, `priorFix`, `sentido`, `flags`, `stations`, `quality`). Go through schema-v1.
- **`parseFloat`/`toFixed`/`Math.round` for the recovery or key6**: binary rounding differs from Decimal/ROUND_HALF_UP.
- **`Date.parse` for CSV timestamps**: ms precision only.
- **Mutating the live store/run before conversion succeeds**: breaks "view intact".
- **Leaving the old Leaflet map / uPlot instances alive** after a swap (memory + duplicated ResizeObservers).
- **Porting the station txt parser to JS** when a generated JSON is available.
- **Adding a network call** (the static test `test_module_graph_resolves_and_relative` requires every `fetch` URL to be relative; uploads must not fetch anything). Add a guard test: `site/js/core/convert/**` and `upload.js` contain no `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Analysis of uploaded run | New analysis path | `decodeRun` -> `applyGpsFilter` -> `analyze` -> `buildView` (unchanged) | Phase 10-13 parity-tested |
| Trecho/sentido logic | A "simplified" geofence | Line-by-line port of `geofence.py` | STATE records accepted deviations; parity must match them |
| Station list | JS txt parser | `site/data/stations.json` generated by Python | One parser, one display-name table |
| Downloading/CSV export, formats, dom helpers | New helpers | `app/dom.js` `h()`, `app/format.js`, `app/i18n.js` `T` | Existing conventions |
| Notices/info popups | New popup system | `#notice` + `info.js` `infoBtn` | Existing, accessible |
| Parity assertions | Hand-picked spot checks | Deep-equal of whole schema-v1 JSON vs Python output | Catches drift anywhere |
| SHA-256 | Own implementation | `crypto.subtle.digest` | Built in |

**Key insight:** the work is a faithful port, not a redesign. Every behavioural decision was made and validated in Phases 9-10; the plan's job is to preserve them exactly and prove it.

## Common Pitfalls

### Pitfall 1: Float arithmetic in accel recovery
**What goes wrong:** `-10.625` -> test `v*2048` on a double; padded cells like `21.650.000.000.000.000` or accel cells with 15-17 digits exceed 2^53 as integers; `Math.log10` on large/near-power values can be off by one.
**How to avoid:** digit-string + BigInt for the thousands path; `k` = CPython's `int(math.log10(n))` (float log10 of the nearest double; NOT `digits.length - 1`, which differs for e.g. `999.999.999.999.999`), checked against Python-generated near-power-of-ten fixtures. Keep the 1e-6 grid tolerance semantics (distance to the nearest integer, off_grid before out_of_range) on exact values.
**Warning signs:** parity diff in `accel.ax/ay/az` or recovery stats on the `3. A-B.csv`-style (`;`) fixture.

### Pitfall 2: Timestamp precision and timezone
**What goes wrong:** `Date.parse` drops microseconds -> `dt_ms` cumulative rounding differs (`abs_ms` rounds the cumulative sum, not each delta).
**How to avoid:** integer-microsecond parse with a port of Python 3.13 `fromisoformat` (accept/reject parity, calendar validation, no `Date.UTC` normalisation); compute `abs_ms` per row from t0 then diff, exactly as `_dt_ms`.
**Warning signs:** `t.dt_ms` mismatch by +-1 at scattered rows.

### Pitfall 3: ROUND_HALF_UP key6 on decimal text
**What goes wrong:** `toFixed(6)` on a double rounds the binary value; Excel-parity half-up differs on exact ties like `...0000005`.
**How to avoid:** decimal-string rounding helper with unit tests including ties and negative values (Python quantizes the signed Decimal with ROUND_HALF_UP = away from zero on ties).

### Pitfall 4: `source_runs` / sentido split lost with a single file
**What goes wrong:** `region` is built only if `source_runs` exists; `regionSplit` and the conforme check use it. A single uploaded file yields one region; `conformeCheck` is skipped (`reference == null`) so nothing breaks, but any code assuming 2 regions must tolerate 1. Check `core/engine.js`/`panels` for `nRegions` assumptions.

### Pitfall 5: Stale module state after remount
**What goes wrong:** `controls.js`' module-level render state, `map.js` `viewKey/heatKey`, matrix/ranking `lastRun` memo keys, `info.js` global listeners, `window.__painel` debug handle pointing at the old store.
**How to avoid:** fresh section elements + new mount calls; update `window.__painel`; unit/DOM-less test via a small static check, and a manual browser check (swap upload -> back -> upload twice).

### Pitfall 6: Hash and state leakage
**What goes wrong:** old `lastWritten` hash / debounce timer fires after the swap and writes the example's state over the URL, or `hashchange` re-parses against the wrong run's `hashContext`.
**How to avoid:** a single `hashSync` object with `start(run)/stop()`; clear the timer in `destroy()`.

### Pitfall 7: Drop target navigates away
**What goes wrong:** missing `preventDefault()` on `dragover`/`drop` makes the browser open the CSV.
**How to avoid:** window-level handlers; test manually.

### Pitfall 8: Large files blocking the UI / memory
**What goes wrong:** 23k rows x 21 cols string splitting plus JSON object, then `decodeRun` again; fine for run-1 size but a 200 MB file freezes the tab.
**How to avoid:** size cap (suggest 60 MB per file, 6 files) with Portuguese error; show "Processando..." and yield one macrotask before converting; log conversion ms to `console.debug` like `analyze ms`.

### Pitfall 9: Unknown line / non-Rio GPS
**What goes wrong:** the envelope rejects all GPS; `score_lines` returns all zeros; `assign` picks line 1 "ambiguous" and flags the whole run edge/sem GPS - a technically "valid" but useless run.
**How to avoid:** explicit JS guard (error ONLY if no station of any line is within radius: all `in_line === 0`) and a warning (not error) when `line.ambiguous` or when the best line has a single station hit. Never reject a run Python converts on other grounds.

## Code Examples

### Pure orchestrator shape
```js
// site/js/core/convert/index.js  (pure; stations injected, no fetch)
export function convertFiles(files /* [{name, text, sha256?}] sorted by name */, stations) {
  const run = readRun(files);                         // reader.js: merged, time-ordered, issues, recoveryStats
  const lat = run.lat.map(toFloatOrNull), lon = run.lon.map(toFloatOrNull);
  const assignment = assign(lat, lon, stations.lines, { radiusM: 100, terminalRadiusM: 200, timestampsUs: run.tsUs });
  requireKnownLine(assignment);                       // JS-only guard: every line_scores[].in_line === 0 -> ConvertError('unknown_line')
  const fixes = buildFixes(run);
  return buildSiteJson(run, assignment, fixes, { stations, radiusM: 100, terminalRadiusM: 200 });
}
export class ConvertError extends Error { constructor(code, message, detail) { super(message); this.code = code; this.detail = detail; } }
```
Error messages are built from `T` strings in the app layer from `err.code` + `err.detail` (core stays language-neutral or carries Portuguese text directly; pick one and test it).

### Upload wiring skeleton
```js
// site/js/app/upload.js
export function mountUpload(headerEl, { onLoad, onError, onReset, stations }) {
  const input = h('input', { type: 'file', accept: '.csv,text/csv', multiple: true, hidden: true });
  input.addEventListener('change', () => handle([...input.files]).finally(() => { input.value = ''; }));
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => { e.preventDefault(); handle([...e.dataTransfer.files]); });
  async function handle(files) {
    if (!files.length) return;
    try {
      setBusy(true); await new Promise((r) => setTimeout(r, 0));   // let "Processando..." paint
      const json = await convertSelected(files, stations);          // reads text, sha256, convertFiles
      onLoad(decodeRun(json), { name: files.map((f) => f.name).join(', ') });
    } catch (err) { onError(err); } finally { setBusy(false); }
  }
}
```
Source for the Python behaviour being ported: `tools/dashboard_converter/{recover.py,sources/logger_csv.py,geofence.py,gps.py,writer.py,cli.py}`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Converter runs only offline (`python -m tools.dashboard_converter`) producing committed JSON | Same logic also in browser, JSON built client-side | this phase | Python converter stays the oracle; add parity fixtures so the two cannot drift |
| One bundled run mounted once | Mount/destroy lifecycle | this phase | `main.js` refactor |

**Deprecated/outdated:** none relevant; `File.arrayBuffer()`/`TextDecoder`/`crypto.subtle` are baseline in all current browsers.

## Open Questions

1. **Does V8 trig/`asin` match CPython bit-for-bit on run-1?**
   - Known: same IEEE formulas; libm results can differ by an ulp. Geofence decisions are threshold compares against 100/200 m radii and `min()` over distances; ties are practically impossible.
   - Unclear: whether any boundary flips on the 23k-row run.
   - Recommendation: the local full-run parity test is the arbiter (compare `trecho_runs`, `sentido_runs`, `flag_runs` exactly); if a flip appears, add a tiny epsilon only where Python compares with `<=`, and record the decision in STATE.
2. **Line override / ambiguous line UX.** Python has `--line`. Recommend no override UI in this phase (warn only when ambiguous). Confirm with the user if wanted.
3. **Title for uploaded data.** Recommend `Linha N · dd/mm/aaaa (arquivo enviado)`; trivial to change.
4. **File-name ordering vs timestamp.** Python sorts files by name only for tie-breaking; order is decided by timestamps. Same in JS. No open risk.
5. **Hash on return to example.** Recommend returning to the default state (not restoring the pre-upload state) to keep the code simple.
6. **Size cap numbers (60 MB / 6 files)** are a recommendation, not measured.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in test runner (Node 24, ESM, no package.json) for JS; pytest for generators/guards (`pytest.ini`: `-q --tb=short -m "not slow"`, markers: `slow`) |
| Config file | none for JS (glob in CI: `node --test "tests/js/*.test.js"`); `pytest.ini` |
| Quick run command | `node --test tests/js/convert_recover.test.js tests/js/convert_reader.test.js tests/js/convert_geofence.test.js tests/js/convert_parity.test.js` |
| Full suite command | `node --test "tests/js/*.test.js"` then `python -m pytest` (CI runs both; pytest under xvfb on Linux) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UPLOAD-01 (SC1) | Comma and `;` files accepted; multiple files merged by timestamp; output decodes via `decodeRun` and `analyze()` runs | unit + integration | `node --test tests/js/convert_reader.test.js tests/js/convert_build.test.js` | Wave 0 |
| UPLOAD-01 (SC2a) | Cell recovery (accel k/k-1/plain/off_grid/out_of_range incl. log10 round-up and upper-integer grid cases, GPS recovered/envelope, scaled neighbour/median, key6 half-up ties, pyRound half-even ties) and timestamp accept/reject (fromisoformat port) equal Python on generated cases | parity (fixture) | `node --test tests/js/convert_recover.test.js tests/js/convert_reader.test.js` | Wave 0 |
| UPLOAD-01 (SC2b) | Geofence trecho/sentido/flag runs equal Python on generated synthetic routes (forward trip, skipped stations, dwell, terminal turn, reversal, tunnel gaps, line scoring) | parity (fixture) | `node --test tests/js/convert_geofence.test.js` | Wave 0 |
| UPLOAD-01 (SC2c) | JS-built schema-v1 JSON deep-equals Python output (default CLI args) for `run_mini` + synthetic comma/`;` cases, ignoring only `UPLOAD_ONLY_META` = `generated_at, converter_version, title, uploaded` (run_id IS compared) | parity (fixture, CI) | `node --test tests/js/convert_parity.test.js` | Wave 0 |
| UPLOAD-01 (SC2d) | Run-1 raw CSVs -> JS JSON deep-equals the committed `site/data/run-2026-10-02-l4-t102.json` (23.383 rows; whole object) ignoring only `RUN1_IGNORED_META` = `run_id, title, workbook_reference, uploaded, generated_at, converter_version` — the committed file was built with `--run-id`, `--title`, `--golden`, which change exactly those meta keys and nothing else | parity (local-only, `skip` when `Results_1st.Run/raw` absent) | `node --test tests/js/convert_run1.test.js` | Wave 0 |
| UPLOAD-01 (SC3a) | Invalid files -> `ConvertError` with Portuguese message: empty, missing column, naive/invalid timestamp, no rows, bad UTF-8, unknown line, too large | unit | `node --test tests/js/convert_errors.test.js` | Wave 0 |
| UPLOAD-01 (SC3b) | Failed upload leaves the current view intact (swap only on success); stale conversions discarded (generation token); partial mount disposed + previous run remounted | unit on the pure session controller `site/js/app/session.js` (injected mount/destroy) | `node --test tests/js/upload_controller.test.js` | Wave 0 |
| UPLOAD-01 (SC3a app) | `.csv`-only selection, file-count/byte-size caps, fatal UTF-8 decode, pt-BR message for every error code | unit (`site/js/app/uploadio.js`, DOM-free) | `node --test tests/js/upload_io.test.js` | Wave 0 |
| UPLOAD-01 (SC3c) | Nothing uploaded: no network APIs in upload/convert sources; fetches remain relative | static | `python -m pytest tests/test_site_static.py -x` (extend) | extend existing |
| UPLOAD-01 (share) | Uploaded data: hash not written / link disabled; example restore reinstates | unit (pure predicate) + manual | `node --test tests/js/upload_controller.test.js` | Wave 0 |
| UPLOAD-01 (stations) | `site/data/stations.json` and `tests/fixtures/upload_parity.json` are fresh vs the Python generator | pytest | `python -m pytest tests/test_upload_fixture.py -x` | Wave 0 |
| UPLOAD-01 (UI) | Button, drop overlay, busy status, error notice, banner, return-to-example, repeated uploads, charts/map re-created without leaks | manual browser check (checkpoint plan like 11-06/12-06/13-07) | n/a - manual | manual-only (DOM/Leaflet/uPlot not testable under node) |

### Sampling Rate
- **Per task commit:** the relevant `node --test tests/js/convert_*.test.js` file(s) (< 10 s).
- **Per wave merge:** `node --test "tests/js/*.test.js"` + `python -m pytest tests/test_site_static.py tests/test_upload_fixture.py tests/test_parity_fixture.py`.
- **Phase gate:** full `node --test "tests/js/*.test.js"` and full `python -m pytest` green, plus the local run-1 parity test executed on the developer machine (it is skipped in CI), plus the manual browser checkpoint, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tools/dashboard_converter/gen_upload_parity.py` - writes `site/data/stations.json` and `tests/fixtures/upload_parity.json` (cell-recovery cases from `recover.py`, synthetic geofence routes from `geofence.assign`, run_mini expected JSON from `cli`/`build_site_json`); CLI like `gen_parity.py`
- [ ] `tests/test_upload_fixture.py` - freshness guard (pattern: `tests/test_parity_fixture.py`)
- [ ] `tests/js/convert_*.test.js` (recover, reader, geofence, build, parity, errors, run1), `tests/js/convert_meta.js` (shared ignore lists), `tests/js/upload_controller.test.js`, `tests/js/upload_io.test.js`
- [ ] Possibly extra committed fixtures: a small mangled `;` file with every recovery rule (the existing `run_mini/3. A-B.csv` covers several), plus a synthetic multi-station comma/`;` CSV pair generated from the committed run-1 JSON slice if the geofence on 18 rows is too trivial (committed size must stay small; raw run-1 CSVs must NOT be committed - see `.gitignore` and `tests/test_repo_hygiene.py`)
- [ ] Extend `tests/test_site_static.py` for the no-network guard on convert/upload sources and that `site/data/stations.json` exists
- Framework install: none (Node 24 + pytest already present; `pages.yml` already runs both suites, so new tests gate the deploy automatically)

## Sources

### Primary (HIGH confidence - repository code read in this session)
- `tools/dashboard_converter/recover.py`, `sources/logger_csv.py`, `geofence.py`, `gps.py`, `writer.py`, `model.py`, `stations.py`, `cli.py`, `geo.py`, `gen_parity.py`
- `site/js/app/main.js`, `state.js`, `urlstate.js`, `panels/{charts,map,controls,matrix,ranking,share}.js`, `link.js`, `core/{data,conforme,quality,geo}.js`, `site/index.html`
- `tests/js/helpers.js`, `tests/js/parity.test.js`, `tests/test_site_static.py`, `tests/test_dashboard_converter_real.py`, `tests/fixtures/run_mini/*`, `.github/workflows/pages.yml`, `pytest.ini`, `.gitignore` behaviour (`Results_1st.Run` ignored)
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/config.json`

### Secondary / Tertiary
- No external sources were needed: File API, `TextDecoder`, `crypto.subtle`, drag-and-drop and `BigInt` are standard platform features. Training-data knowledge only (LOW-risk, not verified against MDN in this session): `crypto.subtle` requires a secure context; `Array.prototype.sort` stability guaranteed since ES2019.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies; reuses verified repo modules
- Architecture: HIGH - schema-v1 reuse and remount points verified by reading code (minor unknown: `engine.js` handling of `nRegions == 1`/null reference; `conforme` and `overview` paths read and null-safe)
- Pitfalls: HIGH for numeric/timestamp exactness (read the exact Python semantics); MEDIUM for V8-vs-CPython trig ulp (resolved only by the local run-1 test)

**Research date:** 2026-10-14
**Valid until:** 2026-11-13 (stable; invalidated if Phase 9-13 modules change)
