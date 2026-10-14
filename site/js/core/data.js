// Pure module: no DOM/window; mirrors tools/dashboard_converter/analysis_ref.py.

/** Expand [[start, value], ...] run-length pairs into a typed array of length n. */
export function expandRuns(runs, n, ArrayType = Int32Array) {
  const out = new ArrayType(n);
  for (let r = 0; r < runs.length; r++) {
    const start = runs[r][0];
    const end = r + 1 < runs.length ? runs[r + 1][0] : n;
    out.fill(runs[r][1], start, end);
  }
  return out;
}

// Explicit null mask: Int32Array.from([null]) would silently store 0.
function maskedInt32(arr, n) {
  const out = new Int32Array(n);
  const ok = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const v = arr[i];
    if (v !== null && v !== undefined) { out[i] = v; ok[i] = 1; }
  }
  return [out, ok];
}

/** Build a Run from plain arrays (nulls are stored as 0 with valid = 0). */
export function fromArrays({ ax, ay, az, tMs, locKey, trecho, trechoNames, source }) {
  const n = ax.length;
  const [X, xv] = maskedInt32(ax, n);
  const [Y, yv] = maskedInt32(ay, n);
  const [Z, zv] = maskedInt32(az, n);
  const valid = new Uint8Array(n);
  for (let i = 0; i < n; i++) valid[i] = xv[i] & yv[i] & zv[i];

  const ids = new Map();
  const locId = new Int32Array(n).fill(-1);
  if (locKey) {
    for (let i = 0; i < n; i++) {
      const k = locKey[i];
      if (k === null || k === undefined) continue;
      let id = ids.get(k);
      if (id === undefined) { id = ids.size; ids.set(k, id); }
      locId[i] = id;
    }
  }

  let region = null;
  let nRegions = 0;
  if (source) {
    region = new Int32Array(n);
    const m = new Map();
    for (let i = 0; i < n; i++) {
      let r = m.get(source[i]);
      if (r === undefined) { r = m.size; m.set(source[i], r); }
      region[i] = r;
    }
    nRegions = m.size;
  }

  return {
    n, ax: X, ay: Y, az: Z, valid, axValid: xv, ayValid: yv, azValid: zv,
    tMs: Float64Array.from(tMs),
    locId,
    trecho: Int32Array.from(trecho ?? new Array(n).fill(0)),
    trechoNames: trechoNames ?? [],
    region, nRegions,
  };
}

/**
 * Decode schema-v1 dashboard JSON into a Run.
 * Extra fields: t0Ms, fixLat/fixLon (Float64Array, NaN = null), fixRow (first row per fix, -1 if absent),
 * priorFix (last known fix index per row, -1 before the first).
 */
export function decodeRun(json) {
  if (!json || json.schema !== 1) throw new Error('decodeRun: unsupported schema (expected 1)');
  const n = json.meta.n;
  const dt = json.t.dt_ms;
  const tMs = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) { acc += dt[i]; tMs[i] = acc; }

  const trecho = expandRuns(json.trecho_runs, n);
  const fix = expandRuns(json.fix_runs, n);
  const lat = json.gps.lat || [];
  const keys = lat.map((la, f) => (la === null || json.gps.lon[f] === null)
    ? null : la.toFixed(6) + ',' + json.gps.lon[f].toFixed(6));
  const locKey = new Array(n);
  for (let i = 0; i < n; i++) locKey[i] = fix[i] >= 0 ? (keys[fix[i]] ?? null) : null;

  const run = fromArrays({
    ax: json.accel.ax, ay: json.accel.ay, az: json.accel.az,
    tMs, locKey, trecho,
    trechoNames: json.trechos.map((t) => t.name),
    source: json.source_runs ? expandRuns(json.source_runs, n) : null,
  });
  run.sentido = expandRuns(json.sentido_runs, n, Uint8Array);
  run.flags = expandRuns(json.flag_runs, n, Uint8Array);
  run.fix = fix;
  run.t0Ms = Date.parse(json.meta.t0);
  run.fixLat = Float64Array.from(lat, (v) => (v === null ? NaN : v));
  run.fixLon = Float64Array.from(json.gps.lon || [], (v) => (v === null ? NaN : v));
  const fixRow = new Int32Array(lat.length).fill(-1);
  const priorFix = new Int32Array(n);
  let lastFix = -1;
  for (let i = 0; i < n; i++) {
    const f = fix[i];
    if (f >= 0) {
      lastFix = f;
      if (f < fixRow.length && fixRow[f] === -1) fixRow[f] = i;
    }
    priorFix[i] = lastFix;
  }
  run.fixRow = fixRow;
  run.priorFix = priorFix;
  run.meta = json.meta;
  run.trechos = json.trechos;
  run.sentidos = json.sentidos;
  run.stations = json.stations;
  run.reference = json.meta.workbook_reference ?? null;
  run.channels = json.channels ?? null;
  run.quality = json.quality ?? null;
  run.flagBits = json.flag_bits ?? null;
  return run;
}
