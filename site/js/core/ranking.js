// Pure module: no DOM/window. Trecho and ponto ranking rows (RANK-01, RANK-02).
import { rowMask, normalizeFilters } from './view.js';
import { pointsByLocation } from './events.js';
import { qualityIndex } from './quality_index.js';
import { googleMapsUrl } from './geo.js';
import { axisConverters } from './stats.js';
import { epochMs } from './series.js';
import { CLASS_NAMES } from './defaults.js';

export const AXIS_NAMES = ['X Longitudinal', 'Y Lateral', 'Z Vertical'];

// Same column keys as state.js RANK_SORT_KEYS (not imported: core stays independent of app).
const SORT_KEYS = ['hora', 'trecho', 'sentido', 'eixo', 'dom', 'ax', 'ay', 'az', 'cls', 'nImp'];

const sentidoName = (run, idx) => (run.sentidos && run.sentidos[idx] && run.sentidos[idx].name) || '—';

/** Trecho table rows in full-run priority order; counts follow every filter except trecho (which only marks rows). */
export function trechoRows(run, analysis, filters) {
  const f = normalizeFilters(filters);
  const mask = rowMask(run, analysis, { ...f, trechos: [] });
  const { ncls, cls, dom2 } = analysis;
  const nT = run.trechoNames.length;
  const top = ncls - 1;

  const classCounts = Array.from({ length: nT }, () => new Array(ncls).fill(0));
  const registros = new Array(nT).fill(0);
  const eventos = new Array(nT).fill(0);
  const impactos = new Array(nT).fill(0);
  const pontos = new Array(nT).fill(0);
  const maxCls = new Array(nT).fill(-1);
  const peak2 = new Array(nT).fill(-1);
  const topFull = new Array(nT).fill(0);
  const maskedCls = new Int8Array(run.n).fill(-1);

  for (let i = 0; i < run.n; i++) {
    if (cls[i] === top) topFull[run.trecho[i]]++;
    if (!mask[i]) continue;
    const t = run.trecho[i];
    registros[t]++;
    const c = cls[i];
    if (c < 0) continue;
    maskedCls[i] = c;
    classCounts[t][c]++;
    if (c > maxCls[t]) maxCls[t] = c;
    if (c >= 1) {
      eventos[t]++;
      if (dom2[i] > peak2[t]) peak2[t] = dom2[i];
    }
  }
  for (const im of analysis.impacts) if (mask[im.peak]) impactos[run.trecho[im.peak]]++;
  for (const r of pointsByLocation(dom2, maskedCls, run.locId, run.trecho)) pontos[run.trecho[r]]++;

  return analysis.priority.map((p) => {
    const t = p.trecho;
    const sIdx = run.trechos && run.trechos[t] ? run.trechos[t].sentido : 0;
    return {
      trecho: t, name: run.trechoNames[t], sentidoIdx: sIdx, sentido: sentidoName(run, sIdx),
      level: p.level, label: p.label,
      classCounts: classCounts[t], iq: qualityIndex(classCounts[t]),
      registros: registros[t], eventos: eventos[t], impactos: impactos[t], pontos: pontos[t],
      maxCls: maxCls[t], peakDom: peak2[t] >= 0 ? peak2[t] / 4096 : null,
      semCritico: topFull[t] === 0, selected: f.trechos.includes(t),
    };
  });
}

/** Every filtered ponto de impacto, worst |dom| first (ties: lower row), with sem-GPS pontos included. */
export function pontoRows(run, analysis, view) {
  const [cx, cy, cz] = axisConverters(analysis, 'dinamico');
  const keyOf = (r) => (run.locId[r] >= 0 ? run.locId[r] : -1 - run.trecho[r]);
  const nImp = new Map();
  for (const im of view.impacts) {
    const k = keyOf(im.peak);
    nImp.set(k, (nImp.get(k) || 0) + 1);
  }
  const rows = Array.from(view.pointRows).map((r) => {
    const f = run.fix[r];
    const hasGps = run.locId[r] >= 0 && f >= 0;
    const c = analysis.cls[r];
    const sIdx = run.sentido ? run.sentido[r] : 0;
    const eixo = analysis.domAxis[r];
    return {
      row: r, rank: 0, tEpochMs: epochMs(run, r), trechoIdx: run.trecho[r],
      trecho: run.trechoNames[run.trecho[r]], sentido: sentidoName(run, sIdx),
      eixo, eixoName: AXIS_NAMES[eixo], dom: analysis.dom2[r] / 4096,
      ax: cx(run.ax[r]), ay: cy(run.ay[r]), az: cz(run.az[r]),
      cls: c, className: CLASS_NAMES[c], nImp: nImp.get(keyOf(r)) || 0,
      url: hasGps ? googleMapsUrl(run.fixLat[f], run.fixLon[f]) : null,
      lat: hasGps ? run.fixLat[f] : null, lon: hasGps ? run.fixLon[f] : null,
    };
  });
  rows.sort((a, b) => (b.dom - a.dom) || (a.row - b.row));
  rows.forEach((x, i) => { x.rank = i + 1; });
  return rows;
}

export function topPontos(rows, n = 50) { return rows.slice(0, n); }

const ACCESS = {
  hora: (x) => x.tEpochMs, trecho: (x) => x.trecho, sentido: (x) => x.sentido, eixo: (x) => x.eixo,
  dom: (x) => x.dom, ax: (x) => x.ax, ay: (x) => x.ay, az: (x) => x.az, cls: (x) => x.cls, nImp: (x) => x.nImp,
};

/** New array sorted by column; ties fall back to rank ascending. */
export function sortPontos(rows, { col, dir }) {
  if (!SORT_KEYS.includes(col)) throw new Error(`coluna de ordenação desconhecida: ${col}`);
  const get = ACCESS[col];
  const sign = dir === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    const c = typeof va === 'string' ? va.localeCompare(vb, 'pt-BR') : va - vb;
    return c * sign || a.rank - b.rank;
  });
}
