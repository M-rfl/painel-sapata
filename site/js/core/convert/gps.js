// Pure module: no DOM/window.
// Port of tools/dashboard_converter/gps.py: 6-decimal location keys, fixes and estimated speed.
import { roundHalfUp6 } from './decimal.js';
import { haversineM } from './geo.js';
import { pyRound } from './pynum.js';

// lat/lon are decimal strings (or null) as produced by readRun.
export function sampleKey(lat, lon) {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return null;
  return roundHalfUp6(lat) + ',' + roundHalfUp6(lon);
}

// run: RunData from readRun (lat, lon, gpsStatus, tsUs)
export function buildFixes(run, { maxSpeedKmh = 50.0, maxFixGapS = 120.0 } = {}) {
  const n = run.lat.length;
  const keys = new Array(n);
  for (let i = 0; i < n; i++) keys[i] = sampleKey(run.lat[i], run.lon[i]);
  const fixLat = [];
  const fixLon = [];
  const fixLoc = [];
  const locKeys = [];
  const locIds = new Map();
  const status = [];
  const starts = [];
  const fixRuns = [];

  let prev; // undefined sentinel: differs from every key and from null
  for (let i = 0; i < n; i++) {
    const k = keys[i];
    if (k === null) {
      if (prev !== null) fixRuns.push([i, -1]);
      prev = null;
      continue;
    }
    if (k !== prev) {
      if (!locIds.has(k)) {
        locIds.set(k, locKeys.length);
        locKeys.push(k);
      }
      const idx = fixLat.length;
      const [la, lo] = k.split(',');
      fixLat.push(Number(la));
      fixLon.push(Number(lo));
      fixLoc.push(locIds.get(k));
      status.push(0);
      starts.push(i);
      fixRuns.push([i, idx]);
    }
    if (run.gpsStatus[i] === 1) status[status.length - 1] = 1;
    prev = k;
  }

  const speed = [];
  for (let j = 0; j < fixLat.length; j++) {
    if (j + 1 >= fixLat.length) { speed.push(null); continue; }
    const dt = (run.tsUs[starts[j + 1]] - run.tsUs[starts[j]]) / 1e6;
    if (dt <= 0 || dt > maxFixGapS) { speed.push(null); continue; }
    const d = haversineM(fixLat[j], fixLon[j], fixLat[j + 1], fixLon[j + 1]);
    const v = d / dt * 3.6;
    speed.push(v > maxSpeedKmh ? null : pyRound(v, 2));
  }
  return { lat: fixLat, lon: fixLon, loc: fixLoc, locKeys, speedKmh: speed, status, fixRuns, sampleKey: keys };
}
