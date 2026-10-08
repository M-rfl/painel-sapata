// Pure module: no DOM/window; mirrors tools/dashboard_converter/analysis_ref.py.

/** Per-trecho aggregates, indexed by trecho idx. Impacts belong to the trecho of their peak row. */
export function perTrecho(run, cls, impacts, pointRows, dom2, ncls) {
  const nT = run.trechoNames.length;
  const out = Array.from({ length: nT }, () => ({
    records: 0, eventos: 0, impactos: 0, pontos: 0, maxCls: 0, topCount: 0, peakDom2: 0,
  }));
  for (let i = 0; i < run.n; i++) {
    const t = out[run.trecho[i]];
    if (!t) continue;
    t.records++;
    if (cls[i] >= 1) {
      t.eventos++;
      if (dom2[i] > t.peakDom2) t.peakDom2 = dom2[i];
    }
  }
  for (const im of impacts) {
    const t = out[run.trecho[im.peak]];
    if (!t) continue;
    t.impactos++;
    if (im.cls > t.maxCls) t.maxCls = im.cls;
    if (im.cls === ncls - 1) t.topCount++;
  }
  for (const r of pointRows) {
    const t = out[run.trecho[r]];
    if (t) t.pontos++;
  }
  return out;
}

function levelOf(maxCls, ncls) {
  if (maxCls === ncls - 1) return 1;
  if (maxCls === ncls - 2) return 2;
  if (maxCls === ncls - 3) return 3;
  return 4;
}

/** Impact-basis priority; full run only (filters never apply). Sorted level asc, topCount desc, peakDom2 desc, idx asc. */
export function trechoPriority(perT, names, ncls) {
  return perT
    .map((t, trecho) => ({
      trecho, name: names[trecho], level: levelOf(t.maxCls, ncls),
      maxCls: t.maxCls, topCount: t.topCount, peakDom2: t.peakDom2,
    }))
    .sort((a, b) => a.level - b.level || b.topCount - a.topCount
      || b.peakDom2 - a.peakDom2 || a.trecho - b.trecho);
}

/** Records and event rows per source-file region; null when region is unavailable. */
export function regionSplit(region, nRegions, cls) {
  if (!region) return null;
  const records = new Array(nRegions).fill(0);
  const eventos = new Array(nRegions).fill(0);
  for (let i = 0; i < region.length; i++) {
    records[region[i]]++;
    if (cls[i] >= 1) eventos[region[i]]++;
  }
  return { records, eventos };
}
