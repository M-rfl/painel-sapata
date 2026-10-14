// Pure module: no DOM/window.
// Port of tools/dashboard_converter/sources/logger_csv.py: raw logger CSVs (clean ',' files and pt-BR Excel
// ';' re-saves) merged into one time-ordered RunData. Mangled cells are recovered with recover.js; whatever
// cannot be recovered becomes null and is listed as an issue (never guessed).
import { ConvertError } from './errors.js';
import { parseTimestamp } from './isotime.js';
import { pyMedian } from './pynum.js';
import {
  alternativeAccelReading, isThousandsShaped, parsePlain, pyStrip, recoverAccel, recoverGps, resolveScaled,
} from './recover.js';

const ACCEL_PER_G = 2048;
const REQUIRED = ['timestamp', 'ax_g', 'ay_g', 'az_g', 'gps_lat', 'gps_lon'];
// [RunData group, axis, column header, SCALED_RANGES kind]
const SCALED_COLS = [
  ['vel', 'x', 'vx_mm_s', 'vel'], ['vel', 'y', 'vy_mm_s', 'vel'], ['vel', 'z', 'vz_mm_s', 'vel'],
  ['disp', 'x', 'dx_um', 'disp'], ['disp', 'y', 'dy_um', 'disp'], ['disp', 'z', 'dz_um', 'disp'],
  ['freq', 'x', 'freq_x_hz', 'freq'], ['freq', 'y', 'freq_y_hz', 'freq'], ['freq', 'z', 'freq_z_hz', 'freq'],
  ['temp', '', 'temperature_c', 'temp'],
];
const NEIGHBOUR_WINDOW = 6;
const AMBIGUITY_WINDOW = 3;
const AMBIGUITY_G = 2.0;
const STAT_KEYS = ['accel_plain', 'accel_k', 'accel_k-1', 'gps_recovered', 'scaled_recovered', 'unrecovered'];

// Python str.splitlines(keepends=True)
const LINE_SPLIT = /\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/g;
function splitLines(text) {
  const out = [];
  let last = 0;
  LINE_SPLIT.lastIndex = 0;
  let m;
  while ((m = LINE_SPLIT.exec(text)) !== null) {
    out.push(text.slice(last, m.index + m[0].length));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Python csv.reader (excel dialect, non-strict) over pre-split lines, a transcription of the C state machine.
// Returns [{ row, line }]: line is the physical line number of the LAST line consumed by the record
// (reader.line_num). EOL marks the end of each fed line.
const EOL = null;

function parseCsv(lines, delim) {
  const records = [];
  let i = 0;
  while (i < lines.length) {
    const row = [];
    let field = '';
    let state = 'sr'; // sr = start record, sf = start field, field, quoted, qq = quote in quoted, crnl
    const save = () => { row.push(field); field = ''; };
    while (i < lines.length) {
      const ln = lines[i++];
      for (let k = 0; k <= ln.length; k++) {
        const c = k < ln.length ? ln[k] : EOL;
        const nl = c === '\n' || c === '\r';
        if (state === 'sr') {
          if (c === EOL) { /* empty row */ } else if (nl) state = 'crnl';
          else { state = 'sf'; k--; }
        } else if (state === 'sf') {
          if (c === EOL) { save(); state = 'sr'; } else if (nl) { save(); state = 'crnl'; } else if (c === '"') state = 'quoted';
          else if (c === delim) save();
          else { field += c; state = 'field'; }
        } else if (state === 'field') {
          if (c === EOL) { save(); state = 'sr'; } else if (nl) { save(); state = 'crnl'; } else if (c === delim) { save(); state = 'sf'; } else field += c;
        } else if (state === 'quoted') {
          if (c === EOL) { /* the quoted field continues on the next line */ } else if (c === '"') state = 'qq';
          else field += c;
        } else if (state === 'qq') {
          if (c === '"') { field += '"'; state = 'quoted'; } else if (c === delim) { save(); state = 'sf'; } else if (c === EOL) { save(); state = 'sr'; } else if (nl) { save(); state = 'crnl'; } else { field += c; state = 'field'; }
        } else if (c === EOL) state = 'sr'; // crnl
        else if (!nl) throw new ConvertError('read_failed', {}); // Python raises; unreachable after the line split
      }
      if (state === 'sr') break;
    }
    if (state === 'quoted' || state === 'qq') row.push(field); // EOF inside quotes (non-strict)
    records.push({ row, line: i });
  }
  return records;
}

function readFile(file, index, issues, stats) {
  let text = file.text;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const nl = text.indexOf('\n');
  const first = nl < 0 ? text : text.slice(0, nl);
  const count = (s, ch) => s.split(ch).length - 1;
  const delim = count(first, ';') > count(first, ',') ? ';' : ',';
  const ptbr = delim === ';';
  const lines = splitLines(text);
  if (lines.length === 0) throw new ConvertError('empty_file', { file: file.name });
  const records = parseCsv(lines, delim);
  const header = records[0].row.map(pyStrip);
  for (const col of REQUIRED) {
    if (!header.includes(col)) throw new ConvertError('missing_column', { file: file.name, column: col });
  }
  const pos = new Map();
  // Python builds {h: i}: the LAST duplicate wins
  header.forEach((h, i) => pos.set(h, i));
  const cell = (row, col) => {
    const i = pos.get(col);
    return i !== undefined && i < row.length ? pyStrip(row[i]) : '';
  };

  const name = file.name;
  const recs = [];
  for (let r = 1; r < records.length; r++) {
    const { row, line } = records[r];
    if (row.length === 0 || row.every((c) => pyStrip(c) === '')) continue;
    const tsText = cell(row, 'timestamp');
    let ts;
    try {
      ts = parseTimestamp(tsText);
    } catch (e) {
      if (e instanceof ConvertError) throw new ConvertError(e.code, { file: name, line, text: tsText });
      throw e;
    }
    const rec = { ts, line, raw: row, acc: {}, rules: {}, sc: {} };
    for (const [col, key] of [['ax_g', 'ax'], ['ay_g', 'ay'], ['az_g', 'az']]) {
      const txt = cell(row, col);
      const { lsb, reason } = recoverAccel(txt, ptbr);
      rec.acc[key] = lsb;
      rec.rules[key] = reason;
      if (lsb === null) {
        if (reason !== 'empty') {
          issues.push({ file: name, line, column: col, raw: txt, reason, value: null });
          stats.unrecovered += 1;
        }
      } else stats[`accel_${reason}`] += 1;
    }
    const latT = cell(row, 'gps_lat');
    const lonT = cell(row, 'gps_lon');
    const lat = recoverGps(latT, 'lat', ptbr);
    const lon = recoverGps(lonT, 'lon', ptbr);
    for (const [col, txt, g] of [['gps_lat', latT, lat], ['gps_lon', lonT, lon]]) {
      if (g.value === null && g.reason !== 'empty') {
        issues.push({ file: name, line, column: col, raw: txt, reason: g.reason, value: null });
        stats.unrecovered += 1;
      }
    }
    if (lat.value === null || lon.value === null) {
      rec.lat = null; rec.lon = null; rec.gpsStatus = 0;
    } else {
      rec.lat = lat.value; rec.lon = lon.value;
      const recovered = lat.reason === 'recovered' || lon.reason === 'recovered';
      rec.gpsStatus = recovered ? 1 : 0;
      if (recovered) stats.gps_recovered += 1;
    }
    rec.sensorId = cell(row, 'sensor_id');
    recs.push(rec);
  }

  resolveScaledColumns(recs, name, ptbr, cell, issues, stats);
  if (ptbr) ambiguityAudit(recs, name, cell, issues);
  const source = { name, sha256: file.sha256, rows: recs.length, delimiter: delim, mode: ptbr ? 'ptbr' : 'plain' };
  return { source, recs };
}

// Fill rec.sc[col] for every scaled channel (two passes: plain, then thousands-shaped).
function resolveScaledColumns(recs, name, ptbr, cell, issues, stats) {
  for (const [, , col, kind] of SCALED_COLS) {
    const plain = [];
    const pending = [];
    recs.forEach((rec, i) => {
      const txt = cell(rec.raw, col);
      let val = null;
      if (ptbr && isThousandsShaped(txt)) pending.push(i);
      else {
        try {
          val = parsePlain(txt, ptbr);
        } catch (e) {
          issues.push({ file: name, line: rec.line, column: col, raw: txt, reason: 'unrecoverable', value: null });
          stats.unrecovered += 1;
        }
      }
      plain.push(val);
      rec.sc[col] = val;
    });
    const known = plain.filter((v) => v !== null);
    const colMedian = known.length ? pyMedian(known) : null;
    for (const i of pending) {
      const lo = Math.max(0, i - NEIGHBOUR_WINDOW);
      const hi = Math.min(recs.length, i + NEIGHBOUR_WINDOW + 1);
      const neigh = [];
      for (let j = lo; j < hi; j++) if (j !== i && plain[j] !== null) neigh.push(plain[j]);
      const txt = cell(recs[i].raw, col);
      const { value, reason } = resolveScaled(txt, kind, neigh, colMedian);
      recs[i].sc[col] = value;
      if (value === null) {
        issues.push({ file: name, line: recs[i].line, column: col, raw: txt, reason, value: null });
        stats.unrecovered += 1;
      } else stats.scaled_recovered += 1;
    }
  }
}

// Report (never change) k / k-1 accel readings where the other reading fits the neighbours better.
function ambiguityAudit(recs, name, cell, issues) {
  for (const [key, col] of [['ax', 'ax_g'], ['ay', 'ay_g'], ['az', 'az_g']]) {
    recs.forEach((rec, i) => {
      const rule = rec.rules[key];
      if (rule !== 'k' && rule !== 'k-1') return;
      const txt = cell(rec.raw, col);
      const alt = alternativeAccelReading(txt);
      if (alt === null) return;
      const lo = Math.max(0, i - AMBIGUITY_WINDOW);
      const hi = Math.min(recs.length, i + AMBIGUITY_WINDOW + 1);
      const neigh = [];
      for (let j = lo; j < hi; j++) {
        if (j !== i && recs[j].rules[key] === 'plain' && recs[j].acc[key] !== null) neigh.push(recs[j].acc[key] / ACCEL_PER_G);
      }
      if (neigh.length === 0) return;
      const med = pyMedian(neigh);
      const chosenG = rec.acc[key] / ACCEL_PER_G;
      const altG = alt / ACCEL_PER_G;
      if (Math.abs(chosenG - med) > AMBIGUITY_G && Math.abs(altG - med) < Math.abs(chosenG - med)) {
        issues.push({ file: name, line: rec.line, column: col, raw: txt, reason: 'ambiguous_resolved_by_rule', value: chosenG });
      }
    });
  }
}

// files: [{ name, text, sha256 }] in any order -> RunData (see plan 14-03 contract)
export function readRun(files) {
  if (!files || files.length === 0) throw new ConvertError('no_files');
  const sorted = [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const issues = [];
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = 0;
  const sources = [];
  const merged = [];
  sorted.forEach((file, idx) => {
    const { source, recs } = readFile(file, idx, issues, stats);
    sources.push(source);
    for (const r of recs) merged.push({ idx, r });
  });
  if (merged.length === 0) throw new ConvertError('no_rows');
  merged.sort((a, b) => a.r.ts.us - b.r.ts.us); // stable: ties keep file-sorted order

  const col = (cname) => merged.map(({ r }) => (r.sc[cname] === undefined ? null : r.sc[cname]));
  const group = (g) => {
    const o = {};
    for (const [grp, ax, c] of SCALED_COLS) if (grp === g) o[ax] = col(c);
    return o;
  };
  const counts = new Map();
  for (const { r } of merged) if (r.sensorId) counts.set(r.sensorId, (counts.get(r.sensorId) || 0) + 1);
  let sensorId = '';
  let best = 0;
  for (const [id, n] of counts) if (n > best) { best = n; sensorId = id; }
  const t0 = merged[0].r.ts;
  return {
    sources,
    tsUs: merged.map(({ r }) => r.ts.us),
    t0: { iso: t0.iso, date: t0.date, dmy: t0.dmy },
    origin: merged.map(({ idx, r }) => [idx, r.line]),
    ax: merged.map(({ r }) => r.acc.ax),
    ay: merged.map(({ r }) => r.acc.ay),
    az: merged.map(({ r }) => r.acc.az),
    vel: group('vel'),
    disp: group('disp'),
    freq: group('freq'),
    temp: col('temperature_c'),
    lat: merged.map(({ r }) => r.lat),
    lon: merged.map(({ r }) => r.lon),
    gpsStatus: merged.map(({ r }) => r.gpsStatus),
    sensorId,
    issues,
    recoveryStats: stats,
  };
}
