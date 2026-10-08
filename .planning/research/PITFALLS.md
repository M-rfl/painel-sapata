# Domain Pitfalls

**Domain:** Static GitHub Pages dashboard (pt-BR) for an accelerometer + GPS field run, added to an existing Python logger repo
**Milestone:** v1.3 Field Run Dashboard
**Researched:** 2026-10-08
**Overall confidence:** MEDIUM. Project-specific facts come from PROJECT.md and the repo state (HIGH). Leaflet.heat, GitHub Pages and OSM policy points come from training knowledge and were not re-verified this session (MEDIUM). Items marked LOW need a check in the owning phase.

Phase names below are suggested labels, not final roadmap numbering:
- **P-A** Converter (xlsx/CSV to JSON)
- **P-B** Site core (KPIs, charts, parameter engine)
- **P-C** Map and heat maps
- **P-D** Publication (new repo, Pages)

---

## Critical Pitfalls

### 1. The 22 MB xlsx, raw CSVs and generated data get committed or published (repo has NO .gitignore)
**What goes wrong:** `git status` shows `Results_1st.Run/`, `data/`, `logs/`, `WTVB01 documents/`, `__pycache__/` and the `.docx` files all untracked, and there is no `.gitignore` in the repo root. A careless `git add .` pushes the 22 MB workbook, logger CSVs, logs and vendor PDFs to a PUBLIC repo. Git history keeps them forever, even after deletion.
**Why it happens:** The dashboard repo is "new", so people skip hygiene. The Pages site is also often served from the repo root, so anything in the tree becomes a public URL.
**Consequences:** Raw data and vendor manuals exposed. Repo bloat is permanent without a history rewrite. A file over 100 MB is rejected at push, and a 22 MB file is allowed but wasteful.
**Prevention:**
- First commit of v1.3 is a `.gitignore` covering `Results_1st.Run/`, `data/`, `logs/`, `*.xlsx`, `*.csv`, `__pycache__/`, `WTVB01 documents/`, `*.docx`, `.venv/`. Allowlist only the generated site JSON if it is committed.
- Decide the repo layout up front. Preferred: the site lives in `docs/` or `site/` and is the only published tree. Source data never lives under it.
- Use `git add <explicit paths>`. Run `git status` and `git diff --cached --stat` before the first push to the new remote.
- Add a converter guard that refuses to write outside the configured output dir.
- If the dashboard goes to a separate new repo, copy only the site folder. Do not push this logger repo's history, which contains other material.
**Detection:** `git count-objects -vH` jumps. `git ls-files | xargs du -h` shows files over 1 MB. The Pages URL serves `/Results_1st.Run/...xlsx`.
**Phase:** P-D (but the `.gitignore` is created in P-A).

### 2. Raw sheet decimal corruption leaks into the converter (wrong source sheet or wrong parse)
**What goes wrong:** The raw sheet has values like `2.165e+16` and GPS like `-2289879276454220`. Reading `01 dados originais` instead of `02 — DADOS TRATADOS`, or "fixing" the numbers heuristically in the converter, silently yields garbage. Examples are 1e16 g, or lat of -2.29e15 that Leaflet renders in the ocean or throws on.
**Why it happens:** The "reusable for raw logger CSVs later" requirement tempts a generic path. Raw logger CSVs are fine (dot decimals, ISO timestamps), but the xlsx raw sheet is already damaged.
**Consequences:** Wrong KPIs, a broken map, a crashed Leaflet (`Invalid LatLng`).
**Prevention:**
- The converter has two explicit input adapters (workbook treated sheet, logger CSV) that normalize to one internal schema. They do not share a heuristic.
- Validate ranges and fail loudly (exit non-zero) rather than emit bad JSON. Checks: |lat| <= 90, |lon| <= 180, and for Rio roughly lat -23.1 to -22.7 and lon -43.8 to -43.1 as a warning. Also |accel| < 16 g, which is the sensor range and gives hard bounds.
- Emit a `meta.validation` block in the JSON (counts of dropped and out-of-range rows).
- Prefer reading the workbook with `openpyxl` `read_only=True, data_only=True`. Do NOT use the formula view, because formulas without cached values yield `None`.
**Detection:** Min and max of the series in the converter log. A KPI mismatch against the workbook (see pitfall 6).
**Phase:** P-A.

### 3. GPS repeated coordinates and the "tunnel" gap produce a misleading map and heat map
**What goes wrong:** The fix updates only every ~30 s (about 150 samples at 5 Hz share one coordinate). Plotting every sample as a heat point stacks 150 points on one spot. That spot becomes a hot blob regardless of vibration, and the "heat" reflects dwell count, not severity. The 2,020 rows without coordinates are either dropped from the geographic view without telling the user, or linearly interpolated across the tunnel as if exact.
**Why it happens:** leaflet.heat sums point weights per pixel cell. Many duplicate points with weight 1 saturate the gradient.
**Consequences:** Management reads the blobs as the worst locations when they are only the places where a fix was held longest. Impact positions can be off by hundreds of metres (a train at ~40 km/h covers ~330 m in 30 s).
**Prevention:**
- Collapse to one entry per distinct GPS fix (or per fix-bucket) before heat-mapping, and use the MAX of the chosen metric for that fix (this mirrors the workbook's "ponto de impacto = 1 per GPS location, max value"). Never feed raw samples.
- Optionally interpolate position between consecutive fixes by timestamp, but show interpolated positions distinctly (marked "posição estimada") and never claim sub-fix accuracy. Make this a documented choice, not a silent one.
- Show a visible caveat in the UI ("GPS atualiza a cada ~30 s; posição de impacto aproximada") and the tunnel segment as a dashed gap labelled "sem sinal GPS". Do not draw a straight polyline through the gap without styling it.
- Count points without coordinates in the KPI panel ("2.020 registros sem GPS") so totals reconcile with 23.383.
- Break the polyline at gaps (separate segments) instead of connecting across them.
**Detection:** Heat blobs sit on exact fix coordinates. Number of unique (lat, lon) pairs is much smaller than the number of rows.
**Phase:** P-A (dedupe/fix-index in JSON) and P-C (rendering and caveat).

### 4. Leaflet.heat intensity and max normalization misread
**What goes wrong:** leaflet.heat's per-point intensity is 0 to 1, and the `max` option (default 1.0) is the value that maps to the top of the gradient. Feeding raw g values (0.5 to 6) clips everything to red. Normalizing each filter state to its own max makes colors non-comparable between filters. The `radius` is in pixels, not metres, so the apparent footprint changes with zoom. The `maxZoom` option affects intensity scaling with zoom. The plugin is old and its behavior is not a physically meaningful density. (Behavior from training knowledge, MEDIUM.)
**Why it happens:** The "live radius/intensity" sliders are exposed without defining what they mean.
**Consequences:** Heat colors change when the user zooms or filters; a Moderado hotspot looks as hot as a Crítico one; comparisons are invalid.
**Prevention:**
- Map the metric to 0..1 using FIXED severity-anchored scales, e.g. `w = clamp(|dyn| / Crítico_threshold, 0, 1)`, so color means the same thing under every filter. Offer "relativo ao filtro atual" only as an explicit opt-in.
- Set `max` = 1 and drive scale via the weight. Test with `minOpacity`, `blur`, `radius` at several zoom levels.
- Label the legend in severity terms (Leve to Crítico), not "densidade".
- Treat the slider "intensidade" as a multiplier on weight and document it. Consider capping the radius range.
- Because leaflet.heat is a canvas that redraws on `setLatLngs`, debounce slider input (~100 to 150 ms) and call `setLatLngs` once per change.
- Consider a circle-marker layer colored by severity as the primary view, with heat as the secondary, since heat can mislead for sparse, dedupe'd points.
**Detection:** Whole map red on first load. Colors shift when you zoom in.
**Phase:** P-C.

### 5. Client-side recompute does not match the workbook KPIs
**What goes wrong:** The JS re-implementation produces different counts of events, impacts and impact points than the workbook, so management numbers contradict the Excel report.
**Why it happens (specific causes in this project):**
- Dynamic = measured minus the MEDIAN of the axis. If the JS computes the median over a filtered subset, over a different row set (including tunnel rows or not), or with a different even-count rule, offsets differ. Fix the median over the full treated series, and expose "offset de repouso" as an explicit parameter whose default equals the workbook value.
- AZ includes -1 g. The "dominant axis" must be decided on the DYNAMIC values, not on measured. Using measured AZ would make AZ dominant everywhere.
- Threshold boundaries are half-open: Normal < 0,5 <= Leve < 1 <= Moderado < 2 <= Severo < 4 <= Crítico. Use `>=` on the lower bound and compare the ABSOLUTE value. An off-by-one `>` vs `>=` changes counts only at exact equality, which is likely given values quantized at 1/2048 g (0.5 g is exactly representable).
- Event grouping ("consecutive event measurements") depends on the gap rule: consecutive in index or in time, and across the sentido boundary or the tunnel gap. Reproduce the Python/Excel rule exactly.
- Floating-point: JS doubles equal Python floats, but the source values are rounded in the sheet. Compare with a tolerance only for derived floats and exact for integer counts.
**Consequences:** Loss of trust in the dashboard.
**Prevention:**
- Build a golden-file test. The converter emits `expected_kpis` (computed in Python from the workbook's own sheets `eventos`, `picos`, `estatísticas`) into a test fixture. A Node or browser test loads the JSON, runs the JS engine with default params, and asserts exact equality on counts and max values by trecho and sentido.
- Put the engine in a pure JS module (no DOM) so it can be tested with `node --test`.
- Document each rule in one place (`docs/regras.md`) and reference the workbook sheet that defines it.
- Show a "valores conforme planilha" badge when params equal defaults, and "parâmetros alterados" when they differ.
**Detection:** KPI cards at default parameters differ from the workbook's summary sheet by any amount.
**Phase:** P-B (engine and golden test). Define the expected values in P-A.

### 6. 23k x 3 time series: JSON size and rendering lock the browser
**What goes wrong:** Naive JSON of 23,383 rows x many keys (ISO timestamp strings, repeated keys, 15 digits of float) is easily 8 to 15 MB. Plotting 70k points in an SVG chart library or re-rendering on every slider tick freezes the page. Mobile management users get a blank page.
**Prevention:**
- Columnar JSON (`{"t":[...], "ax":[...], ...}`), not an array of objects. Timestamps as integer epoch offsets or seconds from run start (one `t0` plus deltas). Round accel to 4 decimals, or store integers in 1/2048 g units (exact and compact) and divide in JS. Coordinates to 6 decimals. Expect roughly 1 to 2 MB raw and a few hundred KB gzipped. (GitHub Pages serves gzip automatically; LOW to MEDIUM on exact ratio, so measure.)
- Keep a size budget in the converter (warn above e.g. 3 MB) and print the size.
- Do not duplicate data: the dynamic series is derived in JS from measured minus offset, so do not ship both.
- Use a canvas-based chart (uPlot, ECharts canvas, or Plotly `scattergl`) with built-in downsampling or windowing. Avoid SVG for 23k+ points. Consider LTTB or min/max-per-pixel decimation for the overview and full resolution on zoom. Peaks must survive decimation (use min/max buckets, not every Nth sample), otherwise a Crítico impact disappears from the chart.
- Recompute with typed arrays (`Float32Array`/`Int16Array`) and a single pass. Debounce sliders. Run heavy recomputes in `requestAnimationFrame` or a Web Worker only if profiling demands it.
- Lazy-load the map and chart libraries per tab.
**Detection:** JSON over 5 MB. Chart interaction below 30 fps. Slider drag lag.
**Phase:** P-A (format) and P-B (rendering).

---

## Moderate Pitfalls

### 7. Timezone and date parsing (dd/mm vs mm/dd, local vs UTC)
**What goes wrong:** `02/10/2026` parsed as 10 February by `new Date("02/10/2026")` (US order). The date means 2 October. Excel cells may hold a real datetime or a string, depending on the sheet. The run crosses midnight (00:30 to 01:58 on a date that straddles 01/10 to 02/10 local), so a time-only column can wrap. Treating naive local timestamps as UTC shifts the display by 3 h. Brazil has no DST since 2019, but do not rely on that: the converter should not guess.
**Prevention:**
- The converter parses with explicit formats and emits absolute epoch seconds (UTC) plus a `tz: "America/Sao_Paulo"` meta field. Logger CSV already has ISO 8601 with offset, so parse it with the offset.
- JS formats with `Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo'})`. Never use `new Date(string)` on dd/mm strings and never the browser's local zone (a viewer abroad would see shifted times).
- If openpyxl returns `datetime` objects they are naive local. Attach the zone explicitly with `zoneinfo` (`tzdata` is already a dependency).
- Test: the first row displays as 00:30 local and the last as 01:58.
**Detection:** Axis labels read 03:30 or show the wrong day. Dates of 10 Feb.
**Phase:** P-A, with the formatting in P-B.

### 8. pt-BR number formatting and parsing
**What goes wrong:** Mixed up decimal commas: the sheet/UI shows `0,5`, JSON requires `0.5`. `parseFloat("0,5")` returns 0. `<input type="number">` accepts locale-specific input inconsistently across browsers, so a user typing `0,75` for a threshold may get an empty value. Thousands separators ("23.383") get parsed as 23.383. The Portuguese-text cells in the workbook (e.g. a criteria sheet with "0,5") may be strings.
**Prevention:**
- JSON is always dot-decimal numbers (never strings with commas). The converter normalizes `,` to `.` only on string cells and logs the count.
- Display via `Intl.NumberFormat('pt-BR', {minimumFractionDigits, maximumFractionDigits})`. Do not hand-replace characters.
- For threshold inputs use `type="text" inputmode="decimal"` with a small tolerant parser that accepts both `,` and `.` and rejects ambiguity. Validate that thresholds are strictly increasing, and show an inline error in Portuguese.
- Chart libraries' tooltip and axis formatters must be given the pt-BR formatter explicitly. Many default to en-US.
- Keep all UI strings in one dictionary. Check accents (UTF-8 meta tag, files saved as UTF-8 without BOM issues, `<meta charset="utf-8">` first in head). On Windows, Python `open()` defaults to cp1252, so pass `encoding="utf-8"` and `ensure_ascii=False` (or keep ASCII-escaped, since JSON is valid either way) when writing JSON.
**Detection:** Thresholds of 0 after typing a comma. `�` in labels.
**Phase:** P-A (encoding) and P-B (inputs and formatting).

### 9. Jekyll silently breaks the site (underscore paths, `.nojekyll`)
**What goes wrong:** Pages runs Jekyll by default when publishing from a branch. Files and folders starting with `_` or `.` are ignored (e.g. `_data/`, `_assets/`, `_next/`), so a JSON or JS in such a path 404s. Some files with front matter get processed. Vendored node_modules style folders may also be skipped.
**Prevention:**
- Add an empty `.nojekyll` at the published root. Do not use underscore-prefixed directory names for data or assets. Name them `data/`, `assets/`, `vendor/`.
- Alternative: deploy via GitHub Actions (`actions/upload-pages-artifact` + `actions/deploy-pages`), which bypasses Jekyll, and also makes the converter output a build artifact instead of a committed file. Weigh this against simplicity: for a single run, committing the small JSON under `docs/data/` is simpler and the version is auditable.
**Detection:** Works locally with `python -m http.server`, 404 on Pages.
**Phase:** P-D.

### 10. Base path breakage on project pages
**What goes wrong:** A project page is served at `https://<user>.github.io/<repo>/`, not at the root. Absolute URLs like `/data/run.json` or `/assets/app.js` resolve to `github.io/data/...` and 404. Works at `localhost:8000/` and breaks in production. Also: `fetch('data/run.json')` from a file opened via `file://` fails due to CORS, so developers think the code is broken.
**Prevention:**
- Use relative URLs everywhere (`./data/run.json`) or a `<base>` configured once. Avoid router-style paths and no SPA history-API routing (GitHub Pages has no rewrite, so deep links 404). Use hash or tab state in the query string instead.
- Test locally under a sub-path (serve the parent folder and open `/<repo>/`) or test on the real URL right after the first deploy, before building more.
- Document `python -m http.server -d docs` as the dev command.
**Phase:** P-B (conventions) and P-D (verify on the live URL).

### 11. Caching serves stale data after the converter reruns
**What goes wrong:** Pages sends caching headers (about 10 minutes max-age) and CDN edge caching. After re-converting and pushing, users (and the author) see old JSON with new JS, or the reverse, so a version-mismatched schema crashes the page.
**Prevention:**
- Put `schema_version` and `generated_at` and a content hash in the JSON `meta`. The JS checks `schema_version` and shows a clear error on mismatch.
- Cache-bust by appending `?v=<hash>` in the loader (the hash is injected by the converter into a small `manifest.json`, or use `fetch(url, {cache:'no-cache'})` for the manifest only).
- Display "gerado em ..." in the footer so staleness is visible.
**Phase:** P-A (meta fields), P-B (loader).

### 12. Third-party CDN, CORS and supply-chain risk
**What goes wrong:** Leaflet, leaflet.heat and chart libs loaded from unpkg/cdnjs without version pins or SRI. An outage, a corporate firewall (the target audience is a railway operator and may block CDNs or tile servers) or a silent update breaks the page. leaflet.heat is unmaintained (last release years ago), so it is not an auto-updating dependency worth floating.
**Prevention:**
- Vendor the pinned JS/CSS and Leaflet marker images into `docs/vendor/` (small, a few hundred KB), or pin exact versions with `integrity` + `crossorigin="anonymous"`. Vendoring also avoids the well-known Leaflet default-marker icon path breakage under bundlers/base paths (use `L.circleMarker` or `L.divIcon` and avoid default PNG icons).
- Same-origin JSON needs no CORS. Do not fetch from other origins other than tiles.
- Tiles: see pitfall 13. Provide a graceful degraded state when tiles fail (track and markers still draw on a blank background, with a note).
**Phase:** P-B/P-C (decision), P-D (verify).

### 13. OpenStreetMap tile usage policy
**What goes wrong:** The default `tile.openstreetmap.org` is for light, non-commercial-scale use only: it requires attribution ("© OpenStreetMap contributors"), a valid HTTP Referer/identifying User-Agent (browsers send a Referer automatically, but a `Referrer-Policy: no-referrer` meta tag will break it), no bulk download or prefetch, and the service can block heavy traffic. A shared link in a management channel can spike load. (MEDIUM, from the OSM Foundation tile usage policy; recheck the current text.)
**Prevention:**
- Keep the attribution control visible. Do not set `<meta name="referrer" content="no-referrer">`. Do not prefetch tiles or set high `maxZoom` with `detectRetina` spam.
- Plan an alternative provider switch via one config constant (e.g. CARTO basemaps with attribution, or a keyed provider such as MapTiler/Stadia with a free tier restricted by domain). A dark or light CARTO base also improves heat contrast (note that provider terms also require attribution).
- Do not embed API keys that cannot be domain-restricted. A key in public JS is public.
**Phase:** P-C.

### 14. Privacy and sensitivity of "public" data
**What goes wrong:** The user confirmed public publication is acceptable, but the data still reveals the operator (VLT Carioca), line, train ID (Trem 102), exact route, precise time windows of a night maintenance run (00:30 to 01:58), and location of defects on a rail asset (infrastructure condition and potentially security-relevant). Workbook files may also contain embedded metadata (author name, file paths, personal comments in the criteria sheet). The git author/email in commits is also public (`montesrfl@gmail.com` appears in the account context; use the project-specific git identity "Accel MRO" and consider a no-reply email).
**Prevention:**
- Confirm scope again with the user in the roadmap phase: what fields are published, and whether to reduce coordinate precision (5 decimals is about 1 m, 4 decimals is about 11 m, enough for a maintenance view) or to show it as-is. This is a one-line config in the converter (`--coord-decimals`).
- The converter outputs ONLY an allowlist of fields (no raw filenames, author, sheet names with internal paths, sensor/COM identifiers). Strip workbook doc properties by never copying them.
- Add a visible disclaimer ("dados de ensaio; valores não calibrados; unidade g inferida") on the page. This is an honesty issue, not just privacy, because the unit is inferred and velocity/displacement/frequency channels were all 0.
- Remember that anything pushed is permanent in git history; scrub before first push, not after.
**Phase:** P-A (allowlist, precision) and P-D (pre-push review).

### 15. Hiding the data-quality caveats of this run
**What goes wrong:** The dashboard shows vibration/displacement/frequency tabs full of zeros, angle placeholders, or a "temperature" chart, implying measurement. Unit g is inferred, AZ includes gravity (a user may read AZ = 1 g as a Crítico-adjacent impact if the measured series is shown beside thresholds).
**Prevention:**
- Converter detects all-zero or all-null channels and omits them (`meta.channels_available`), and the UI hides those controls instead of displaying flat zeros.
- Thresholds apply to the dynamic value only. When the user plots "medido", draw no severity bands on AZ, or shift them by the offset.
- Provide a short "Notas e limitações" section.
**Phase:** P-A (channel detection), P-B (UI).

---

## Minor Pitfalls

### 16. Repo and Pages size/limit surprises
GitHub: a single file over 100 MB is rejected on push (warning at 50 MB), the repo should stay under about 1 GB, the published site under 1 GB, and soft bandwidth of 100 GB/month. A published site of a few MB is fine. The risk is only from accidental additions (pitfall 1). Also, GitHub Pages for private repos needs a paid plan, and public Pages from a free account requires a PUBLIC repo, which matches the stated intent (MEDIUM).
**Prevention:** Add a CI or pre-commit check: fail if any tracked file is over 5 MB.

### 17. Windows-specific converter gotchas
`Results_1st.Run/Final - ... .xlsx` has spaces and an en-dash style name; the sheet name `02 — DADOS TRATADOS` contains an em dash (U+2014). Typing a plain hyphen in code gives `KeyError`. Match sheets by prefix (`startswith("02")`) or by an index map with a clear error that lists available sheet names. Console output of accented characters on cp1252 may raise `UnicodeEncodeError`, so set `PYTHONUTF8=1` or reconfigure stdout. Use `pathlib` and `argparse` (`--input`, `--out`, `--run-id`). Keep `openpyxl` in a separate `requirements-dev.txt`, not in the logger runtime `requirements.txt`. A 22 MB workbook in non-read-only mode can use 1 GB+ RAM and take minutes: use `read_only=True` and iterate rows once.

### 18. Output not deterministic
Dict ordering, float repr and timestamps in the output make every conversion produce a noisy git diff. Use sorted keys for meta, fixed rounding, and separators `(",", ":")`. Put `generated_at` in a single field so diffs are small. Easy to test by running the converter twice and comparing hashes.

### 19. Accessibility and mobile for management audience
The heat matrix with only red/green gradients is unreadable for color-blind users. Use a sequential palette (e.g. viridis/YlOrRd) plus numeric labels in the cells. Make controls usable on a phone (collapsible parameter panel, 16 px minimum input font to avoid iOS zoom). Check contrast of severity colors against text.

### 20. Trecho x severidade matrix pitfalls
Empty cells (0 events) must render as 0, not blank or NaN. Order trechos by route order and sentido, not alphabetically ("Trecho 10" sorts before "Trecho 2"). With the two sentidos, 21 trechos need a stable key (`sentido|trecho`). Row totals must reconcile with KPI totals. Matrix cells recompute on filters, so confirm that a "janela de tempo" filter also affects the matrix.

### 21. Live-parameter state hygiene
Thresholds not monotonic, rest-offset applied twice (once in the converter and once in JS), filter state not reset by "Restaurar padrões", URL state not encoded so the author cannot share a particular view. Keep the converter output as measured data plus metadata, with derived values only in the JS engine, except for the golden `expected_kpis` fixture. Single state object, single `recompute(state)` function.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| P-A Converter: repo setup | No `.gitignore`, xlsx/CSV committed (1) | `.gitignore` as the very first commit; explicit `git add` |
| P-A Converter: input | Wrong sheet / decimal corruption (2), em dash sheet name (17) | Use the treated sheet by prefix; range validation; fail loudly |
| P-A Converter: output | JSON bloat (6), non-determinism (18), privacy allowlist (14) | Columnar + integer units, size budget, field allowlist, coordinate precision option |
| P-A Converter: time | Naive datetime / dd-mm (7) | Epoch UTC + explicit zone; test first/last row labels |
| P-A Converter: GPS | Repeated fixes, gaps (3) | Emit fix index, `has_gps` flag, gap segments |
| P-B Engine | KPI drift vs workbook (5) | Golden-file test, pure JS module, documented rules |
| P-B UI | pt-BR parsing and formatting (8), cache/schema (11) | `Intl`, tolerant parser, schema_version check |
| P-B Charts | 70k points freezing the page (6) | Canvas library, min/max decimation, typed arrays, debounce |
| P-C Map | Heat saturation and scale (4), duplicate points (3), tiles policy (13) | Fixed severity-anchored weights, dedupe by fix, attribution and a swap-able provider |
| P-C Map | Default marker icons 404 under base path (12) | `circleMarker`/`divIcon` or vendored images |
| P-D Publish | Jekyll (9), base path (10), CDN reliance (12), caching (11), push of sensitive files (1, 14) | `.nojekyll`, relative URLs, vendored libs, test on the live URL, `git diff --cached --stat` before push |

## Research Flags

- **P-C (heat map):** deeper research recommended. Verify the current leaflet.heat API (`max`, `maxZoom`, `radius`, `blur`, `gradient`) against its README, and decide between leaflet.heat, a maintained alternative, or severity circle markers.
- **P-B (charts):** quick spike to choose between uPlot and ECharts/Plotly for 23k x 3 points with decimation. Measure real JSON size after the converter exists.
- **P-D:** verify the current GitHub Pages limits and the "Pages from `/docs` vs Actions" behavior in current GitHub docs before relying on the numbers above.
- **P-A and P-B (KPI parity):** needs a careful read of the workbook's `eventos`, `picos` and `critérios` sheets to pin the exact grouping and rounding rules (not yet inspected in this research).

## Sources

- `.planning/PROJECT.md` (field-run data facts, constraints; HIGH)
- Repo state: `git status` shows no `.gitignore`, untracked `Results_1st.Run/`, `data/`, `logs/` (HIGH)
- Training knowledge, NOT re-verified this session: Leaflet.heat README behavior (MEDIUM), GitHub Pages limits and Jekyll underscore/`.nojekyll` behavior (MEDIUM-HIGH, long-standing documented behavior), OSM tile usage policy (https://operations.osmfoundation.org/policies/tiles/; MEDIUM), `Intl` and `Date` parsing behavior (HIGH, standard)
