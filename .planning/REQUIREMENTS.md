# Requirements: WTVB01 Notebook Logger — v1.3 Field Run Dashboard

**Defined:** 2026-10-08
**Core Value:** O sensor deve conectar, ler e salvar dados confiáveis em CSV — se isso não funcionar, nada mais importa.
**Milestone goal:** Public, Portuguese GitHub Pages dashboard for the first field run (VLT Carioca · Linha 4 · Trem 102 · 02/10/2026), built from the raw logger CSVs, with live-adjustable thresholds, filters, display and analysis parameters.

**Inputs:**
- Raw CSVs (primary): `Results_1st.Run/raw/2. PXV-TIG.csv` (clean), `Results_1st.Run/raw/3. TIG-PXV.csv` (pt-BR Excel re-saved, mangled)
- Station geofences: `Stations_GEO/Line4_Stat_geo.txt`, `Stations_GEO/Line1_Stat_geo.txt` (both directions per line)
- Validation reference: `Results_1st.Run/Final - Monitoramento de Sapata coletora - Linha 04.xlsx` (golden values in `.planning/research/WORKBOOK-CRITERIA.md`)

## v1.3 Requirements

### Repository & Publishing

- [x] **REPO-01**: Run data, workbook, logs, docs and caches are excluded from git (`.gitignore`) before anything is pushed
- [ ] **REPO-02**: Project has a public GitHub remote with Pages enabled
- [ ] **PUB-01**: Anyone can open the dashboard at a public GitHub Pages URL, deployed by a GitHub Actions workflow
- [ ] **PUB-02**: Deploy only happens when converter (pytest) and JS engine (`node --test`) tests pass
- [ ] **PUB-03**: All UI text is Portuguese, with pt-BR number/date formatting (America/Sao_Paulo)

### Converter (raw CSV → site JSON)

- [x] **CONV-01**: Engineer converts a run folder of raw logger CSVs into site data with one command
- [x] **CONV-02**: Converter reads both clean comma CSVs and pt-BR Excel re-saved `;` CSVs, recovering mangled values (accel on the 1/2048 g grid within ±16 g, GPS within the line envelope, temp/vel/disp/freq) and reporting any unrecoverable value instead of guessing
- [x] **CONV-03**: Converter assigns each sample a trecho by station geofence from `Stations_GEO/*.txt` (any line, both directions)
- [x] **CONV-04**: Converter detects sentido automatically from the sequence of stations passed (not from the filename)
- [x] **CONV-05**: Samples without GPS fix (tunnel) get trecho inferred from the surrounding stations in time and are flagged "sem GPS"
- [x] **CONV-06**: Converter emits compact, schema-versioned JSON: sub-second time, accel as integer 1/2048 g counts, GPS fixes with location ids, estimated speed between fixes, vel/disp/freq/temp channels
- [x] **CONV-07**: Converter validates against the treated workbook: class counts (21.031/1.611/512/173/56), eventos (2.352) and impactos (1.749) match exactly; pontos and per-trecho numbers are reported side by side with explained differences

### Analysis Engine (browser)

- [x] **CORE-01**: Dynamic component = measured − rest-level offset; dominant axis; severity = |dominant|
- [x] **CORE-02**: Each measurement is classified Normal/Leve/Moderado/Severo/Crítico by current thresholds (lower bound inclusive)
- [x] **CORE-03**: Eventos, impactos (consecutive events grouped) and pontos de impacto (1 per location) are recomputed live
- [ ] **CORE-04**: Trecho priority (1 Alta → 4 Monitorar) is recomputed live
- [x] **CORE-05**: At default settings a "conforme planilha" badge confirms the trecho-independent KPIs equal the workbook
- [x] **CORE-06**: Automated golden-value and Python↔JS parity tests protect the engine

### Overview

- [ ] **KPI-01**: User sees cards for registros, eventos, impactos, pontos and trecho with most events, reacting to filters and parameters
- [ ] **KPI-02**: User sees class counts and % for medições, impactos and pontos, with dominant-axis breakdown
- [ ] **KPI-03**: User sees means and maxima per axis and for the resultant (medido and dinâmico)
- [ ] **KPI-04**: User sees a per-axis statistics table (mean, median, std, P0.5/P99.5)
- [ ] **KPI-05**: User sees a data-quality card: GPS coverage, samples without position, empty channels, turnaround gap, station-file warnings

### Charts

- [ ] **CHART-01**: User sees AX/AY/AZ time series with zoom and a medido/dinâmico toggle
- [ ] **CHART-02**: Charts show threshold lines and keep every peak visible at any zoom level
- [ ] **CHART-03**: Data gaps (turnaround, missing samples) are drawn as gaps, not bridged
- [ ] **CHART-04**: User can expand secondary charts for vibration velocity, displacement, frequency and temperature
- [ ] **CHART-05**: Zoom and time cursor are synchronized across all charts

### Map

- [ ] **MAP-01**: User sees the GPS track on an OSM map, coloured by sentido and broken at gaps
- [ ] **MAP-02**: User sees station markers and trecho segments on the map
- [ ] **MAP-03**: User sees impact points as severity-coloured markers with a popup (hora, trecho, sentido, AX/AY/AZ din., classe, Google Maps link)
- [ ] **MAP-04**: User can toggle a geographic heat map weighted by severity on a fixed scale (one point per GPS fix)
- [ ] **MAP-05**: User sees how many events cannot be placed on the map (no GPS)

### Matrix & Ranking

- [ ] **MTX-01**: User sees a trecho × severidade heat-map matrix in route order per sentido
- [ ] **MTX-02**: Clicking a matrix cell filters all other views
- [ ] **RANK-01**: User sees a sortable top-50 pontos de impacto table with Google Maps links
- [ ] **RANK-02**: User sees a trecho table with priority and "sem Crítico" highlight
- [ ] **RANK-03**: User can export the filtered ranking as CSV

### User Parameters

- [ ] **PARAM-01**: User can edit the 4 severity thresholds; order is enforced; `,` or `.` accepted as decimal separator
- [ ] **PARAM-02**: User can filter by sentido, trecho, eixo dominante, time window and severity class
- [ ] **PARAM-03**: User can set display options: heat-map metric (eixo dominante / AX / AY / AZ / resultante dinâmica), radius, intensity; medido vs dinâmico
- [ ] **PARAM-04**: User can set analysis parameters: rest-level offset per axis (median default or manual), event-grouping gap, GPS max speed and max fix interval
- [ ] **PARAM-05**: User can reset all parameters to defaults
- [ ] **SHARE-01**: Page URL encodes all parameters and filters; opening the link restores the same view
- [ ] **SYNC-01**: Hovering a chart highlights the position on the map; clicking a map point moves the chart cursor to that time

## Future Requirements

Deferred — tracked but not in the v1.3 roadmap.

- **MOB-01**: Mobile single-column layout with controls in a drawer (not selected for v1.3)
- **RUN-01**: Multi-run selector (converter output is run-scoped to allow it)
- **RUN-02**: Side-by-side run comparison (e.g. before/after maintenance)
- **CHART-06**: Range brushing on chart filters the map
- **UI-01**: Dark mode
- **EXP-01**: PNG export of charts/map
- **GEO-01**: Position interpolation between GPS fixes

Carried from earlier milestones (still deferred): field-validate SCALE_VEL; fix `test_main.py` `mock_csv.file_path` → `.path`; VIZ-07…VIZ-10 (live plot extras).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend / database | Static GitHub Pages only |
| Access control / private dashboard | User confirmed public publication is fine |
| Live streaming from the logger | Dashboard is for post-run analysis |
| FFT / spectral analysis | Out of the project's analysis scope |
| Time × trecho heat map | Not selected; geographic + trecho × severidade chosen |
| Density-weighted heat map | Misleading: repeated GPS fixes (~30 s) would show dwell time, not severity |
| Changes to the logger (`src/`, `requirements.txt`) | Dashboard is additive; 95 logger tests must stay untouched |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REPO-01 | Phase 9 | Complete |
| CONV-01 | Phase 9 | Complete |
| CONV-02 | Phase 9 | Complete |
| CONV-03 | Phase 9 | Complete |
| CONV-04 | Phase 9 | Complete |
| CONV-05 | Phase 9 | Complete |
| CONV-06 | Phase 9 | Complete |
| CONV-07 | Phase 9 | Complete |
| CORE-01 | Phase 10 | Complete |
| CORE-02 | Phase 10 | Complete |
| CORE-03 | Phase 10 | Complete |
| CORE-04 | Phase 10 | Pending |
| CORE-05 | Phase 10 | Complete |
| CORE-06 | Phase 10 | Complete |
| REPO-02 | Phase 11 | Pending |
| PUB-01 | Phase 11 | Pending |
| PUB-02 | Phase 11 | Pending |
| PUB-03 | Phase 11 | Pending |
| KPI-01 | Phase 11 | Pending |
| KPI-02 | Phase 11 | Pending |
| KPI-03 | Phase 11 | Pending |
| KPI-04 | Phase 11 | Pending |
| KPI-05 | Phase 11 | Pending |
| PARAM-01 | Phase 11 | Pending |
| PARAM-02 | Phase 11 | Pending |
| PARAM-03 | Phase 11 | Pending |
| PARAM-05 | Phase 11 | Pending |
| CHART-01 | Phase 12 | Pending |
| CHART-02 | Phase 12 | Pending |
| CHART-03 | Phase 12 | Pending |
| CHART-04 | Phase 12 | Pending |
| CHART-05 | Phase 12 | Pending |
| MAP-01 | Phase 12 | Pending |
| MAP-02 | Phase 12 | Pending |
| MAP-03 | Phase 12 | Pending |
| MAP-04 | Phase 12 | Pending |
| MAP-05 | Phase 12 | Pending |
| SYNC-01 | Phase 12 | Pending |
| MTX-01 | Phase 13 | Pending |
| MTX-02 | Phase 13 | Pending |
| RANK-01 | Phase 13 | Pending |
| RANK-02 | Phase 13 | Pending |
| RANK-03 | Phase 13 | Pending |
| PARAM-04 | Phase 13 | Pending |
| SHARE-01 | Phase 13 | Pending |

**Coverage:**
- v1.3 requirements: 45 total
- Mapped to phases: 45
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-08*
*Last updated: 2026-10-08 after roadmap creation (phases 9-13)*
