// Pure module: no DOM/window, no fetch. Browser converter orchestrator (mirrors tools/dashboard_converter/cli._run).
import { ConvertError } from './errors.js';
import { assign } from './geofence.js';
import { buildFixes } from './gps.js';
import { buildSiteJson } from './build.js';
import { readRun } from './reader.js';
import { prepareLines } from './stations.js';

export { ConvertError, ERROR_CODES } from './errors.js';
export const MAX_FILES = 6;
export const MAX_FILE_BYTES = 60 * 1024 * 1024;

const RADIUS_M = 100.0;
const TERMINAL_RADIUS_M = 200.0;

// files: [{ name, text, sha256 }]; stationsJson: parsed site/data/stations.json
export function convertFiles(files, stationsJson, { requireKnownLine = true, generatedAt = null } = {}) {
  if (!files || files.length === 0) throw new ConvertError('no_files');
  if (files.length > MAX_FILES) throw new ConvertError('too_many_files', { max: MAX_FILES });
  const lines = prepareLines(stationsJson);
  const run = readRun(files);
  const lat = run.lat.map((x) => (x === null ? null : Number(x)));
  const lon = run.lon.map((x) => (x === null ? null : Number(x)));
  const assignment = assign(lat, lon, lines, {
    radiusM: RADIUS_M, terminalRadiusM: TERMINAL_RADIUS_M, timestampsUs: run.tsUs,
  });
  const best = assignment.line_scores[0];
  // JS-only guard (Pitfall 9): no station of any line was hit -> not a recognised VLT run (or no GPS at all).
  if (requireKnownLine && assignment.line_scores.every((s) => s.in_line === 0)) {
    throw new ConvertError('unknown_line');
  }
  const chosen = lines.find((l) => l.lineId === assignment.line_id);
  const stationWarnings = [...(stationsJson.warnings || []), ...(chosen.overlapWarnings || [])];
  const fixes = buildFixes(run);
  const lineId = assignment.line_id;
  const json = buildSiteJson(run, assignment, fixes, {
    runId: `${run.t0.date}-l${lineId}`,
    title: `Linha ${lineId} · ${run.t0.dmy} (arquivo enviado)`,
    radiusM: RADIUS_M,
    terminalRadiusM: TERMINAL_RADIUS_M,
    stationWarnings,
    lineName: chosen.name,
    stations: chosen.siteStations,
    generatedAt: generatedAt ?? new Date().toISOString(),
  });
  const q = json.quality;
  const summary = {
    rows: json.meta.n,
    files: run.sources.map((s) => s.name),
    lineId,
    lineName: chosen.name,
    ambiguous: assignment.ambiguous,
    lineHits: best.in_line,
    rowsWithoutGps: q.rows_without_gps,
    unrecovered: q.unrecovered_values,
    ambiguousValues: q.ambiguous_values,
    inferredStations: q.inferred_stations.length,
  };
  return { json, summary };
}
