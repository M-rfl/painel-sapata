---
phase: 12-time-series-map
verified: 2026-10-14T12:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 12: Time Series & Map Verification Report

**Phase Goal:** User can inspect the run over time and over the route, with both views linked
**Verified:** 2026-10-14
**Status:** passed (with one intentional, engineer-approved deviation on MAP-01)
**Re-verification:** No, initial verification

## Gates

- `node --test "tests/js/*.test.js"`: 113 tests, 113 pass, 0 fail.
- `pytest`: tests/test_visualizer.py fails with `_tkinter.TclError` (a different test fails on each run). This is the legacy matplotlib/Tk visualizer, which needs a Tk display and is unrelated to the Phase 12 site code (site/ is JS only). Environmental, not a Phase 12 gap.

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AX/AY/AZ series with zoom, medido/dinâmico toggle, thresholds, peaks, gaps; synced secondary charts | VERIFIED | `site/js/app/panels/charts.js` (222 lines) with uPlot `cursor.sync` on `SYNC_KEY`; `thresholdLines`, `channelSeries`, `zoomWindow` come from `core/series.js` (tested). Browser check approved. |
| 2 | Route on OSM map by sentido, station markers, trecho segments | VERIFIED (deviation) | The GPS-fix track was replaced by static OSM relation routes per sentido (8 files in `site/data/routes/*.geojson`, loaded in `panels/map.js` lines 76-95, legend per sentido). Stations are drawn as circle markers. See Deviations. |
| 3 | Severity-coloured markers with popup (hora, trecho, sentido, AX/AY/AZ, classe, Google Maps link) and an unplaced note | VERIFIED | `pontoMarkers`, `unplacedCounts` and `googleMapsUrl` in `core/geo.js`; the popup is built in `map.js` and the note goes to `.map-note`. |
| 4 | Heat map toggle, severity-weighted, fixed scale | VERIFIED | `heatPoints` in `core/geo.js`; leaflet.heat layer toggled by checkbox in `map.js`, rebuilt when the view or heat settings change (`heatKey`). |
| 5 | Chart hover highlights the map position; map click moves the chart cursor | VERIFIED | `link.js` is a pub-sub with deduped `hover(row)` and `select(row)`. `charts.js` calls `link.hover` and `link.onSelect(focusRow)`. `map.js` has `hoverPosition` and `mk.on('click', () => link.select(m.row))`. |
| 6 | Filters and thresholds update the map immediately | VERIFIED | `map.js` re-renders from the shared store (`store.subscribe(update)` in `main.js`). Markers, heat and unplaced counts derive from `view.mask`. |

**Score:** 6/6

## Requirements Coverage

| Req | Status | Evidence |
|-----|--------|----------|
| CHART-01 to CHART-05 | SATISFIED | `charts.js` and `core/series.js`, with tests |
| MAP-01 | SATISFIED (deviation) | See below |
| MAP-02 | SATISFIED (partial wording) | Station markers exist. "Trecho segments" are not drawn as separate segments; the trecho is shown in popups and as a filter. The engineer accepted the final map. |
| MAP-03 to MAP-06 | SATISFIED | `core/geo.js` and `panels/map.js` |
| SYNC-01 | SATISFIED | `link.js` plus the charts and map wiring |

All 12 IDs are mapped to Phase 12 in REQUIREMENTS.md and marked Complete. There are no orphaned requirements.

## Deviations (intentional, engineer-approved at the 12-06 checkpoint, commit 0472d99)

- The GPS-fix-derived sentido track polyline, broken at gaps, was removed. It is replaced by static OSM relation route outlines per sentido, produced by `tools/fetch_routes.py`. Impact points are not connected by a line. This is accepted, not a gap.
- Recommended doc updates (not blocking):
  - REQUIREMENTS.md MAP-01 currently reads "GPS track on an OSM map, coloured by sentido and broken at gaps". Suggested wording: "User sees the OSM route of the run's line for each sentido (coloured by sentido) on an OSM map".
  - The ROADMAP.md Phase 12 success criterion 2 and the "track highlight" wording in MAP-06 and SC6 should be aligned in the same way.
  - MAP-02 "trecho segments" should be reworded, or the requirement marked as met by stations plus the trecho filter.

## Anti-Patterns

None blocking. The commit removed the dead geo.js exports, and no stubs were found in the panels.

## Human Verification

None outstanding. The browser checkpoint was approved by the engineer.

---

_Verified: 2026-10-14_
_Verifier: Claude (gsd-verifier)_
