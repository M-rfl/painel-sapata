# Phase 10: Analysis Engine - Research

**Researched:** 2026-10-08
**Domain:** Pure ES-module JS rules engine (Node-testable, browser-consumable) mirroring a Python oracle; `node --test` golden and parity testing
**Confidence:** HIGH (everything is verified against the repo code and a local Node 24.14 / Python 3.13 run; no external libraries are involved)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carried forward (locked in Phase 9 / research)**
- Workbook rules: lower bounds inclusive. Dominant-axis ties go X > Y > Z (strict `>`). The impact peak is the first maximum. Impact class = the max class in the run. Ponto = per location key, the event with max |dominante|. Rows without GPS use the key `"SEM GPS | " + trecho`.
- Accel is integer 1/2048 g (LSB). Do comparisons in exact integer or doubled-LSB arithmetic, as `analysis_ref.py` does, so a .5 median or a sample sitting on a threshold never flips between Python and JS.
- Row order = the merged, time-sorted order of the site JSON (the converter ignores filenames).
- Exact parity is required for class counts, eventos, impactos and impacts_by_class. Pontos (99 vs 101) and per-trecho values are compared side by side only.
- `node --test` only, with no package.json, npm or node_modules. Tests live outside `site/` (e.g. `tests/js/`).

**Impact grouping gap**
- Unit: samples. `gap` = the number of Normal (non-event) samples allowed between events in the same impact. The default of 0 = the workbook (any non-event sample splits the impact).
- Sentido change does NOT split an impact. Grouping is pure row order, as in the workbook.
- Large time jumps DO split an impact. If consecutive rows are more than a threshold apart (suggested ~2 s; planner picks and documents the value), they never share an impact. The planner/researcher must verify that this leaves impactos = 1.749 at defaults on run 1. If it doesn't, flag it rather than silently tuning it.
- GPS availability has no effect on grouping (it only affects pontos via the location key).
- Unclassified samples (any axis missing) are non-events, so they break an impact run (same as `analysis_ref.py`).

**Rest-level offset**
- Modes: `median` (default) and `manual`. Not mean.
- The median is computed over the whole run, on all valid samples per axis, once. Filters never move the offset, so a sample's class is independent of filters. It is not per sentido.
- Manual offset is entered in g per axis (e.g. AZ = -1,0). The engine quantizes it to the 1/2048 g grid (or the doubled-LSB grid) internally so the threshold comparisons stay exact and match Python.
- Missing axis: if any of AX/AY/AZ is null, the sample is unclassified. It has no class and is not an event. The engine exposes a `nao_classificadas` count for the data-quality card.

**Trecho priority**
- Basis: impactos, not pontos. The trecho's priority comes from the highest class among the impacts whose peak row falls in that trecho:
  - 1 Alta = >= 1 impact in the top class
  - 2 Media = no top-class impact, >= 1 in the second-highest class
  - 3 Baixa = the highest is the middle class
  - 4 Monitorar = only the lowest event class, or no impacts
  - This deliberately diverges from the workbook text (pontos-based). Priority is NOT part of the workbook parity check. The per-trecho side-by-side report should note the different basis.
- Priority ignores filters. It is computed on the full run for the current analysis parameters (thresholds, offset, gap).
- Mapping by class index: priority levels follow the class indices, so edited thresholds carry through automatically. There are no fixed g levels.
- Order within the same level: first the count of top-class impactos in the trecho (desc), then the trecho's peak |dominante| g (desc), then workbook trecho order as a stable final tie-break.

**"Conforme planilha" state**
- KPIs checked: class counts (5), eventos, impactos, impacts_by_class, and sentido splits (registros + eventos per sentido).
- The sentido split for the check uses the source-file row boundary, not the geofence sentido. In time order, the first file (`3. TIG-PXV.csv`, 10.839 rows) is S1 and the rest is S2. That gives 10.839 / 12.544 registros and 1.262 / 1.090 eventos, as in the workbook. The geofence-detected sentido (11.835 split, accepted in Phase 9) stays the sentido used everywhere else (filters, views). The converter must expose the file boundary in the JSON (e.g. per-file row ranges in time order) if it isn't already derivable from `meta.source.files`.
- Only the parameters matter, not filters. The state is true when the analysis params are at their defaults (thresholds 0.5/1/2/4, median offset, gap 0, and the time-jump split at its default) AND the full-run KPIs equal the reference. Active filters don't turn it off.
- Reference values are embedded in the site JSON (e.g. `meta.workbook_reference`, written by the converter from the golden/workbook numbers). They are not hard-coded in the engine. If a run has no reference, the state is "not available" (no badge), not false.
- Diagnostics: return `{ ok, reasons[] }`, with reasons such as `"limiares alterados"`, `"offset manual"` or `"impactos 1.750 != 1.749"`. The UI can show them as a tooltip.

### Claude's Discretion
- Module split inside `site/js/core/` (ARCHITECTURE.md suggests data/dynamics/classify/events/filter/aggregate/defaults). Phase 10 may stop at aggregate primitives needed for KPIs and priority. Filters can be included as a pure function if cheap.
- Typed-array choices, caching/stage keys, API naming.
- Parity fixture design: seeded random non-default params (thresholds, manual offsets, gap) on run 1 and the mini fixture, generated by Python into `tests/fixtures/parity_cases.json` (or similar), plus a pytest guard that the fixture is fresh.
- Exact default for the time-jump threshold (subject to the 1.749 check above).

### Deferred Ideas (OUT OF SCOPE)
- Mean as a rest-offset mode.
- Gap in seconds / dual-unit gap: samples only.
- Per-sentido medians.
- Fixing the geofence terminal rule so the geofence sentido matches the workbook split: not done. The badge uses the file boundary instead.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CORE-01 | Dynamic = measured - rest offset; dominant axis; severity = abs(dominant) | Doubled-LSB algorithm in `analysis_ref.py` (ported verbatim); median over valid samples; manual offset quantization (Pitfall 2, 3) |
| CORE-02 | Classification Normal..Critico, lower bound inclusive | `cls = count(th2 <= dom2)`; threshold-to-integer conversion rule (Pitfall 3); inclusive tests already in `test_dashboard_converter_analysis.py` |
| CORE-03 | Eventos, impactos (grouped), pontos recomputed live | `groupImpacts` extension (gap + time jump), `pointsByLocation`; verified time-jump default leaves 1.749 (see Time-jump) |
| CORE-04 | Trecho priority 1..4 recomputed live | Impact-basis priority algorithm + verified default-run table (Architecture Pattern 4) |
| CORE-05 | "conforme planilha" state | Needs two converter additions: `meta.workbook_reference` and a time-ordered source-file run field (Architecture Pattern 5, Open Question 1) |
| CORE-06 | Golden + Python<->JS parity tests | Test layout, fixture generator, freshness guard, `node --test` discovery rules (Validation Architecture) |
</phase_requirements>

## Summary

Phase 10 is a port plus an extension, not a technology exploration. There are no third-party libraries: the engine is plain ES modules under `site/js/core/`, run by Node's built-in `node:test` and `node:assert`. The oracle (`tools/dashboard_converter/analysis_ref.py`, 111 lines) already contains the full workbook logic in doubled-LSB integer arithmetic: median, dominant axis with strict `>` ties, inclusive thresholds, impact runs with first-maximum peak, per-location points, per-trecho counts. The JS port must be line-for-line equivalent, and the Python oracle must then be extended with the new parameters (manual offset, gap, time-jump split) and the new outputs (priority) so parity cases can be generated for non-default parameters.

Two things in CONTEXT.md are not yet derivable from the existing site JSON and need small converter changes before the badge can work. First, `meta.workbook_reference` does not exist. Second, the file boundary in time order is not derivable: `meta.source.files` is listed in filename order (`2. PXV-TIG` 12.544 rows, then `3. TIG-PXV` 10.839 rows), but time order is TIG-PXV first. `RunData.origin` already holds `(source_index, line)` per row in merged time order, so the writer can emit an RLE field such as `source_runs: [[0,1],[10839,0]]`. The site JSON must then be regenerated from the local raw CSVs (`Results_1st.Run/raw` exists locally).

Verified findings that de-risk the phase: (a) on run 1 the largest `dt` between two consecutive event rows is 426 ms, and the only large jump in the whole run is the 566.7 s turnaround at row 10838->10839, which falls between non-event rows. So any time-jump threshold from 1 s up to 5 s leaves impactos = 1.749, and 2000 ms is safe. (b) Event counts split by the file boundary are 1262 / 1090, exactly the workbook values. (c) Run 1 has 0 null accel samples, so null handling is exercised only by the mini fixture and synthetic parity cases. (d) Node 24.14 runs `.js` files containing `import`/`export` with no package.json silently (module-syntax detection), so `site/js/core/*.js` can be shared by the browser and by `node --test` without any package file.

**Primary recommendation:** Port `analysis_ref.py` to `site/js/core/` as stage functions over typed arrays working in doubled-LSB integers; extend the Python oracle first (new params + priority), generate `tests/fixtures/parity_cases.json` from it, add a pytest freshness guard, and make the converter emit `meta.workbook_reference` and `source_runs` before writing the "conforme planilha" logic.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `node:test` | Node >= 22.7 (verified locally 24.14.0) | Test runner (`node --test`) | Locked: no npm/package.json. Auto-discovers `*.test.js`/`*.test.mjs` recursively |
| Node `node:assert/strict` | built-in | Assertions (`deepStrictEqual`) | No dependency |
| Node `node:fs` | built-in | Load `site/data/*.json` and fixtures in tests | JSON import attributes are unnecessary; `JSON.parse(readFileSync)` is simplest |
| ES modules (`export`/`import`) | native | Engine code shared with the browser | Browser loads via `<script type="module">` |
| Typed arrays (`Int32Array`, `Uint8Array`, `Float64Array`) | native | Sample stores | 23k rows; fast and exact for integer LSB values |
| pytest (existing) | existing | Python-side freshness guard and oracle tests | Already used by 13 converter test files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Python `random.Random(seed)` | stdlib | Seeded parity case generation | Fixture generator script |
| Python `hashlib`/FNV-1a helper | stdlib | Compact digest of per-row class array in fixtures | Avoids storing 23k-element arrays |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `.js` files + module detection | `.mjs` extension | `.mjs` is robust on any Node, but Pages MIME for `.mjs` is not verified here. `.js` works on Node >= 22.7 (and >= 20.19) and CI must pin Node 22/24 |
| `.js` + detection | `site/js/package.json` with `{"type":"module"}` | Removes the Node-version dependency but contradicts the "no package.json" lock. Do not do this without asking |
| Storing full expected arrays in parity fixtures | digest + counts + indices | Digest keeps the fixture small; store `impact_starts` and `point_rows` for run 1 so a failure is diagnosable |

**Installation:** none. Required runtime: Node >= 22.7 (CI step `actions/setup-node` with `node-version: 22` or `24` is Phase 11's job, but note it in the Phase 10 summary).

## Architecture Patterns

### Recommended Project Structure
```
site/js/core/
├── defaults.js     # DEFAULT_PARAMS (thresholds_g [0.5,1,2,4], offset {mode:'median'}, gap 0, maxJumpMs 2000), CLASS_NAMES, PRIORITY_NAMES
├── data.js         # decodeRun(json): t_ms, ax/ay/az Int32Array + valid mask, runs expanded, loc ids, trecho idx, sourceIdx
├── dynamics.js     # median2(), restOffset2(params, axes), dominant()  -> dom2 (Int32Array), domAxis (Uint8Array)
├── classify.js     # thresholds2(), classify(dom2, valid, th2) -> cls Int8Array (-1 = unclassified)
├── events.js       # groupImpacts(), pointsByLocation()
├── aggregate.js    # classCounts, eventos, impactsByClass, perTrecho, trechoPriority, sentidoSplit
├── conforme.js     # conformeCheck(result, params, reference)
├── engine.js       # analyze(run, params) -> result (stage composition; optional memo keyed by param slices)
└── index.js        # re-exports
tests/js/
├── golden.test.js      # loads site/data/run-*.json + tests/fixtures/golden_run1.json
├── parity.test.js      # replays tests/fixtures/parity_cases.json
├── unit.test.js        # boundary / tie / null / gap / priority cases
└── helpers.js          # loadRun(), fnv1a()
tests/fixtures/parity_cases.json   # generated by Python
tools/dashboard_converter/gen_parity.py (or tests/tools script)  # fixture generator
```
Test files must be named `*.test.js` (or `.mjs`): `node --test` default discovery matches `**/*.test.?(c|m)js`, `**/*-test.*`, `**/*_test.*`, `**/test-*.*`, `**/test.*` and anything under a directory literally named `test`. A directory called `tests/` is NOT matched by itself, so the `.test.js` suffix is required. Helper files (`helpers.js`) are not picked up, which is desired.

### Pattern 1: Doubled-LSB integer pipeline (the port)
**What:** Everything compared in integers: `dom2 = max_k |2*v_k - med2_k|`; thresholds `th2_i` are integers; `cls = number of th2 <= dom2`.
**When to use:** All classification. Never convert to g before comparing.
**Example (port of analysis_ref.py; verified semantics):**
```js
// Source: tools/dashboard_converter/analysis_ref.py (oracle)
export function median2(values) {            // values: Int32Array of valid samples
  const s = Int32Array.from(values).sort();  // typed-array sort is numeric
  const n = s.length;
  if (n === 0) return 0;
  return n % 2 ? 2 * s[(n - 1) >> 1] : s[n / 2 - 1] + s[n / 2];
}
// per sample (valid = all three axes non-null)
let best = -1;
for (let k = 0; k < 3; k++) {
  const d = Math.abs(2 * v[k] - off2[k]);
  if (d > best) best = d;                    // strict '>': X wins ties over Y over Z
}
```
Track the dominant axis index in the same loop (`d > best` -> `axis = k`), so the dominant-axis breakdown (KPI-02, Phase 11) needs no second pass.

### Pattern 2: Impact grouping with gap and time-jump split
**What:** Extends the architecture sketch `groupImpacts` with (a) the sample gap and (b) the time-jump rule, and treats unclassified rows as non-events.
```js
export function groupImpacts(dom2, cls, tMs, gap, maxJumpMs) {
  const impacts = []; let cur = null, last = -1;
  for (let i = 0; i < cls.length; i++) {
    if (cls[i] < 1) continue;                          // Normal (0) and unclassified (-1)
    const splits = cur === null
      || (i - last - 1) > gap                           // gap=0: any non-event between events splits
      || (tMs[i] - tMs[last]) > maxJumpMs;              // time jump
    if (splits) { cur = { start: i, end: i, peak: i, cls: cls[i], nEv: 0 }; impacts.push(cur); }
    if (dom2[i] > dom2[cur.peak]) cur.peak = i;         // strict '>' -> first maximum
    if (cls[i] > cur.cls) cur.cls = cls[i];
    cur.end = i; cur.nEv++; last = i;
  }
  return impacts;
}
```
Note the sketch in ARCHITECTURE.md uses `domAbs < thrLeve` to detect events; use `cls[i] >= 1` instead so unclassified rows (dom2 left at 0) are excluded for free.
Time-jump definition recommendation: the time between the two events (`tMs[i] - tMs[last]`), a single comparison, identical in Python. At gap=0 this equals "consecutive rows more than the threshold apart". Document that for gap>0 it measures event-to-event span. Default `maxJumpMs = 2000`, stored in `defaults.js` and in the Python oracle default (and part of the "conforme" default check).

**Verified on run 1 (Python prototype against the committed site JSON):** max `dt` between consecutive event rows = 426 ms; thresholds 1000/1500/2000/3000/5000 ms all give impactos = 1749; the only large dt is 566 731 ms at the turnaround (row 10838 -> 10839), which is between non-event rows. The CONTEXT check "must leave 1.749" passes at 2000 ms with a wide margin.

### Pattern 3: Pontos by location key
Keep the sketch: location id per sample from `fix_runs` (`-1` = no GPS). The Python oracle keys on the lat/lon string (`"%.6f,%.6f"`); JS must key on the GPS fix index mapped to a canonical id. Caution: two different fix indices can share the same coordinates (repeated coordinates every ~30 s). The Python key is the coordinate string, so the JS must build the key from the coordinate (e.g. `lat6 + ',' + lon6` string, or a `Map` from coordinate string to dense id built once in `data.js`), not from the fix index. Otherwise pontos would count 101 or more for the wrong reason. Use `gps.loc` (location id per fix) only if verified identical to coordinate identity; test it explicitly (golden pontos reference 99 for the current converter output, side by side only). The no-GPS key is `-1 - trechoIndex` (integer) in JS and `"SEM GPS | " + trecho_name` in Python. These are equivalent as long as trecho names are unique per index (they are: 20 distinct names).

### Pattern 4: Trecho priority on impact basis
```js
// top = ncls-1 (4), second = ncls-2 (3), middle = ncls-3 (2)
function priority(maxCls, ncls) {
  if (maxCls === ncls - 1) return 1;   // Alta
  if (maxCls === ncls - 2) return 2;   // Media
  if (maxCls === ncls - 3) return 3;   // Baixa
  return 4;                            // Monitorar (Leve only, or no impacts)
}
```
Per trecho, from each impact: `trecho = trechoIdx[impact.peak]`, `maxCls = max(impact.cls)`, `topCount = count of impacts with cls == ncls-1`, `peakDom2 = max dom2 over event rows in the trecho` (use event rows of the whole trecho, not just peaks; document it). Sort key: `priority asc, topCount desc, peakDom2 desc, trechoOrder asc`. Class thresholds are fixed at 4 values by PARAM-01, so `ncls = 5`; still derive from `th2.length + 1` so the mapping follows the class index.
Verified expectation at defaults on run 1 (Python prototype): max impact class per trecho index 0..19 = `4,0,4,4,0,4,4,3,4,4,4,4,4,4,3,4,3,4,4,4` (0 = no impacts: trechos 1 and 4, the collapsed ones from the Phase 9 inferred-station issue), so priorities are Alta for 15, Media for 3 (indices 7, 14, 16), Monitorar for 2 (indices 1, 4). Use this as a sanity test, not as a workbook parity assertion (the basis differs from the workbook, per decision).

### Pattern 5: "Conforme planilha"
```js
export function conformeCheck(result, params, ref) {
  if (!ref) return { available: false, ok: null, reasons: [] };
  const reasons = [];
  if (!sameThresholds(params.thresholds_g, ref.thresholds_g)) reasons.push('limiares alterados');
  if (params.offset.mode !== 'median') reasons.push('offset manual');
  if (params.gap !== 0) reasons.push('agrupamento alterado');
  if (params.maxJumpMs !== DEFAULT_PARAMS.maxJumpMs) reasons.push('salto de tempo alterado');
  // KPI equality (only meaningful if params are default, but always report diffs)
  cmp('classes', result.classCounts, ref.class_counts); cmp('eventos', ...); cmp('impactos', ...);
  cmp('impactos por classe', ...); cmp('registros por sentido', ...); cmp('eventos por sentido', ...);
  return { available: true, ok: reasons.length === 0, reasons };
}
```
Reasons formatting uses pt-BR thousand separators (`'impactos 1.750 != 1.749'` -> use `Intl.NumberFormat('pt-BR')` or a tiny formatter; Node has full ICU by default). Compare thresholds as numbers with tolerance-free equality after the same parse (UI parsing is Phase 11; engine takes numbers).

The sentido split for the check is computed with `source_runs` (file boundary), separate from the geofence `sentido_runs`. Reference thresholds come from `meta.workbook_reference.thresholds_g` (or `meta.workbook_defaults.thresholds_g`, which already exists).

### Pattern 6: Python oracle extension first
Extend `reference_analysis` signature (keep old call sites working, all new args keyword-only with defaults that reproduce current behavior):
`reference_analysis(ax, ay, az, loc_key, trecho_name, *, thresholds=(0.5,1,2,4), offset=None | {"mode": "manual", "g": [..]}, gap=0, t_ms=None, max_jump_ms=None, trecho_order=None)` and add `priority`/`per_trecho_priority`. `t_ms=None` disables the time-jump split so existing tests are unchanged. Defaults for the real run should pass `t_ms` and `max_jump_ms=2000`; then re-assert 1749 in `test_dashboard_site_json.py`.

### Anti-Patterns to Avoid
- **Comparing in float g.** `0.5 * 2048` is exact, but a median of .5 LSB and thresholds like 1.1 are not safe in float; always compare integers.
- **Using `Math.round` / Python `round` on thresholds and offsets differently.** See Pitfall 3.
- **Per-sentido or filtered medians.** Locked out; offset is whole-run once.
- **Hard-coding golden numbers in the engine.** Reference lives in the JSON (`meta.workbook_reference`).
- **Reading the geofence sentido for the badge.** Use `source_runs`.
- **Mutating inputs / DOM or `window` references in `core/`.** Must import cleanly in Node.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test runner / assertions | Custom harness | `node:test` + `node:assert/strict` | Locked; discovery and reporters built-in |
| Seeded RNG for parity cases | JS-side PRNG that must match Python's | Generate cases in Python (`random.Random(seed)`), store inputs and expected outputs in the fixture | No cross-language RNG parity needed; JS only replays |
| Run-length decode | New format | Copy the `expand_runs` semantics from `writer.py` (`[start, value]` pairs, end = next start or n) | Same schema, already tested in Python |
| Median | Float mean-of-middle | Integer doubled median (sum of two middles) | Exact `.5` handling, identical to Excel MEDIAN |
| Number formatting for reasons | Manual thousand separators | `Intl.NumberFormat('pt-BR')` | ICU is built into Node and browsers |
| Hashing of class arrays | Large expected arrays | FNV-1a 32-bit over the `Int8` class-per-row array, same function in Python and JS (implement identically with `Math.imul` / `& 0xFFFFFFFF`) | Small, exact digest |

**Key insight:** every rule is already encoded and tested in `analysis_ref.py`. The risk is divergence, not invention, so copy structure and name variables identically to ease review.

## Common Pitfalls

### Pitfall 1: Python `round()` vs JS `Math.round()` (banker's vs half-up)
**What goes wrong:** `round(t*2048*2)` in Python rounds half to even; `Math.round` rounds half up (toward +inf, so `-2.5 -> -2`). A threshold or manual offset exactly at `k+0.5` produces different integers.
**How to avoid:** Define one function `half_up(x) = floor(x + 0.5)` and use it in both languages (`math.floor(x + 0.5)` / `Math.floor(x + 0.5)`) for offset quantization. Add a unit test with manual offsets like `-0.00012207031 g` (an exact half step) and negative values.

### Pitfall 2: Threshold-to-integer conversion changes semantics
**What goes wrong:** The current oracle uses `round(t*2048*2)`, i.e. nearest doubled-LSB. For a threshold such as 0.7 g (`2867.2`) the oracle uses 2867, so a sample with `dom2 = 2867` (0.69995 g) is classed as an event although `0.69995 < 0.7`. This violates "lower bound inclusive at the g value".
**How to avoid (recommended):** use `th2 = ceil(t * 4096)` in Python and JS. `dom2 >= t*4096` with integer `dom2` is exactly `dom2 >= ceil(t*4096)`. For thresholds that are exact binary fractions (0.5, 1, 2, 4, 0.25, any k/4096) the float product is exact; non-dyadic decimals can never land on an integer, so there is no float-noise risk. This leaves the default classes unchanged (2048/4096/8192/16384 doubled units). Change the oracle in the same plan as the JS and keep the existing inclusive tests green. If the planner prefers not to change the oracle's semantics, the fallback is to keep `half_up` and document the <= 1/4096 g quantization; either way both languages must use the identical function. Confidence: HIGH on the arithmetic, the choice itself is Claude's discretion area.

### Pitfall 3: Manual offset quantization grid
**What goes wrong:** Median offsets can be half-LSB (`med2` odd). A manual offset typed in g must land on the same grid: `off2 = half_up(g * 4096)` gives resolution 1/4096 g, which covers every possible median exactly. Quantizing to whole LSB only (`g*2048`) would make the default-equivalent manual offset (e.g. median 94 LSB = 0.04589844 g) fine but would silently round a half-LSB median.
**How to avoid:** Quantize to doubled LSB (`g*4096`), test that entering the workbook medians in g (0.0458984375, -0.0185546875, -0.9853515625) as manual offsets reproduces the golden counts exactly.

### Pitfall 4: Location key identity (fix index vs coordinate)
**What goes wrong:** Using the fix index (`fix_runs`) as the location key splits points that share coordinates; using it would produce pontos != Python. See Pattern 3.
**How to avoid:** Build keys from `gps.lat/lon` formatted to 6 decimals (or verify `gps.loc` equals coordinate identity with a test, then use `gps.loc`). Compare JS pontos to `reference_analysis(...)["pontos"]` on the committed site JSON; they must be equal (this is Python<->JS parity, distinct from 99 vs 101 workbook difference).

### Pitfall 5: Null handling in typed arrays
**What goes wrong:** `Int32Array.from([null])` silently stores 0, making missing samples look like valid rest readings and corrupting the median.
**How to avoid:** Decode with an explicit `valid` mask (`Uint8Array`), filter by mask before the median, and mark `cls = -1`. Run 1 has no nulls, so this is only caught by the mini fixture or synthetic cases; include a null case in unit and parity tests.

### Pitfall 6: Typed-array `sort()` default
**What goes wrong:** `Array.prototype.sort()` on plain arrays is lexicographic. `Int32Array.prototype.sort()` is numeric by default, but a plain array of numbers is not.
**How to avoid:** Always sort a typed array copy (or pass `(a,b)=>a-b`).

### Pitfall 7: Time base and the time-jump
**What goes wrong:** `t.dt_ms[0] = 0` and the array is deltas, so `tMs` is a cumulative sum; mixing up index and value, or computing the time-jump from `dt` of the wrong index (`dt_ms[i]` is the gap between `i-1` and `i`) gives off-by-one splits.
**How to avoid:** Decode `tMs` once as a cumulative `Float64Array`/`Int32Array` (run 1 is ~5.3e6 ms, fits Int32), and always compare `tMs[i] - tMs[last]`. Python's `decode_samples` already provides `t_ms` in the same form.

### Pitfall 8: Source-file boundary not derivable today
**What goes wrong:** Deriving S1/S2 from `meta.source.files` order assigns the 12.544-row file first; the correct time order puts `3. TIG-PXV.csv` (10.839) first.
**How to avoid:** The writer emits `source_runs` (RLE of `run.origin[i][0]`, one entry per change) and the engine uses it; map each run to `meta.source.files[idx]`. In the reference, define `sentido_by_file_order: [10839, 12544]` as per-time-order region sizes, or store per-region expected values and let the engine compute regions from `source_runs`. Also fix `tests/test_dashboard_site_json.py` golden check to assert the new field.

### Pitfall 9: Fixtures going stale
**What goes wrong:** Regenerating `site/data/run-*.json` (new `generated_at`, new fields) or editing the oracle changes expectations silently.
**How to avoid:** `parity_cases.json` records `oracle_version`/a hash of the input site JSON (sha256 of the accel arrays or of the file) and a pytest `test_parity_fixture_fresh` regenerates the fixture in memory and compares. Keep the real-run cases to expected summaries (counts, digest, indices), not 23k-element arrays.

### Pitfall 10: Node version in CI
**What goes wrong:** On Node < 22.7 (and < 20.19) `.js` files with `import` fail with "Cannot use import statement outside a module".
**How to avoid:** Phase 11's workflow must set Node 22+ explicitly. Note this in the Phase 10 summary. Fallback if ever needed: rename modules to `.mjs`.

## Code Examples

### Golden test (mirrors the exact/reference split)
```js
// tests/js/golden.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeRun, analyze, DEFAULT_PARAMS } from '../../site/js/core/index.js';

const run = decodeRun(JSON.parse(readFileSync('site/data/run-2026-10-02-l4-t102.json', 'utf8')));
const gold = JSON.parse(readFileSync('tests/fixtures/golden_run1.json', 'utf8'));

test('golden exact (defaults)', () => {
  const r = analyze(run, DEFAULT_PARAMS);
  assert.deepEqual(r.mediansLsb, gold.exact.medians_lsb);
  assert.deepEqual(r.classCounts, gold.exact.class_counts);
  assert.equal(r.eventos, gold.exact.eventos);
  assert.equal(r.impactos, gold.exact.impactos);
  assert.deepEqual(r.impactsByClass, gold.exact.impacts_by_class);
  assert.equal(r.conforme.ok, true);
});
```
`node --test` from the repo root finds this file; `assert.deepEqual` in the `strict` import is deep strict (plain numbers compare fine; convert typed arrays with `Array.from` first, since `deepStrictEqual` of `Int32Array` vs `Array` fails by prototype).

### Parity fixture shape
```json
{ "generator": "tools/.../gen_parity.py", "seed": 1234, "inputs_sha256": "...",
  "cases": [
    { "name": "mini-nondefault-1", "source": "synthetic",
      "input": {"ax": [...], "ay": [...], "az": [...], "t_ms": [...], "loc": [...], "trecho": [...]},
      "params": {"thresholds_g": [0.3,0.9,1.7,3.3], "offset": {"mode":"manual","g":[0.01,-0.02,-1.0]}, "gap": 2, "maxJumpMs": 2000},
      "expected": {"class_counts": [...], "eventos": 0, "impactos": 0, "impacts_by_class": [...], "impact_starts": [...], "pontos": 0, "point_rows": [...], "class_digest": "fnv1a32hex", "priority": [...]} },
    { "name": "run1-nondefault-3", "source": "site/data/run-2026-10-02-l4-t102.json", "params": {...}, "expected": {...} } ] }
```
Case design: (a) synthetic series with injected edge cases (values exactly on a threshold, X/Y/Z ties, peak ties, events at array start/end, runs separated by exactly gap and gap+1 normal samples, nulls, repeated location keys, no-GPS stretches, time jumps exactly at, below and above the threshold), several seeds and parameter sets including gap 0/1/3 and manual offsets with half-LSB values; (b) 5-10 seeded random non-default parameter sets on run 1 (inputs referenced by path, expected stored as summary). Parameter sets with thresholds must stay strictly increasing (PARAM-01 enforces order; the engine may assume it and a unit test should document that unordered input is undefined or normalized).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Node test via jest/mocha | Built-in `node:test` (stable since Node 20) | Node 18-20 | No dependencies, fits the no-package.json lock |
| ESM needs `"type":"module"` or `.mjs` | Module-syntax auto-detection for typeless `.js` | Node 22.7 / 20.19 default-on | `.js` shared across browser and Node without package.json (verified on 24.14) |
| Workbook priority from pontos | Priority from impactos (user decision) | Phase 10 context | Divergence from workbook text is intentional |

**Deprecated/outdated:** none relevant.

## Open Questions

1. **Exact schema for `meta.workbook_reference` and `source_runs`**
   - What we know: golden values live in `tests/fixtures/golden_run1.json` (`exact` + `reference`); `--golden` is already a CLI flag; `RunData.origin` has per-row source index; `build_site_json` is the single writer.
   - What's unclear: field names and whether `source_runs` is top-level (peer of `sentido_runs`) or inside `meta`.
   - Recommendation: top-level `source_runs` RLE `[[0,1],[10839,0]]` (start, index into `meta.source.files`), and `meta.workbook_reference = { thresholds_g, class_counts, eventos, impactos, impacts_by_class, sentido_records, sentido_eventos }` built from `golden["exact"]` + `golden["reference"]`; `sentido_records/eventos` are in time-order of files. Add an optional `reference=` argument to `build_site_json`, populated from `--golden` in `cli.py`; absent -> field omitted -> engine returns `available:false`. Schema stays 1 (additive); JS must tolerate missing optional fields. Regenerate with the README command (needs local `Results_1st.Run`, which exists; `--workbook` is optional and slow, skip it unless full re-validation is wanted since exit code 2 only arises from exact check failures) and re-run all converter tests; also bump nothing in `converter_version` unless desired. Update `tools/dashboard_converter/README.md` and the "keys are frozen" comment in `writer.py`.

2. **Gap semantics with unclassified rows**
   - What we know: unclassified rows are non-events and break runs at gap=0.
   - What's unclear: whether they count toward the `gap` budget.
   - Recommendation: they count as non-event samples (pure index distance), same code path in both languages; add a parity case with nulls and gap > 0.

3. **Which rows feed `peakDom2` for trecho ordering**
   - Recommendation: max `dom2` over event rows (cls >= 1) in the trecho, whole run; document in the API.

4. **Time-jump definition for gap > 0**
   - Recommendation as in Pattern 2 (event-to-event span). Low impact; whichever is chosen must be identical in Python.

5. **Unresolved Phase 9 carry-overs** (informational)
   - Per-trecho deviations at inferred stations mean trechos 1 and 4 have 0 impacts at defaults; this affects the side-by-side per-trecho report, not Phase 10 parity. The 6-dp GPS precision re-confirmation is a Phase 11 checkpoint. Regenerating the site JSON in this phase should not change coordinates or trechos; assert that `trecho_runs`/`gps` are byte-identical after regeneration (diff the JSON minus `generated_at`, new fields).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | JS: `node --test` (built-in, Node 24.14 locally; require >= 22.7). Python: pytest (existing, `pytest.ini`, slow marker deselected by default) |
| Config file | none for JS (no package.json by decision); `pytest.ini` exists |
| Quick run command | `node --test tests/js/` (runs in well under 5 s: 23k rows) and `python -m pytest tests/test_dashboard_converter_analysis.py tests/test_dashboard_site_json.py -q` |
| Full suite command | `node --test` (repo root, recursive) and `python -m pytest -q` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | Medians, dominant axis (X>Y>Z ties), dyn = measured - offset, manual offset quantization (half-LSB, negative) | unit | `node --test tests/js/unit.test.js` | ❌ Wave 0 |
| CORE-02 | Classification with inclusive lower bounds; threshold-to-integer rule; unclassified = -1 | unit + golden | `node --test tests/js/unit.test.js tests/js/golden.test.js` | ❌ Wave 0 |
| CORE-03 | Class counts 21031/1611/512/173/56, eventos 2352, impactos 1749 (1112/423/159/55) at defaults; gap and time-jump behavior; pontos JS == Python oracle | golden + unit + parity | `node --test tests/js/golden.test.js` | ❌ Wave 0 |
| CORE-03 | Changing thresholds/offset/gap changes results consistently | unit | `node --test tests/js/unit.test.js` | ❌ Wave 0 |
| CORE-04 | Priority mapping by class index, tie ordering (topCount, peakDom2, trecho order); default-run priorities table | unit + golden | `node --test tests/js/unit.test.js tests/js/golden.test.js` | ❌ Wave 0 |
| CORE-05 | `conformeCheck`: true at defaults on run 1; false with reasons for changed thresholds/manual offset/gap/jump; `available:false` without reference; filters irrelevant; sentido split by file boundary 10839/12544 and 1262/1090 | unit + golden | `node --test tests/js/golden.test.js tests/js/unit.test.js` | ❌ Wave 0 |
| CORE-06 | Python<->JS parity on seeded non-default params (synthetic + run 1) | parity | `node --test tests/js/parity.test.js` | ❌ Wave 0 |
| CORE-06 | Parity fixture is fresh (regenerated == committed) | pytest | `python -m pytest tests/test_parity_fixture.py -q` | ❌ Wave 0 |
| (support) | Oracle extension: manual offset, gap, time-jump, priority; old tests unchanged | pytest | `python -m pytest tests/test_dashboard_converter_analysis.py -q` | ✅ exists, extend |
| (support) | Site JSON has `source_runs` and `meta.workbook_reference`, regeneration keeps trechos/gps identical | pytest | `python -m pytest tests/test_dashboard_site_json.py tests/test_dashboard_converter_writer.py -q` | ✅ exist, extend |

### Sampling Rate
- **Per task commit:** `node --test tests/js/` plus the relevant pytest file(s)
- **Per wave merge:** `node --test` and `python -m pytest -q`
- **Phase gate:** both full suites green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/js/helpers.js` - `loadRun()`, FNV-1a digest, deep-equal helpers for typed arrays
- [ ] `tests/js/golden.test.js`, `tests/js/unit.test.js`, `tests/js/parity.test.js`
- [ ] `tests/fixtures/parity_cases.json` and its generator script (committed, runnable offline)
- [ ] `tests/test_parity_fixture.py` - freshness guard (keep fast: synthetic cases regenerate in memory; real-run cases use the committed site JSON, which is available in CI)
- [ ] Extend `analysis_ref.py` (new params, priority) and its tests before generating the fixture
- [ ] Converter: `source_runs` + `meta.workbook_reference` + regeneration of `site/data/run-2026-10-02-l4-t102.json`
- [ ] Framework install: none (Node built-in); document minimum Node 22.7

## Sources

### Primary (HIGH confidence)
- Repo: `tools/dashboard_converter/analysis_ref.py`, `writer.py`, `cli.py`, `model.py`, `validate.py` (read in full or relevant parts)
- Repo: `tests/test_dashboard_site_json.py`, `tests/test_dashboard_converter_analysis.py`, `tests/fixtures/golden_run1.json`
- Repo: `.planning/research/WORKBOOK-CRITERIA.md`, `.planning/research/ARCHITECTURE.md` (groupImpacts / pointsByLocation sketch, parity design), `10-CONTEXT.md`
- Local experiments (this session): Python prototype over `site/data/run-2026-10-02-l4-t102.json` for time-jump sweep, per-file eventos split and per-trecho impact classes; Node 24.14.0 run confirming typeless `.js` ESM test file executes under `node --test` with no warning

### Secondary (MEDIUM confidence)
- Node `node:test` default file discovery patterns and the module-syntax detection version boundary (22.7 default-on, backported 20.19), from training knowledge; the behavior was confirmed locally on 24.14 only. Not checked against the Node docs in this session.

### Tertiary (LOW confidence)
- GitHub Pages MIME type for `.mjs` (not verified; irrelevant if `.js` is kept).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no libraries; Node built-ins verified locally
- Architecture: HIGH - direct port of a tested oracle, key numbers prototyped on real data
- Pitfalls: HIGH for arithmetic/rounding and schema gaps (verified in code); MEDIUM for Node version boundaries

**Research date:** 2026-10-08
**Valid until:** 2026-11-07 (stable; revisit only if the site JSON schema or the oracle changes)
