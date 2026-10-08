# Phase 11: Public Site, Overview & Controls - Research

**Researched:** 2026-10-08
**Domain:** Static no-build ES-module dashboard (vanilla JS) on GitHub Pages, deployed by Actions gated on pytest + `node --test`; pt-BR formatting; KPI/filter layer over the Phase 10 engine
**Confidence:** HIGH for repo facts and the engine API (read from source). MEDIUM for action versions (checked with `gh api` on 2026-10-08, not yet run in CI).

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 11. The user chose to continue without one. Constraints below come from the task brief and from locked Phase 9/10 decisions.

### Locked Decisions
- All UI text is Portuguese. Numbers are pt-BR and dates are America/Sao_Paulo (PUB-03).
- Deploy is by a GitHub Actions workflow. It is blocked when pytest or `node --test` fails (PUB-01, PUB-02).
- No git remote exists. The user creates the public GitHub remote themselves, so the workflow must work once they do. Platform is Windows. The branch is `master`.
- Static site only: no backend, no database. No changes to the logger (`src/`, `requirements.txt`). The 95 logger tests stay untouched.
- `node --test` only: no package.json, npm or node_modules (Phase 10 decision). Tests live in `tests/js/`.
- The engine in `site/js/core/` is pure (no DOM). Filters are applied by callers on top of the `analyze()` result. Priority and "conforme" are full-run and ignore filters.
- "Conforme planilha" depends on analysis params only, not on filters. Do not label pontos as "equal to the workbook" (Phase 10 verification note: 99 vs 101).
- Public GPS precision is 6 dp. This is OPEN and must be re-confirmed at the push checkpoint.

### Claude's Discretion
- UI structure, file layout under `site/`, CSS approach, state module design, KPI/filter semantics, workflow details.

### Deferred Ideas (OUT OF SCOPE)
- Charts, map and heat map rendering (Phase 12). Matrix, ranking, CSV export, PARAM-04 (offset/gap/GPS params UI) and URL share state (Phase 13). Mobile drawer, dark mode, multi-run selector, PNG export.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REPO-02 | Public GitHub remote with Pages enabled | User checkpoint: create the remote, push, set Pages source to "GitHub Actions". `configure-pages` with `enablement: true` can't be relied on with `GITHUB_TOKEN`, so document the manual setting. Includes the 6-dp GPS precision re-confirmation. |
| PUB-01 | Public Pages URL, deployed by Actions | Official artifact flow: `configure-pages`, `upload-pages-artifact` (path `site`), `deploy-pages`. |
| PUB-02 | Deploy only if pytest and `node --test` pass | A `test` job; `deploy` has `needs: test`. The same workflow can also run on PRs, with the deploy job gated to push. |
| PUB-03 | Portuguese UI, pt-BR numbers, America/Sao_Paulo dates | `Intl.NumberFormat('pt-BR')` and `Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'})`. A single `format.js` plus an i18n string table. |
| KPI-01 | Cards: registros, eventos, impactos, pontos, trecho with most events | The engine gives totals. The filtered view needs a new `view.js` (mask + KPIs). |
| KPI-02 | Class counts and % for medições, impactos, pontos, with dominant-axis breakdown | `classCounts`, `impactsByClass`, `pointsByClass`, `domAxis`. Cross-tab class × axis is new. |
| KPI-03 | Means and maxima per axis and resultant, medido and dinâmico | New `stats.js`. Golden numbers exist in WORKBOOK-CRITERIA.md. |
| KPI-04 | Per-axis table: mean, median, std, P0.5/P99.5 | New `stats.js`. Define the percentile method (see Pitfalls). |
| KPI-05 | Data-quality card | `meta.quality`, `run.flags`, `fix_runs`, `channels`, `engine.naoClassificadas`. |
| PARAM-01 | Edit 4 thresholds, order enforced, `,` or `.` | New `parseDecimal` plus a validator. Feeds `params.thresholds_g`. |
| PARAM-02 | Filter by sentido, trecho, eixo dominante, time window, severity class | New row-mask filter in `view.js`. |
| PARAM-03 | Display options: heat metric, radius, intensity, medido/dinâmico | UI state only in this phase. Heat options are stored for Phase 12. `medido/dinâmico` drives the means/maxima/stats display. |
| PARAM-05 | Reset all to defaults | A single `defaultState()` factory. Reset replaces the state object. |
</phase_requirements>

## Summary

The engine is done and verified: `analyze(run, params)` returns classes, eventos, impactos, pontos, per-trecho aggregates, priority and a `conforme` object. `decodeRun(json)` returns typed arrays. Phase 11 adds three things around it. First, a thin UI shell with no framework and no build step, using ES modules served as-is from `site/`. Second, a "view" layer for filters, stats and KPIs that the engine deliberately left to callers. Third, the CI/Pages pipeline.

Node is v24.14.0 locally, with no package.json. The `.js` files use `import`, and Node 22.7+/24 detect ES module syntax, so `node --test` works. Pin Node 24 (or 22 at minimum) in CI, and don't introduce a package.json. If the user's CI Node were older than 22.7 the tests would fail on `import`.

Repo facts verified on 2026-10-08: no `.github/` directory, only branch `master`, the site JSON (1.1 MB) is committed under `site/data/`, `requirements-dashboard.txt` contains only `openpyxl==3.1.5`, and `pytest.ini` deselects `slow` tests by default. The full pytest suite includes `tests/test_visualizer.py`, which needs Tk. It already failed once on Tk/Tcl (`tcl_findLibrary`) in a Phase 10 verification run and passed on re-run. CI on `ubuntu-latest` may have no Tk or display, so the gate must tolerate this (see Pitfall 2).

**Primary recommendation:** Vanilla ES modules (`site/index.html`, `site/js/app/*.js`, `site/css/app.css`), zero runtime dependencies. Add `site/js/core/stats.js` and `view.js` as pure, `node --test`-covered modules. Add `.github/workflows/pages.yml` with a `test` job (pytest for the converter and the engine fixtures, plus `node --test`) and a `deploy` job that `needs: test`. Run the push and Pages enablement as a human checkpoint.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS ES modules | native | UI, state, rendering | Matches Phase 10 (no npm, no build). `site/` is deployed as-is. |
| `Intl.NumberFormat` / `Intl.DateTimeFormat` | native | pt-BR numbers, Sao_Paulo dates | Built in. Node 24 ships full ICU, so tests can verify the output. |
| `node:test` + `node:assert` | Node 24 | JS tests | Already used by 50 tests. |
| pytest | existing | Python tests | Existing suite. |

### CI actions (versions read from the GitHub releases API on 2026-10-08)
| Action | Latest tag | Use |
|--------|-----------|-----|
| actions/checkout | v7.0.1 | Check out the repo |
| actions/setup-python | v7.0.0 | Python 3.13 |
| actions/setup-node | v7.1.0 | Node 24 |
| actions/configure-pages | v6.0.0 | Pages setup |
| actions/upload-pages-artifact | v5.0.0 | Upload `site/` |
| actions/deploy-pages | v5.0.1 | Deploy |

These are the numbers returned by `gh api repos/<action>/releases/latest`. Pin the major tag (`@v7`, `@v5`, etc.). Planner: re-check at write time, because the pattern is stable but the majors move.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla JS | Preact/Lit via CDN | Adds a runtime dependency and CDN availability for little gain. Phase 11 has a handful of panels. |
| Hand-written DOM updates | lit-html, htm | Not needed. A single `render()` that rewrites KPI containers from state is enough for about 6 panels. |
| Class bars via CSS | uPlot/Chart.js | Chart libraries belong to Phase 12. Use plain `<div>` bars with `width: %`. |

**Installation:** none for the site. CI: `pip install -r requirements.txt -r requirements-dashboard.txt pytest` (check what the existing suite needs; see Open Questions).

## Architecture Patterns

### Recommended Project Structure
```
site/
├── index.html                 # lang="pt-BR", <script type="module" src="js/app/main.js">
├── css/app.css
├── data/run-2026-10-02-l4-t102.json   # already committed
└── js/
    ├── core/                  # existing pure engine (+ stats.js, view.js, units.js new, pure)
    └── app/                   # DOM layer, NOT imported by tests except pure helpers
        ├── main.js            # fetch JSON -> decodeRun -> state -> render
        ├── state.js           # defaultState(), setters, subscribe
        ├── i18n.js            # PT strings
        ├── format.js          # pt-BR number/date formatting + parseDecimal (pure, testable)
        └── panels/            # kpis.js, classes.js, stats-table.js, quality.js, controls.js
tests/js/                      # stats.test.js, view.test.js, format.test.js, state.test.js
.github/workflows/pages.yml
```
Put everything testable under `site/js/core/` or in DOM-free files such as `format.js` and `state.js`. Tests must not import files that touch `document`.

### Pattern 1: Single immutable-ish state, one render path
**What:** `state = { params: {thresholds_g, offset, gap, maxJumpMs}, filters: {sentidos, trechos, eixos, classes, tFrom, tTo}, display: {valueMode: 'medido'|'dinamico', heatMetric, radius, intensity}, inputs: {thresholdText: [...]} }`. `defaultState()` is the only source of defaults, reusing `DEFAULT_PARAMS`. Reset is `setState(defaultState())`, which also clears the threshold text inputs.
**Recompute split (keeps UI immediate):**
1. `analysis = analyze(run, state.params)` runs only when params change. Memoize on a JSON key of the params. On 23k rows it takes tens of ms, but do not re-run it on a filter change.
2. `view = buildView(run, analysis, state.filters, state.display)` runs on every filter or display change.
Priority and conforme come from `analysis` and never change with filters.

### Pattern 2: Row mask + masked KPIs (the filter layer the engine left to callers)
**What:** `rowMask(run, analysis, filters) -> Uint8Array(n)`. A row passes when all the following hold: its sentido is selected; its trecho is selected; its dominant axis is selected (`analysis.domAxis`); its class is selected (`analysis.cls`); and `tMs` is inside the window. Empty selection means "all".
- **registros** = masked row count.
- **eventos** = masked rows with `cls >= 1`.
- **class counts** = masked histogram. Percent = count / masked registros.
- **impactos** = impacts from `analysis.impacts` whose `peak` row is in the mask. This is the same rule `perTrecho` already uses (impact belongs to the trecho of its peak). Impact boundaries are never recomputed under filters, so filters don't split or merge impactos.
- **pontos** = `pointsByLocation(dom2, maskedCls, locId, trecho)`, where `maskedCls[i] = mask[i] ? cls[i] : -1`. The representative of a location is then the strongest event inside the filter. At no filters this equals `analysis.pontos`, which is a cheap assertion for a test.
- **trecho with most events** = argmax of masked eventos by trecho (ties: route order). At defaults it must be "Vila Olímpica – Central" (304 in the workbook). Treat it as a documented comparison, not an exact gate, because the Phase 9 report records known per-trecho deviations at inferred stations (CTR/EQD/SCT). Check the real value in the plan before asserting.
**Dominant-axis breakdown (KPI-02):** a cross-tab of class × axis (X/Y/Z), over medições and over impactos (axis of the peak row). For pontos, the axis of the ponto row.

### Pattern 3: Stats module (pure, golden-tested)
Work from LSB integers with `per_g = 2048`. Convert to g only at the end, so the output stays exact.
- medido per axis: `lsb/2048`. Dinâmico per axis: `(2*lsb - off2)/4096`, signed. This is the signed component, whereas `dom2` is the absolute value of the dominant one.
- Resultante = `sqrt(ax²+ay²+az²)` in g (medido) and with the dynamic components (dinâmica).
- Stats scope = masked rows with all 3 axes valid.
- **Means and maxima** are shown for AX/AY/AZ and the resultante. The golden numbers in WORKBOOK-CRITERIA.md, at no filters, are: mean AX/AY/AZ = 0.04303 / −0.01147 / −0.98747 g; mean resultante 1.06105 g; mean resultante dinâmica 0.27438 g; max AX/AY/AZ (medido) = 10.1636 / −10.7070 / −12.6455 g; max resultante 17.7306 g; max resultante dinâmica 17.1108 g. Use these as a `node --test` golden check at 4–5 decimals. "Maior AX" appears to be the value with the largest magnitude (signs are preserved in the golden), so state that rule explicitly in the code and the UI label ("maior valor absoluto").
- **Table (KPI-04):** mean, median, std, P0.5, P99.5 per axis, on the dinâmico or medido value according to the display toggle. The workbook uses the P0.5–P99.5 band on the dynamic component.

### Pattern 4: Controls
- Thresholds: 4 `<input type="text" inputmode="decimal">` bound to a text buffer in state. On each `input`/`change` event, `parseDecimal(text)` accepts `,` or `.` and trims whitespace. It rejects NaN, negative values, empty text and thousand separators like `1.000,5` (decide and test the rule: accept a single separator only). Validate strictly increasing `t0 < t1 < t2 < t3` and `t0 > 0`. When invalid, keep the last valid `params.thresholds_g` (so the KPIs don't flicker), mark the field in error, and show a Portuguese message. Do not call `analyze` with invalid values. Don't use `type="number"`: browsers reject the comma in some locales and drop it in others.
- Show the thresholds back in pt-BR format (`0,5`).
- Filters: sentido as chips/checkboxes, trecho as a multi-select (route order from `run.trechos[].order`, grouped by sentido), eixo as X/Y/Z chips (labels from `meta.axes`: Longitudinal/Lateral/Vertical), class as chips with the farol colours (Normal verde, Leve amarelo, Moderado laranja, Severo vermelho, Crítico roxo), and a time window.
- Time window: two range inputs over elapsed time, with clock labels from `meta.t0` + `tMs` formatted in Sao_Paulo. The run starts 00:30:56 on 02/10/2026 and spans a turnaround, so don't ask the user to type clock times (midnight wrap and date ambiguity).
- Display options: valueMode (medido/dinâmico), heat metric (eixo dominante / AX / AY / AZ / resultante dinâmica), radius, intensity (`<input type="range">`). They are stored and shown now and consumed by the Phase 12 map. Only valueMode changes anything visible in Phase 11 (stats). Say so in the plan so nobody invents a fake heat map.
- Reset button: restores the state and re-renders. A test checks that `defaultState()` deep-equals the state after a series of edits plus reset.

### Pattern 5: Badge
`analysis.conforme` has three states: `available:false` (no badge), `ok:true` (badge "Conforme planilha", green), and `ok:false` (show "Divergente da planilha" or similar, with the `reasons` list in a tooltip/`title`). Per the verification note, the badge text may say the KPIs of classes, eventos, impactos and sentido split match the workbook. It must not mention pontos. Add a small neutral note that pontos is 99 vs 101 (GPS key differences), since the workbook report lists it as side by side.

### Pattern 6: Data-quality card (KPI-05)
Sources (all in the JSON/engine already):
- GPS coverage = `quality.rows_with_gps / n` (23.383 total: 21.363 with, 2.020 without, so 91,4%). Samples without position = `rows_without_gps`.
- Empty channels: count per channel (vel/disp/freq X/Y/Z, temp) of null or all-zero. `decodeRun` does not keep `channels`, so either keep `json.channels` on the run (small change in `data.js`, add a test) or compute in `main.js` from the raw JSON. Real data: vel/disp/freq are zero in about 17–20% of rows and none of the channels is entirely empty. Define "canal vazio" as 100% null/zero and also show the percentage of zero/null rows per channel, so the card isn't always empty.
- Turnaround gap: `quality.turnarounds[]` (`gap_s`, e.g. 566,7 s) and `max_gap_s`.
- Station-file warnings: `quality.station_file_warnings` (empty list on run 1 → show "nenhum aviso").
- Also available: `unrecovered_values`, `ambiguous_values`, `inferred_stations` (CTR 210 m, EQD 159 m, as per the Phase 9 decision), `nao_classificadas`, and `meta.generated_at`, `converter_version`.

### Pattern 7: pt-BR formatting
- Numbers: `new Intl.NumberFormat('pt-BR', {maximumFractionDigits: d})`, with integers as `21.031` and decimals as `0,5`.
- Percent: `Intl.NumberFormat('pt-BR',{style:'percent', minimumFractionDigits:1})`.
- Dates: `new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo', dateStyle:'short', timeStyle:'medium'})`. Always pass `timeZone` explicitly, because the viewer's machine zone can differ. `meta.t0` is ISO with `-03:00`. Brazil has had no DST since 2019, so offsets are stable, but the explicit zone is still required by the spec.
- Date for tests: `new Date('2026-10-02T00:30:56.060-03:00')` must render `02/10/2026 00:30:56`. Beware that `fmt.format` of `0,5` in Node vs browsers can differ only in exotic cases. Use ` ` consideration for currency only; here there is no currency.

### Anti-Patterns to Avoid
- **Re-running `analyze` on every filter change.** It is full-run and filter-independent by design.
- **Recomputing impactos from filtered rows.** It would change impact boundaries and break the "class independent of filters" rule.
- **`type="number"` for thresholds** (comma handling).
- **Hard-coded workbook values in the UI.** The reference comes from `meta.workbook_reference` (Phase 10 decision).
- **Importing DOM modules from tests.**
- **Duplicating default constants** in `state.js`; import `DEFAULT_PARAMS`.
- **Fetching the JSON with `file://`.** `fetch` of local files fails in browsers. Local dev needs `python -m http.server -d site`. Document it in the README.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| pt-BR number/date formatting | Manual thousands/decimal replace | `Intl.*` with explicit `pt-BR` and `timeZone` | Locale rules and time zone are handled correctly. |
| Rules (classes, eventos, impactos, pontos, priority, conforme) | A second implementation in the UI | `analyze()` from `site/js/core` | Parity-tested; a second copy would drift. |
| Decimal parsing | `parseFloat(text.replace(',', '.'))` alone | A tested `parseDecimal` (strict regex `^\d+([.,]\d+)?$`) | `parseFloat('1,5abc')` returns 1.5, and `parseFloat('1.000,5')` returns 1. Strictness is a requirement. |
| Deploy pipeline | A custom `gh-pages` branch push script | Official Pages actions (artifact flow) | Supports `needs:` gating and the Pages environment. |
| Percentiles | Ad hoc index rounding | One documented `percentile(sorted, p)` with linear interpolation (Excel `PERCENTILE.INC`), unit-tested | A rounding choice silently changes P0.5/P99.5. |
| Charts/maps | Anything | Defer to Phase 12 | Out of scope. |

## Common Pitfalls

### Pitfall 1: Pages source not set to "GitHub Actions"
**What goes wrong:** The workflow fails at `configure-pages` ("Get Pages site failed") or deploys nothing.
**Why:** The default Pages source is "Deploy from a branch". A fresh repo has Pages disabled.
**How to avoid:** The human checkpoint (REPO-02): create the public repo, `git remote add origin ...`, push, then Settings → Pages → Source = GitHub Actions. Also ensure workflow permissions include `pages: write` and `id-token: write`. Provide the exact commands in the plan. The URL will be `https://<user>.github.io/<repo>/`, so every asset and fetch path in the site must be **relative** (`js/app/main.js`, `data/run-….json`), never root-absolute (`/data/…`).
**Warning signs:** A 404 for JS or JSON only on Pages but not locally.

### Pitfall 2: The Python gate runs the Tk-dependent logger tests in CI
**What goes wrong:** `tests/test_visualizer.py` needs Tk/a display and flakes on a headless runner. A flaky gate blocks the deploy for unrelated reasons. On the other side, silently ignoring failures defeats PUB-02.
**How to avoid:** Decide explicitly. Recommended: the gate runs the whole `pytest` (honours `pytest.ini`, so slow is deselected), with `sudo apt-get install -y python3-tk xvfb` and `xvfb-run -a pytest` on ubuntu if the visualizer tests are kept. Alternative: gate only the dashboard tests (`pytest tests/test_dashboard_*.py tests/test_parity_fixture.py tests/test_repo_hygiene.py ...`) and leave logger tests out of the deploy. Check first whether the logger's Windows-only imports (winrt, pyserial, tkinter) even import on Linux. A `windows-latest` runner matches the dev platform better but is slower. Have the plan run the real suite on the chosen runner once (a dry run via `workflow_dispatch` on a PR or branch) before declaring the gate done.
**Warning signs:** The `test_visualizer` Tk errors, or ImportError for `winrt` on Linux (the logger's `requirements.txt` includes Windows-specific packages, so don't install it blindly).

### Pitfall 3: Tests that read data ignored by git
**What goes wrong:** `tests/test_dashboard_converter_real.py` and the `slow` tests read `Results_1st.Run/` (gitignored) and fail in CI.
**How to avoid:** Check that the non-slow suite passes on a clean clone (`git clone` to a temp directory, then run `pytest`). Real-data tests need `skipif` when the folder is missing, or the `slow` marker. The committed site JSON and `tests/fixtures/` (golden, parity) are available in CI. Node tests only use committed files (checked: `helpers.js` loads `site/data/…` and `tests/fixtures/…`). Phase 9/10 notes say "real + CI golden tests", which suggests this is already handled, but verify with the clean-clone run.

### Pitfall 4: Node module detection
**What goes wrong:** `node --test` on `.js` files with `import`, without package.json `"type":"module"`, relies on syntax detection (Node ≥ 22.7). With an older Node in CI, tests fail.
**How to avoid:** `actions/setup-node` with `node-version: 24`. Don't add package.json. New test files use the same pattern as `tests/js/*.test.js`. Use `node --test "tests/js/*.test.js"` (the quoted glob form that the Phase 10 verification used).

### Pitfall 5: Time-window semantics
**What goes wrong:** Filtering by clock time breaks when a run crosses midnight, and the filter can silently change the "conforme" state if mixed up.
**How to avoid:** Filter on elapsed `tMs`, display as clock. Filters never feed `analyze`. A filtered view must still show the "conforme" badge based on full-run values (add a test: `conforme` unchanged when filters change).

### Pitfall 6: Percent denominators
**What goes wrong:** Percent for medições uses registros (including unclassified rows), while impactos/pontos use their own totals.
**How to avoid:** Define the denominators once: medições % = masked rows with class ≥ 0 (or masked registros; choose and display "não classificadas" separately). Document it in the code. On run 1 the two are equal if `naoClassificadas` is 0 (verify), so a golden check will not catch the mistake. Add a unit test with a synthetic null-axis sample.

### Pitfall 7: Threshold edits while mid-typing
**What goes wrong:** Typing "1," produces an invalid intermediate value and the KPIs flash or throw.
**How to avoid:** Keep the text buffer separate from the numeric params (Pattern 1/4). Only a valid, ordered set of 4 values updates `params`. Debounce is unnecessary on 23k rows. Check `analyze` timing in the browser, and if it is above about 50 ms add `requestAnimationFrame` coalescing.

### Pitfall 8: Public repo hygiene at first push
**What goes wrong:** Publishing something that should not be public (raw run data, workbook, manuals).
**How to avoid:** REPO-01 is done and `tests/test_repo_hygiene.py` exists. The checkpoint should run `git status --ignored` and `git ls-files` for a last review before the first push, plus the open decision on GPS precision (6 dp is about 0.11 m, so the track is effectively exact; the user decides whether to coarsen it before publication, and doing so means re-running the converter and re-checking the golden/parity tests). `config.yaml` and `README.md` are tracked and public; look through them for personal paths or serial-port details. Also note that git history is public once pushed (149 commits).

## Code Examples

### Pages workflow (shape; versions per the table above)
```yaml
# Source: GitHub Pages "custom workflow" pattern (actions/starter-workflows pages/static.yml) - structure verified from memory, action majors from releases API
name: Deploy dashboard
on:
  push:
    branches: [master, main]
  pull_request:
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with: { python-version: '3.13', cache: pip }
      - uses: actions/setup-node@v7
        with: { node-version: '24' }
      - run: pip install pytest openpyxl==3.1.5   # plus whatever the dashboard tests import; see Open Questions
      - run: pytest
      - run: node --test "tests/js/*.test.js"
  deploy:
    if: github.event_name != 'pull_request'
    needs: test
    runs-on: ubuntu-latest
    permissions: { pages: write, id-token: write }
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with: { path: site }
      - id: deployment
        uses: actions/deploy-pages@v5
```
Both `master` and `main` are listed because the local branch is `master` while the user may create the remote with `main`. Leave off `paths:` filters so that a converter change also redeploys. Confirm `node --test` quoting: on Linux the shell expands unquoted globs, and Node also accepts the quoted glob.

### pt-BR helpers
```js
// site/js/app/format.js (pure)
const nf = (d) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtInt = (v) => nf(0).format(v);
export const fmtG = (v, d = 4) => nf(d).format(v);
export const fmtPct = (v) => new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
export const fmtDateTime = (d) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' }).format(d);

/** Strict decimal: one separator, ',' or '.', digits only. Returns number or NaN. */
export function parseDecimal(text) {
  const t = String(text).trim();
  return /^\d+([.,]\d+)?$/.test(t) ? Number(t.replace(',', '.')) : NaN;
}
export function validateThresholds(vals) { // -> { ok, errors[] }
  const errors = [];
  if (vals.some((v) => Number.isNaN(v))) errors.push('Informe números válidos (use vírgula ou ponto).');
  else if (!(vals[0] > 0 && vals[0] < vals[1] && vals[1] < vals[2] && vals[2] < vals[3])) errors.push('Os limiares devem ser crescentes.');
  return { ok: errors.length === 0, errors };
}
```
A limiar of exactly 0 is rejected: `thresholds2` uses `ceil(t*4096)` and a zero threshold would turn every sample into an event. The engine accepts it, so the UI must enforce it. Also consider an upper bound, since thresholds above the sensor range (±16 g) are meaningless.

### Mask + KPIs (shape)
```js
export function rowMask(run, a, f) {
  const m = new Uint8Array(run.n);
  for (let i = 0; i < run.n; i++) {
    m[i] = (!f.sentidos.size || f.sentidos.has(run.sentido[i]))
        && (!f.trechos.size || f.trechos.has(run.trecho[i]))
        && (!f.eixos.size || f.eixos.has(a.domAxis[i]))
        && (!f.classes.size || f.classes.has(a.cls[i]))
        && run.tMs[i] >= f.tFrom && run.tMs[i] <= f.tTo ? 1 : 0;
  }
  return m;
}
```
Note on the axis filter: unclassified rows have `domAxis = -1`, so they pass only when no axis filter is set. This is the right behaviour, but document it.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `gh-pages` branch deploys | Artifact + `deploy-pages` with the `github-pages` environment | Needs `pages: write` and `id-token: write`; supports test gating by `needs:`. |
| Bundler for ES modules | Native modules, import maps optional | No build needed for this scale. |
| `winsdk` | `winrt-*` packages (project memory) | Logger-only. Don't install the logger's Windows packages in the Pages job. |

## Open Questions

1. **What does the CI Python environment need?**
   - Known: `requirements-dashboard.txt` has only openpyxl. The converter tests may need only stdlib. The logger tests import `src/*` (serial, tkinter, winrt on Windows).
   - Unclear: whether the full non-slow pytest passes on ubuntu without the Windows packages.
   - Recommendation: the plan's first task runs the suite in a clean clone on Linux (or reads the imports) and decides between "full pytest" and "dashboard tests only + xvfb". Prefer the full suite if it passes, because it is the stricter gate.
2. **Which sentido filter basis?** The geofence `sentido_runs` (11.835 split) is used for filters, per Phase 10 decisions. The "conforme" check uses the file boundary. The UI will show different registros per sentido (11.835 vs 10.839) if both appear. Show only the geofence sentido in filters, and keep the file-based split inside the badge's reasons. Mention the difference in the UI notes.
3. **Trecho with most events value at defaults.** The workbook says Vila Olímpica – Central (304). The converter has a known deviation there (1 vs 2.940 records), so the JS result will differ. The plan should compute the engine's value and describe the difference, not assert 304.
4. **Percentile definition and which value (medido vs dinâmico) the stats table uses.** Recommend `PERCENTILE.INC` linear interpolation, on the dinâmico value by default and following the display toggle. Verify against the workbook "Estatísticas" sheet if the engineer can supply numbers. If not, flag it as MEDIUM.
5. **GPS precision (6 dp) public re-confirmation** remains open and belongs at the push checkpoint.
6. **Repo name / Pages URL** are unknown until the user creates the remote. Relative paths make the site URL-agnostic. A README line with the final URL is a post-checkpoint edit.
7. **Responsive layout.** Mobile is deferred (MOB-01), but a plain CSS grid that does not break on a narrow screen is cheap and avoids a bad first impression on a public link.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 24) for JS; pytest for Python (`pytest.ini`, slow deselected) |
| Config file | `pytest.ini`; none for Node (no package.json) |
| Quick run command | `node --test "tests/js/*.test.js"` |
| Full suite command | `pytest` and `node --test "tests/js/*.test.js"` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUB-02 | Workflow has `test` job and `deploy` has `needs: test`; both test commands present; Pages permissions set; paths relative | pytest (parse YAML text with a regex or simple checks; avoid a PyYAML dependency unless already installed) | `pytest tests/test_pages_workflow.py -x` | ❌ Wave 0 |
| PUB-01 | `site/index.html` exists, uses only relative asset URLs, `lang="pt-BR"`, module entry exists | pytest | `pytest tests/test_site_static.py -x` | ❌ Wave 0 |
| REPO-02 | Remote exists, Pages URL answers 200 | manual (human checkpoint; needs the user's GitHub account) | `gh api repos/{owner}/{repo}/pages` and open the URL | manual-only |
| PUB-03 | `fmtInt(21031)` → `21.031`; `fmtG(0.5,1)` → `0,5`; date → `02/10/2026`; no English UI strings in `i18n.js` | node | `node --test tests/js/format.test.js` | ❌ Wave 0 |
| PARAM-01 | `parseDecimal` accepts `0,5`/`0.5`, rejects `1,5abc`/`1.000,5`/empty; order enforced; invalid keeps last valid params | node | `node --test tests/js/format.test.js tests/js/state.test.js` | ❌ Wave 0 |
| PARAM-02 | rowMask for each filter; empty = all; combined filters; time window; unclassified rows | node | `node --test tests/js/view.test.js` | ❌ Wave 0 |
| PARAM-03 | `defaultState` display fields; valueMode switches stats source | node | `node --test tests/js/state.test.js` | ❌ Wave 0 |
| PARAM-05 | edit then reset → deep-equals `defaultState()`, `conforme.ok` true again | node | `node --test tests/js/state.test.js` | ❌ Wave 0 |
| KPI-01 | No filters: registros 23.383, eventos 2.352, impactos 1.749; filtered impactos by peak row; pontos = `analysis.pontos` when unfiltered | node (golden on run 1) | `node --test tests/js/view.test.js` | ❌ Wave 0 |
| KPI-02 | Class counts 21.031/1.611/512/173/56; % sum to 100; class × axis cross-tab sums match totals | node | `node --test tests/js/view.test.js` | ❌ Wave 0 |
| KPI-03 | Golden means and maxima (WORKBOOK-CRITERIA.md) at 4–5 decimals, medido and dinâmico | node | `node --test tests/js/stats.test.js` | ❌ Wave 0 |
| KPI-04 | mean/median/std/P0.5/P99.5 on a hand-computed small array; percentile interpolation | node | `node --test tests/js/stats.test.js` | ❌ Wave 0 |
| KPI-05 | Quality summary from run 1: 21.363/2.020, 91,4%, turnaround 566,7 s, no warnings; empty-channel logic on a synthetic channel | node | `node --test tests/js/quality.test.js` | ❌ Wave 0 |
| (badge) | `conforme.ok` true at defaults and unchanged under filters; false with changed thresholds | node | existing `unit.test.js` plus the new `view.test.js` | partly ✅ |
| (visual) | Layout, labels, tooltips, error styling, no console errors | manual / optional browser smoke | Open `python -m http.server -d site`, load in a browser | manual-only (no headless browser in the stack) |

### Sampling Rate
- **Per task commit:** `node --test "tests/js/*.test.js"` (under about 5 s) plus the specific pytest file when touching workflow/static checks.
- **Per wave merge:** `pytest` and the full `node --test`.
- **Phase gate:** both green, a green Actions run on the pushed remote, and a human check of the public URL before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/js/format.test.js` — PUB-03, PARAM-01
- [ ] `tests/js/stats.test.js` — KPI-03, KPI-04
- [ ] `tests/js/view.test.js` — KPI-01, KPI-02, PARAM-02
- [ ] `tests/js/state.test.js` — PARAM-01/03/05 (state must live in a DOM-free module)
- [ ] `tests/js/quality.test.js` — KPI-05
- [ ] `tests/test_pages_workflow.py`, `tests/test_site_static.py` — PUB-01, PUB-02
- [ ] No framework install is needed. Node 24 and pytest already exist.

## Sources

### Primary (HIGH confidence)
- Repo source read on 2026-10-08: `site/js/core/*.js`, `site/data/run-…json` (structure and quality fields), `tests/js/helpers.js`, `.gitignore`, `pytest.ini`, `requirements-dashboard.txt`, `.planning/config.json`, 10-CONTEXT.md, 10-VERIFICATION.md, `.planning/research/WORKBOOK-CRITERIA.md`.
- `gh api repos/actions/*/releases/latest` on 2026-10-08, for action versions.

### Secondary (MEDIUM confidence)
- The Pages workflow shape (permissions, environment, artifact flow) comes from my knowledge of the official `static.yml` starter workflow and was not re-fetched this session. Planner: confirm against https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages when writing the file.
- Node ≥ 22.7 ES-module syntax detection (the local Node 24.14.0 proves it works there).

### Tertiary (LOW confidence)
- Whether the logger test suite runs on ubuntu without Windows packages (not tested).
- The percentile method used by the workbook's Estatísticas sheet (assumed to be Excel's `PERCENTILE.INC`).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no-build vanilla is forced by Phase 10 constraints; the action versions were checked through the API.
- Architecture: HIGH — the engine API and the data shape were read directly. The filter semantics (impact by peak row, pontos recomputed on masked classes) are my recommendation, consistent with the existing `perTrecho` rule.
- Pitfalls: MEDIUM — CI Python/Tk behaviour on Linux is untested.

**Research date:** 2026-10-08
**Valid until:** 2026-11-07 (action majors may move sooner)
