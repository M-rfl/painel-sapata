// Pure module: no DOM/window. Filters are applied on top of analyze(); they never feed analyze, so priority and conforme stay full-run.
import { pointsByLocation } from './events.js';

/** Fill defaults: [] = all, null = unbounded. tFrom/tTo are elapsed ms (same basis as run.tMs). */
export function normalizeFilters(f) {
  const o = f || {};
  return {
    sentidos: o.sentidos ? Array.from(o.sentidos) : [],
    trechos: o.trechos ? Array.from(o.trechos) : [],
    eixos: o.eixos ? Array.from(o.eixos) : [],
    classes: o.classes ? Array.from(o.classes) : [],
    tFrom: o.tFrom ?? null,
    tTo: o.tTo ?? null,
  };
}

function isFilteredState(f) {
  return f.sentidos.length > 0 || f.trechos.length > 0 || f.eixos.length > 0
    || f.classes.length > 0 || f.tFrom !== null || f.tTo !== null;
}

/**
 * Row mask (1 = row passes every filter, AND semantics, empty selection = no constraint).
 * Runs without a `sentido` field (fromArrays) treat every row as sentido 0.
 * Unclassified rows (domAxis = -1, cls = -1) are excluded as soon as an eixo or classe filter is set.
 */
export function rowMask(run, analysis, filters) {
  const f = normalizeFilters(filters);
  const n = run.n;
  const mask = new Uint8Array(n);
  const sS = f.sentidos.length ? new Set(f.sentidos) : null;
  const sT = f.trechos.length ? new Set(f.trechos) : null;
  const sE = f.eixos.length ? new Set(f.eixos) : null;
  const sC = f.classes.length ? new Set(f.classes) : null;
  const { domAxis, cls } = analysis;
  const lo = f.tFrom;
  const hi = f.tTo;
  for (let i = 0; i < n; i++) {
    if (sS && !sS.has(run.sentido ? run.sentido[i] : 0)) continue;
    if (sT && !sT.has(run.trecho[i])) continue;
    if (sE && !sE.has(domAxis[i])) continue;
    if (sC && !sC.has(cls[i])) continue;
    if (lo !== null && run.tMs[i] < lo) continue;
    if (hi !== null && run.tMs[i] > hi) continue;
    mask[i] = 1;
  }
  return mask;
}

const pct = (counts) => {
  const total = counts.reduce((a, b) => a + b, 0);
  return counts.map((c) => (total ? c / total : 0));
};
const grid = (ncls) => Array.from({ length: ncls }, () => [0, 0, 0]);

/**
 * Filtered KPI view over an analyze() result. Never mutates analysis.
 * Percent denominators are the classified masked rows (resp. impacts / pontos);
 * nao classificadas are reported separately and excluded from classPct.
 * An impact belongs to its peak row (same rule as perTrecho).
 */
export function buildView(run, analysis, filters) {
  const f = normalizeFilters(filters);
  const mask = rowMask(run, analysis, f);
  const { ncls, cls, dom2, domAxis } = analysis;
  const nT = run.trechoNames.length;

  let registros = 0;
  let eventos = 0;
  let naoClassificadas = 0;
  const classCounts = new Array(ncls).fill(0);
  const eventosByTrecho = new Array(nT).fill(0);
  const axMed = grid(ncls);
  const maskedCls = new Int8Array(run.n).fill(-1);

  for (let i = 0; i < run.n; i++) {
    if (!mask[i]) continue;
    registros++;
    const c = cls[i];
    if (c < 0) { naoClassificadas++; continue; }
    maskedCls[i] = c;
    classCounts[c]++;
    axMed[c][domAxis[i]]++;
    if (c >= 1) {
      eventos++;
      eventosByTrecho[run.trecho[i]]++;
    }
  }

  const impacts = [];
  const impactsByClass = new Array(ncls).fill(0);
  const axImp = grid(ncls);
  for (const im of analysis.impacts) {
    if (!mask[im.peak]) continue;
    impacts.push(im);
    impactsByClass[im.cls]++;
    axImp[im.cls][domAxis[im.peak]]++;
  }

  const pointRows = pointsByLocation(dom2, maskedCls, run.locId, run.trecho);
  const pointsByClass = new Array(ncls).fill(0);
  const axPts = grid(ncls);
  for (const r of pointRows) {
    pointsByClass[cls[r]]++;
    axPts[cls[r]][domAxis[r]]++;
  }

  // argmax of masked events; ties -> lower route order (run.trechos[t].order) else lower idx.
  let topTrecho = null;
  if (eventos > 0) {
    const ord = (t) => (run.trechos && run.trechos[t] && run.trechos[t].order != null ? run.trechos[t].order : t);
    let best = -1;
    for (let t = 0; t < nT; t++) {
      if (eventosByTrecho[t] === 0) continue;
      if (best < 0 || eventosByTrecho[t] > eventosByTrecho[best]
        || (eventosByTrecho[t] === eventosByTrecho[best] && ord(t) < ord(best))) best = t;
    }
    topTrecho = { trecho: best, name: run.trechoNames[best], eventos: eventosByTrecho[best] };
  }

  return {
    filters: f, mask, registros, eventos, naoClassificadas,
    classCounts, classPct: pct(classCounts),
    impacts, impactos: impacts.length, impactsByClass, impactsPct: pct(impactsByClass),
    pointRows, pontos: pointRows.length, pointsByClass, pointsPct: pct(pointsByClass),
    axisByClass: { medicoes: axMed, impactos: axImp, pontos: axPts },
    eventosByTrecho, topTrecho, isFiltered: isFilteredState(f),
  };
}
