// Pure module: no DOM/window. Trecho x severidade matrix and its cell-click reducer.
import { normalizeFilters, rowMask } from './view.js';
import { pointsByLocation } from './events.js';

/** Row mask ignoring trecho/classe filters (the matrix shows every trecho and class). */
export function matrixMask(run, analysis, filters) {
  return rowMask(run, analysis, { ...normalizeFilters(filters), trechos: [], classes: [] });
}

export function buildMatrix(run, analysis, filters, basis) {
  if (basis !== 'medicoes' && basis !== 'impactos' && basis !== 'pontos') {
    throw new Error('matriz: base desconhecida ' + basis);
  }
  const { ncls, cls } = analysis;
  const nT = run.trechoNames.length;
  const mask = matrixMask(run, analysis, filters);
  const counts = Array.from({ length: nT }, () => new Array(ncls).fill(0));

  if (basis === 'medicoes') {
    for (let i = 0; i < run.n; i++) if (mask[i] && cls[i] >= 0) counts[run.trecho[i]][cls[i]]++;
  } else if (basis === 'impactos') {
    for (const im of analysis.impacts) if (mask[im.peak]) counts[run.trecho[im.peak]][im.cls]++;
  } else {
    const masked = new Int8Array(run.n).fill(-1);
    for (let i = 0; i < run.n; i++) if (mask[i]) masked[i] = cls[i];
    for (const r of pointsByLocation(analysis.dom2, masked, run.locId, run.trecho)) counts[run.trecho[r]][cls[r]]++;
  }

  const first = basis === 'medicoes' ? 0 : 1;
  const columns = [];
  for (let c = first; c < ncls; c++) columns.push(c);

  const blocks = run.sentidos
    ? run.sentidos.map((s, si) => ({
      sentido: si,
      name: s.name,
      idxs: run.trechos.map((t, idx) => ({ ...t, idx })).filter((t) => t.sentido === si)
        .sort((a, b) => a.order - b.order).map((t) => t.idx),
    }))
    : [{ sentido: 0, name: '', idxs: Array.from({ length: nT }, (_, i) => i) }];

  const colMax = new Array(ncls).fill(0);
  const sentidos = blocks.map((b) => ({
    sentido: b.sentido,
    name: b.name,
    rows: b.idxs.map((t) => {
      let total = 0;
      for (const c of columns) {
        total += counts[t][c];
        if (counts[t][c] > colMax[c]) colMax[c] = counts[t][c];
      }
      return { trecho: t, name: run.trechoNames[t], counts: counts[t], total };
    }),
  }));
  return { basis, columns, colMax, sentidos };
}

export function isCellSelected(filters, trecho, cls) {
  const f = normalizeFilters(filters);
  if (!f.trechos.length && !f.classes.length) return false;
  return (!f.trechos.length || f.trechos.includes(trecho)) && (!f.classes.length || f.classes.includes(cls));
}

export function cellClick(filters, trecho, cls, additive) {
  const f = normalizeFilters(filters);
  const only = f.trechos.length === 1 && f.classes.length === 1
    && f.trechos[0] === trecho && f.classes[0] === cls;
  if (!additive) {
    return only ? { trechos: [], classes: [] } : { trechos: [trecho], classes: [cls] };
  }
  const asc = (a, b) => a - b;
  return {
    trechos: [...new Set([...f.trechos, trecho])].sort(asc),
    classes: [...new Set([...f.classes, cls])].sort(asc),
  };
}
