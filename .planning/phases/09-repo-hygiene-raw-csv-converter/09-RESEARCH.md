# Phase 9: Repo Hygiene & Raw CSV Converter - Research

**Researched:** 2026-10-08
**Domain:** Python stdlib CSV recovery + geofence trecho assignment + golden-value validation (no new runtime stack)
**Confidence:** HIGH for CSV recovery and golden reproduction (verified row-by-row against the real workbook); MEDIUM for geofence/sentido algorithm (prototyped on real fixes, not yet implemented); HIGH for `.gitignore`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Trecho assignment (geofence rules)
- **Method: last station passed.** Each station has a circular geofence. A sample's trecho is "last station entered -> next station in the detected line/direction sequence" and holds until the next station's geofence is entered. Nearest-segment projection was rejected.
- **Radius:** configurable, default **~100 m**. With fixes only every ~30 s (~330 m apart) a smaller radius misses stations.
- **Dwell at a station belongs to the arriving trecho.** A sample inside B's radius stays in "A - B" until it leaves B's radius, then becomes "B - C".
- **Skipped station** (no fix inside its radius): infer it from the sequence, split the samples between the surrounding fixes at the fix closest to the skipped station, and list the inferred station in the report. Never create spanning "A - C" trechos.
- **Naming:** use the workbook display names where they exist (e.g. COT -> "Cristiano Ottoni/Pequena Africa"; see WORKBOOK-CRITERIA.md trecho list), so the per-trecho comparison lines up 1:1. Keep station-code ids (e.g. `COT-SAR`) alongside as stable keys.
- **Tunnel trecho:** the workbook's "Central - Dentro do Tunel" (S2 #17) is **folded into "Central - Gamboa"**. Its samples have no GPS, inherit Central - Gamboa from their neighbours and carry the "sem GPS" flag. The report explains this as workbook 16+17 ~= converter 16.
- **Overlapping geofences / shared stations** (Lines 1 and 4 share TIG/RDV/EQD/PRE/GMB/SCT/CDG): resolve them by the expected sequence of the detected line and direction.
- **Station file correction (done during discussion):** in `Stations_GEO/Line1_Stat_geo.txt`, PNV and PMS had identical coordinates. The user corrected them and the file is updated in both directions:
  - PNV (Parada dos Navios): -22.89415693338551, -43.18720087413599
  - PMS (Parada dos Museus): -22.895722418240428, -43.18204210007264
  - Old value for both: -22.893917602230008, -43.18734187775152.
  - The converter should still warn on duplicate or identical station coordinates. These warnings feed the KPI-05 "station-file warnings".

#### Sentido & run segmentation
- **One run, time-ordered.** Read every CSV in the run folder, merge, sort by timestamp, and detect sentido segments over the whole timeline. **Filenames are ignored** for sentido. Impact grouping (Phase 10) uses this row order. Here it equals the workbook order: TIG-PXV/S1 from 00:30, then PXV-TIG/S2 from 01:15.
- **Line identification: automatic best sequence match.** Score each line/direction from `Stations_GEO/*.txt` against the observed station order and pick the best. A unique station (e.g. VOL -> L4, HMN -> L1) settles it. Report ambiguity, and provide a CLI override (e.g. `--line 4`).
- **Sentido change at the terminals:** a sentido ends on arrival at the terminal geofence. Terminal dwell samples stay with the arriving sentido, and the new sentido starts when the train leaves the terminal radius. Don't rely on the 567 s turnaround gap.
- **Run edges** (before the first or after the last station seen): infer the trecho from the line/direction sequence (e.g. a start between TIG and RDV -> "Terminal Gentileza - Rodoviaria") and flag it in the report.
- Sentido labels follow the workbook: TIG->PXV = "Sentido 1 — Terminal Gentileza -> Praca XV"; PXV->TIG = "Sentido 2 — Praca XV -> Terminal Gentileza".

### Claude's Discretion (not discussed; use research defaults)
- **Unrecoverable mangled values:** default is to keep the sample, set the field to null and list it in the report (row, column, raw text). Never guess. Fail the run only on structural problems (missing columns, unreadable file) or if the recovered row count != 23.383.
- **Commit vs. ignore:** raw CSVs, the workbook and `data/` are ignored. The generated site JSON is committed under `site/data/`, because CI can't regenerate it from ignored inputs. Whether the golden file is committed is up to the planner (tests need it in CI, so likely yes).
- **GPS precision in the public JSON:** planner's choice. Research flagged it as "confirm before first push". Suggest ~6 decimals (~0.1 m) and raise it at the Phase 11 push checkpoint.
- **Validation report format:** console summary plus a markdown file next to the output, not in `site/`.
- Exact JSON schema details (delta time, RLE runs, loc ids, fix speed): follow ARCHITECTURE.md schema v1, adapted to sub-second raw timestamps and the extra vel/disp/freq/temp channels.

### Deferred Ideas (OUT OF SCOPE)
None. The discussion stayed within phase scope. Out of this phase: the JS engine (Phase 10), the site/UI and GitHub remote (Phase 11), any change to `src/` or `requirements.txt`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REPO-01 | Run data, workbook, logs, docs, caches excluded from git before anything is pushed | `.gitignore` section: anchored patterns (`/data/` not `data/`, which would also ignore `site/data/`), `logs/.gitkeep` is tracked, exact list of untracked items |
| CONV-01 | One command converts a run folder | `python -m tools.dashboard_converter <run_dir>` package layout, stdlib-only core, `openpyxl` only for validation |
| CONV-02 | Reads comma and pt-BR `;` CSVs, recovers mangled values, reports unrecoverable ones | Verified mangling model + recovery rules (0 mismatches over 70,149 accel values and all GPS vs workbook) |
| CONV-03 | Trecho by station geofence, any line, both directions | Station-file parser (tolerant), forward-only state machine, prototype results on real fixes |
| CONV-04 | Sentido auto-detected from station sequence | Monotone-run segmentation of hit sequence; L2/L4 ambiguity; terminals never hit at 100 m |
| CONV-05 | No-GPS samples inherit trecho, flagged "sem GPS" | 2,020 no-coordinate rows; state carried through timeline; workbook tunnel label facts |
| CONV-06 | Compact schema-versioned JSON | Scale factors for each channel verified; schema v1 adaptations |
| CONV-07 | Validation vs workbook (exact class/eventos/impactos; side-by-side pontos/trecho) | Golden totals reproduced from recovered raw data; 6-dp half-up key pitfall; read-only openpyxl |
</phase_requirements>

## Summary

The raw data is fully recoverable. I loaded the real raw CSVs and the workbook's sheet `02 — DADOS TRATADOS` (exported via openpyxl `read_only=True, data_only=True`) and compared. Applying the recovery rules below to `3. TIG-PXV.csv` (the pt-BR file) gives **0 mismatches** against the workbook for all 70,149 accel values (AX/AY/AZ x 23,383 rows) and **0 mismatches** for all GPS coordinates. Running the plain classification rules (median offset, dominant axis, thresholds 0.5/1/2/4, consecutive-run grouping) on the recovered values reproduces **21.031 / 1.611 / 512 / 173 / 56, eventos 2.352, impactos 1.749** exactly. So CONV-07's exact-match half is achievable and is independent of trecho assignment. Row counts are 10.839 (file `3. TIG-PXV`, `;`) + 12.544 (file `2. PXV-TIG`, `,`) = 23.383, in time order (file numbering is misleading; ordering must come from timestamps).

Two things in CONTEXT.md need to be adjusted by the planner (not contradictions of decisions, but facts that change how they are implemented). (1) At the default ~100 m radius, **6 of 22 station passages have no fix inside the geofence** (S1: EQD, CTR, PXV; S2: PXV, TRD, SCT/CDG borderline), including **both PXV passages (min distance 166-183 m)**. So "sentido ends on arrival at the terminal geofence" cannot work for PXV with a 100 m radius; the turnaround must be derived from sequence reversal (with the terminal inferred), and the skipped-station inference path is the *common* case, not an edge case. (2) **VOL is not unique to Line 4**: `Line2_Stat_geo.txt` (PFM terminal instead of TIG) has the same intermediate stations. L2 vs L4 is only separable by TIG vs PFM, so line scoring must penalise observed hits not in the line and reward terminal matches.

Two further empirical facts: the workbook "Dentro do Tunel" trecho (882 samples) is a manual time label, and only 108 of those 882 samples lack coordinates (the other 774 carry stale Wi-Fi coordinates); the no-GPS set overall is 2.020 rows (1.575 in the S1 file, 445 in the S2 file). And the pontos key must be the **6-decimal coordinate rounded half-away-from-zero** (Excel behaviour): full-precision keys give 102 pontos, Python `round()` mismatches 193 coordinates, correct 6-dp keys give 101.

**Primary recommendation:** Build `tools/dashboard_converter/` as a stdlib-only package (csv, json, math, datetime, zoneinfo, decimal, argparse) with `openpyxl` isolated to the validation module; implement recovery exactly as in the "Code Examples" section; implement trecho as a forward-only station-progress state machine (not per-station "last fix inside"); commit `.gitignore` alone first.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python stdlib (`csv`, `json`, `math`, `re`, `datetime`, `decimal`, `argparse`, `statistics`, `hashlib`) | 3.13 installed (3.8+ compatible features only) | Parse, recover, geofence, write JSON | Data is 23k rows; no need for pandas/numpy. Keeps CI install trivial |
| pytest | 9.0.3 (installed; `pytest>=7.0` in requirements.txt) | Converter tests | Existing framework, `pytest.ini` has `testpaths = tests` |
| openpyxl | 3.1.5 (installed; pin in `requirements-dashboard.txt`) | Read workbook for validation only | ARCHITECTURE.md decision; dev-only, must not enter `requirements.txt` (`test_structure.py` asserts its content) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zoneinfo` + `tzdata` | stdlib / already in requirements | America/Sao_Paulo | Raw timestamps already carry `-03:00`; use `datetime.fromisoformat` (handles 6-digit microseconds), only attach zone for meta |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| stdlib csv | pandas | Pandas would mis-infer the mangled columns as strings anyway and adds a heavy dep for CI; not needed |
| Per-station "last fix inside radius" | Forward-only state machine | The per-station version produced non-monotonic boundaries on real data (CTR boundary after COT boundary at R=100); state machine is required |

**Installation:**
```bash
# requirements-dashboard.txt (new, dev-only)
openpyxl==3.1.5
```

## Architecture Patterns

### Recommended Project Structure
```
tools/
├── __init__.py
└── dashboard_converter/
    ├── __init__.py
    ├── __main__.py          # python -m tools.dashboard_converter
    ├── cli.py               # argparse: run_dir, --stations, --out, --run-id, --title, --line, --radius, --workbook, --report, --strict
    ├── sources/logger_csv.py   # delimiter sniff, per-cell recovery, merge+sort -> RunData
    ├── recover.py           # pure functions: recover_accel, recover_gps, recover_scaled (unit-testable)
    ├── stations.py          # tolerant parser + warnings (dups, overlaps, unparsed lines)
    ├── geofence.py          # hits, line/direction scoring, sentido segmentation, trecho state machine
    ├── gps.py               # 6-dp half-up key, loc ids, fix runs, speed
    ├── model.py             # RunData dataclass
    ├── writer.py            # schema v1 compact JSON
    ├── analysis_ref.py      # Python reference (median, dominant axis, class, events, impacts, pontos)
    └── validate.py          # golden compare + workbook slice + markdown report (only module importing openpyxl)
tests/
├── test_dashboard_converter_recover.py / _stations.py / _geofence.py / _writer.py / _validate.py
├── test_dashboard_converter_real.py     # skipif raw run folder missing (CI)
├── test_dashboard_site_json.py          # golden check on committed site/data/run-*.json (runs in CI)
└── fixtures/ (tiny synthetic CSVs + golden_run1.json constants)
```
`tools/` must not live under `src/` (`test_docs.py` rglobs `src/` for naive `datetime.now()`). `tests/__init__.py` exists, so pytest's rootdir insertion makes `import tools.dashboard_converter` work without packaging.

### Pattern 1: Per-cell recovery by regex shape, not per-column guess
**What:** Classify each cell: `empty` / `plain` (`-?\d+\.\d+` not thousands-shaped, or leading `0.`) / `thousands-shaped` (`^-?[1-9]\d{0,2}(\.\d{3})+$`). Thousands-shaped cells are Excel's decimal-point-stripped integers re-displayed with `.` grouping; strip dots to get integer N and apply the per-column rule.
**Why single-group matters:** `-10.625`, `-103.125`, `-12.578.125` are all mangled integers (true -1.0625, -1.03125, -1.2578125). A single dot group must NOT be treated as plain. `0.375`/`-0.125` (leading `0.`) are genuine. For `1.125`-like values both readings give the same number, so uniform treatment is safe.
**Verified:** 65,629 plain, 4,516 "k" rule, 4 "k-1" rule; 0 mismatches vs workbook.

### Pattern 2: Forward-only station-progress state machine for trecho
**What:** Per detected (line, direction) sequence `S[0..m]`: walk fixes in time order, keep `j` = index of last passed station. At each fix test only `S[j+1 .. j+L]` (lookahead L=2-3) for `dist <= R`; on a hit at `j+k`, mark skipped stations `j+1..j+k-1` as inferred and advance. A station counts as "left" when the next fix is outside its radius (dwell stays in arriving trecho). Boundaries are forced monotone non-decreasing in sample index.
**Why:** Prototype of "for each station, last fix inside R" on real data gave non-monotone boundaries (S1 R=100: COT boundary at sample 7085 but CTR at 7265) because Wi-Fi location is noisy (min fix distance from 4 m to 262 m). At R>=150, shared stations (GMB/CDG/PRE on S1) produce spurious hits unless candidates are restricted to the direction sequence.
**Skipped station boundary:** among fixes strictly between the neighbouring boundaries, take the fix closest to the skipped station; if no fix lies between, the boundary is the later neighbour's fix (never create "A - C").

### Pattern 3: Sentido from monotone runs of the hit sequence
Observed hit sequence at R=100 (S1 file then S2 file): S1 file `TIG RDV PRE VOL COT SAR TRD CLB`, then S2 file `CLB SAR COT CTR VOL GMB PRE RDV TIG` (unrestricted nearest-station hits; restrict to the direction's own stations to drop e.g. S1 GMB). Split into maximal runs whose station index is monotone in one direction of the chosen line; a reversal (index regresses, or the same non-terminal station repeats then proceeds backwards) is a turnaround. Place the turnaround at the fix with minimum distance to the terminal (inferred PXV) between the last forward hit and first backward hit; corroborate with the largest inter-sample gap (567 s here, report both, do not depend on it). The S1/S2 split should land at sample index 10.839 (workbook boundary); assert this in the real-data test.

### Pattern 4: Adapter -> RunData -> writer (from ARCHITECTURE.md)
Keep the schema frozen at v1 with these adaptations:
- `t.dt_ms`: round **absolute** ms from t0 first, then diff (avoids cumulative rounding drift; raw has microsecond timestamps, dt 0.16-0.49 s, ~5.5 Hz).
- accel: integer LSB, `per_g: 2048` (all recovered values are exact multiples; assert and fail otherwise).
- `vel_x/y/z`: int x100 (mm/s); `temp`: int x100 (C); `disp_x/y/z`: int x1 (um); `freq_x/y/z`: int x10 (Hz). Verified exact on the clean file (vx,vy,vz,temp scale 100; dx scale 1; freq scale 10). Put the scales in the JSON so JS does not hard-code. Angles are empty (RESERVED) and `gps_speed_mps` is empty in this run: omit angles, estimate speed from fixes.
- `gps.lat/lon` at 6 dp, one entry per contiguous 6-dp coordinate run; `loc` id = same 6-dp string; `speed_kmh` per fix (haversine to next fix / dt, valid if dt <= 120 s and v <= 50 km/h; params from WORKBOOK-CRITERIA).
- per-sample flags as RLE: `trecho_runs`, `sentido_runs`, `fix_runs` (-1 = sem GPS), plus `trecho_inferred` runs (edge / skipped-station / sem GPS) so the UI/KPI-05 can count them.
- JSON via `json.dumps(obj, separators=(",", ":"), ensure_ascii=False)`, written UTF-8.

### Anti-Patterns to Avoid
- **Treating a single `d.ddd` group as plain.** Breaks 46 values in this run (found by testing).
- **Python `round(x, 6)` for the location key.** Float repr of `-22.9025225` rounds to `-22.902522`; Excel gives `-22.902523`. Use `Decimal(str).quantize(Decimal("0.000001"), ROUND_HALF_UP)` (ROUND_HALF_UP is away-from-zero for ties) on the recovered decimal string. 193 coordinates differ otherwise.
- **Full-precision coordinate as pontos key.** Gives 102 pontos instead of 101.
- **Deriving sentido/line from filenames or file order.** Filenames `2. PXV-TIG` / `3. TIG-PXV` are in reverse time order.
- **`data/` in `.gitignore`.** An unanchored `data/` also ignores `site/data/`, which must be committed.
- **Reading the workbook with `read_only=False`.** >100 s; use `read_only=True, data_only=True` (still takes minutes for the 54-column sheet; make `--workbook` optional and default validation to committed golden constants).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Great-circle distance | Planar approximations | `math` haversine (R=6371000 m) | Distances are 5-250 m; use the same haversine as the workbook speed |
| Excel rounding | `round()` | `decimal.Decimal.quantize(ROUND_HALF_UP)` | Ties exist in real data |
| Median of accel | float median | Integer LSB median (`statistics.median` on ints; average of two middles for even n) | Exact parity with Excel MEDIAN; gives 94/-38/-2018 LSB |
| xlsx reading | zip/XML parsing | openpyxl read-only | Cached values only |
| ISO timestamp parsing | strptime formats | `datetime.fromisoformat` | Handles `.060032-03:00` natively (3.7+) |
| CSV dialect | Manual split | `csv.reader` with delimiter sniffed from the header line (`;` count > `,` count) | Quoting/CRLF handled; also tolerate decimal comma in `;` files |

**Key insight:** The only truly custom logic is (a) mangled-number recovery, (b) station-progress/sentido state machine. Everything else is stdlib.

## Common Pitfalls

### Pitfall 1: Mangled-value ambiguity between 1 and 2 integer digits
**What goes wrong:** Integer N from the stripped digits has two on-grid readings for accel (x and 10x, both multiples of 1/2048 and both <=16 g), e.g. `-1.037.109.375` -> 1.037109375 or 10.37109375.
**Observed:** In this run the grid test alone is ambiguous for 3,840 + 403 values; the workbook rule resolves them: take `N / 10^INT(LOG10 N)` (1 integer digit) if on-grid and <=16, else `N / 10^(INT(LOG10 N) - 1)` (only 4 cases here). This matches the workbook on every value.
**How to avoid:** Implement exactly that rule; add a neighbour-continuity audit (median of +-3 plain neighbours; flag when |chosen - median| > 2 g and the alternative is closer) and list flagged cells as "ambiguous, resolved by rule" in the report without changing the value (changing it would break the golden counts). Residual risk: a genuine >=10 g reading whose digits also form an on-grid 1-digit reading; cannot be separated from the text alone.
**Warning signs:** a mangled AZ far from the -1 g baseline with quiet neighbours.

### Pitfall 2: GPS, temperature, velocity, frequency mangling is Excel's 15/17-digit padding
**What:** Floating-point artefact strings (e.g. `3.0500000000000003`, `21.650000000000002`) lost the dot and were padded: `21.650.000.000.000.000` (17 digits) = 21.65; `19.000.000.000.000.000` = 1.9 Hz; `16.500.000.000.000.000` = 1.65 mm/s; GPS `-2.289.879.276.454.220` = -22.8987927645422 (16/17 digits; short ones with 7-9 digits are 5-7 decimal coordinates).
**Rules (verified):** GPS: `N / 10^(len(digits) - 2)` (2 integer digits; matches workbook 100%, then check envelope lat -22.92..-22.88, lon -43.22..-43.16). Temperature: 2 integer digits (587/587 agree with neighbours). Velocity and frequency: 1 integer digit (all 4+1+20 vel and 9,347 freq cells agree with the nearest-neighbour candidate). Implement as "candidates with 1..3 integer digits, filter by a per-column physical range, pick the one closest to the median of plain neighbours (+-6 samples), else the column's plain-value median; report if no neighbour exists". The workbook has no vel/temp/freq columns, so these are validated by neighbours and by the clean file's ranges only (MEDIUM confidence). Disp (um) columns were never mangled in this run but handle the same way.

### Pitfall 3: GPS fix identity vs. coordinate identity
**What:** Fixes arrive about every 30 s (raw string changes: 59 in the S1 file, 78 in the S2 file; ARCHITECTURE.md measured 142 contiguous 6-dp runs and 115 distinct keys in the workbook), coordinates repeat on revisits. Loc id must be per distinct 6-dp key, fix runs per contiguous run.

### Pitfall 4: Radius 100 m misses many stations
**Measured minimum fix distance to station (m)** S1 file: TIG 5, RDV 44, EQD 159, PRE 75, VOL 47, CTR 210, COT 76, SAR 44, TRD 95, CLB 21, PXV 183. S2 file: PXV 166, CLB 4, TRD 171, SAR 58, COT 33, CTR 70, GMB 14, SCT 145, CDG 124, RDV 72, TIG 44.
At R=100: S1 skips EQD, CTR, PXV; S2 skips PXV, TRD, SCT, CDG (4 inferred + the terminals). At R=200 only CTR (S1) remains inferred. Geofence trecho boundaries differ from the workbook by roughly 700-900 samples at VOL/CTR and ~300-1,200 elsewhere (e.g. workbook TIG-RDV ends at sample 1.628; R=100 gives ~1.234). This is expected; the report must list it station by station. Recommendation to the planner: keep default 100 m as decided (CLI `--radius`), emit a `hit`/`inferred(distance)` status per station per sentido in the report, and consider adding `--terminal-radius` (default e.g. 200 m) so terminals can be detected; surface this as the single most useful discretionary knob. (Confirm with the user; the discussion only decided "~100 m configurable".)

### Pitfall 5: Line identification ambiguity (L2 vs L4, L1 vs L4)
**What:** `Line2_Stat_geo.txt` = L4 stations with PFM replacing TIG; VOL, CTR, COT... occur in L2 and L4. CONTEXT's "VOL settles L4" is wrong. L1 shares TIG/RDV/EQD/PRE/GMB/SCT/CDG with L4. L3 shares CTR/COT/CDL... with L1/L2.
**How to avoid:** Score = matched in-order hits - penalty x observed hits not present in the line/direction; terminal presence (TIG vs PFM) breaks the L2/L4 tie. In this run TIG is hit at 5 m and 44 m and PFM never, so L4 wins unambiguously. Report the runner-up score; `--line N` override.

### Pitfall 6: Station file parsing quirks
Line1 is LF without trailing newline; Lines 2-4 are CRLF; headers `TIG ->  SDU` (double space) and `SDU-> CTR` (no space before arrow); entries `TRD (TIRADENTES):-22.9...` (no space after colon), `EQD (EQUADOR):  -22.89` (extra spaces); accented names (`PRAÇA XV`, `SÃO BENTO`) in UTF-8 without BOM; `LINHA 4:` banner lines. Parse with `^\s*([A-Z]{3})\s*\(([^)]*)\)\s*:\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)` and header `^\s*([A-Z]{3})\s*->\s*([A-Z]{3})\s*$`; unparsable non-empty lines become warnings (not crashes). Warnings to emit (feed KPI-05): identical coordinates for different codes; same code with different coordinates across lines (currently none); consecutive stations closer than 2R (geofences overlap; e.g. VOL-GMB are ~145 m apart); unparsed lines; direction block with duplicate code. Current check: no duplicate or conflicting coordinates in lines 1-4 after the PNV/PMS fix.

### Pitfall 7: "Sem GPS" is not the same as the workbook tunnel
Rows without coordinate: 2.020 (1.575 + 445) vs 21.363 with. The workbook "Dentro do Tunel" label covers 882 rows of which only 108 have no coordinate. After folding into "Central - Gamboa" the report should say: workbook 16 (two runs, 2.937 + 294 samples) + 17 (882 samples) ~= converter 16 (4.113 samples), and the 774 coordinate-bearing tunnel-labelled rows are assigned by geofence instead. Do not claim "tunnel = no GPS".

### Pitfall 8: Pontos expectations
With the workbook's own trecho and 6-dp keys: 101. Folding the tunnel trecho into Central - Gamboa for the "SEM GPS | trecho" keys gives 100 in a quick estimate (workbook trechos only). With geofence trechos it will differ more. Pontos and per-trecho numbers are "reported side by side with explanations", so do NOT put pontos=101 in a hard assertion for the converter; assert class counts, eventos, impactos, impactos-by-class (1.112/423/159/55) and coordinate/no-coordinate counts exactly.

### Pitfall 9: Workbook validation speed and encoding
Sheet names/headers contain em-dashes and accents (`02 — DADOS TRATADOS`); find the sheet by prefix `02`, and columns by header text (`Trecho (padronizado)`, `Evento (1/0)`, `CLASSIFICAÇÃO`, `Local (chave)`, ...). On Windows set stdout to UTF-8 (`sys.stdout.reconfigure(encoding="utf-8")`) or printing the report raises `UnicodeEncodeError` (cp1252) -- this happened in research. Write the markdown report with `encoding="utf-8"`.

## Code Examples

Verified against the real files (0 mismatches vs workbook):

### Accel recovery
```python
# Source: verified in research against workbook sheet 02 (all 70,149 values)
import math, re
THOU = re.compile(r"^-?[1-9]\d{0,2}(\.\d{3})+$")   # includes single group: '-10.625'

def recover_accel(text: str) -> tuple[float, str]:
    if not THOU.match(text):
        return float(text), "plain"                      # '0.375', '0.05419921875', '-0.125'
    sign = -1 if text.startswith("-") else 1
    n = int(text.replace(".", "").replace("-", ""))
    if n <= 16:
        return sign * float(n), "plain"
    k = int(math.log10(n))
    y = n / 10**k
    if y <= 16 and abs(y * 2048 - round(y * 2048)) < 1e-9:
        return sign * y, "k"        # workbook: /10^INT(LOG10)
    return sign * n / 10**(k - 1), "k-1"
# then: lsb = round(v * 2048); assert abs(v*2048 - lsb) < 1e-6 and abs(v) <= 16
```

### GPS recovery and 6-dp key
```python
from decimal import Decimal, ROUND_HALF_UP
GPS_THOU = re.compile(r"^-?\d{1,3}(\.\d{3})+$")
def recover_gps(text):
    if text == "": return None
    if GPS_THOU.match(text):
        digits = text.replace(".", "").replace("-", "")
        val = Decimal(digits).scaleb(-(len(digits) - 2))      # 2 integer digits
        return -val if text.startswith("-") else val
    return Decimal(text)
def key6(d: Decimal) -> str:
    return str(d.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP))
# envelope check: -22.92 <= lat <= -22.88 and -43.22 <= lon <= -43.16 else report (don't guess)
```

### Reference analysis (matches golden)
```python
# medians over ints (exact), dyn = (lsb - med)/2048, dominant = max(|dx|,|dy|,|dz|), tie X>Y>Z
# class by lower-bound-inclusive thresholds 0.5/1/2/4; evento = class>=Leve
# impacto = run of consecutive evento rows over the merged time-ordered series
# ponto = per key (6-dp coord string, or ("SEM GPS", trecho)) the first strict-max evento row
```
Result on the real data: classes 21031/1611/512/173/56, eventos 2352, impactos 1749.

### Forward-only trecho sketch
```python
def assign_trechos(fixes, seq, R):
    """fixes: [(sample_idx, lat, lon)] time-ordered; seq: stations of detected direction."""
    j = -1; hits = {}          # station index -> (first_fix, last_fix) inside radius
    for f, (i, la, lo) in enumerate(fixes):
        for k in range(j + 1, min(j + 4, len(seq))):
            if haversine(la, lo, seq[k].lat, seq[k].lon) <= R:
                # mark seq[j+1:k] as inferred (closest fix between neighbours later)
                j = k; hits.setdefault(k, [f, f])[1] = f; break
        else:
            if j >= 0 and haversine(la, lo, seq[j].lat, seq[j].lon) <= R:
                hits[j][1] = f             # dwell continues
    # boundary after station k = sample index of the first fix after hits[k][1];
    # inferred stations: fix closest to station within (prev boundary, next boundary)
    # enforce boundaries[i] >= boundaries[i-1]
```

### `.gitignore` (first commit of v1.3, committed alone)
```gitignore
# Run data, workbook, field logs (22 MB xlsx; raw CSVs stay local)
/Results_1st.Run/
/Stations_GEO/        # decide: see note below
/data/
/logs/*
!/logs/.gitkeep
*.log
# Docs and generated documents
/WTVB01 documents/
*.docx
/gerar_*.py           # decide: see note below
~$*
# Python caches
__pycache__/
*.py[cod]
.pytest_cache/
.venv/
```
Notes for the planner: `Stations_GEO/` (20 KB) is a converter *input* needed to reproduce the data and by the Phase 9 test fixtures; the user's list says run data/workbook/logs/docs/caches are ignored, and Stations_GEO is not run data, so recommend **tracking it** (do not ignore) unless the user says otherwise (flag at checkpoint). `gerar_guia_instalacao.py`/`gerar_manual.py` are untracked doc generators; they are not in the user's ignore list either, so leave them as untracked/for a separate decision (do not silently ignore code). Anchor every directory with a leading `/` so `site/data/` is never ignored. `logs/.gitkeep` is already tracked, so use `/logs/*` + `!/logs/.gitkeep`. Verification: `git status --short` must show no `Results_1st.Run`, `data`, `logs/*.log*`, `WTVB01 documents`, `*.docx`, `__pycache__`; `git check-ignore -v` on each; `git log --oneline -1 -- .gitignore` is the first Phase 9 commit.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Convert from treated xlsx (ARCHITECTURE.md adapter 1) | Convert from raw CSVs, use xlsx only to validate | v1.3 phase 9 decision | Need recovery rules + trecho assignment; sheet 02 is the oracle |
| Treated sheet 1 s time | Sub-second raw timestamps (~5.5 Hz) | - | `dt_ms` from absolute rounded ms |
| Manual trecho labels in workbook | Geofence-derived | v1.3 | Per-trecho numbers differ and must be explained |

## Open Questions

1. **Radius vs. terminals (important)**
   - Known: at 100 m neither PXV passage (166/183 m), EQD, S1-CTR (210 m) nor S2-TRD/SCT/CDG are hit; R=200 hits all but S1-CTR.
   - Unclear: whether the user wants a larger radius or a separate terminal radius.
   - Recommendation: keep 100 m default as decided; add `--radius` plus `--terminal-radius`; list hit/inferred per station in the report and raise at plan checkpoint.
2. **Where do ambiguous mangled values go in the report?** Recommend: count + list only those failing the neighbour-continuity audit; never alter values (golden parity).
3. **Golden file location.** Recommend `tests/fixtures/golden_run1.json` (constants: class counts, eventos, impactos, impactos by class, 23.383 rows, 21.363/2.020 gps split, sentido row counts 10.839/12.544, medians 94/-38/-2018 LSB) committed, plus a CI test that recomputes everything from the committed `site/data/run-*.json`.
4. **GPS precision:** 6 dp is effectively forced by pontos-key parity with the workbook; record it as decided and still raise at the Phase 11 push checkpoint (public location data).
5. **Report location:** suggest `Results_1st.Run/validation-<run-id>.md` (inside ignored folder) via `--report`; planner's call whether to commit a copy.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.0.3 (`pytest.ini`: `testpaths = tests`, `addopts = -q --tb=short`) |
| Config file | `pytest.ini` (exists) |
| Quick run command | `python -m pytest tests/test_dashboard_converter_recover.py tests/test_dashboard_converter_stations.py tests/test_dashboard_converter_geofence.py -x` |
| Full suite command | `python -m pytest` (must keep the 95 logger tests green) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REPO-01 | Ignored paths ignored; `site/data/` and `logs/.gitkeep` not ignored; `.gitignore` committed first | integration (git) | `python -m pytest tests/test_repo_hygiene.py -x` (uses `git check-ignore`; skip if git absent) | Wave 0 |
| CONV-01 | One command produces JSON from a fixture run folder | integration | `python -m pytest tests/test_dashboard_converter_cli.py -x` | Wave 0 |
| CONV-02 | accel/GPS/scaled recovery incl. `-10.625`, `0.375`, 17-digit pads; unrecoverable -> null + report; row-count check | unit | `python -m pytest tests/test_dashboard_converter_recover.py -x` | Wave 0 |
| CONV-02 | Real files: 23.383 rows, 0 unrecovered, class counts exact | integration (skipif raw missing) | `python -m pytest tests/test_dashboard_converter_real.py -x` | Wave 0 |
| CONV-03 | Station parser quirks; hit/skip/dwell/monotone boundaries on synthetic line | unit | `python -m pytest tests/test_dashboard_converter_stations.py tests/test_dashboard_converter_geofence.py -x` | Wave 0 |
| CONV-04 | Reversal detection, line scoring (L2 vs L4), S1/S2 split at sample 10.839 on real data | unit + real | same geofence file + `test_dashboard_converter_real.py` | Wave 0 |
| CONV-05 | No-coordinate samples inherit trecho, flagged; 2.020 / 21.363 counts | unit + real | geofence + real tests | Wave 0 |
| CONV-06 | JSON schema v1 shape, integer scales, RLE round-trip, size budget, dt_ms drift-free | unit | `python -m pytest tests/test_dashboard_converter_writer.py -x` | Wave 0 |
| CONV-07 | Golden totals from committed JSON (21.031/1.611/512/173/56; 2.352; 1.749; 1.112/423/159/55) | integration (runs in CI) | `python -m pytest tests/test_dashboard_site_json.py -x` | Wave 0 |
| CONV-07 | Validation report generation incl. side-by-side pontos/trecho; workbook compare | integration (skipif workbook missing; slow) | `python -m pytest tests/test_dashboard_converter_validate.py -x -m slow` | Wave 0 |

### Sampling Rate
- **Per task commit:** quick run command above (< 30 s; all synthetic).
- **Per wave merge:** `python -m pytest` (full suite incl. logger tests, plus real-data tests locally).
- **Phase gate:** full suite green and one manual run of the converter with `--workbook` showing "OK" for the exact-match rows before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/test_dashboard_converter_*.py`, `tests/test_dashboard_site_json.py`, `tests/test_repo_hygiene.py` - new
- [ ] `tests/fixtures/` tiny comma and `;` CSV samples (include `-10.625`, `-103.125`, `0.375`, `-2.289.879.276.454.220`, `21.650.000.000.000.000`, empty GPS rows) and `golden_run1.json`
- [ ] `tools/__init__.py`, `tools/dashboard_converter/`, `requirements-dashboard.txt`
- [ ] Register a `slow` marker in `pytest.ini` (or skip by env) so the multi-minute workbook read is opt-in; `pytest.ini` is the only existing file touched (allowed: not `src/` or `requirements.txt`)

## Sources

### Primary (HIGH confidence)
- Direct inspection of `Results_1st.Run/raw/2. PXV-TIG.csv`, `3. TIG-PXV.csv` (bytes, delimiters, 12.544 + 10.839 rows, UTF-8, CRLF, timestamps `...T00:30:56.060032-03:00`)
- Workbook sheet `02 — DADOS TRATADOS` read with openpyxl 3.1.5 (`read_only=True, data_only=True`); recovery and golden reproduction tests run in scratch scripts
- `Stations_GEO/Line1..4_Stat_geo.txt` (parsed; duplicates/conflicts checked)
- `src/csv_logger.py` (21-column header), `.planning/research/WORKBOOK-CRITERIA.md`, `ARCHITECTURE.md`, `pytest.ini`, `tests/test_structure.py`, `tests/test_docs.py`, `git ls-files`

### Secondary (MEDIUM confidence)
- Geofence/sentido prototypes on real fixes (recovered coordinates; algorithm not final)
- Temperature/velocity/frequency digit rules (neighbour-consistent, no workbook oracle)

### Tertiary (LOW confidence)
- None used (no web sources were needed; all libraries are stdlib or already installed)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - stdlib + installed pytest/openpyxl; versions checked locally
- CSV recovery: HIGH for accel/GPS (0 mismatches vs workbook), MEDIUM for temp/vel/freq
- Architecture (geofence/sentido): MEDIUM - prototyped, boundaries differ from workbook as expected; terminal handling needs a decision
- Pitfalls: HIGH - each found with real data

**Research date:** 2026-10-08
**Valid until:** 2026-11-07 (stable; invalidated if raw CSVs or station files change)
