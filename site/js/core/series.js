// Pure module: no DOM/window. Chart data for the uPlot panels (Phase 12).
import { axisConverters } from './stats.js';

export const SYNC_KEY = 'painel-corrida';

export const CHANNELS = [
  { key: 'vel', label: 'Velocidade', unit: 'mm/s' },
  { key: 'disp', label: 'Deslocamento', unit: 'µm' },
  { key: 'freq', label: 'Frequência', unit: 'Hz' },
  { key: 'temp', label: 'Temperatura', unit: '°C' },
];

/** Epoch milliseconds of a row. */
export function epochMs(run, row) {
  return run.t0Ms + (run.tMs[row] - run.tMs[0]);
}

/**
 * X axis (epoch seconds) with a synthetic entry inserted at every time gap > maxJumpMs.
 * rowOfIdx[idx] = row or -1 for synthetic entries; idxOfRow[row] = idx.
 */
export function chartFrame(run, maxJumpMs) {
  const n = run.n;
  const x = [];
  const rowOfIdx = [];
  const idxOfRow = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const e = epochMs(run, i) / 1000;
    if (i > 0 && run.tMs[i] - run.tMs[i - 1] > maxJumpMs) {
      x.push((x[x.length - 1] + e) / 2);
      rowOfIdx.push(-1);
    }
    idxOfRow[i] = x.length;
    x.push(e);
    rowOfIdx.push(i);
  }
  return { x, rowOfIdx: Int32Array.from(rowOfIdx), idxOfRow };
}

/** Series for axis k (0..2): all samples, filter-masked samples and isolated masked indices. */
export function axisSeries(run, analysis, mask, mode, k, frame) {
  const conv = axisConverters(analysis, mode)[k];
  const raw = [run.ax, run.ay, run.az][k];
  const vld = [run.axValid, run.ayValid, run.azValid][k] ?? run.valid;
  const len = frame.x.length;
  const all = new Array(len).fill(null);
  const masked = new Array(len).fill(null);
  for (let i = 0; i < run.n; i++) {
    if (!vld[i]) continue;
    const idx = frame.idxOfRow[i];
    const v = conv(raw[i]);
    all[idx] = v;
    if (!mask || mask[i]) masked[idx] = v;
  }
  const isolated = [];
  for (let i = 0; i < len; i++) {
    if (masked[i] === null) continue;
    if ((i === 0 || masked[i - 1] === null) && (i === len - 1 || masked[i + 1] === null)) isolated.push(i);
  }
  return { all, masked, isolated };
}

/** Threshold lines on the exact classification boundaries (2 per threshold, cls 1..ncls-1). */
export function thresholdLines(analysis, mode, k) {
  const base = mode === 'medido' ? analysis.off2[k] : 0;
  const out = [];
  for (let j = 0; j < analysis.ncls - 1; j++) {
    const t = analysis.th2[j];
    out.push({ cls: j + 1, value: (base + t) / 4096 });
    out.push({ cls: j + 1, value: (base - t) / 4096 });
  }
  return out;
}

/** Secondary channel series (vel/disp/freq: X/Y/Z; temp: 1) aligned on frame. */
export function channelSeries(run, key, frame) {
  const def = CHANNELS.find((c) => c.key === key);
  const ch = run.channels && run.channels[key];
  if (!def || !ch) return null;
  const names = key === 'temp' ? [['', 'v']] : [['X', 'x'], ['Y', 'y'], ['Z', 'z']];
  const series = [];
  for (const [name, prop] of names) {
    const src = ch[prop];
    if (!src) continue;
    const values = new Array(frame.x.length).fill(null);
    for (let i = 0; i < run.n; i++) {
      const v = src[i];
      if (v !== null && v !== undefined) values[frame.idxOfRow[i]] = v / ch.scale;
    }
    series.push({ name: name || def.label, values });
  }
  return { label: def.label, unit: def.unit, series };
}

/** Zoom window centred on a point (seconds). */
export function zoomWindow(xSec, half = 30) {
  return { min: xSec - half, max: xSec + half };
}

function stationCodes(t) {
  if (!t) return null;
  let parts = typeof t.id === 'string' ? t.id.split('-').map((s) => s.trim()).filter(Boolean) : [];
  if (parts.length < 2 && typeof t.name === 'string') {
    parts = t.name.split(' \u2013 ');
    if (parts.length < 2) parts = t.name.split('-');
    parts = parts.map((s) => s.trim()).filter(Boolean);
  }
  if (parts.length < 2) return null;
  return [parts[0], parts[parts.length - 1]];
}

/** Station boundary marks and per-trecho spans on the chart x axis (epoch seconds). */
export function stationMarks(run, frame) {
  const out = { marks: [], spans: [] };
  const trechos = run.trechos;
  if (!trechos || !run.trecho) return out;
  const valid = (v) => v >= 0 && v < trechos.length;
  const n = run.n;
  const starts = []; // { mark index, trecho }
  let lastTrecho = -1;
  for (let i = 0; i < n; i++) {
    const tr = run.trecho[i];
    if (!(i === 0 || tr !== run.trecho[i - 1]) || !valid(tr)) continue;
    const codes = stationCodes(trechos[tr]);
    if (!codes) continue;
    const x = frame.x[frame.idxOfRow[i]];
    const sc = i > 0 && !!run.sentido && run.sentido[i] !== run.sentido[i - 1];
    const prev = out.marks[out.marks.length - 1];
    if (prev && x <= prev.x) {
      prev.label = codes[0]; prev.row = i; prev.sentidoChange = prev.sentidoChange || sc;
      starts[starts.length - 1] = tr;
    } else {
      out.marks.push({ x, label: codes[0], row: i, sentidoChange: sc });
      starts.push(tr);
    }
    lastTrecho = tr;
  }
  if (!out.marks.length) return out;
  const endCodes = stationCodes(trechos[lastTrecho]);
  const endX = frame.x[frame.idxOfRow[n - 1]];
  const last = out.marks[out.marks.length - 1];
  if (endX > last.x) out.marks.push({ x: endX, label: endCodes[1], row: n - 1, sentidoChange: false });
  else last.label = endCodes[1];
  for (let j = 0; j < starts.length; j++) {
    const tr = starts[j];
    const next = out.marks[j + 1];
    out.spans.push({
      x0: out.marks[j].x, x1: next ? next.x : out.marks[j].x, trecho: tr,
      name: trechos[tr].name ?? (run.trechoNames && run.trechoNames[tr]) ?? '',
    });
  }
  return out;
}

/** Name of the trecho at a row, or null. */
export function trechoNameAt(run, row) {
  if (row == null || row < 0 || row >= run.n || !run.trecho) return null;
  const tr = run.trecho[row];
  if (tr < 0) return null;
  const t = run.trechos && run.trechos[tr];
  if (t && t.name) return t.name;
  const nm = run.trechoNames && run.trechoNames[tr];
  return nm || null;
}
