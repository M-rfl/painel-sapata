// Pure module: no DOM/window. Data-quality summary (KPI-05).
// Describes the SOURCE data of the full run, not the current filter.

const GROUPS = ['vel', 'disp', 'freq'];
const AXES = ['x', 'y', 'z'];

function entry(channel, axis, unit, arr) {
  let zeroOrNull = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] === null || arr[i] === undefined || arr[i] === 0) zeroOrNull++;
  const n = arr.length;
  const share = n ? zeroOrNull / n : 0;
  return { channel, axis, unit, n, zeroOrNull, share, empty: n > 0 && zeroOrNull === n };
}

/** Zero/null share per channel (vel/disp/freq x,y,z and temp.v). */
export function channelEmptiness(channels) {
  const out = [];
  if (!channels) return out;
  for (const g of GROUPS) {
    const c = channels[g];
    if (!c) continue;
    for (const a of AXES) if (Array.isArray(c[a]) || ArrayBuffer.isView(c[a])) out.push(entry(g, a, c.unit, c[a]));
  }
  const t = channels.temp;
  if (t && t.v) out.push(entry('temp', 'v', t.unit, t.v));
  return out;
}

export function qualitySummary(run, analysis) {
  const q = run.quality ?? null;
  const bit = run.flagBits?.sem_gps ?? 1;
  let semGpsRows = 0;
  if (run.flags) for (let i = 0; i < run.n; i++) if (run.flags[i] & bit) semGpsRows++;
  const channels = channelEmptiness(run.channels);
  const rowsWithGps = q ? q.rows_with_gps : null;
  const rowsWithoutGps = q ? q.rows_without_gps : null;
  const total = q ? rowsWithGps + rowsWithoutGps : 0;
  return {
    n: run.n,
    rowsWithGps,
    rowsWithoutGps,
    gpsCoverage: q && total ? rowsWithGps / total : null,
    turnarounds: q ? (q.turnarounds ?? []).map((t) => ({ gapS: t.gap_s, terminal: t.terminal ?? null, index: t.index })) : [],
    maxGapS: q ? q.max_gap_s : null,
    stationWarnings: q ? (q.station_file_warnings ?? []) : [],
    inferredStations: q ? (q.inferred_stations ?? []).map((s) => ({ sentido: s.sentido, code: s.code, minDistM: s.min_dist_m })) : [],
    unrecovered: q ? q.unrecovered_values : null,
    ambiguous: q ? q.ambiguous_values : null,
    naoClassificadas: analysis ? analysis.naoClassificadas : null,
    semGpsRows,
    channels,
    emptyChannels: channels.filter((c) => c.empty),
    converterVersion: run.meta?.converter_version ?? null,
    generatedAt: run.meta?.generated_at ?? null,
  };
}
