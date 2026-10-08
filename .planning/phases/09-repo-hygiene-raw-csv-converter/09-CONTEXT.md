# Phase 9: Repo Hygiene & Raw CSV Converter - Context

**Gathered:** 2026-10-08
**Status:** Ready for planning

<domain>
## Phase Boundary

1. `.gitignore` is the **first commit** of v1.3. Run data, the workbook, logs, docs (`WTVB01 documents/`, generated `.docx`) and caches are excluded.
2. One command turns a run folder of raw logger CSVs (`Results_1st.Run/raw/`) into compact, schema-versioned site JSON:
   - it reads the clean comma CSV and the pt-BR `;` CSV, recovering mangled values;
   - it assigns trecho by station geofence and auto-detects sentido;
   - samples without GPS (tunnel) inherit their trecho and are flagged "sem GPS".
3. A validation report checks the output against the treated workbook. Class counts 21.031/1.611/512/173/56, eventos 2.352 and impactos 1.749 must match exactly. Pontos and per-trecho numbers are shown side by side with explanations.

Out of this phase: the JS engine (Phase 10), the site/UI and the GitHub remote (Phase 11), and any change to `src/` or `requirements.txt`.

</domain>

<decisions>
## Implementation Decisions

### Trecho assignment (geofence rules)
- **Method: last station passed.** Each station has a circular geofence. A sample's trecho is "last station entered → next station in the detected line/direction sequence" and holds until the next station's geofence is entered. Nearest-segment projection was rejected.
- **Radius:** configurable, default **~100 m**. With fixes only every ~30 s (~330 m apart) a smaller radius misses stations.
- **Dwell at a station belongs to the arriving trecho.** A sample inside B's radius stays in "A – B" until it leaves B's radius, then becomes "B – C".
- **Skipped station** (no fix inside its radius): infer it from the sequence, split the samples between the surrounding fixes at the fix closest to the skipped station, and list the inferred station in the report. Never create spanning "A – C" trechos.
- **Naming:** use the workbook display names where they exist (e.g. COT → "Cristiano Ottoni/Pequena África"; see WORKBOOK-CRITERIA.md trecho list), so the per-trecho comparison lines up 1:1. Keep station-code ids (e.g. `COT-SAR`) alongside as stable keys.
- **Tunnel trecho:** the workbook's "Central – Dentro do Túnel" (S2 #17) is **folded into "Central – Gamboa"**. Its samples have no GPS, inherit Central – Gamboa from their neighbours and carry the "sem GPS" flag. The report explains this as workbook 16+17 ≈ converter 16.
- **Overlapping geofences / shared stations** (Lines 1 and 4 share TIG/RDV/EQD/PRE/GMB/SCT/CDG): resolve them by the expected sequence of the detected line and direction.
- **Station file correction (done during discussion):** in `Stations_GEO/Line1_Stat_geo.txt`, PNV and PMS had identical coordinates. The user corrected them and the file is updated in both directions:
  - PNV (Parada dos Navios): −22.89415693338551, −43.18720087413599
  - PMS (Parada dos Museus): −22.895722418240428, −43.18204210007264
  - Old value for both: −22.893917602230008, −43.18734187775152.
  - The converter should still warn on duplicate or identical station coordinates. These warnings feed the KPI-05 "station-file warnings".

### Sentido & run segmentation
- **One run, time-ordered.** Read every CSV in the run folder, merge, sort by timestamp, and detect sentido segments over the whole timeline. **Filenames are ignored** for sentido. Impact grouping (Phase 10) uses this row order. Here it equals the workbook order: TIG-PXV/S1 from 00:30, then PXV-TIG/S2 from 01:15.
- **Line identification: automatic best sequence match.** Score each line/direction from `Stations_GEO/*.txt` against the observed station order and pick the best. A unique station (e.g. VOL → L4, HMN → L1) settles it. Report ambiguity, and provide a CLI override (e.g. `--line 4`).
- **Sentido change at the terminals:** a sentido ends on arrival at the terminal geofence. Terminal dwell samples stay with the arriving sentido, and the new sentido starts when the train leaves the terminal radius. Don't rely on the 567 s turnaround gap.
- **Run edges** (before the first or after the last station seen): infer the trecho from the line/direction sequence (e.g. a start between TIG and RDV → "Terminal Gentileza – Rodoviária") and flag it in the report.
- Sentido labels follow the workbook: TIG→PXV = "Sentido 1 — Terminal Gentileza → Praça XV"; PXV→TIG = "Sentido 2 — Praça XV → Terminal Gentileza".

### Claude's Discretion (not discussed; use research defaults)
- **Unrecoverable mangled values:** default is to keep the sample, set the field to null and list it in the report (row, column, raw text). Never guess. Fail the run only on structural problems (missing columns, unreadable file) or if the recovered row count ≠ 23.383.
- **Commit vs. ignore:** raw CSVs, the workbook and `data/` are ignored. The generated site JSON is committed under `site/data/`, because CI can't regenerate it from ignored inputs. Whether the golden file is committed is up to the planner (tests need it in CI, so likely yes).
- **GPS precision in the public JSON:** planner's choice. Research flagged it as "confirm before first push". Suggest ~6 decimals (~0.1 m) and raise it at the Phase 11 push checkpoint.
- **Validation report format:** console summary plus a markdown file next to the output, not in `site/`.
- Exact JSON schema details (delta time, RLE runs, loc ids, fix speed): follow ARCHITECTURE.md schema v1, adapted to sub-second raw timestamps and the extra vel/disp/freq/temp channels.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/research/ARCHITECTURE.md`: target layout `tools/dashboard_converter/` (adapter → neutral `RunData` → writer), schema v1, and a reference Python analysis that already reproduced 21.031/2.352/1.749/101 from the workbook. Reuse its rules for the validation report.
- `.planning/research/WORKBOOK-CRITERIA.md`: recovery rules (accel 1/2048 g grid, GPS `/10^(INT(LOG10|x|)−1)`), the GPS envelope (lat −22.92…−22.88, lon −43.22…−43.16), golden totals, and the ordered trecho list per sentido.
- `src/csv_logger.py`: defines the 21-column raw CSV header (GPS as the last 3; `gps_speed_mps` always empty in this run).

### Established Patterns
- pytest under `tests/`; `test_docs.py` globs `src/**/*.py` for naive `datetime.now()`. Keeping the converter in `tools/` avoids it.
- Timezone handling: explicit America/Sao_Paulo (raw timestamps already carry −03:00).
- Dev-only deps go in `requirements-dashboard.txt` (openpyxl for reading the workbook during validation). The logger's `requirements.txt` stays untouched.

### Integration Points
- Inputs: `Results_1st.Run/raw/*.csv`, `Stations_GEO/Line{1..4}_Stat_geo.txt` (format: `CODE (NAME): lat, lon` under `X -> Y` direction headers; spacing is inconsistent and needs tolerant parsing), and `Results_1st.Run/treated/Final - Monitoramento de Sapata coletora - Linha 04.xlsx` (validation only; note it moved to `treated/`).
- Output: `site/data/run-<id>.json`, consumed by the Phase 10 JS engine. The schema is frozen here.
- Line 4 is a loop: S1 goes via VOL; S2 goes via GMB/SCT/CDG. The direction sequences differ, so the station-file direction blocks are the source of truth.

</code_context>

<specifics>
## Specific Ideas

- Per-trecho differences from the workbook are expected and must be **explained** in the report, not hidden. Known causes: the folded tunnel trecho, geofence vs. manual boundaries, and sub-second vs. 1 s resolution.
- Line 1 data (SDU) isn't in this run, but the converter must handle any line in `Stations_GEO/` in both directions.

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within phase scope.

</deferred>

---

*Phase: 09-repo-hygiene-raw-csv-converter*
*Context gathered: 2026-10-08*
