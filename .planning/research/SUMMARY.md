# Research Summary — v1.3 Field Run Dashboard

**Synthesized:** 2026-10-08 from STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, WORKBOOK-CRITERIA.md
**Overall confidence:** HIGH (converter/core path) · MEDIUM (libraries/deploy)

## Executive Summary

v1.3 turns the first field run (VLT Carioca · Linha 4 · Trem 102 · 02/10/2026 · 23.383 samples · 21 trechos · 2 sentidos) into a public, static, pt-BR dashboard: KPIs, per-axis time series, route map + geographic heat map, trecho × severidade matrix, top-N table, and live thresholds / filters / display / analysis parameters — all recomputed in the browser.

Stack: no build step, no framework — vanilla ES modules; vendored uPlot 1.6.32, Leaflet 1.9.4, leaflet.heat 0.2.0; dev-only Python converter with openpyxl 3.1.5 (`read_only=True, data_only=True`) reading only sheet `02 — DADOS TRATADOS`; GitHub Actions Pages publishing `site/`.

The JSON ships raw samples only (no classes/events). A pure JS core (stages S1–S6) owns the rules. ARCHITECTURE reproduced the workbook exactly in Python: 21.031/1.611/512/173/56 by class, 2.352 eventos, 1.749 impactos, 101 pontos.

Top risks: (1) no `.gitignore` → 22 MB xlsx / data / docs leaking to a public repo; (2) JS drifting from Excel numbers; (3) misleading GPS/heat map (fix every ~30 s; 2.020 rows without coordinates); (4) Pages pitfalls (relative paths, `.nojekyll`, vendored libs, OSM tile policy).

## Reconciliation

ARCHITECTURE overrides STACK on accel storage: store integer LSB counts (`per_g: 2048`), not 4-decimal floats — rounding shifts the median offset (−0.0185546875 → −0.0186) and can flip samples on threshold boundaries. Estimated JSON ~350–450 KB raw / ~100 KB gzipped (supersedes STACK's 1–2 MB).

## Key Findings

### Stack
- Vanilla ES modules, libs vendored in `site/vendor/` at pinned versions (no CDN at runtime)
- uPlot (canvas, 23k × 3 points, drag zoom, `uPlot.sync`); Leaflet + leaflet.heat on OSM tiles; matrix as CSS grid/table
- `requirements-dashboard.txt` separate from logger `requirements.txt`; JS tests via `node --test` (no npm)

### Features
- **Must have:** KPI cards; one shared palette (verde/amarelo/laranja/vermelho/roxo); AX/AY/AZ series with threshold lines; map with popups (Google Maps link); severity-weighted heat map; trecho × severidade matrix (click-to-filter); top-50 table + CSV export; filters; thresholds (ordered cut-points); analysis params; "valores conforme planilha" badge at defaults; pt-BR formatting; responsive layout
- **Should have:** URL-hash state; chart↔map hover sync; data-quality card (GPS gaps); per-trecho priority (1 Alta … 4 Monitorar); per-axis statistics
- **Defer:** range brushing; dark mode; PNG export; multi-run selector; raw logger CSV adapter
- **Anti-features:** live streaming, backend, time × trecho heat map, FFT, density-weighted heat, SVG/DOM rendering of 23k points, straight lines across tunnels, generated PDFs

### Architecture
- `tools/dashboard_converter/` (adapter → neutral `RunData` → writer), `site/` (published: `js/core` pure modules, `ui`, `vendor`, `data`), `tests/js/`, `.github/workflows/pages.yml`
- Schema v1: delta-encoded time, LSB accel, RLE trecho/sentido/fix runs, GPS fixes with `loc` ids + precomputed speed; golden file for tests only (not deployed)
- Python: quantization, GPS validation, loc ids, fix speed, trecho normalization. JS: offset, dynamics, class, events, impacts, points, filter mask, aggregates
- Flags derived on full series, filters select by the flagged row's attributes (= workbook COUNTIFS)
- Points keyed by coordinate loc id (115 distinct keys vs 142 contiguous runs — keying by run breaks 101); 15 of 101 pontos are "SEM GPS | trecho" (count in KPIs, not drawable)
- Rules: dynamic = measured − whole-run median; dominant-axis ties X→Y→Z; class `>=` on |dominant|; impact = run of consecutive event rows, classed by first strict max; ponto = first max per location key
- Treated sheet time has 1 s resolution (3–6 rows/s); one 567 s turnaround gap at row 10.839 — don't assume uniform 5 Hz
- State slices: `params`, `filters`, `display` — display changes never re-run S1–S5; each stage cached by input key
- No change to `src/` or `requirements.txt` → 95 logger tests unaffected

### Pitfalls
1. `.gitignore` is the first commit; explicit-path `git add` only; `git diff --cached --stat` before first push
2. Golden test + Python↔JS parity (seeded random, non-default params) guards drift
3. Read only sheet 02 (by prefix — name contains em dash); gate on 1/2048 grid and GPS envelope; fail loudly
4. Heat weights fixed and severity-anchored (`clamp(|dyn|/Crítico, 0, 1)`), one point per GPS fix (max), never density; break polyline at gaps
5. Canvas charts with min/max decimation so peaks survive
6. `.nojekyll`, relative URLs, vendored libs, OSM attribution, swappable tile provider
7. Comma/dot-tolerant number inputs, `Intl` pt-BR formatting, explicit `America/Sao_Paulo`
8. Publish only an allowlist of fields; scrub git identity / workbook metadata

## Roadmap Implications

Suggested phases (continue from Phase 8 → 9…):

| Phase | Scope | Gate |
|---|---|---|
| A | Repo hygiene (`.gitignore` first) + converter + schema v1 + reference analysis + golden file | Row-level match with workbook flags; 21.031 / 2.352 / 1.749 / 101 |
| B | JS core + Node tests (no UI) | Golden, parity, property tests GREEN |
| C | Site shell, state, KPIs, controls, early Pages deploy | Live KPIs = golden at defaults on the public URL |
| D | Time-series charts | uPlot, decimation, threshold lines, gap shading |
| E | Map + heat map | Track, severity markers, heat layer, no-GPS footnote |
| F | Matrix + top-N table | Click-to-filter, CSV, priority rule |
| G | Analysis-param UI, URL state, hover sync, data-quality card, mobile/a11y polish | |

D/E/F are independent after C. Raw logger CSV adapter → future milestone.

## Research Flags
- **Spike needed:** E (leaflet.heat `max`/radius behavior, basemap, circle-marker alternative); D (uPlot on phone); C (current Actions Pages versions); F (priority basis vs sheet 05)
- **Standard patterns:** A, B, G

## Confidence
| Area | Level |
|---|---|
| Stack | MEDIUM-HIGH |
| Features | MEDIUM |
| Architecture | HIGH |
| Pitfalls | MEDIUM |

## Gaps
- Trecho map position: use fix positions as workbook does, labelled approximate (~330 m per 30 s); interpolation later
- Priority basis (pontos vs impactos) — confirm on sheet 05 (workbook text says pontos)
- Coordinate precision for public site — confirm with user before first push
- Repo/remote undecided: name, `master` vs `main`
- Raw CSV adapter needs run descriptor (trecho/sentido), ~10 Hz rate
- UI footnote "resolução de 1 s na fonte"
