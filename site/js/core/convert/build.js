// Pure module: no DOM/window.
// Port of tools/dashboard_converter/writer.build_site_json (schema 1). Every Python round(x, n) is pyRound.
import { ConvertError } from './errors.js';
import { pyRound } from './pynum.js';

export const SCHEMA_VERSION = 1;
export const TZ_NAME = 'America/Sao_Paulo';
export const WORKBOOK_THRESHOLDS_G = [0.5, 1, 2, 4];
export const ACCEL_PER_G = 2048;
export const FLAG_SEM_GPS = 1;
export const FLAG_EDGE = 2;
export const FLAG_INFERRED_STATION = 4;

export function rle(values) {
  const out = [];
  let first = true;
  let prev;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (first || v !== prev) { out.push([i, v]); prev = v; first = false; }
  }
  return out;
}

function quantize(values, scale, channel) {
  const out = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || v === undefined) { out[i] = null; continue; }
    const q = pyRound(v * scale, 0);
    if (Math.abs(v * scale - q) > 1e-6) throw new ConvertError('channel_off_grid', { channel, index: i });
    out[i] = q + 0; // -0 -> 0
  }
  return out;
}

function dtMs(tsUs) {
  const t0 = tsUs[0];
  const abs = tsUs.map((u) => Math.floor((u - t0 + 500) / 1000));
  const out = [0];
  for (let k = 1; k < abs.length; k++) out.push(abs[k] - abs[k - 1]);
  return out;
}

function quality(run, assignment, fixes, stationWarnings) {
  const n = run.tsUs.length;
  const withGps = fixes.sampleKey.filter((k) => k !== null).length;
  let maxGap = 0.0;
  let maxIdx = 0;
  for (let i = 1; i < n; i++) {
    const g = (run.tsUs[i] - run.tsUs[i - 1]) / 1e6;
    if (g > maxGap) { maxGap = g; maxIdx = i - 1; }
  }
  return {
    rows_with_gps: withGps,
    rows_without_gps: n - withGps,
    unrecovered_values: run.issues.filter((x) => x.value === null).length,
    ambiguous_values: run.issues.filter((x) => x.reason === 'ambiguous_resolved_by_rule').length,
    station_file_warnings: stationWarnings.map((w) => ({ kind: w.kind, message: w.message })),
    inferred_stations: assignment.passages.filter((p) => p.status === 'inferred')
      .map((p) => ({ sentido: p.sentido, code: p.code, min_dist_m: p.min_dist_m })),
    turnarounds: assignment.turnarounds.map((t) => ({
      index: t.index,
      method: t.method,
      terminal: t.terminal_code,
      gap_s: t.gap_s === null || t.gap_s === undefined ? null : pyRound(t.gap_s, 1),
    })),
    max_gap_s: pyRound(maxGap, 1),
    max_gap_index: maxIdx,
  };
}

// run: readRun result; assignment: geofence.assign result; fixes: buildFixes result.
export function buildSiteJson(run, assignment, fixes, {
  runId, title, radiusM, terminalRadiusM, stationWarnings, lineName, stations, generatedAt,
  converterVersion = 'js', uploaded = true,
}) {
  const n = run.tsUs.length;
  const meta = {
    run_id: runId,
    title,
    sensor_id: run.sensorId,
    source: {
      kind: 'logger_csv',
      files: run.sources.map((s) => ({
        name: s.name, sha256: s.sha256, rows: s.rows, delimiter: s.delimiter, mode: s.mode,
      })),
    },
    t0: run.t0.iso,
    tz: TZ_NAME,
    n,
    t_quality: 'sub-second logger timestamps',
    axes: { ax: 'Longitudinal', ay: 'Lateral', az: 'Vertical' },
    workbook_defaults: {
      thresholds_g: [...WORKBOOK_THRESHOLDS_G], rest: 'median', max_speed_kmh: 50, max_fix_gap_s: 120,
    },
    line: {
      id: assignment.line_id,
      name: lineName,
      ambiguous: assignment.ambiguous,
      scores: assignment.line_scores.map((s) => ({ line_id: s.line_id, score: s.score })),
    },
    geofence: { radius_m: radiusM, terminal_radius_m: terminalRadiusM },
    gps_decimals: 6,
    converter_version: converterVersion,
    generated_at: generatedAt,
  };
  if (uploaded) meta.uploaded = true;
  const axes = ['x', 'y', 'z'];
  const grp = (unit, scale, g, name) => {
    const o = { unit, scale };
    for (const a of axes) o[a] = quantize(g[a], scale, `${name}.${a}`);
    return o;
  };
  const channels = {
    vel: grp('mm/s', 100, run.vel, 'vel'),
    disp: grp('um', 1, run.disp, 'disp'),
    freq: grp('Hz', 10, run.freq, 'freq'),
    temp: { unit: 'C', scale: 100, v: quantize(run.temp, 100, 'temp') },
  };
  return {
    schema: SCHEMA_VERSION,
    meta,
    t: { dt_ms: dtMs(run.tsUs) },
    accel: { unit: 'lsb', per_g: ACCEL_PER_G, ax: [...run.ax], ay: [...run.ay], az: [...run.az] },
    channels,
    stations: stations.map((s) => ({ ...s, lat: pyRound(s.lat, 6), lon: pyRound(s.lon, 6) })),
    sentidos: assignment.sentidos.map((s) => ({ code: s.code, name: s.name })),
    trechos: assignment.trechos.map((t) => ({ id: t.id, name: t.name, sentido: t.sentido, order: t.order })),
    sentido_runs: assignment.sentido_runs.map((r) => [...r]),
    source_runs: rle(run.origin.map((o) => o[0])),
    trecho_runs: assignment.trecho_runs.map((r) => [...r]),
    flag_runs: assignment.flag_runs.map((r) => [...r]),
    flag_bits: { sem_gps: FLAG_SEM_GPS, edge: FLAG_EDGE, inferred_station: FLAG_INFERRED_STATION },
    gps: {
      lat: fixes.lat.map((v) => pyRound(v, 6)),
      lon: fixes.lon.map((v) => pyRound(v, 6)),
      loc: [...fixes.loc],
      speed_kmh: [...fixes.speedKmh],
      status: [...fixes.status],
    },
    fix_runs: fixes.fixRuns.map((r) => [...r]),
    quality: quality(run, assignment, fixes, stationWarnings),
  };
}
