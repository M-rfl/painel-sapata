# Roadmap: WTVB01 Notebook Logger

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-05-21)
- ✅ **v1.1 Real-Time Visualization** — Phases 5-6 (shipped 2026-05-24)
- ✅ **v1.2 GPS Data Integration** — Phases 7-8 (shipped 2026-05-25)
- 🚧 **v1.3 Field Run Dashboard** — Phases 9-13 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-05-21</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-05-20
- [x] Phase 2: Sensor Layer (1/2 plans; HW checkpoint deferred) — completed 2026-05-21
- [x] Phase 3: Acquisition Loop (3/3 plans) — completed 2026-05-21
- [x] Phase 4: Documentation & Hardening (2/2 plans) — completed 2026-05-21

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Real-Time Visualization (Phases 5-6) — SHIPPED 2026-05-24</summary>

- [x] Phase 5: Visualizer Module (2/2 plans) — completed 2026-05-23
- [x] Phase 6: main.py Integration (2/2 plans) — completed 2026-05-24

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 GPS Data Integration (Phases 7-8) — SHIPPED 2026-05-25</summary>

- [x] Phase 7: GPS Reader & Data Model (3/3 plans) — completed 2026-05-24
- [x] Phase 8: CSV Integration (1/1 plan) — completed 2026-05-25

Full details: `.planning/milestones/v1.2-ROADMAP.md`

</details>

### 🚧 v1.3 Field Run Dashboard (Phases 9-14)

- [x] **Phase 9: Repo Hygiene & Raw CSV Converter** - `.gitignore` first, then raw logger CSVs become validated, schema-versioned site JSON with trecho/sentido assigned by station geofence
 (completed 2026-10-08)
- [x] **Phase 10: Analysis Engine** - Pure JS core recomputes classes, eventos, impactos, pontos and trecho priority, protected by golden and Python↔JS parity tests
 (completed 2026-10-08)
- [x] **Phase 11: Public Site, Overview & Controls** - Public Portuguese GitHub Pages site with test-gated deploy, KPI overview, and threshold/filter/display controls
 (completed 2026-10-14)
- [x] **Phase 12: Time Series & Map** - Zoomable synchronized charts and the OSM route/impact/heat map, linked by hover and click
 (completed 2026-10-14)
- [x] **Phase 13: Matrix, Ranking & Shareable State** - Trecho × severidade matrix, ranking tables with CSV export, analysis parameters and shareable URLs (completed 2026-10-14)
- [ ] **Phase 14: CSV Upload** - User uploads any raw logger CSV in the browser and the whole dashboard re-renders from it (JS port of the converter, no backend)

## Phase Details

### Phase 9: Repo Hygiene & Raw CSV Converter
**Goal**: The run data is safely excluded from git and one command turns the raw logger CSVs into trustworthy site JSON that matches the treated workbook
**Depends on**: Nothing (first phase of v1.3; the `.gitignore` commit comes before anything else)
**Requirements**: REPO-01, CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06, CONV-07
**Success Criteria** (what must be TRUE):
  1. `git status` shows run data, workbook, logs, docs and caches as ignored, and `.gitignore` is the first commit of the milestone
  2. Engineer runs one command on `Results_1st.Run/raw/` and gets schema-versioned compact JSON from both the clean comma CSV and the pt-BR `;` CSV, with any unrecoverable mangled value reported rather than guessed
  3. Every sample carries a trecho from the station geofences (Line 4 and Line 1, both directions), sentido is detected from the station sequence, and tunnel samples without GPS inherit trecho from neighbours and are flagged "sem GPS"
  4. The converter's validation report shows class counts 21.031/1.611/512/173/56, eventos 2.352 and impactos 1.749 equal to the workbook, with pontos and per-trecho differences listed side by side with explanations
**Plans**: 6 plans

Plans:
- [ ] 09-01-PLAN.md — `.gitignore` as first v1.3 commit, repo-hygiene test, track Stations_GEO + doc generators (W1)
- [ ] 09-02-PLAN.md — Converter package + shared contracts, mangled-value recovery, raw CSV reader, golden fixture (W2)
- [ ] 09-03-PLAN.md — Station-file parser + geofence trecho/sentido state machine, sem GPS/edge flags (W3)
- [ ] 09-04-PLAN.md — GPS fixes/loc ids/speed, schema v1 writer/loader, Python reference analysis (W3)
- [ ] 09-05-PLAN.md — Validation report (golden + workbook, side by side) and one-command CLI (W4)
- [ ] 09-06-PLAN.md — Real-data run, real + CI golden tests, commit site JSON, engineer reviews report (W5, checkpoint)

### Phase 10: Analysis Engine
**Goal**: The browser-side rules reproduce the workbook numbers at default settings and recompute correctly for any parameter change, with no UI required to prove it
**Depends on**: Phase 9
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06
**Success Criteria** (what must be TRUE):
  1. Running `node --test` shows golden-value tests passing: at defaults the engine yields the workbook class counts, eventos and impactos exactly
  2. Changing thresholds, offset or grouping gap changes classes, eventos, impactos, pontos and trecho priority (1 Alta → 4 Monitorar) consistently, with lower bounds inclusive
  3. Python↔JS parity tests with seeded random non-default parameters pass, so engine drift is caught automatically
  4. The engine exposes a "conforme planilha" state that is true only when settings are default and the trecho-independent KPIs equal the workbook
**Plans**: 5 plans

Plans:
- [ ] 10-01-PLAN.md — Extend Python oracle: manual offset, ceil thresholds, gap, 2000 ms time-jump split, impact-basis priority, region split, class digest (W1)
- [ ] 10-02-PLAN.md — Converter emits `source_runs` + `meta.workbook_reference`; regenerate run-1 site JSON (W1)
- [ ] 10-03-PLAN.md — JS core: decode, offsets/dominant/classes, impactos/pontos, analyze(); unit + golden `node --test` (W1)
- [ ] 10-04-PLAN.md — JS per-trecho aggregates, trecho priority, "conforme planilha" state (W2)
- [ ] 10-05-PLAN.md — Python↔JS parity fixture generator, JS replay, pytest freshness guard (W3)

### Phase 11: Public Site, Overview & Controls
**Goal**: Anyone can open a public Portuguese dashboard and see live KPIs that react to thresholds, filters and display options
**Depends on**: Phase 10
**Requirements**: REPO-02, PUB-01, PUB-02, PUB-03, KPI-01, KPI-02, KPI-03, KPI-04, KPI-05, PARAM-01, PARAM-02, PARAM-03, PARAM-05
**Success Criteria** (what must be TRUE):
  1. After the user creates the public GitHub remote, the dashboard loads at a public GitHub Pages URL deployed by Actions, and a failing pytest or `node --test` blocks the deploy
  2. All text is Portuguese with pt-BR numbers and America/Sao_Paulo dates, and the overview shows KPI cards, class counts and % for medições/impactos/pontos with dominant-axis breakdown, means/maxima, the per-axis statistics table and the data-quality card
  3. User edits the four severity thresholds (`,` or `.` decimal, order enforced) and every KPI updates immediately; at defaults the "conforme planilha" badge appears
  4. User filters by sentido, trecho, eixo dominante, time window and severity class, sets display options (heat metric, radius, intensity, medido/dinâmico), and resets everything to defaults in one action
**Plans**: 7 plans
**UI hint**: yes

Plans:
- [ ] 11-01-PLAN.md — pt-BR format/parseDecimal/threshold validation, PT strings, state model + reset (W1)
- [ ] 11-02-PLAN.md — Filter mask + filtered KPI view (cards, class %, axis breakdown, top trecho) (W1)
- [ ] 11-03-PLAN.md — Stats (means/maxima, per-axis table, PERCENTILE.INC) + data-quality summary (W1)
- [ ] 11-04-PLAN.md — Clean-clone CI check + test-gated Pages workflow + workflow guard test (W1)
- [ ] 11-05-PLAN.md — Page shell + overview panels (KPIs/badge, classes, stats, quality) + static site test (W2)
- [ ] 11-06-PLAN.md — Controls (thresholds, filters, display, reset), README, local human check (W3, checkpoint)
- [ ] 11-07-PLAN.md — Pre-publication review, user creates remote/pushes/enables Pages, verify gate + public URL (W4, checkpoints)

### Phase 12: Time Series & Map
**Goal**: User can inspect the run over time and over the route, with both views linked
**Depends on**: Phase 11
**Requirements**: CHART-01, CHART-02, CHART-03, CHART-04, CHART-05, MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, SYNC-01
**Success Criteria** (what must be TRUE):
  1. User sees AX/AY/AZ time series with zoom and a medido/dinâmico toggle, threshold lines, every peak visible at any zoom, and data gaps drawn as gaps; zoom and cursor stay in sync across all charts including expandable velocity, displacement, frequency and temperature
  2. User sees the GPS track on an OSM map coloured by sentido and broken at gaps, with station markers and trecho segments
  3. User sees severity-coloured impact markers whose popup shows hora, trecho, sentido, AX/AY/AZ dinâmicos, classe and a Google Maps link, and a note of how many events cannot be placed (no GPS)
  4. User toggles a severity-weighted geographic heat map on a fixed scale (one point per GPS fix)
  5. Hovering a chart highlights the position on the map, and clicking a map point moves the chart cursor to that time
  6. Every filter and threshold change from the Phase 11 controls updates the map (markers, track highlight, heat map) immediately
**Plans**: 6 plans
**UI hint**: yes

Plans:
- [ ] 12-01-PLAN.md — Vendor uPlot 1.6.32 / Leaflet 1.9.4 / leaflet.heat 0.2.0, #map + #charts sections, base CSS, static guards (W1)
- [ ] 12-02-PLAN.md — decodeRun fix tables, exported g converters, core/series.js chart derivation + tests (W1)
- [ ] 12-03-PLAN.md — core/geo.js: track segments, ponto markers, fixed-scale heat, sem-GPS counts, row<->fix lookups + tests (W2)
- [ ] 12-04-PLAN.md — link bus + mount-once uPlot panel (AX/AY/AZ + Mais canais), sync, thresholds, main.js wiring (W2)
- [ ] 12-05-PLAN.md — Mount-once Leaflet panel (track, stations, markers/popups, heat toggle, note), chart<->map link (W3)
- [ ] 12-06-PLAN.md — Full gates, validation map, engineer browser check (W4, checkpoint)

### Phase 13: Matrix, Ranking & Shareable State
**Goal**: User can find the worst trechos and pontos, tune analysis parameters, and share the exact view by link
**Depends on**: Phase 11 (matrix/ranking independent of Phase 12; share link covers all views once Phase 12 is done)
**Requirements**: MTX-01, MTX-02, RANK-01, RANK-02, RANK-03, PARAM-04, SHARE-01, KPI-06
**Success Criteria** (what must be TRUE):
  1. User sees a trecho × severidade heat-map matrix in route order per sentido, and clicking a cell filters every other view
  2. User sees a sortable top-50 pontos de impacto table with Google Maps links and a trecho table with priority and "sem Crítico" highlight, and can export the filtered ranking as CSV
  3. User sets rest-level offset per axis (median default or manual), event-grouping gap, GPS max speed and max fix interval, and all views recompute
  4. Copying the page URL and opening it elsewhere restores the same thresholds, filters, display and analysis parameters
  5. User sees a track quality index card (0–100 %, Bom/Regular/Ruim) first in the KPI row that reacts to filters and parameters (96,4 % on run 1 at defaults), and the same index per trecho in the trecho table
**Plans**: 7 plans
**UI hint**: yes

Plans:
- [ ] 13-01-PLAN.md — State: analysis params + ui slice + validators, parseSignedDecimal, URL hash serialize/parse (W1)
- [ ] 13-02-PLAN.md — core/gpsfilter.js derived run (fix 31 rejected, pontos 98) + core/matrix.js with click reducer (W1)
- [ ] 13-03-PLAN.md — core/quality_index.js (IQ 96,4 %), core/ranking.js trecho/pontos rows, app/csv.js pt-BR export (W1)
- [ ] 13-04-PLAN.md — IQ card first in KPI row + "Parâmetros de análise" control group (W2)
- [ ] 13-05-PLAN.md — Matrix panel + ranking panel (trecho table, top-50 pontos, CSV), page sections (W3)
- [ ] 13-06-PLAN.md — Derived GPS run wiring, map focus/heat state, live URL hash + Copiar link (W4)
- [ ] 13-07-PLAN.md — Full gates, validation record, engineer browser check incl. GPS 98-pontos decision (W5, checkpoint)

### Phase 14: CSV Upload
**Goal**: User can upload any raw logger CSV in the browser and the whole dashboard (overview, charts, map, matrix, ranking) re-renders from it, with no backend
**Depends on**: Phase 13
**Requirements**: UPLOAD-01
**Success Criteria** (what must be TRUE):
  1. User picks or drops a raw logger CSV (comma or pt-BR `;`) and every view recomputes from it; the bundled run stays the default
  2. Parsing, mangled-value recovery and station-geofence trecho/sentido assignment run in JS and match the Python converter on the run-1 CSVs (parity test)
  3. Invalid or unrecognised files show a Portuguese error and leave the current view intact; nothing is uploaded to any server
**Plans**: 7 plans
**UI hint**: yes

Plans:
- [ ] 14-01-PLAN.md — Python oracle: stations.json + upload_parity fixture (recover, log10k, timestamps, pyround, geofence, whole files) + freshness guard (W1)
- [ ] 14-02-PLAN.md — Pure session controller (generation token, disposer stack, rollback) + mountDashboard/destroy lifecycle, share disabled for uploads (W1)
- [ ] 14-03-PLAN.md — JS recover/reader port: exact decimals, CPython log10/round, fromisoformat port, CSV reader (W2)
- [ ] 14-04-PLAN.md — JS geofence port: haversine, line scoring, assign() state machine (W2)
- [ ] 14-05-PLAN.md — gps/build/convertFiles, known-line guard, CI parity + local run-1 parity under the meta contract (W3)
- [ ] 14-06-PLAN.md — Upload UI: .csv-only selection, caps, UTF-8, pt-BR errors, busy, banner, return to example, no-network guard (W4)
- [ ] 14-07-PLAN.md — Full gates, local run-1 parity, validation record, engineer browser checkpoint (W5, checkpoint)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-05-20 |
| 2. Sensor Layer | v1.0 | 1/2 | Complete (HW checkpoint deferred) | 2026-05-21 |
| 3. Acquisition Loop | v1.0 | 3/3 | Complete | 2026-05-21 |
| 4. Documentation & Hardening | v1.0 | 2/2 | Complete | 2026-05-21 |
| 5. Visualizer Module | v1.1 | 2/2 | Complete | 2026-05-23 |
| 6. main.py Integration | v1.1 | 2/2 | Complete | 2026-05-24 |
| 7. GPS Reader & Data Model | v1.2 | 3/3 | Complete | 2026-05-24 |
| 8. CSV Integration | v1.2 | 1/1 | Complete | 2026-05-25 |
| 9. Repo Hygiene & Raw CSV Converter | v1.3 | 0/6 | Complete | 2026-10-08 |
| 10. Analysis Engine | v1.3 | 5/5 | Complete | 2026-10-08 |
| 11. Public Site, Overview & Controls | v1.3 | 7/7 | Complete | 2026-10-14 |
| 12. Time Series & Map | v1.3 | 6/6 | Complete | 2026-10-14 |
| 13. Matrix, Ranking & Shareable State | v1.3 | 7/7 | Complete | 2026-10-14 |
| 14. CSV Upload | v1.3 | 4/7 | In Progress | - |
