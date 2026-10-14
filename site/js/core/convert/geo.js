// CPython-faithful haversine (mirrors tools/dashboard_converter/geo.py).
// math.radians(x) is x * (pi / 180); do not reorder (core/gpsfilter.js keeps its own variant).
const EARTH_RADIUS_M = 6371000.0;
const DEG = Math.PI / 180;

export function haversineM(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dphi = p2 - p1;
  const dlmb = (lon2 - lon1) * DEG;
  const sa = Math.sin(dphi / 2);
  const sb = Math.sin(dlmb / 2);
  const a = sa * sa + Math.cos(p1) * Math.cos(p2) * sb * sb;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1.0, Math.sqrt(a)));
}
