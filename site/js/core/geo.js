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
