// Pure module: no DOM/window. GPS jump filter applied as a derived run (analyze() on the raw run is untouched).
// Mirrors tools/dashboard_converter/geo.py haversine_m and the gps.py speed rule (strict > max).

const R = 6371000;

export function haversineM(lat1, lon1, lat2, lon2) {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function gpsKey(gps) {
  return `${gps.maxSpeedKmh}|${gps.maxFixGapS}`;
}

/** Fix indices (ascending) whose speed from the last accepted fix exceeds the max within the max gap. */
export function rejectedFixes(run, gps) {
  const out = [];
  const { fixLat, fixLon, fixRow, tMs } = run;
  let prev = -1;
  for (let f = 0; f < fixLat.length; f++) {
    if (Number.isNaN(fixLat[f]) || Number.isNaN(fixLon[f]) || fixRow[f] < 0) continue;
    if (prev >= 0) {
      const dt = (tMs[fixRow[f]] - tMs[fixRow[prev]]) / 1000;
      if (dt > 0 && dt <= gps.maxFixGapS
        && (haversineM(fixLat[prev], fixLon[prev], fixLat[f], fixLon[f]) / dt) * 3.6 > gps.maxSpeedKmh) {
        out.push(f);
        continue;
      }
    }
    prev = f;
  }
  return out;
}

/** Derived run: rejected fixes become "sem GPS" (fix -1, locId -1). Input arrays are never mutated. */
export function applyGpsFilter(run, gps) {
  const rej = rejectedFixes(run, gps);
  if (rej.length === 0) return { ...run, gpsRejected: [] };
  const bad = new Set(rej);
  const fix = Int32Array.from(run.fix);
  const locId = Int32Array.from(run.locId);
  const priorFix = new Int32Array(run.n);
  let last = -1;
  for (let i = 0; i < run.n; i++) {
    if (fix[i] >= 0 && bad.has(fix[i])) { fix[i] = -1; locId[i] = -1; }
    if (fix[i] >= 0) last = fix[i];
    priorFix[i] = last;
  }
  return { ...run, fix, locId, priorFix, gpsRejected: rej };
}
