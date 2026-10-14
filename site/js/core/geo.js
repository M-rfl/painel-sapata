// Pure module: no DOM/window. Map data for the Leaflet panel (Phase 12).
import { CLASS_NAMES } from './defaults.js';
import { axisConverters, resultant } from './stats.js';
import { epochMs } from './series.js';

/** 1 per fix if any row of that fix passes the mask. */
export function fixMatched(run, mask) {
  const out = new Uint8Array(run.fixLat.length);
  for (let r = 0; r < run.n; r++) {
    const f = run.fix[r];
    if (f >= 0 && mask[r]) out[f] = 1;
  }
  return out;
}

/** Track split at sentido changes and fix gaps > maxFixGapMs; edges flagged by filter match. */
export function trackSegments(run, matched, maxFixGapMs) {
  const gap = maxFixGapMs ?? ((run.meta?.workbook_defaults?.max_fix_gap_s ?? 120) * 1000);
  const segs = [];
  let cur = null;
  let prev = -1;
  const flush = () => { if (cur && cur.fixes.length >= 2) segs.push(cur); cur = null; };
  for (let f = 0; f < run.fixLat.length; f++) {
    const r = run.fixRow[f];
    if (r < 0 || Number.isNaN(run.fixLat[f]) || Number.isNaN(run.fixLon[f])) continue;
    if (prev >= 0) {
      const ra = run.fixRow[prev];
      const brk = run.sentido[r] !== run.sentido[ra] || run.tMs[r] - run.tMs[ra] > gap;
      if (brk) { flush(); } else {
        const m = !!(matched[prev] || matched[f]);
        if (!cur || cur.matched !== m) {
          flush();
          cur = { sentido: run.sentido[ra], matched: m, fixes: [prev], latlngs: [[run.fixLat[prev], run.fixLon[prev]]] };
        }
        cur.fixes.push(f);
        cur.latlngs.push([run.fixLat[f], run.fixLon[f]]);
      }
    }
    prev = f;
  }
  flush();
  return segs;
}

/** Row -> map position; tunnel rows reuse the prior fix with noGps. */
export function hoverPosition(run, row) {
  if (row === null || row === undefined || row < 0) return null;
  const f = run.fix[row];
  if (f >= 0) return { fix: f, lat: run.fixLat[f], lon: run.fixLon[f], noGps: false };
  const p = run.priorFix[row];
  if (p < 0) return null;
  return { fix: p, lat: run.fixLat[p], lon: run.fixLon[p], noGps: true };
}

/** Fix index nearest to (lat, lon) in [from, to] (equirectangular distance). */
export function nearestFix(run, lat, lon, from = 0, to = run.fixLat.length - 1) {
  const k = Math.cos((lat * Math.PI) / 180);
  let best = -1;
  let bd = Infinity;
  for (let f = Math.max(0, from); f <= Math.min(to, run.fixLat.length - 1); f++) {
    const la = run.fixLat[f];
    const lo = run.fixLon[f];
    if (Number.isNaN(la) || Number.isNaN(lo)) continue;
    const d = (la - lat) ** 2 + ((lo - lon) * k) ** 2;
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}

export function googleMapsUrl(lat, lon) {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
}

/** One marker per placeable ponto de impacto (view.pointRows with GPS), worst class last. */
export function pontoMarkers(run, analysis, view) {
  const [cx, cy, cz] = axisConverters(analysis, 'dinamico');
  const perLoc = new Map();
  for (const im of view.impacts) {
    const loc = run.locId[im.peak];
    if (loc >= 0) perLoc.set(loc, (perLoc.get(loc) || 0) + 1);
  }
  const out = [];
  for (const r of view.pointRows) {
    const loc = run.locId[r];
    const f = run.fix[r];
    if (loc < 0 || f < 0) continue;
    const lat = run.fixLat[f];
    const lon = run.fixLon[f];
    const cls = analysis.cls[r];
    out.push({
      row: r, fix: f, lat, lon, cls, className: CLASS_NAMES[cls], tEpochMs: epochMs(run, r),
      trecho: run.trechoNames[run.trecho[r]],
      sentido: (run.sentidos && run.sentidos[run.sentido[r]]?.name) || '—',
      ax: cx(run.ax[r]), ay: cy(run.ay[r]), az: cz(run.az[r]),
      nImpactos: perLoc.get(loc) || 0, url: googleMapsUrl(lat, lon),
    });
  }
  out.sort((a, b) => a.cls - b.cls);
  return out;
}

/** Pontos and eventos that cannot be placed on the map (no GPS), following the current filters. */
export function unplacedCounts(run, analysis, view) {
  let pontos = 0;
  for (const r of view.pointRows) if (run.locId[r] < 0) pontos++;
  let eventos = 0;
  for (let r = 0; r < run.n; r++) {
    if (view.mask[r] && analysis.cls[r] >= 1 && run.locId[r] < 0) eventos++;
  }
  return { pontos, eventos };
}

/** Heat points [lat, lon, w]: one per fix, weight on a fixed scale (Crítico threshold = 1) times intensity. */
export function heatPoints(run, analysis, mask, metric, intensity = 1) {
  const [cx, cy, cz] = axisConverters(analysis, 'dinamico');
  let g;
  if (metric === 'dom') g = (r) => analysis.dom2[r] / 4096;
  else if (metric === 'ax') g = (r) => Math.abs(cx(run.ax[r]));
  else if (metric === 'ay') g = (r) => Math.abs(cy(run.ay[r]));
  else if (metric === 'az') g = (r) => Math.abs(cz(run.az[r]));
  else if (metric === 'resDin') g = (r) => resultant(cx(run.ax[r]), cy(run.ay[r]), cz(run.az[r]));
  else throw new Error(`geo: unknown heat metric "${metric}"`);
  const th2 = analysis.th2;
  const scale = th2[th2.length - 1] / 4096;
  const raw = new Float64Array(run.fixLat.length);
  for (let r = 0; r < run.n; r++) {
    const f = run.fix[r];
    if (f < 0 || !mask[r] || analysis.cls[r] < 0) continue;
    const v = g(r);
    if (v > raw[f]) raw[f] = v;
  }
  const out = [];
  for (let f = 0; f < raw.length; f++) {
    const w = Math.min(1, (raw[f] / scale) * intensity);
    if (w > 0 && !Number.isNaN(run.fixLat[f])) out.push([run.fixLat[f], run.fixLon[f], w]);
  }
  return out;
}
